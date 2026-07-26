#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局月度「工业生产者出厂价格」（PPI）。

用法：
  python scripts/crawl_nbs_ppi.py
  python scripts/crawl_nbs_ppi.py --backfill --no-latest

口径：全国 PPI 同比/环比；购进价格同比；非金属矿物制品业同比（建材相关分项）。
PPI / 建材出厂价 ≠ 房价均价、≠挂牌、≠70城指数。
"""
from __future__ import annotations

import argparse
import csv
import html
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

INDEX_URL = "https://www.stats.gov.cn/sj/"
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_ppi.csv"

# 2026-01 … 2026-06（与同日 CPI 稿相邻；1–3 月标题常为「降幅收窄/由降转涨」）
BACKFILL_URLS = [
    "https://www.stats.gov.cn/sj/zxfb/202602/t20260211_1962587.html",  # 1月
    "https://www.stats.gov.cn/sj/zxfb/202603/t20260309_1962729.html",  # 2月
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260410_1963263.html",  # 3月
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260511_1963658.html",  # 4月
    "https://www.stats.gov.cn/sj/zxfbhjd/202606/t20260610_1963922.html",  # 5月
    "https://www.stats.gov.cn/sj/zxfbhjd/202607/t20260709_1964083.html",  # 6月
]

FIELDS = [
    "month",
    "publish_date",
    "ppi_yoy_pct",
    "ppi_mom_pct",
    "purchase_yoy_pct",
    "non_metal_yoy_pct",
    "source_url",
]


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_cell = False
        self.in_row = False
        self.cell: list[str] = []
        self.row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "tr":
            self.in_row = True
            self.row = []
        elif self.in_row and tag in {"td", "th"}:
            self.in_cell = True
            self.cell = []

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self.in_cell:
            self.row.append(" ".join("".join(self.cell).split()))
            self.in_cell = False
        elif tag == "tr" and self.in_row:
            if self.row:
                self.rows.append(self.row)
            self.in_row = False


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.href = ""
        self.text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "a":
            self.href = dict(attrs).get("href", "")
            self.text = []

    def handle_data(self, data: str) -> None:
        if self.href:
            self.text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.href:
            self.links.append((self.href, " ".join("".join(self.text).split())))
            self.href = ""
            self.text = []


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "realty-app-data-refresh/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read().decode("utf-8", errors="replace")


def find_release(index_html: str) -> str:
    parser = LinkParser()
    parser.feed(index_html)
    for href, text in parser.links:
        if re.search(r"\d{4}年\d{1,2}月份工业生产者出厂价格同比", text) and re.search(
            r"t\d+_\d+\.html", href
        ):
            return urllib.parse.urljoin(INDEX_URL, html.unescape(href))
    raise RuntimeError("未在国家统计局数据首页找到工业生产者出厂价格发布页")


def fnum(s: str) -> float:
    return float(s.replace(",", "").replace(" ", "").replace("—", "-"))


def signed_from_lead(direction: str, pct: str) -> float:
    v = fnum(pct)
    return -v if direction in ("下降", "下跌", "回落") else v


def table_yoy(rows: list[list[str]], name: str) -> float | None:
    want = name.replace(" ", "")
    for row in rows:
        if not row:
            continue
        label = row[0].replace(" ", "")
        if label != want:
            continue
        if len(row) >= 3:
            return fnum(row[2])
    return None


def parse_release(url: str, body: str) -> dict[str, str | float]:
    plain = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", body)).split())
    publish_match = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)
    # 标题偶发不含「同比上涨/下降 X%」（如「降幅收窄」「由降转涨」），改从正文首句取
    period = re.search(r"(20\d{2})\s*年\s*(\d{1,2})\s*月份工业生产者出厂价格", plain)
    yoy = re.search(
        r"全国工业生产者出厂价格同比(上涨|下降|由.*?转为上涨|由.*?转为下降)\s*([\d.]+)\s*%",
        plain,
    )
    if not yoy:
        yoy = re.search(
            r"工业生产者出厂价格同比(上涨|下降)\s*([\d.]+)\s*%",
            plain,
        )
    if not period or not yoy or not publish_match:
        raise RuntimeError(f"PPI 页缺少期间或同比: {url}")

    year, month = int(period.group(1)), int(period.group(2))
    yoy_dir = yoy.group(1)
    if "转为上涨" in yoy_dir or yoy_dir == "上涨":
        ppi_yoy = fnum(yoy.group(2))
    elif "转为下降" in yoy_dir or yoy_dir == "下降":
        ppi_yoy = -fnum(yoy.group(2))
    else:
        ppi_yoy = signed_from_lead(yoy_dir, yoy.group(2))

    mom = re.search(
        r"全国工业生产者出厂价格同比.*?[；;]\s*环比(上涨|下降|持平)(?:\s*([\d.]+)\s*%)?",
        plain,
    )
    if not mom:
        mom = re.search(r"环比(上涨|下降|持平)(?:\s*([\d.]+)\s*%)?", plain)
    if mom and mom.group(1) == "持平":
        ppi_mom = 0.0
    elif mom and mom.group(2):
        ppi_mom = signed_from_lead(mom.group(1), mom.group(2))
    else:
        ppi_mom = 0.0

    parser = TableParser()
    parser.feed(body)
    purchase = table_yoy(parser.rows, "二、工业生产者购进价格")
    if purchase is None:
        purchase = table_yoy(parser.rows, "工业生产者购进价格")
    non_metal = table_yoy(parser.rows, "非金属矿物制品业")

    if purchase is None or non_metal is None:
        raise RuntimeError(f"PPI 表缺少购进或非金属矿物制品业同比: {url}")

    return {
        "month": f"{year}-{month:02d}",
        "publish_date": "-".join(publish_match.groups()),
        "ppi_yoy_pct": ppi_yoy,
        "ppi_mom_pct": ppi_mom,
        "purchase_yoy_pct": purchase,
        "non_metal_yoy_pct": non_metal,
        "source_url": url,
    }


def load_existing() -> dict[str, dict[str, str]]:
    if not OUTPUT.exists():
        return {}
    with OUTPUT.open(encoding="utf-8", newline="") as f:
        return {row["month"]: row for row in csv.DictReader(f) if row.get("month")}


def write_rows(by_month: dict[str, dict[str, str | float]]) -> None:
    ordered = sorted(
        by_month.values(),
        key=lambda r: str(r.get("month", "")),
        reverse=True,
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for row in ordered:
            writer.writerow({k: row.get(k, "") for k in FIELDS})


def merge_one(url: str, by_month: dict[str, dict[str, str | float]]) -> str:
    parsed = parse_release(url, fetch(url))
    month = str(parsed["month"])
    by_month[month] = parsed
    return month


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="")
    ap.add_argument("--backfill", action="store_true")
    ap.add_argument("--no-latest", action="store_true")
    args = ap.parse_args()

    by_month: dict[str, dict[str, str | float]] = {
        k: dict(v) for k, v in load_existing().items()
    }
    touched: list[str] = []

    if args.url:
        touched.append(merge_one(args.url, by_month))
    if args.backfill:
        for url in BACKFILL_URLS:
            try:
                touched.append(merge_one(url, by_month))
            except Exception as e:  # noqa: BLE001
                print(f"[warn] backfill skip {url}: {e}", file=sys.stderr)
    if not args.no_latest and not args.url:
        try:
            touched.append(merge_one(find_release(fetch(INDEX_URL)), by_month))
        except Exception as e:  # noqa: BLE001
            if not touched and not by_month:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_month:
        raise RuntimeError("无 PPI 数据可写")
    write_rows(by_month)
    print(f"wrote {OUTPUT} months={len(by_month)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局「全国固定资产投资基本情况」。

用法：
  python scripts/crawl_nbs_fa_investment.py
  python scripts/crawl_nbs_fa_investment.py --backfill --no-latest
  python scripts/crawl_nbs_fa_investment.py --url URL

口径：不含农户；绝对额亿元 + 同比；**≠城市挂牌/网签均价、≠70城、≠房开投资额**
（房开投资见 nbs_real_estate.csv）。表内通常无「房地产业」行。
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
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_fa_investment.csv"

BACKFILL_URLS_2026 = [
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260518_1963730.html",  # 1—4
    "https://www.stats.gov.cn/sj/zxfb/202606/t20260616_1963951.html",  # 1—5
    "https://www.stats.gov.cn/sj/zxfb/202607/t20260715_1964124.html",  # 1—6
]

FIELDS = [
    "period",
    "publish_date",
    "fa_cny_100m",
    "fa_yoy_pct",
    "private_yoy_pct",
    "state_yoy_pct",
    "primary_yoy_pct",
    "secondary_yoy_pct",
    "tertiary_yoy_pct",
    "manufacturing_yoy_pct",
    "equipment_yoy_pct",
    "ip_yoy_pct",
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
        if "全国固定资产投资基本情况" in text and re.search(r"t\d+_\d+\.html", href):
            return urllib.parse.urljoin(INDEX_URL, html.unescape(href))
    raise RuntimeError("未在国家统计局数据首页找到固定资产投资基本情况发布页")


def table_yoy(rows: list[list[str]], name: str) -> float:
    for row in rows:
        if len(row) >= 2 and row[0] == name:
            return float(row[1].replace(",", "").replace(" ", ""))
    raise RuntimeError(f"表中缺少指标：{name}")


def parse_release(url: str, body: str) -> dict[str, str | float]:
    plain = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", body)).split())
    title_match = re.search(
        r"(\d{4})年\s*1\s*[—－-]\s*(\d+)\s*月份全国固定资产投资基本情况", plain
    )
    publish_match = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)
    if not title_match or not publish_match:
        raise RuntimeError(f"国家统计局固投发布页缺少期间或发布日期: {url}")

    amount_match = re.search(
        r"固定资产投资（不含农户）\s*([\d,\s]+)\s*亿元", plain
    )
    if not amount_match:
        raise RuntimeError(f"固投发布页缺少累计绝对额: {url}")

    parser = TableParser()
    parser.feed(body)
    rows = parser.rows

    ip_match = re.search(r"知识产权产品投资同比增长\s*([\d.]+)\s*%", plain)
    ip_yoy = float(ip_match.group(1)) if ip_match else ""

    return {
        "period": f"{title_match.group(1)}-01_to_{title_match.group(1)}-{int(title_match.group(2)):02d}",
        "publish_date": "-".join(publish_match.groups()),
        "fa_cny_100m": float(amount_match.group(1).replace(",", "").replace(" ", "")),
        "fa_yoy_pct": table_yoy(rows, "固定资产投资（不含农户）"),
        "private_yoy_pct": table_yoy(rows, "其中：民间投资"),
        "state_yoy_pct": table_yoy(rows, "其中：国有控股"),
        "primary_yoy_pct": table_yoy(rows, "第一产业"),
        "secondary_yoy_pct": table_yoy(rows, "第二产业"),
        "tertiary_yoy_pct": table_yoy(rows, "第三产业"),
        "manufacturing_yoy_pct": table_yoy(rows, "制造业"),
        "equipment_yoy_pct": table_yoy(rows, "设备工器具购置"),
        "ip_yoy_pct": ip_yoy,
        "source_url": url,
    }


def load_existing() -> dict[str, dict[str, str]]:
    if not OUTPUT.exists():
        return {}
    with OUTPUT.open(encoding="utf-8", newline="") as f:
        return {row["period"]: row for row in csv.DictReader(f) if row.get("period")}


def write_rows(by_period: dict[str, dict[str, str | float]]) -> None:
    ordered = sorted(
        by_period.values(),
        key=lambda r: str(r.get("publish_date", "")),
        reverse=True,
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for row in ordered:
            writer.writerow({k: row.get(k, "") for k in FIELDS})


def merge_one(url: str, by_period: dict[str, dict[str, str | float]]) -> str:
    body = fetch(url)
    parsed = parse_release(url, body)
    period = str(parsed["period"])
    by_period[period] = parsed
    return period


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="", help="单篇发布页 URL")
    ap.add_argument("--backfill", action="store_true", help="回填已知 2026 归档")
    ap.add_argument("--no-latest", action="store_true", help="不从首页抓最新")
    args = ap.parse_args()

    by_period: dict[str, dict[str, str | float]] = {
        k: dict(v) for k, v in load_existing().items()
    }
    touched: list[str] = []

    if args.url:
        touched.append(merge_one(args.url, by_period))
    if args.backfill:
        for url in BACKFILL_URLS_2026:
            try:
                touched.append(merge_one(url, by_period))
            except Exception as e:
                print(f"[warn] backfill skip {url}: {e}", file=sys.stderr)
    if not args.no_latest and not args.url:
        try:
            latest = find_release(fetch(INDEX_URL))
            touched.append(merge_one(latest, by_period))
        except Exception as e:
            if not touched and not by_period:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_period:
        raise RuntimeError("无固投数据可写")

    write_rows(by_period)
    print(f"wrote {OUTPUT} periods={len(by_period)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

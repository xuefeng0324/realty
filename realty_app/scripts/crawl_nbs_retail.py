#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局月度「社会消费品零售总额」中与居住相关的限额以上商品类。

用法：
  python scripts/crawl_nbs_retail.py
  python scripts/crawl_nbs_retail.py --backfill --no-latest

口径：限额以上单位商品零售中的 **建筑及装潢材料类**、**家具类**（当月+累计）。
装潢/家具零售 ≠ 房价均价、≠挂牌、≠70城指数。
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
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_retail.csv"

# 2026 已发布期（含建筑及装潢材料类行）
BACKFILL_URLS = [
    "https://www.stats.gov.cn/sj/zxfb/202603/t20260316_1962786.html",  # 1—2（仅累计）
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963325.html",  # 3月 / 1—3
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260518_1963727.html",  # 4月 / 1—4
    "https://www.stats.gov.cn/sj/zxfb/202606/t20260616_1963949.html",  # 5月 / 1—5
    "https://www.stats.gov.cn/sj/zxfb/202607/t20260715_1964127.html",  # 6月 / 上半年
]

FIELDS = [
    "month",
    "publish_date",
    "retail_month_cny_100m",
    "retail_month_yoy_pct",
    "retail_cum_cny_100m",
    "retail_cum_yoy_pct",
    "building_month_cny_100m",
    "building_month_yoy_pct",
    "building_cum_cny_100m",
    "building_cum_yoy_pct",
    "furniture_month_cny_100m",
    "furniture_month_yoy_pct",
    "furniture_cum_cny_100m",
    "furniture_cum_yoy_pct",
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
        if "社会消费品零售总额" in text and re.search(r"t\d+_\d+\.html", href):
            return urllib.parse.urljoin(INDEX_URL, html.unescape(href))
    raise RuntimeError("未在国家统计局数据首页找到社会消费品零售总额发布页")


def fnum(s: str) -> float:
    return float(s.replace(",", "").replace(" ", "").replace("—", "-"))


def detect_month(plain: str, url: str) -> tuple[int, int]:
    """返回 (year, month)。优先正文「X月份，社会消费品零售总额」。"""
    m = re.search(r"(20\d{2})年\s*(\d{1,2})\s*月份[，,].{0,8}社会消费品零售总额", plain)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"(20\d{2})年\s*(\d{1,2})\s*月份社会消费品零售总额", plain)
    if m:
        return int(m.group(1)), int(m.group(2))
    # 上半年稿：取 6 月
    m = re.search(r"(20\d{2})年\s*上半年社会消费品零售总额", plain)
    if m:
        return int(m.group(1)), 6
    m = re.search(r"(20\d{2})年\s*1\s*[—－-]\s*(\d+)\s*月份社会消费品零售总额", plain)
    if m:
        return int(m.group(1)), int(m.group(2))
    raise RuntimeError(f"社消页缺少期间: {url}")


def table_row(rows: list[list[str]], name: str) -> list[str] | None:
    want = name.replace(" ", "")
    for row in rows:
        if not row:
            continue
        if row[0].replace(" ", "") == want and len(row) >= 3:
            return row
    return None


def split_metric(row: list[str]) -> tuple[float, float, float, float]:
    """返回 (当月额, 当月同比, 累计额, 累计同比)。1—2 月稿仅有累计两列时，当月=累计。"""
    if len(row) >= 5:
        return fnum(row[1]), fnum(row[2]), fnum(row[3]), fnum(row[4])
    # 仅累计：绝对量 | 同比增长
    cum_abs, cum_yoy = fnum(row[1]), fnum(row[2])
    return cum_abs, cum_yoy, cum_abs, cum_yoy


def parse_release(url: str, body: str) -> dict[str, str | float]:
    plain = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", body)).split())
    publish_match = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)
    if not publish_match:
        raise RuntimeError(f"社消页缺少发布日期: {url}")
    year, month = detect_month(plain, url)

    parser = TableParser()
    parser.feed(body)
    retail = table_row(parser.rows, "社会消费品零售总额")
    building = table_row(parser.rows, "建筑及装潢材料类")
    furniture = table_row(parser.rows, "家具类")
    if not retail or not building or not furniture:
        raise RuntimeError(f"社消表缺少总额/装潢/家具行: {url}")

    r_m, r_my, r_c, r_cy = split_metric(retail)
    b_m, b_my, b_c, b_cy = split_metric(building)
    f_m, f_my, f_c, f_cy = split_metric(furniture)

    return {
        "month": f"{year}-{month:02d}",
        "publish_date": "-".join(publish_match.groups()),
        "retail_month_cny_100m": r_m,
        "retail_month_yoy_pct": r_my,
        "retail_cum_cny_100m": r_c,
        "retail_cum_yoy_pct": r_cy,
        "building_month_cny_100m": b_m,
        "building_month_yoy_pct": b_my,
        "building_cum_cny_100m": b_c,
        "building_cum_yoy_pct": b_cy,
        "furniture_month_cny_100m": f_m,
        "furniture_month_yoy_pct": f_my,
        "furniture_cum_cny_100m": f_c,
        "furniture_cum_yoy_pct": f_cy,
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
        raise RuntimeError("无社消数据可写")
    write_rows(by_month)
    print(f"wrote {OUTPUT} months={len(by_month)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

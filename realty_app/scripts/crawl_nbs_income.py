#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局「居民收入和消费支出情况」。

用法：
  python scripts/crawl_nbs_income.py
  python scripts/crawl_nbs_income.py --backfill --no-latest

口径：人均可支配收入/消费（元）；居住消费 ≠ 房价均价/挂牌/70城。
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
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_income.csv"

BACKFILL_URLS = [
    # 2025
    "https://www.stats.gov.cn/sj/zxfb/202504/t20250416_1959322.html",  # 一季度
    "https://www.stats.gov.cn/sj/zxfb/202507/t20250715_1960406.html",  # 上半年
    "https://www.stats.gov.cn/sj/zxfb/202510/t20251020_1961604.html",  # 前三季度
    "https://www.stats.gov.cn/sj/zxfb/202601/t20260119_1962321.html",  # 全年
    # 2026
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963323.html",  # 一季度
    "https://www.stats.gov.cn/sj/zxfb/202607/t20260715_1964129.html",  # 上半年
]

FIELDS = [
    "period",
    "period_label",
    "publish_date",
    "sort_key",
    "disposable_yuan",
    "disposable_nominal_yoy_pct",
    "disposable_real_yoy_pct",
    "urban_disposable_yuan",
    "urban_nominal_yoy_pct",
    "urban_real_yoy_pct",
    "rural_disposable_yuan",
    "rural_nominal_yoy_pct",
    "rural_real_yoy_pct",
    "consumption_yuan",
    "consumption_nominal_yoy_pct",
    "consumption_real_yoy_pct",
    "housing_consumption_yuan",
    "housing_consumption_yoy_pct",
    "source_url",
]


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
        if "居民收入和消费支出情况" in text and re.search(r"t\d+_\d+\.html", href):
            return urllib.parse.urljoin(INDEX_URL, html.unescape(href))
    raise RuntimeError("未在国家统计局数据首页找到居民收入和消费支出发布页")


def fnum(s: str) -> float:
    return float(s.replace(",", "").replace(" ", ""))


def signed(direction: str, pct: str) -> float:
    v = fnum(pct)
    return -v if direction in ("下降", "减少") else v


def parse_period(plain: str, url: str) -> tuple[str, str, str]:
    publish_match = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)
    if not publish_match:
        raise RuntimeError(f"缺少发布日期: {url}")
    publish_date = "-".join(publish_match.groups())

    if re.search(r"上半年居民收入和消费支出情况", plain):
        y = int(publish_match.group(1))
        # 上半年发布通常在 7 月，年份取标题更稳
        ym = re.search(r"(20\d{2})\s*年上半年居民收入", plain)
        year = int(ym.group(1)) if ym else y
        return f"{year}_H1", f"{year}年上半年", f"{year}-06"
    if re.search(r"一季度居民收入和消费支出情况", plain):
        ym = re.search(r"(20\d{2})\s*年一季度居民收入", plain)
        year = int(ym.group(1)) if ym else int(publish_match.group(1))
        return f"{year}_Q1", f"{year}年一季度", f"{year}-03"
    if re.search(r"前三季度居民收入和消费支出情况", plain):
        ym = re.search(r"(20\d{2})\s*年前三季度居民收入", plain)
        year = int(ym.group(1)) if ym else int(publish_match.group(1))
        return f"{year}_Q3", f"{year}年前三季度", f"{year}-09"
    if re.search(r"(20\d{2})\s*年居民收入和消费支出情况", plain) and "上半年" not in plain[:200]:
        ym = re.search(r"(20\d{2})\s*年居民收入和消费支出情况", plain)
        year = int(ym.group(1)) if ym else int(publish_match.group(1))
        return f"{year}", f"{year}年", f"{year}-12"
    raise RuntimeError(f"无法识别居民收入期间: {url}")


def parse_release(url: str, body: str) -> dict[str, str | float]:
    plain = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", body)).split())
    period, period_label, sort_key = parse_period(plain, url)

    disp = re.search(
        r"全国居民人均可支配收入\s*([\d,\s]+)\s*元.*?名义增长\s*([\d.]+)\s*%.*?实际增长\s*([\d.]+)\s*%",
        plain,
    )
    urban = re.search(
        r"城镇居民人均可支配收入\s*([\d,\s]+)\s*元.*?增长.*?([\d.]+)\s*%.*?实际增长\s*([\d.]+)\s*%",
        plain,
    )
    rural = re.search(
        r"农村居民人均可支配收入\s*([\d,\s]+)\s*元.*?增长\s*([\d.]+)\s*%.*?实际增长\s*([\d.]+)\s*%",
        plain,
    )
    cons = re.search(
        r"全国居民人均消费支出\s*([\d,\s]+)\s*元.*?名义增长\s*([\d.]+)\s*%.*?实际增长\s*([\d.]+)\s*%",
        plain,
    )
    housing = re.search(
        r"人均居住消费支出\s*([\d,\s]+)\s*元[，,]?\s*(增长|下降)\s*([\d.]+)\s*%",
        plain,
    )
    if not disp or not urban or not rural or not cons or not housing:
        missing = [
            name
            for name, val in [
                ("可支配收入", disp),
                ("城镇", urban),
                ("农村", rural),
                ("消费支出", cons),
                ("居住消费", housing),
            ]
            if not val
        ]
        raise RuntimeError(f"居民收入页缺少字段 {','.join(missing)}: {url}")

    return {
        "period": period,
        "period_label": period_label,
        "publish_date": "-".join(re.search(r"/t(\d{4})(\d{2})(\d{2})_", url).groups()),  # type: ignore[union-attr]
        "sort_key": sort_key,
        "disposable_yuan": fnum(disp.group(1)),
        "disposable_nominal_yoy_pct": fnum(disp.group(2)),
        "disposable_real_yoy_pct": fnum(disp.group(3)),
        "urban_disposable_yuan": fnum(urban.group(1)),
        "urban_nominal_yoy_pct": fnum(urban.group(2)),
        "urban_real_yoy_pct": fnum(urban.group(3)),
        "rural_disposable_yuan": fnum(rural.group(1)),
        "rural_nominal_yoy_pct": fnum(rural.group(2)),
        "rural_real_yoy_pct": fnum(rural.group(3)),
        "consumption_yuan": fnum(cons.group(1)),
        "consumption_nominal_yoy_pct": fnum(cons.group(2)),
        "consumption_real_yoy_pct": fnum(cons.group(3)),
        "housing_consumption_yuan": fnum(housing.group(1)),
        "housing_consumption_yoy_pct": signed(housing.group(2), housing.group(3)),
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
        key=lambda r: str(r.get("sort_key", "")),
        reverse=True,
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for row in ordered:
            writer.writerow({k: row.get(k, "") for k in FIELDS})


def merge_one(url: str, by_period: dict[str, dict[str, str | float]]) -> str:
    parsed = parse_release(url, fetch(url))
    period = str(parsed["period"])
    by_period[period] = parsed
    return period


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="")
    ap.add_argument("--backfill", action="store_true")
    ap.add_argument("--no-latest", action="store_true")
    args = ap.parse_args()

    by_period: dict[str, dict[str, str | float]] = {
        k: dict(v) for k, v in load_existing().items()
    }
    touched: list[str] = []

    if args.url:
        touched.append(merge_one(args.url, by_period))
    if args.backfill:
        for url in BACKFILL_URLS:
            try:
                touched.append(merge_one(url, by_period))
            except Exception as e:  # noqa: BLE001
                print(f"[warn] backfill skip {url}: {e}", file=sys.stderr)
    if not args.no_latest and not args.url:
        try:
            touched.append(merge_one(find_release(fetch(INDEX_URL)), by_period))
        except Exception as e:  # noqa: BLE001
            if not touched and not by_period:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_period:
        raise RuntimeError("无居民收入数据可写")
    write_rows(by_period)
    print(f"wrote {OUTPUT} periods={len(by_period)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局月度「国民经济运行」通稿中的城镇调查失业率。

用法：
  python scripts/crawl_nbs_unemployment.py
  python scripts/crawl_nbs_unemployment.py --backfill --no-latest

口径：当月全国城镇调查失业率；1—N 月平均值；31 个大城市；企业就业人员周平均工时。
**失业率 / 工时 ≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**（就业景气弱相关）。
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

INDEX_URL = "https://www.stats.gov.cn/sj/zxfb/"
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_unemployment.csv"

BACKFILL_URLS = [
    "https://www.stats.gov.cn/sj/zxfb/202509/t20250915_1961181.html",  # 2025-08
    "https://www.stats.gov.cn/sj/zxfb/202511/t20251114_1961858.html",  # 2025-10
    "https://www.stats.gov.cn/sj/zxfb/202512/t20251215_1962075.html",  # 2025-11
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963330.html",  # 2026-03（一季度稿）
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260518_1963732.html",  # 2026-04
    "https://www.stats.gov.cn/sj/zxfb/202606/t20260616_1963954.html",  # 2026-05
]

FIELDS = [
    "month",
    "publish_date",
    "urban_rate_pct",
    "urban_avg_ytd_pct",
    "big31_rate_pct",
    "local_hukou_rate_pct",
    "migrant_rate_pct",
    "migrant_agri_rate_pct",
    "weekly_hours",
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
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read().decode("utf-8", errors="replace")


def plain_of(body: str) -> str:
    s = re.sub(r"<script[\s\S]*?</script>", " ", body, flags=re.I)
    s = re.sub(r"<style[\s\S]*?</style>", " ", s, flags=re.I)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).split())


def fnum(s: str) -> float:
    return float(s.replace(",", "").replace(" ", ""))


def _f(v: float | None) -> str:
    if v is None:
        return ""
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return f"{v:g}"


def parse_release(url: str, body: str) -> dict[str, str]:
    plain = plain_of(body)
    pub = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)
    if not pub:
        raise RuntimeError(f"缺发布日: {url}")
    pub_year, pub_month = int(pub.group(1)), int(pub.group(2))

    rate_m = re.search(
        r"(\d{1,2})\s*月份[，,]\s*全国城镇调查失业率为\s*([\d.]+)\s*%",
        plain,
    )
    if not rate_m:
        raise RuntimeError(f"缺当月城镇调查失业率: {url}")
    data_month = int(rate_m.group(1))
    urban = fnum(rate_m.group(2))
    year = pub_year if data_month <= pub_month else pub_year - 1

    avg_m = re.search(
        r"1\s*[—\-]\s*(\d{1,2})\s*月份[，,]\s*全国城镇调查失业率平均值为\s*([\d.]+)\s*%",
        plain,
    )
    big_m = re.search(r"31\s*个大城市城镇调查失业率为\s*([\d.]+)\s*%", plain)
    local_m = re.search(r"本地户籍劳动力调查失业率为\s*([\d.]+)\s*%", plain)
    migrant_m = re.search(r"外来户籍劳动力调查失业率为\s*([\d.]+)\s*%", plain)
    agri_m = re.search(r"外来农业户籍劳动力调查失业率为\s*([\d.]+)\s*%", plain)
    hours_m = re.search(r"周平均工作时间为\s*([\d.]+)\s*小时", plain)

    return {
        "month": f"{year}-{data_month:02d}",
        "publish_date": "-".join(pub.groups()),
        "urban_rate_pct": _f(urban),
        "urban_avg_ytd_pct": _f(fnum(avg_m.group(2))) if avg_m else "",
        "big31_rate_pct": _f(fnum(big_m.group(1))) if big_m else "",
        "local_hukou_rate_pct": _f(fnum(local_m.group(1))) if local_m else "",
        "migrant_rate_pct": _f(fnum(migrant_m.group(1))) if migrant_m else "",
        "migrant_agri_rate_pct": _f(fnum(agri_m.group(1))) if agri_m else "",
        "weekly_hours": _f(fnum(hours_m.group(1))) if hours_m else "",
        "source_url": url,
    }


def find_release() -> str:
    for i in range(0, 8):
        list_url = INDEX_URL if i == 0 else f"{INDEX_URL}index_{i}.html"
        parser = LinkParser()
        parser.feed(fetch(list_url))
        for href, text in parser.links:
            if "国民经济运行" not in text:
                continue
            if any(k in text for k in ("解读", "答记者", "英文", "新闻发布会答")):
                continue
            if not re.search(r"t\d+_\d+\.html", href):
                continue
            cand = urllib.parse.urljoin(list_url, html.unescape(href))
            # verify page has unemployment sentence
            try:
                parse_release(cand, fetch(cand))
            except Exception:  # noqa: BLE001
                continue
            return cand
    raise RuntimeError("未找到含城镇调查失业率的国民经济运行稿")


def load_existing() -> dict[str, dict[str, str]]:
    if not OUTPUT.exists():
        return {}
    with OUTPUT.open(encoding="utf-8", newline="") as f:
        return {row["month"]: row for row in csv.DictReader(f) if row.get("month")}


def write_rows(by_month: dict[str, dict[str, str]]) -> None:
    ordered = sorted(by_month.values(), key=lambda r: str(r.get("month", "")), reverse=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for row in ordered:
            writer.writerow({k: row.get(k, "") for k in FIELDS})


def merge_one(url: str, by_month: dict[str, dict[str, str]]) -> str:
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

    by_month: dict[str, dict[str, str]] = {k: dict(v) for k, v in load_existing().items()}
    touched: list[str] = []

    if args.url:
        touched.append(merge_one(args.url, by_month))
    if args.backfill:
        for url in BACKFILL_URLS:
            try:
                touched.append(merge_one(url, by_month))
                print(f"[ok] {touched[-1]} ← {url}")
            except Exception as e:  # noqa: BLE001
                print(f"[warn] backfill skip {url}: {e}", file=sys.stderr)
    if not args.no_latest and not args.url:
        try:
            latest = find_release()
            touched.append(merge_one(latest, by_month))
            print(f"[ok] latest {touched[-1]} ← {latest}")
        except Exception as e:  # noqa: BLE001
            if not touched and not by_month:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_month:
        raise RuntimeError("无失业率可写")
    write_rows(by_month)
    print(f"wrote {OUTPUT} months={len(by_month)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

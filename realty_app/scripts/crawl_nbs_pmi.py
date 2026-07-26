#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局月度「中国采购经理指数运行情况」。

用法：
  python scripts/crawl_nbs_pmi.py
  python scripts/crawl_nbs_pmi.py --backfill --no-latest

口径：制造业 PMI / 生产 / 新订单；非制造业商务活动；建筑业/服务业商务活动；综合 PMI 产出指数。
临界点 50：>50 扩张，<50 收缩。**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**（建筑业商务活动亦非房价）。
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
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_pmi.csv"

BACKFILL_URLS = [
    "https://www.stats.gov.cn/sj/zxfb/202601/t20260131_1962416.html",  # 1月
    "https://www.stats.gov.cn/sj/zxfb/202603/t20260304_1962699.html",  # 2月
    "https://www.stats.gov.cn/sj/zxfb/202603/t20260331_1962889.html",  # 3月
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260430_1963473.html",  # 4月
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260531_1963824.html",  # 5月
    "https://www.stats.gov.cn/sj/zxfb/202606/t20260630_1964032.html",  # 6月
]

FIELDS = [
    "month",
    "publish_date",
    "mfg_pmi",
    "production",
    "new_orders",
    "non_mfg_business",
    "construction_business",
    "services_business",
    "composite_pmi",
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


def fnum(s: str) -> float:
    return float(s.replace(",", "").replace(" ", ""))


def _f(v: float | None) -> str:
    if v is None:
        return ""
    return f"{v:g}"


def grab(plain: str, *patterns: str) -> float | None:
    for pat in patterns:
        m = re.search(pat, plain)
        if m:
            return fnum(m.group(1))
    return None


def parse_release(url: str, body: str) -> dict[str, str]:
    plain = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", body)).split())
    pub = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)

    mfg = grab(
        plain,
        r"制造业采购经理指数\s*[（(]\s*PMI\s*[）)]\s*为\s*([\d.]+)\s*%",
        r"制造业采购经理指数为\s*([\d.]+)\s*%",
        r"制造业采购经理指数.{0,24}为\s*([\d.]+)\s*%",
    )
    if mfg is None:
        raise RuntimeError(f"缺少制造业 PMI: {url}")

    # 期间：优先标题/正文「2026年6月…」；否则「6月份，制造业…」
    title = re.search(r"(20\d{2})\s*年\s*(\d{1,2})\s*月.*?采购经理指数", plain)
    if title:
        year, month = int(title.group(1)), int(title.group(2))
    else:
        m2 = re.search(r"(\d{1,2})\s*月份[，,]\s*制造业采购经理指数", plain)
        if not m2 or not pub:
            raise RuntimeError(f"PMI 页缺少期间: {url}")
        year, month = int(pub.group(1)), int(m2.group(1))
        if int(pub.group(2)) == 1 and month == 12:
            year -= 1

    production = grab(plain, r"生产指数为\s*([\d.]+)\s*%")
    new_orders = grab(plain, r"新订单指数为\s*([\d.]+)\s*%")
    non_mfg = grab(plain, r"非制造业商务活动指数为\s*([\d.]+)\s*%")
    construction = grab(plain, r"建筑业商务活动指数为\s*([\d.]+)\s*%")
    services = grab(plain, r"服务业商务活动指数为\s*([\d.]+)\s*%")
    composite = grab(
        plain,
        r"综合\s*PMI\s*产出指数为\s*([\d.]+)\s*%",
        r"综合PMI产出指数为\s*([\d.]+)\s*%",
    )

    return {
        "month": f"{year}-{month:02d}",
        "publish_date": "-".join(pub.groups()) if pub else "",
        "mfg_pmi": _f(mfg),
        "production": _f(production),
        "new_orders": _f(new_orders),
        "non_mfg_business": _f(non_mfg),
        "construction_business": _f(construction),
        "services_business": _f(services),
        "composite_pmi": _f(composite),
        "source_url": url,
    }


def find_release(index_html: str) -> str:
    parser = LinkParser()
    parser.feed(index_html)
    for href, text in parser.links:
        if "采购经理指数运行情况" in text and re.search(r"t\d+_\d+\.html", href):
            if any(k in text for k in ("解读", "答记者")):
                continue
            return urllib.parse.urljoin(INDEX_URL, html.unescape(href))
    # 备选 zxfb 列表
    alt = fetch("https://www.stats.gov.cn/sj/zxfb/")
    parser2 = LinkParser()
    parser2.feed(alt)
    for href, text in parser2.links:
        if "采购经理指数运行情况" in text and re.search(r"t\d+_\d+\.html", href):
            if any(k in text for k in ("解读", "答记者")):
                continue
            return urllib.parse.urljoin("https://www.stats.gov.cn/sj/zxfb/", html.unescape(href))
    raise RuntimeError("未找到采购经理指数运行情况发布页")


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
            latest = find_release(fetch(INDEX_URL))
            touched.append(merge_one(latest, by_month))
            print(f"[ok] latest {touched[-1]} ← {latest}")
        except Exception as e:  # noqa: BLE001
            if not touched and not by_month:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_month:
        raise RuntimeError("无 PMI 数据可写")
    write_rows(by_month)
    print(f"wrote {OUTPUT} months={len(by_month)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

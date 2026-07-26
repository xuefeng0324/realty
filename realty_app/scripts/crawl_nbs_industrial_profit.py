#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局「全国规模以上工业企业利润」累计通稿。

用法：
  python scripts/crawl_nbs_industrial_profit.py
  python scripts/crawl_nbs_industrial_profit.py --backfill --no-latest

口径：累计利润总额（亿元）及同比；营收（万亿元）及同比；营收利润率；采矿/制造/公用分项利润同比。
通常滞后约一个月发布。**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**。
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

ZXFB_URL = "https://www.stats.gov.cn/sj/zxfb/"
ZXFBHJD_URL = "https://www.stats.gov.cn/sj/zxfbhjd/"
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_industrial_profit.csv"

BACKFILL_URLS = [
    "https://www.stats.gov.cn/sj/zxfb/202603/t20260327_1962868.html",  # 1—2
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260427_1963403.html",  # 1—3
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260527_1963808.html",  # 1—4
    "https://www.stats.gov.cn/sj/zxfbhjd/202606/t20260627_1964019.html",  # 1—5
]

FIELDS = [
    "month",
    "publish_date",
    "profit_yi",
    "profit_yoy_pct",
    "revenue_wan_yi",
    "revenue_yoy_pct",
    "margin_pct",
    "mining_yoy_pct",
    "manufacturing_yoy_pct",
    "utilities_yoy_pct",
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
    return f"{v:g}"


def parse_release(url: str, body: str) -> dict[str, str]:
    plain = plain_of(body)
    pub = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)

    title = re.search(
        r"(20\d{2})\s*年\s*1\s*[—\-]\s*(\d{1,2})\s*月份.*?规模以上工业企业利润",
        plain,
    )
    if title:
        year, month = int(title.group(1)), int(title.group(2))
    else:
        # 全年年报：记为 12 月
        annual = re.search(r"(20\d{2})\s*年全国规模以上工业企业利润", plain)
        if annual:
            year, month = int(annual.group(1)), 12
        elif pub:
            year = int(pub.group(1))
            month = int(pub.group(2)) - 1
            if month <= 0:
                year -= 1
                month = 12
        else:
            raise RuntimeError(f"缺少期间: {url}")

    pm = re.search(
        r"实现利润总额\s*([\d.]+)\s*亿元[，,]\s*同比增长\s*([\-\d.]+)\s*%",
        plain,
    )
    if not pm:
        pm = re.search(
            r"实现利润总额\s*([\d.]+)\s*亿元[，,]\s*同比下降\s*([\d.]+)\s*%",
            plain,
        )
        if not pm:
            raise RuntimeError(f"缺少利润总额: {url}")
        profit_yi, profit_yoy = fnum(pm.group(1)), -fnum(pm.group(2))
    else:
        profit_yi, profit_yoy = fnum(pm.group(1)), fnum(pm.group(2))

    rv = re.search(
        r"实现营业收入\s*([\d.]+)\s*万亿元[，,]\s*同比增长\s*([\-\d.]+)\s*%",
        plain,
    )
    if not rv:
        rv = re.search(
            r"实现营业收入\s*([\d.]+)\s*万亿元[，,]\s*同比下降\s*([\d.]+)\s*%",
            plain,
        )
        revenue_wan = fnum(rv.group(1)) if rv else None
        revenue_yoy = -fnum(rv.group(2)) if rv else None
    else:
        revenue_wan, revenue_yoy = fnum(rv.group(1)), fnum(rv.group(2))

    margin = None
    mm = re.search(r"营业收入利润率为\s*([\d.]+)\s*%", plain)
    if mm:
        margin = fnum(mm.group(1))

    mining = None
    m = re.search(
        r"采矿业实现利润总额\s*[\d.]+\s*亿元[，,]\s*同比增长\s*([\-\d.]+)\s*%",
        plain,
    )
    if m:
        mining = fnum(m.group(1))
    else:
        m = re.search(
            r"采矿业实现利润总额\s*[\d.]+\s*亿元[，,]\s*同比下降\s*([\d.]+)\s*%",
            plain,
        )
        if m:
            mining = -fnum(m.group(1))

    mfg = None
    m = re.search(
        r"制造业实现利润总额\s*[\d.]+\s*亿元[，,]\s*同比增长\s*([\-\d.]+)\s*%",
        plain,
    )
    if m:
        mfg = fnum(m.group(1))
    else:
        m = re.search(
            r"制造业实现利润总额\s*[\d.]+\s*亿元[，,]\s*(?:增长|同比下降)\s*([\d.]+)\s*%",
            plain,
        )
        if m:
            # 「增长」positive；「下降」negative — detect from nearby
            chunk = plain[m.start() - 5 : m.end()]
            mfg = -fnum(m.group(1)) if "下降" in chunk else fnum(m.group(1))

    util = None
    m = re.search(
        r"电力[、,].{0,40}实现利润总额\s*[\d.]+\s*亿元[，,]\s*增长\s*([\-\d.]+)\s*%",
        plain,
    )
    if m:
        util = fnum(m.group(1))
    else:
        m = re.search(
            r"电力[、,].{0,40}实现利润总额\s*[\d.]+\s*亿元[，,]\s*下降\s*([\d.]+)\s*%",
            plain,
        )
        if m:
            util = -fnum(m.group(1))

    return {
        "month": f"{year}-{month:02d}",
        "publish_date": "-".join(pub.groups()) if pub else "",
        "profit_yi": _f(profit_yi),
        "profit_yoy_pct": _f(profit_yoy),
        "revenue_wan_yi": _f(revenue_wan),
        "revenue_yoy_pct": _f(revenue_yoy),
        "margin_pct": _f(margin),
        "mining_yoy_pct": _f(mining),
        "manufacturing_yoy_pct": _f(mfg),
        "utilities_yoy_pct": _f(util),
        "source_url": url,
    }


def _pick_from_list(list_url: str) -> str | None:
    parser = LinkParser()
    parser.feed(fetch(list_url))
    for href, text in parser.links:
        if "规模以上工业企业利润" not in text:
            continue
        if any(k in text for k in ("解读", "答记者", "英文")):
            continue
        if not re.search(r"t\d+_\d+\.html", href):
            continue
        return urllib.parse.urljoin(list_url, html.unescape(href))
    return None


def find_release() -> str:
    for base in (ZXFBHJD_URL, ZXFB_URL):
        for i in range(0, 4):
            list_url = base if i == 0 else f"{base}index_{i}.html"
            try:
                found = _pick_from_list(list_url)
            except Exception:  # noqa: BLE001
                continue
            if found:
                return found
    raise RuntimeError("未找到规模以上工业企业利润发布页")


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
        raise RuntimeError("无工业企业利润可写")
    write_rows(by_month)
    print(f"wrote {OUTPUT} months={len(by_month)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

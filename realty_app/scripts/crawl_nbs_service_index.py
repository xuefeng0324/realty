#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局月度「国民经济运行」通稿中的服务业生产指数。

用法：
  python scripts/crawl_nbs_service_index.py
  python scripts/crawl_nbs_service_index.py --backfill --no-latest

口径：当月全国服务业生产指数同比；1—N 月累计同比；分项 IT / 租赁商务 / 金融（及可选交运）。
**服务业生产指数 ≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**；租赁商务为住房弱相关。
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
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_service_index.csv"

BACKFILL_URLS = [
    "https://www.stats.gov.cn/sj/zxfb/202509/t20250915_1961181.html",  # 2025-08
    "https://www.stats.gov.cn/sj/zxfb/202511/t20251114_1961858.html",  # 2025-10
    "https://www.stats.gov.cn/sj/zxfb/202512/t20251215_1962075.html",  # 2025-11
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963330.html",  # 2026-03
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260518_1963732.html",  # 2026-04
    "https://www.stats.gov.cn/sj/zxfb/202606/t20260616_1963954.html",  # 2026-05
]

FIELDS = [
    "month",
    "publish_date",
    "index_yoy_pct",
    "index_ytd_yoy_pct",
    "it_yoy_pct",
    "leasing_yoy_pct",
    "finance_yoy_pct",
    "transport_yoy_pct",
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


def signed_yoy(direction: str, pct: str) -> float:
    v = fnum(pct)
    return -v if direction in ("下降", "减少", "回落") else v


def month_spi_match(plain: str) -> re.Match[str] | None:
    """当月句；跳过「1—N 月份」累计句。"""
    pat = r"(\d{1,2})\s*月份[，,]\s*全国服务业生产指数同比(增长|下降)\s*([\d.]+)\s*%"
    for m in re.finditer(pat, plain):
        before = plain[max(0, m.start() - 12) : m.start()]
        if re.search(r"1\s*[—\-]\s*$", before):
            continue
        return m
    return None


def parse_release(url: str, body: str) -> dict[str, str]:
    plain = plain_of(body)
    pub = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)
    if not pub:
        raise RuntimeError(f"缺发布日: {url}")
    pub_year, pub_month = int(pub.group(1)), int(pub.group(2))

    month_m = month_spi_match(plain)
    if not month_m:
        raise RuntimeError(f"缺当月服务业生产指数: {url}")
    data_month = int(month_m.group(1))
    index_yoy = signed_yoy(month_m.group(2), month_m.group(3))
    year = pub_year if data_month <= pub_month else pub_year - 1

    ytd_m = re.search(
        r"1\s*[—\-]\s*(\d{1,2})\s*月份[，,]\s*全国服务业生产指数同比(增长|下降)\s*([\d.]+)\s*%",
        plain,
    )
    # 分行业：IT、租赁商务、金融、[交运]
    ind_m = re.search(
        r"信息传输、软件和信息技术服务业[，,]\s*租赁和商务服务业[，,]\s*金融业"
        r"(?:[，,]\s*交通运输、仓储和邮政业)?生产指数同比分别增长\s*"
        r"([\d.]+)\s*%\s*[、,]\s*([\d.]+)\s*%\s*[、,]\s*([\d.]+)\s*%"
        r"(?:\s*[、,]\s*([\d.]+)\s*%)?",
        plain,
    )

    return {
        "month": f"{year}-{data_month:02d}",
        "publish_date": "-".join(pub.groups()),
        "index_yoy_pct": _f(index_yoy),
        "index_ytd_yoy_pct": _f(signed_yoy(ytd_m.group(2), ytd_m.group(3))) if ytd_m else "",
        "it_yoy_pct": _f(fnum(ind_m.group(1))) if ind_m else "",
        "leasing_yoy_pct": _f(fnum(ind_m.group(2))) if ind_m else "",
        "finance_yoy_pct": _f(fnum(ind_m.group(3))) if ind_m else "",
        "transport_yoy_pct": _f(fnum(ind_m.group(4))) if ind_m and ind_m.group(4) else "",
        "source_url": url,
    }


def find_release() -> str:
    for i in range(0, 8):
        list_url = INDEX_URL if i == 0 else f"{INDEX_URL}index_{i}.html"
        parser = LinkParser()
        parser.feed(fetch(list_url))
        for href, text in parser.links:
            if "国民经济运行" not in text and "国民经济" not in text:
                continue
            if any(k in text for k in ("解读", "答记者", "英文", "新闻发布会答")):
                continue
            if not re.search(r"t\d+_\d+\.html", href):
                continue
            cand = urllib.parse.urljoin(list_url, html.unescape(href))
            try:
                parse_release(cand, fetch(cand))
            except Exception:  # noqa: BLE001
                continue
            return cand
    raise RuntimeError("未找到含服务业生产指数的国民经济运行稿")


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
        raise RuntimeError("无服务业生产指数可写")
    write_rows(by_month)
    print(f"wrote {OUTPUT} months={len(by_month)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

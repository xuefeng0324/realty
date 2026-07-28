#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局月度「能源生产情况」。

用法：
  python scripts/crawl_nbs_energy.py
  python scripts/crawl_nbs_energy.py --backfill --no-latest

口径：规上工业原煤 / 原油 / 天然气 / 发电量当月（或 1—N 累计期）同比。
**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**（能源产量为宏观景气弱相关）。
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
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_energy.csv"

BACKFILL_URLS = [
    "https://www.stats.gov.cn/sj/zxfb/202603/t20260316_1962787.html",  # 1—2
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963324.html",  # 3
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260518_1963725.html",  # 4
    "https://www.stats.gov.cn/sj/zxfb/202606/t20260616_1963948.html",  # 5
    "https://www.stats.gov.cn/sj/zxfb/202607/t20260715_1964128.html",  # 6
]

FIELDS = [
    "month",
    "publish_date",
    "coal_yi_t",
    "coal_yoy_pct",
    "oil_wan_t",
    "oil_yoy_pct",
    "gas_yi_m3",
    "gas_yoy_pct",
    "power_yi_kwh",
    "power_yoy_pct",
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


def signed_yoy(direction: str, pct: str | None) -> float:
    if direction == "持平":
        return 0.0
    if not pct:
        raise ValueError(f"missing pct for {direction}")
    v = fnum(pct)
    return -v if direction in ("下降", "减少", "回落") else v


def first_period_match(
    plain: str, pattern: str, *, allow_cum_lead: bool
) -> re.Match[str] | None:
    """Prefer 当月句；单月稿跳过「1—N 月份」累计句；1—N 稿则保留。"""
    for m in re.finditer(pattern, plain):
        before = plain[max(0, m.start() - 36) : m.start()]
        if (not allow_cum_lead) and re.search(r"1\s*[—\-]\s*\d{1,2}\s*月份", before):
            continue
        return m
    return None


def parse_release(url: str, body: str) -> dict[str, str]:
    plain = plain_of(body)
    pub = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)

    title_single = re.search(r"(20\d{2})\s*年\s*(\d{1,2})\s*月份能源生产情况", plain)
    title_cum = re.search(r"(20\d{2})\s*年\s*1\s*[—\-]\s*(\d{1,2})\s*月份能源生产情况", plain)

    if title_single:
        year, month = int(title_single.group(1)), int(title_single.group(2))
        allow_cum_lead = False
    elif title_cum:
        year, month = int(title_cum.group(1)), int(title_cum.group(2))
        allow_cum_lead = True
    elif pub:
        year = int(pub.group(1))
        month = int(pub.group(2)) - 1
        if month <= 0:
            year -= 1
            month = 12
        allow_cum_lead = False
    else:
        raise RuntimeError(f"缺少期间: {url}")

    coal_m = first_period_match(
        plain,
        r"原煤产量\s*([\d.]+)\s*(亿吨|万吨)，同比(增长|下降|持平)(?:\s*([\d.]+)\s*%)?",
        allow_cum_lead=allow_cum_lead,
    )
    oil_m = first_period_match(
        plain,
        r"原油产量\s*([\d.]+)\s*万吨，同比(增长|下降|持平)(?:\s*([\d.]+)\s*%)?",
        allow_cum_lead=allow_cum_lead,
    )
    gas_m = first_period_match(
        plain,
        r"天然气产量\s*([\d.]+)\s*亿立方米，同比(增长|下降|持平)(?:\s*([\d.]+)\s*%)?",
        allow_cum_lead=allow_cum_lead,
    )
    power_m = first_period_match(
        plain,
        r"(?:规模以上工业)?发电量\s*([\d.]+)\s*亿千瓦时，同比(增长|下降|持平)(?:\s*([\d.]+)\s*%)?",
        allow_cum_lead=allow_cum_lead,
    )

    if not coal_m or not oil_m or not gas_m or not power_m:
        raise RuntimeError(f"能源页缺少原煤/原油/天然气/发电量: {url}")

    coal_amt = fnum(coal_m.group(1))
    if coal_m.group(2) == "万吨":
        coal_amt = coal_amt / 10000.0

    return {
        "month": f"{year}-{month:02d}",
        "publish_date": "-".join(pub.groups()) if pub else "",
        "coal_yi_t": _f(coal_amt),
        "coal_yoy_pct": _f(signed_yoy(coal_m.group(3), coal_m.group(4))),
        "oil_wan_t": _f(fnum(oil_m.group(1))),
        "oil_yoy_pct": _f(signed_yoy(oil_m.group(2), oil_m.group(3))),
        "gas_yi_m3": _f(fnum(gas_m.group(1))),
        "gas_yoy_pct": _f(signed_yoy(gas_m.group(2), gas_m.group(3))),
        "power_yi_kwh": _f(fnum(power_m.group(1))),
        "power_yoy_pct": _f(signed_yoy(power_m.group(2), power_m.group(3))),
        "source_url": url,
    }


def find_release() -> str:
    for i in range(0, 5):
        list_url = INDEX_URL if i == 0 else f"{INDEX_URL}index_{i}.html"
        parser = LinkParser()
        parser.feed(fetch(list_url))
        for href, text in parser.links:
            if "能源生产情况" not in text:
                continue
            if any(k in text for k in ("解读", "答记者", "英文")):
                continue
            if not re.search(r"t\d+_\d+\.html", href):
                continue
            return urllib.parse.urljoin(list_url, html.unescape(href))
    raise RuntimeError("未找到能源生产情况发布页")


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
        raise RuntimeError("无能源生产可写")
    write_rows(by_month)
    print(f"wrote {OUTPUT} months={len(by_month)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

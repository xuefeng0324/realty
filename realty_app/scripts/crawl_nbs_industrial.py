#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局「规模以上工业增加值」月度通稿。

用法：
  python scripts/crawl_nbs_industrial.py
  python scripts/crawl_nbs_industrial.py --backfill --no-latest

口径：规上工业增加值当月同比 / 环比 / 累计同比；采矿业 / 制造业 / 公用事业分项同比；
附「主要产品产量」表中的 **水泥 / 平板玻璃 / 钢材 / 粗钢**（建材弱相关）。
**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**。
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
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_industrial.csv"

BACKFILL_URLS = [
    "https://www.stats.gov.cn/sj/zxfb/202603/t20260316_1962782.html",  # 1—2
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963329.html",  # 3月
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260518_1963731.html",  # 1—4（含4月当月）
    "https://www.stats.gov.cn/sj/zxfb/202606/t20260616_1963953.html",  # 5月
    "https://www.stats.gov.cn/sj/zxfb/202607/t20260715_1964123.html",  # 6月
]

FIELDS = [
    "month",
    "publish_date",
    "yoy_pct",
    "mom_pct",
    "ytd_yoy_pct",
    "mining_yoy_pct",
    "manufacturing_yoy_pct",
    "utilities_yoy_pct",
    "cement_wan_t",
    "cement_yoy_pct",
    "cement_ytd_yoy_pct",
    "flat_glass_wan_weight_box",
    "flat_glass_yoy_pct",
    "steel_wan_t",
    "steel_yoy_pct",
    "crude_steel_wan_t",
    "crude_steel_yoy_pct",
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


def signed_sector(plain: str, name: str) -> float | None:
    m = re.search(rf"{name}增加值同比下降\s*([\d.]+)\s*%", plain)
    if m:
        return -fnum(m.group(1))
    m = re.search(rf"{name}增加值同比增长\s*([\-\d.]+)\s*%", plain)
    if m:
        return fnum(m.group(1))
    m = re.search(rf"{name}增长\s*([\-\d.]+)\s*%", plain)
    if m:
        return fnum(m.group(1))
    m = re.search(rf"{name}下降\s*([\d.]+)\s*%", plain)
    if m:
        return -fnum(m.group(1))
    return None


def month_yoy(plain: str) -> tuple[int | None, float | None]:
    """Prefer single-month sentence; skip『1—N 月份』累计句。"""
    for m in re.finditer(
        r"(\d{1,2})\s*月份[，,]\s*规模以上工业增加值同比(?:实际)?增长\s*([\-\d.]+)\s*%",
        plain,
    ):
        before = plain[max(0, m.start() - 10) : m.start()]
        if re.search(r"1\s*[—\-]\s*$", before):
            continue
        return int(m.group(1)), fnum(m.group(2))
    m = re.search(
        r"规模以上工业增加值同比实际增长\s*([\-\d.]+)\s*%",
        plain,
    )
    if m:
        return None, fnum(m.group(1))
    return None, None


def product_table(
    plain: str, name: str
) -> tuple[float | None, float | None, float | None, float | None]:
    """解析「主要产品产量」表一行：当月产量、当月同比%、累计产量、累计同比%。"""
    m = re.search(
        rf"{re.escape(name)}（[^）]+）\s*([\d.]+)\s+([\-\d.]+)\s+([\d.]+)\s+([\-\d.]+)",
        plain,
    )
    if not m:
        return None, None, None, None
    return fnum(m.group(1)), fnum(m.group(2)), fnum(m.group(3)), fnum(m.group(4))


def parse_release(url: str, body: str) -> dict[str, str]:
    plain = plain_of(body)
    pub = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)

    title_single = re.search(r"(20\d{2})\s*年\s*(\d{1,2})\s*月份规模以上工业增加值", plain)
    title_cum = re.search(r"(20\d{2})\s*年\s*1\s*[—\-]\s*(\d{1,2})\s*月份规模以上工业增加值", plain)

    if title_single:
        year, month = int(title_single.group(1)), int(title_single.group(2))
    elif title_cum:
        year, month = int(title_cum.group(1)), int(title_cum.group(2))
    elif pub:
        year = int(pub.group(1))
        month = int(pub.group(2)) - 1
        if month <= 0:
            year -= 1
            month = 12
    else:
        raise RuntimeError(f"缺少期间: {url}")

    my, yoy = month_yoy(plain)
    if my is not None:
        month = my
        # 跨年：发布在 1 月、正文 12 月
        if pub and int(pub.group(2)) == 1 and month == 12:
            year = int(pub.group(1)) - 1

    if yoy is None:
        raise RuntimeError(f"缺少当月/期同比: {url}")

    mom = None
    mm = re.search(
        r"(\d{1,2})\s*月份[，,].{0,40}比上月增长\s*([\-\d.]+)\s*%",
        plain,
    )
    if mm:
        before = plain[max(0, mm.start() - 10) : mm.start()]
        if not re.search(r"1\s*[—\-]\s*$", before):
            mom = fnum(mm.group(2))
    if mom is None:
        mm = re.search(r"比上月增长\s*([\-\d.]+)\s*%", plain)
        if mm:
            mom = fnum(mm.group(1))

    ytd = None
    ym = re.search(
        r"1\s*[—\-]\s*(\d{1,2})\s*月份[，,]\s*规模以上工业增加值同比(?:实际)?增长\s*([\-\d.]+)\s*%",
        plain,
    )
    if ym:
        ytd = fnum(ym.group(2))

    mining = signed_sector(plain, "采矿业")
    mfg = signed_sector(plain, "制造业")
    util = None
    um = re.search(
        r"电力[、,].{0,24}(?:燃气及水生产和供应业)?增长\s*([\-\d.]+)\s*%",
        plain,
    )
    if um:
        util = fnum(um.group(1))
    else:
        um = re.search(
            r"电力[、,].{0,24}(?:燃气及水生产和供应业)?下降\s*([\d.]+)\s*%",
            plain,
        )
        if um:
            util = -fnum(um.group(1))

    cement_amt, cement_yoy, _cement_ytd_amt, cement_ytd_yoy = product_table(plain, "水泥")
    glass_amt, glass_yoy, _, _ = product_table(plain, "平板玻璃")
    steel_amt, steel_yoy, _, _ = product_table(plain, "钢材")
    crude_amt, crude_yoy, _, _ = product_table(plain, "粗钢")

    return {
        "month": f"{year}-{month:02d}",
        "publish_date": "-".join(pub.groups()) if pub else "",
        "yoy_pct": _f(yoy),
        "mom_pct": _f(mom),
        "ytd_yoy_pct": _f(ytd),
        "mining_yoy_pct": _f(mining),
        "manufacturing_yoy_pct": _f(mfg),
        "utilities_yoy_pct": _f(util),
        "cement_wan_t": _f(cement_amt),
        "cement_yoy_pct": _f(cement_yoy),
        "cement_ytd_yoy_pct": _f(cement_ytd_yoy),
        "flat_glass_wan_weight_box": _f(glass_amt),
        "flat_glass_yoy_pct": _f(glass_yoy),
        "steel_wan_t": _f(steel_amt),
        "steel_yoy_pct": _f(steel_yoy),
        "crude_steel_wan_t": _f(crude_amt),
        "crude_steel_yoy_pct": _f(crude_yoy),
        "source_url": url,
    }


def find_release() -> str:
    for i in range(0, 4):
        list_url = INDEX_URL if i == 0 else f"{INDEX_URL}index_{i}.html"
        parser = LinkParser()
        parser.feed(fetch(list_url))
        for href, text in parser.links:
            if "规模以上工业增加值" not in text:
                continue
            if any(k in text for k in ("解读", "答记者", "英文")):
                continue
            if not re.search(r"t\d+_\d+\.html", href):
                continue
            return urllib.parse.urljoin(list_url, html.unescape(href))
    raise RuntimeError("未找到规模以上工业增加值发布页")


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
        raise RuntimeError("无工业增加值可写")
    write_rows(by_month)
    print(f"wrote {OUTPUT} months={len(by_month)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

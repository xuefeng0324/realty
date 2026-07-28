#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局「城镇单位就业人员年平均工资情况」。

用法：
  python scripts/crawl_nbs_avg_wage.py
  python scripts/crawl_nbs_avg_wage.py --backfill --no-latest

口径：城镇非私营 / 私营单位年平均工资（元）及名义/实际（或可比口径）同比；
行业表「房地产业 / 建筑业」分项（非私营优先，其次私营）。
**工资 ≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**（支付力弱相关）。
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
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_avg_wage.csv"

BACKFILL_URLS = [
    "https://www.stats.gov.cn/sj/zxfb/202505/t20250516_1959826.html",  # 2024
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260515_1963707.html",  # 2025
]

FIELDS = [
    "year",
    "publish_date",
    "nonpriv_yuan",
    "nonpriv_nominal_yoy_pct",
    "nonpriv_real_yoy_pct",
    "priv_yuan",
    "priv_nominal_yoy_pct",
    "priv_real_yoy_pct",
    "re_nonpriv_yuan",
    "re_nonpriv_yoy_pct",
    "construction_nonpriv_yuan",
    "construction_nonpriv_yoy_pct",
    "re_priv_yuan",
    "re_priv_yoy_pct",
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


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "realty-app-data-refresh/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read().decode("utf-8", errors="replace")


def plain_of(body: str) -> str:
    s = re.sub(r"<script[\s\S]*?</script>", " ", body, flags=re.I)
    s = re.sub(r"<style[\s\S]*?</style>", " ", s, flags=re.I)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).split())


def fnum(s: str) -> float:
    return float(s.replace(",", "").replace(" ", "").replace("—", "-"))


def _f(v: float | None) -> str:
    if v is None:
        return ""
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return f"{v:g}"


def unit_block(plain: str, kind: str) -> tuple[float, float, float | None]:
    """kind: 非私营 | 私营 → (yuan, nominal_yoy, real_or_comparable_yoy)."""
    m = re.search(
        rf"城镇{kind}单位就业人员年平均工资\s*([\d,]+)\s*元，"
        rf"比上年增加\s*([\d,]+)\s*元，名义增长\s*(?:\[[^\]]+\])?\s*([\d.]+)\s*%\s*"
        rf"(?:，?\s*扣除价格因素实际增长\s*([\d.]+)\s*%|，?\s*按可比口径\s*(?:\[[^\]]+\])?\s*增长\s*([\d.]+)\s*%)?",
        plain,
    )
    if not m:
        raise RuntimeError(f"缺少城镇{kind}单位年平均工资句")
    yuan = fnum(m.group(1))
    nominal = fnum(m.group(3))
    real = fnum(m.group(4)) if m.group(4) else (fnum(m.group(5)) if m.group(5) else None)
    return yuan, nominal, real


def industry_hits(rows: list[list[str]], name: str) -> list[tuple[float, float]]:
    """Return (yuan, yoy) for table rows with exactly name + year + prev + yoy."""
    out: list[tuple[float, float]] = []
    want = name.replace(" ", "")
    for row in rows:
        if not row:
            continue
        if row[0].replace(" ", "") != want:
            continue
        if len(row) < 4:
            continue
        # skip occupation cross-tabs with many columns
        if len(row) > 5:
            continue
        try:
            yuan = fnum(row[1])
            yoy = fnum(row[3])
        except Exception:
            continue
        # wages are large; yoy typically -20..30
        if yuan < 1000:
            continue
        out.append((yuan, yoy))
    return out


def parse_release(url: str, body: str) -> dict[str, str]:
    plain = plain_of(body)
    pub = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)
    year_m = re.search(r"(20\d{2})\s*年城镇单位就业人员年平均工资情况", plain)
    if not year_m:
        year_m = re.search(r"(20\d{2})\s*年，全国城镇非私营单位就业人员年平均工资", plain)
    if not year_m:
        raise RuntimeError(f"缺少年份: {url}")
    year = int(year_m.group(1))

    nonpriv_yuan, nonpriv_nom, nonpriv_real = unit_block(plain, "非私营")
    priv_yuan, priv_nom, priv_real = unit_block(plain, "私营")

    parser = TableParser()
    parser.feed(body)
    re_hits = industry_hits(parser.rows, "房地产业")
    cons_hits = industry_hits(parser.rows, "建筑业")

    re_np = re_hits[0] if len(re_hits) >= 1 else (None, None)
    re_p = re_hits[1] if len(re_hits) >= 2 else (None, None)
    cons_np = cons_hits[0] if len(cons_hits) >= 1 else (None, None)

    return {
        "year": str(year),
        "publish_date": "-".join(pub.groups()) if pub else "",
        "nonpriv_yuan": _f(nonpriv_yuan),
        "nonpriv_nominal_yoy_pct": _f(nonpriv_nom),
        "nonpriv_real_yoy_pct": _f(nonpriv_real),
        "priv_yuan": _f(priv_yuan),
        "priv_nominal_yoy_pct": _f(priv_nom),
        "priv_real_yoy_pct": _f(priv_real),
        "re_nonpriv_yuan": _f(re_np[0]),
        "re_nonpriv_yoy_pct": _f(re_np[1]),
        "construction_nonpriv_yuan": _f(cons_np[0]),
        "construction_nonpriv_yoy_pct": _f(cons_np[1]),
        "re_priv_yuan": _f(re_p[0]),
        "re_priv_yoy_pct": _f(re_p[1]),
        "source_url": url,
    }


def find_release() -> str:
    for i in range(0, 12):
        list_url = INDEX_URL if i == 0 else f"{INDEX_URL}index_{i}.html"
        parser = LinkParser()
        parser.feed(fetch(list_url))
        for href, text in parser.links:
            if "城镇单位就业人员年平均工资情况" not in text:
                continue
            if any(k in text for k in ("解读", "答记者", "英文")):
                continue
            if not re.search(r"t\d+_\d+\.html", href):
                continue
            return urllib.parse.urljoin(list_url, html.unescape(href))
    raise RuntimeError("未找到城镇单位就业人员年平均工资发布页")


def load_existing() -> dict[str, dict[str, str]]:
    if not OUTPUT.exists():
        return {}
    with OUTPUT.open(encoding="utf-8", newline="") as f:
        return {row["year"]: row for row in csv.DictReader(f) if row.get("year")}


def write_rows(by_year: dict[str, dict[str, str]]) -> None:
    ordered = sorted(by_year.values(), key=lambda r: str(r.get("year", "")), reverse=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for row in ordered:
            writer.writerow({k: row.get(k, "") for k in FIELDS})


def merge_one(url: str, by_year: dict[str, dict[str, str]]) -> str:
    parsed = parse_release(url, fetch(url))
    year = str(parsed["year"])
    by_year[year] = parsed
    return year


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="")
    ap.add_argument("--backfill", action="store_true")
    ap.add_argument("--no-latest", action="store_true")
    args = ap.parse_args()

    by_year: dict[str, dict[str, str]] = {k: dict(v) for k, v in load_existing().items()}
    touched: list[str] = []

    if args.url:
        touched.append(merge_one(args.url, by_year))
    if args.backfill:
        for url in BACKFILL_URLS:
            try:
                touched.append(merge_one(url, by_year))
                print(f"[ok] {touched[-1]} ← {url}")
            except Exception as e:  # noqa: BLE001
                print(f"[warn] backfill skip {url}: {e}", file=sys.stderr)
    if not args.no_latest and not args.url:
        try:
            latest = find_release()
            touched.append(merge_one(latest, by_year))
            print(f"[ok] latest {touched[-1]} ← {latest}")
        except Exception as e:  # noqa: BLE001
            if not touched and not by_year:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_year:
        raise RuntimeError("无年平均工资可写")
    write_rows(by_year)
    print(f"wrote {OUTPUT} years={len(by_year)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

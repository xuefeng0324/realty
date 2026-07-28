#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局季度「国内生产总值初步核算结果」。

用法：
  python scripts/crawl_nbs_gdp.py
  python scripts/crawl_nbs_gdp.py --backfill --no-latest

口径：不变价同比；现价绝对额（亿元）。取累计期（一季度 / 上半年 / 前三季度 / 全年）为主字段；
双列表稿另存当季绝对额与同比。附 **建筑业 / 房地产业** 增加值（住房弱相关）。
**GDP / 行业增加值 ≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**。
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
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_gdp.csv"

BACKFILL_URLS = [
    "https://www.stats.gov.cn/sj/zxfb/202601/t20260120_1962349.html",  # 2025 全年
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260417_1963336.html",  # 2026 Q1
    "https://www.stats.gov.cn/sj/zxfb/202607/t20260716_1964142.html",  # 2026 H1
]

FIELDS = [
    "period",
    "label",
    "publish_date",
    "gdp_yi_yuan",
    "gdp_yoy_pct",
    "primary_yi_yuan",
    "primary_yoy_pct",
    "secondary_yi_yuan",
    "secondary_yoy_pct",
    "tertiary_yi_yuan",
    "tertiary_yoy_pct",
    "industry_yi_yuan",
    "industry_yoy_pct",
    "construction_yi_yuan",
    "construction_yoy_pct",
    "real_estate_yi_yuan",
    "real_estate_yoy_pct",
    "quarter_gdp_yi_yuan",
    "quarter_gdp_yoy_pct",
    "source_url",
]

NUM = r"([-\d]+(?:\.\d+)?)"


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


def detect_period(plain: str, url: str) -> tuple[str, str, bool]:
    """Return (period_key, label, dual_columns)."""
    if re.search(r"四季度和全年|全年国内生产总值初步核算", plain):
        y = re.search(r"(20\d{2})\s*年\s*四季度和全年", plain) or re.search(
            r"(20\d{2})\s*年全年", plain
        )
        year = y.group(1) if y else (re.search(r"/t(20\d{2})", url) or [None, ""])[1]
        return f"{year}", f"{year}全年", True
    if re.search(r"三季度和前三季度|前三季度国内生产总值", plain):
        y = re.search(r"(20\d{2})\s*年", plain)
        year = y.group(1) if y else ""
        return f"{year}-9M", f"{year}前三季度", True
    if re.search(r"二季度和上半年|上半年国内生产总值", plain):
        y = re.search(r"(20\d{2})\s*年", plain)
        year = y.group(1) if y else ""
        return f"{year}-H1", f"{year}上半年", True
    if re.search(r"一季度国内生产总值初步核算", plain):
        y = re.search(r"(20\d{2})\s*年\s*一季度", plain)
        year = y.group(1) if y else ""
        return f"{year}-Q1", f"{year}一季度", False
    raise RuntimeError(f"无法识别 GDP 期次: {url}")


def industry_vals(plain: str, name: str, dual: bool) -> tuple[float, float, float | None, float | None]:
    """Return (cum_abs, cum_yoy, q_abs|None, q_yoy|None). For single-col: cum=period."""
    # Prefer table token after name; avoid prose definitions without digits next to name.
    if dual:
        m = re.search(
            rf"(?<![#\w]){re.escape(name)}\s+{NUM}\s+{NUM}\s+{NUM}\s+{NUM}\b",
            plain,
        )
        if not m:
            raise RuntimeError(f"缺双列行业行: {name}")
        q_abs, cum_abs, q_yoy, cum_yoy = (fnum(m.group(i)) for i in range(1, 5))
        return cum_abs, cum_yoy, q_abs, q_yoy
    m = re.search(rf"(?<![#\w]){re.escape(name)}\s+{NUM}\s+{NUM}\b", plain)
    if not m:
        raise RuntimeError(f"缺单列行业行: {name}")
    return fnum(m.group(1)), fnum(m.group(2)), None, None


def parse_release(url: str, body: str) -> dict[str, str]:
    plain = plain_of(body)
    period, label, dual = detect_period(plain, url)
    pub = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)

    gdp_c, gdp_y, gdp_q, gdp_qy = industry_vals(plain, "GDP", dual)
    p_c, p_y, _, _ = industry_vals(plain, "第一产业", dual)
    s_c, s_y, _, _ = industry_vals(plain, "第二产业", dual)
    t_c, t_y, _, _ = industry_vals(plain, "第三产业", dual)
    i_c, i_y, _, _ = industry_vals(plain, "工业", dual)
    c_c, c_y, _, _ = industry_vals(plain, "建筑业", dual)
    r_c, r_y, _, _ = industry_vals(plain, "房地产业", dual)

    return {
        "period": period,
        "label": label,
        "publish_date": "-".join(pub.groups()) if pub else "",
        "gdp_yi_yuan": _f(gdp_c),
        "gdp_yoy_pct": _f(gdp_y),
        "primary_yi_yuan": _f(p_c),
        "primary_yoy_pct": _f(p_y),
        "secondary_yi_yuan": _f(s_c),
        "secondary_yoy_pct": _f(s_y),
        "tertiary_yi_yuan": _f(t_c),
        "tertiary_yoy_pct": _f(t_y),
        "industry_yi_yuan": _f(i_c),
        "industry_yoy_pct": _f(i_y),
        "construction_yi_yuan": _f(c_c),
        "construction_yoy_pct": _f(c_y),
        "real_estate_yi_yuan": _f(r_c),
        "real_estate_yoy_pct": _f(r_y),
        "quarter_gdp_yi_yuan": _f(gdp_q),
        "quarter_gdp_yoy_pct": _f(gdp_qy),
        "source_url": url,
    }


def find_release() -> str:
    for i in range(0, 8):
        list_url = INDEX_URL if i == 0 else f"{INDEX_URL}index_{i}.html"
        parser = LinkParser()
        parser.feed(fetch(list_url))
        for href, text in parser.links:
            if "国内生产总值" not in text or "初步核算" not in text:
                continue
            if any(k in text for k in ("解读", "答记者", "英文", "英文版")):
                continue
            if not re.search(r"t\d+_\d+\.html", href):
                continue
            return urllib.parse.urljoin(list_url, html.unescape(href))
    raise RuntimeError("未找到国内生产总值初步核算发布页")


def load_existing() -> dict[str, dict[str, str]]:
    if not OUTPUT.exists():
        return {}
    with OUTPUT.open(encoding="utf-8", newline="") as f:
        return {row["period"]: row for row in csv.DictReader(f) if row.get("period")}


def write_rows(by_period: dict[str, dict[str, str]]) -> None:
    def sort_key(p: str) -> tuple:
        # chronological-ish: 2025 < 2026-Q1 < 2026-H1 < 2026-9M < 2026
        m = re.match(r"(20\d{2})(?:-(Q1|H1|9M))?$", p)
        if not m:
            return (p,)
        year = int(m.group(1))
        tag = m.group(2) or "FY"
        order = {"Q1": 1, "H1": 2, "9M": 3, "FY": 4}[tag]
        return (year, order)

    ordered = sorted(by_period.values(), key=lambda r: sort_key(str(r.get("period", ""))), reverse=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for row in ordered:
            writer.writerow({k: row.get(k, "") for k in FIELDS})


def merge_one(url: str, by_period: dict[str, dict[str, str]]) -> str:
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

    by_period: dict[str, dict[str, str]] = {k: dict(v) for k, v in load_existing().items()}
    touched: list[str] = []

    if args.url:
        touched.append(merge_one(args.url, by_period))
    if args.backfill:
        for url in BACKFILL_URLS:
            try:
                touched.append(merge_one(url, by_period))
                print(f"[ok] {touched[-1]} ← {url}")
            except Exception as e:  # noqa: BLE001
                print(f"[warn] backfill skip {url}: {e}", file=sys.stderr)
    if not args.no_latest and not args.url:
        try:
            latest = find_release()
            touched.append(merge_one(latest, by_period))
            print(f"[ok] latest {touched[-1]} ← {latest}")
        except Exception as e:  # noqa: BLE001
            if not touched and not by_period:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_period:
        raise RuntimeError("无 GDP 可写")
    write_rows(by_period)
    print(f"wrote {OUTPUT} periods={len(by_period)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""爬取深圳市住建局「计划入市商品房房源」季度公示正文摘要（不解析 PDF）。

来源列表：https://zjj.sz.gov.cn/xxgk/ztzl/pubdata/qtsj/index.html
口径：官方公示的「计划入市」供应（套数/面积），非成交、非挂牌。

用法：
  python scripts/crawl_sz_planned_supply.py
  python scripts/crawl_sz_planned_supply.py --max 12
"""
from __future__ import annotations

import argparse
import csv
import re
import ssl
import sys
import tempfile
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "sz_planned_supply.csv"
LIST_URL = "https://zjj.sz.gov.cn/xxgk/ztzl/pubdata/qtsj/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0; +https://github.com/xuefeng0324/realty)"}
CTX = ssl.create_default_context()

CN_Q = {"一": 1, "二": 2, "三": 3, "四": 4, "1": 1, "2": 2, "3": 3, "4": 4}

FIELDS = [
    "city",
    "year",
    "quarter",
    "as_of_date",
    "publish_date",
    "project_count",
    "total_units",
    "total_area_sqm",
    "residential_units",
    "residential_area_sqm",
    "apartment_units",
    "apartment_area_sqm",
    "commercial_units",
    "commercial_area_sqm",
    "office_units",
    "office_area_sqm",
    "source_org",
    "source_url",
]


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, context=CTX, timeout=45) as resp:
        return resp.read().decode("utf-8", "replace")


def abs_url(href: str) -> str:
    href = href.strip()
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return "https://zjj.sz.gov.cn" + href
    return href


def list_announcements(html: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*计划入市[^<]*)', html):
        out.append((abs_url(m.group(1)), unescape(m.group(2)).strip()))
    return out


def plain(html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text)


def parse_cn_date(s: str) -> str:
    m = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", s)
    if not m:
        return ""
    return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"


def num(m: re.Match[str] | None, g: int = 1) -> int:
    if not m:
        return 0
    return int(float(m.group(g).replace(",", "")))


def parse_detail(url: str, title: str, html: str) -> dict | None:
    text = plain(html)
    pm = re.search(r"(20\d{2})年(?:第)?([一二三四1-4])季度", title) or re.search(
        r"(20\d{2})年(?:第)?([一二三四1-4])季度", text
    )
    if not pm:
        return None
    year = int(pm.group(1))
    quarter = CN_Q[pm.group(2)]

    # 面积写法：供应房源面积为882821 / 预计供应房源面积1226812
    area_m = re.search(r"供应房源面积为?([\d.]+)平方米", text)
    units_m = re.search(r"供应房源面积为?[\d.]+平方米[，,](\d+)套", text)
    if not units_m:
        units_m = re.search(r"([\d.]+)平方米[，,](\d+)套[，,]其中", text)
        if units_m and not area_m:
            area_m = units_m
            units_m = re.search(r"([\d.]+)平方米[，,](\d+)套[，,]其中", text)
            total_area = num(units_m, 1) if units_m else 0
            total_units = num(units_m, 2) if units_m else 0
        else:
            total_area = num(area_m)
            total_units = num(units_m)
    else:
        total_area = num(area_m)
        total_units = num(units_m)

    # 更稳：直接抓「面积，套数，其中」
    both = re.search(r"供应房源面积为?([\d.]+)平方米[，,](\d+)套", text)
    if both:
        total_area = int(float(both.group(1)))
        total_units = int(both.group(2))

    projects = num(re.search(r"项目(\d+)个", text))

    def pair(*labels: str) -> tuple[int, int]:
        for lab in labels:
            m = re.search(rf"{lab}([\d.]+)平方米[，,](\d+)套", text)
            if m:
                return int(m.group(2)), int(float(m.group(1)))
        return 0, 0

    res_u, res_a = pair("住宅")
    apt_u, apt_a = pair("商务公寓", "公寓")
    com_u, com_a = pair("商业")
    off_u, off_a = pair("办公")

    as_of = ""
    am = re.search(r"截至(\d{4}年\d{1,2}月\d{1,2}日)", text)
    if am:
        as_of = parse_cn_date(am.group(1))

    pub = ""
    pm2 = re.search(r"发布时间：(\d{4}-\d{2}-\d{2})", html)
    if pm2:
        pub = pm2.group(1)
    else:
        # 文末署名日期
        tail = re.findall(r"(\d{4}年\d{1,2}月\d{1,2}日)", text)
        if tail:
            pub = parse_cn_date(tail[-1])

    if total_units <= 0 and projects <= 0:
        return None

    return {
        "city": "深圳",
        "year": year,
        "quarter": quarter,
        "as_of_date": as_of,
        "publish_date": pub,
        "project_count": projects,
        "total_units": total_units,
        "total_area_sqm": total_area,
        "residential_units": res_u,
        "residential_area_sqm": res_a,
        "apartment_units": apt_u,
        "apartment_area_sqm": apt_a,
        "commercial_units": com_u,
        "commercial_area_sqm": com_a,
        "office_units": off_u,
        "office_area_sqm": off_a,
        "source_org": "深圳市住房和建设局",
        "source_url": url,
    }


def write_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = sorted(rows, key=lambda r: (r["year"], r["quarter"]), reverse=True)
    # dedupe by year+quarter keep newest publish
    seen: set[tuple[int, int]] = set()
    uniq: list[dict] = []
    for r in rows:
        key = (int(r["year"]), int(r["quarter"]))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(r)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=str(path.parent)
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        for r in uniq:
            w.writerow({k: r.get(k, "") for k in FIELDS})
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=12, help="最多抓取几条公示")
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    list_html = fetch(LIST_URL)
    links = list_announcements(list_html)
    if not links:
        print("列表页未找到计划入市链接", file=sys.stderr)
        return 1

    rows: list[dict] = []
    for url, title in links[: args.max]:
        try:
            html = fetch(url)
            row = parse_detail(url, title, html)
            if row:
                rows.append(row)
                print(
                    f"OK {row['year']}Q{row['quarter']} projects={row['project_count']} "
                    f"units={row['total_units']} area={row['total_area_sqm']}"
                )
            else:
                print(f"SKIP parse fail: {title} {url}", file=sys.stderr)
        except Exception as e:
            print(f"ERR {url}: {e}", file=sys.stderr)

    if not rows:
        print("无有效行", file=sys.stderr)
        return 2

    write_csv(rows, args.out)
    print(f"wrote {len(rows)} rows -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

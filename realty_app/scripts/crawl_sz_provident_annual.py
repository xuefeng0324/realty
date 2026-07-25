#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取深圳市住房公积金年度报告正文指标。

列表：https://zjj.sz.gov.cn/xxgk/ztzl/pubdata/qtsj/index.html
口径：年报披露的缴存/提取/个人住房贷款；**非商品房成交均价、非挂牌价**。

用法：
  python scripts/crawl_sz_provident_annual.py
  python scripts/crawl_sz_provident_annual.py --max 6
"""
from __future__ import annotations

import argparse
import csv
import re
import ssl
import sys
import tempfile
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "sz_provident_annual.csv"
LIST_URL = "https://zjj.sz.gov.cn/xxgk/ztzl/pubdata/qtsj/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

FIELDS = [
    "city",
    "year",
    "publish_date",
    "paid_units_wan",
    "paid_persons_wan",
    "deposit_amount_yi",
    "deposit_balance_yi",
    "extract_amount_yi",
    "loan_issued_wan",
    "loan_issued_yi",
    "loan_balance_yi",
    "support_purchase_wan_sqm",
    "public_rental_supplement_yi",
    "title",
    "source_org",
    "source_url",
]

TITLE_RE = re.compile(r"住房公积金\s*(20\d{2})\s*年\s*年度报告")


def fetch_text(url: str) -> str:
    raw = urlopen(Request(url, headers=UA), context=CTX, timeout=60).read()
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", "replace")


def abs_url(href: str) -> str:
    href = href.strip()
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return "https://zjj.sz.gov.cn" + href
    return href


def plain(html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text)


def fnum(s: str) -> float:
    return float(s.replace(",", ""))


def list_reports(max_pages: int = 2) -> list[tuple[str, str]]:
    urls = [LIST_URL]
    for i in range(2, max_pages + 1):
        urls.append(f"https://zjj.sz.gov.cn/xxgk/ztzl/pubdata/qtsj/index_{i}.html")
    out: list[tuple[str, str]] = []
    for list_url in urls:
        try:
            html = fetch_text(list_url)
        except Exception as e:
            print(f"skip list {list_url}: {e}", flush=True)
            continue
        for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*住房公积金[^<]*年度报告[^<]*)</a>', html):
            title = unescape(m.group(2)).strip()
            if not TITLE_RE.search(title):
                continue
            out.append((abs_url(m.group(1)), title))
        # title attribute form
        for m in re.finditer(r'href="([^"]+)"[^>]*title="([^"]*住房公积金[^"]*年度报告[^"]*)"', html):
            title = unescape(m.group(2)).strip()
            if not TITLE_RE.search(title):
                continue
            out.append((abs_url(m.group(1)), title))
    seen: set[str] = set()
    uniq: list[tuple[str, str]] = []
    for url, title in out:
        if url in seen:
            continue
        seen.add(url)
        uniq.append((url, title))
    return uniq


def parse_report(url: str, title: str, html: str) -> dict | None:
    text = plain(html)
    ym = TITLE_RE.search(title) or TITLE_RE.search(text)
    if not ym:
        return None
    year = int(ym.group(1))

    def one(*pats: str) -> float:
        for p in pats:
            m = re.search(p, text)
            if m:
                return fnum(m.group(1))
        return 0.0

    def balance_after_label(label: str) -> float:
        for m in re.finditer(rf"{label}\s*(?:\[[^\]]*\])?\s*([\d.,]+)亿元", text):
            prefix = text[max(0, m.start() - 4) : m.start()]
            if prefix.endswith("异地"):
                continue
            return fnum(m.group(1))
        return 0.0

    loan_m = re.search(r"当年发放个人住房贷款([\d.]+)万笔[、,，]([\d.,]+)亿元", text)
    loan_issued_wan = fnum(loan_m.group(1)) if loan_m else 0.0
    loan_issued_yi = fnum(loan_m.group(2)) if loan_m else 0.0

    pub = ""
    pm = re.search(r"发布时间：(\d{4}-\d{2}-\d{2})", html)
    if pm:
        pub = pm.group(1)

    row = {
        "city": "深圳",
        "year": str(year),
        "publish_date": pub,
        "paid_units_wan": f"{one(r'实缴单位([\d.]+)万家'):g}",
        "paid_persons_wan": f"{one(r'实缴人数([\d.]+)万人'):g}",
        "deposit_amount_yi": f"{one(r'缴存额([\d.,]+)亿元'):g}",
        "deposit_balance_yi": f"{balance_after_label('缴存余额'):g}",
        "extract_amount_yi": f"{one(r'提取额([\d.,]+)亿元'):g}",
        "loan_issued_wan": f"{loan_issued_wan:g}",
        "loan_issued_yi": f"{loan_issued_yi:g}",
        "loan_balance_yi": f"{balance_after_label('贷款余额'):g}",
        "support_purchase_wan_sqm": f"{one(r'支持缴存人购建房([\d.]+)万平方米'):g}",
        "public_rental_supplement_yi": f"{one(r'城市公共租赁住房（廉租住房）建设补充资金([\d.,]+)亿元'):g}",
        "title": title if "住房公积金" in title else f"深圳市住房公积金{year}年年度报告",
        "source_org": "深圳市住房公积金管理中心",
        "source_url": url,
    }
    if loan_issued_wan <= 0 and float(row["deposit_amount_yi"] or 0) <= 0:
        return None
    return row


def atomic_write(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8-sig", newline="", delete=False, dir=str(path.parent), suffix=".tmp"
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=6)
    ap.add_argument("--list-pages", type=int, default=2)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    reports = list_reports(args.list_pages)
    print(f"found {len(reports)} annual reports", flush=True)
    best: dict[str, dict] = {}
    for url, title in reports:
        if len(best) >= args.max:
            break
        try:
            html = fetch_text(url)
            row = parse_report(url, title, html)
            if not row:
                print(f"skip parse {title}", flush=True)
                continue
            prev = best.get(row["year"])
            if prev is None or (row["publish_date"] >= prev.get("publish_date", "")):
                best[row["year"]] = row
            print(
                f"ok {row['year']} loan={row['loan_issued_wan']}万笔/{row['loan_issued_yi']}亿 "
                f"area={row['support_purchase_wan_sqm']}万㎡",
                flush=True,
            )
        except Exception as e:
            print(f"ERR {title}: {e}", flush=True)

    rows = sorted(best.values(), key=lambda r: int(r["year"]), reverse=True)
    if not rows:
        print("ERROR: no rows", file=sys.stderr)
        return 2
    atomic_write(args.out, rows)
    print(f"wrote {args.out} n={len(rows)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

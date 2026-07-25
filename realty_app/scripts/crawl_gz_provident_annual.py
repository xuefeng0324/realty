#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广州市住房公积金年度报告正文指标。

已知年报页（列表页本机常超时，脚本以种子 URL + 列表探测合并）：
  https://gjj.gz.gov.cn/gkmlpt/content/10/10186/post_10186442.html  (2024)
  https://gjj.gz.gov.cn/xxgk/xxgkml/qt/zjbg/content/post_9663474.html (2023)

口径：年报披露的缴存/提取/个人住房贷款；**非商品房成交均价、非挂牌价**。

用法：
  python scripts/crawl_gz_provident_annual.py
  python scripts/crawl_gz_provident_annual.py --seed-only
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
OUT = ROOT / "static" / "gz_provident_annual.csv"
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

SEED_URLS = [
    "https://gjj.gz.gov.cn/gkmlpt/content/10/10186/post_10186442.html",
    "https://gjj.gz.gov.cn/xxgk/xxgkml/qt/zjbg/content/post_9663474.html",
]

TITLE_RE = re.compile(r"广州住房公积金\s*(20\d{2})\s*年\s*年度报告")
LIST_URLS = [
    "https://gjj.gz.gov.cn/xxgk/xxgkml/qt/zjbg/",
    "http://gjj.gz.gov.cn/xxgk/xxgkml/qt/zjbg/",
]


def fetch_text(url: str, timeout: int = 45) -> str:
    raw = urlopen(Request(url, headers=UA), context=CTX, timeout=timeout).read()
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
        return "https://gjj.gz.gov.cn" + href
    return href


def plain(html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text)


def fnum(s: str) -> float:
    return float(s.replace(",", ""))


def discover_urls() -> list[str]:
    found: list[str] = []
    for list_url in LIST_URLS:
        try:
            html = fetch_text(list_url, timeout=25)
        except Exception as e:
            print(f"skip list {list_url}: {e}", flush=True)
            continue
        for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*住房公积金[^<]*年度报告[^<]*)</a>', html):
            title = unescape(m.group(2)).strip()
            if TITLE_RE.search(title):
                found.append(abs_url(m.group(1)))
        for m in re.finditer(r'href="([^"]+)"[^>]*title="([^"]*住房公积金[^"]*年度报告[^"]*)"', html):
            title = unescape(m.group(2)).strip()
            if TITLE_RE.search(title):
                found.append(abs_url(m.group(1)))
    return found


def parse_report(url: str, html: str) -> dict | None:
    text = plain(html)
    ym = TITLE_RE.search(text) or re.search(r"住房公积金\s*(20\d{2})\s*年\s*年度报告", text)
    if not ym:
        return None
    year = int(ym.group(1))

    def one(*pats: str) -> float:
        for p in pats:
            m = re.search(p, text)
            if m:
                return fnum(m.group(1))
        return 0.0

    # 实缴单位：17.65万家 或 165604家
    paid_units = one(r"实缴单位([\d.]+)万家")
    if paid_units <= 0:
        raw_units = one(r"实缴单位(\d+)家")
        if raw_units > 0:
            paid_units = round(raw_units / 10000, 2)

    loan_m = re.search(
        r"发放个人住房贷款([\d.]+)万笔[、,，]?([\d.,]+)亿元",
        text,
    )
    loan_issued_wan = fnum(loan_m.group(1)) if loan_m else 0.0
    loan_issued_yi = fnum(loan_m.group(2)) if loan_m else 0.0

    # 贷款余额：优先「贷款余额xxxx亿元」，避开异地贷款余额
    loan_balance = 0.0
    for m in re.finditer(r"贷款余额([\d.,]+)亿元", text):
        prefix = text[max(0, m.start() - 6) : m.start()]
        if "异地" in prefix:
            continue
        loan_balance = fnum(m.group(1))
        break

    pub = ""
    pm = re.search(r"发布日期：\s*\*?\*?(\d{4}-\d{2}-\d{2})", html)
    if not pm:
        pm = re.search(r"发布时间：(\d{4}-\d{2}-\d{2})", html)
    if pm:
        pub = pm.group(1)

    row = {
        "city": "广州",
        "year": str(year),
        "publish_date": pub,
        "paid_units_wan": f"{paid_units:g}",
        "paid_persons_wan": f"{one(r'实缴职工([\d.]+)万人'):g}",
        "deposit_amount_yi": f"{one(r'缴存额([\d.,]+)亿元'):g}",
        "deposit_balance_yi": f"{one(r'缴存余额([\d.,]+)亿元'):g}",
        "extract_amount_yi": f"{one(r'提取额([\d.,]+)亿元'):g}",
        "loan_issued_wan": f"{loan_issued_wan:g}",
        "loan_issued_yi": f"{loan_issued_yi:g}",
        "loan_balance_yi": f"{loan_balance:g}",
        "support_purchase_wan_sqm": f"{one(r'支持职工购建房([\d.]+)万平方米', r'支持缴存人购建房([\d.]+)万平方米'):g}",
        "public_rental_supplement_yi": f"{one(r'提取城市廉租住房（公共租赁住房）建设补充资金([\d.,]+)亿元', r'城市公共租赁住房（廉租住房）建设补充资金([\d.,]+)亿元'):g}",
        "title": f"广州住房公积金{year}年年度报告",
        "source_org": "广州住房公积金管理中心",
        "source_url": url,
    }
    if loan_issued_wan <= 0 and float(row["deposit_amount_yi"] or 0) <= 0:
        return None
    return row


def load_existing(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8-sig", newline="") as f:
        return {r["year"]: r for r in csv.DictReader(f) if r.get("year")}


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
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--seed-only", action="store_true", help="不联网，仅校验已有 CSV")
    args = ap.parse_args()

    existing = load_existing(args.out)
    if args.seed_only:
        if not existing:
            print("ERROR: no existing CSV", file=sys.stderr)
            return 2
        print(f"seed-only ok n={len(existing)}", flush=True)
        return 0

    urls = list(dict.fromkeys(SEED_URLS + discover_urls()))
    print(f"try {len(urls)} urls", flush=True)
    best = dict(existing)
    fetched = 0
    for url in urls:
        try:
            html = fetch_text(url)
            row = parse_report(url, html)
            if not row:
                print(f"skip parse {url}", flush=True)
                continue
            prev = best.get(row["year"])
            if prev is None or (row["publish_date"] >= prev.get("publish_date", "")):
                best[row["year"]] = row
            fetched += 1
            print(
                f"ok {row['year']} loan={row['loan_issued_wan']}万笔/{row['loan_issued_yi']}亿 "
                f"area={row['support_purchase_wan_sqm']}万㎡",
                flush=True,
            )
        except Exception as e:
            print(f"ERR {url}: {e}", flush=True)

    rows = sorted(best.values(), key=lambda r: int(r["year"]), reverse=True)
    if not rows:
        print("ERROR: no rows", file=sys.stderr)
        return 2
    atomic_write(args.out, rows)
    print(f"wrote {args.out} n={len(rows)} fetched={fetched}", flush=True)
    # 本机常 SSL 失败：只要保留种子行即成功
    return 0 if rows else 2


if __name__ == "__main__":
    raise SystemExit(main())

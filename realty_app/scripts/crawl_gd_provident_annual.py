#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广东省住房公积金年度报告全省指标。

官方正文含全省缴存/提取/贷款；分市明细多见于媒体解读而非报告 HTML。
口径：全省年报；**非城市成交均价**。

用法：
  python scripts/crawl_gd_provident_annual.py
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
OUT = ROOT / "static" / "gd_provident_annual.csv"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
SEED_URL = "https://zfcxjst.gd.gov.cn/xxgk/wjtz/content/post_4704530.html"

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
    "title",
    "source_org",
    "source_url",
]


def fetch_text(url: str) -> str:
    raw = urlopen(Request(url, headers=UA), context=CTX, timeout=45).read()
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", "replace")


def plain(html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text)


def fnum(s: str) -> float:
    return float(s.replace(",", ""))


def fmt(v: float) -> str:
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return s


def parse_report(url: str, html: str) -> dict | None:
    text = plain(html)
    ym = re.search(r"广东省住房公积金\s*(20\d{2})\s*年\s*年度报告", text)
    if not ym:
        return None
    year = int(ym.group(1))

    def one(*pats: str) -> float:
        for p in pats:
            m = re.search(p, text)
            if m:
                return fnum(m.group(1))
        return 0.0

    loan_m = re.search(r"发放个人住房贷款([\d.]+)万笔[、,，]([\d.,]+)亿元", text)
    if not loan_m:
        loan_m = re.search(r"发放个人住房贷款([\d.]+)万笔[、,，]?共?([\d.,]+)亿元", text)

    pub = ""
    pm = re.search(r"成文日期：(\d{4})年(\d{1,2})月(\d{1,2})日", html)
    if pm:
        pub = f"{pm.group(1)}-{int(pm.group(2)):02d}-{int(pm.group(3)):02d}"
    if not pub:
        pm2 = re.search(r"(20\d{2}-\d{2}-\d{2})", html)
        if pm2:
            pub = pm2.group(1)

    # 提取：优先「提取住房公积金…共X亿元」
    extract = one(r"提取住房公积金[，,].*?共([\d.,]+)亿元", r"提取额([\d.,]+)亿元")
    if extract <= 0:
        m = re.search(r"([\d.]+)万人提取住房公积金[，,]\s*共([\d.,]+)亿元", text)
        if m:
            extract = fnum(m.group(2))

    row = {
        "city": "广东",
        "year": str(year),
        "publish_date": pub,
        "paid_units_wan": fmt(one(r"实缴单位([\d.]+)万家")),
        "paid_persons_wan": fmt(one(r"实缴职工([\d.]+)万人")),
        "deposit_amount_yi": fmt(one(r"缴存额([\d.,]+)亿元")),
        "deposit_balance_yi": fmt(one(r"缴存余额([\d.,]+)亿元")),
        "extract_amount_yi": fmt(extract),
        "loan_issued_wan": fmt(fnum(loan_m.group(1)) if loan_m else 0.0),
        "loan_issued_yi": fmt(fnum(loan_m.group(2)) if loan_m else 0.0),
        "loan_balance_yi": fmt(one(r"贷款余额([\d.,]+)亿元")),
        "title": f"广东省住房公积金{year}年年度报告",
        "source_org": "广东省住房和城乡建设厅",
        "source_url": url,
    }
    if float(row["deposit_amount_yi"] or 0) <= 0:
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
    ap.add_argument("--url", default=SEED_URL)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    existing: dict[str, dict] = {}
    if args.out.exists():
        with args.out.open(encoding="utf-8-sig", newline="") as f:
            existing = {r["year"]: r for r in csv.DictReader(f) if r.get("year")}

    try:
        html = fetch_text(args.url)
        row = parse_report(args.url, html)
        if row:
            existing[row["year"]] = row
            print(f"ok {row['year']} deposit={row['deposit_amount_yi']} loan={row['loan_issued_wan']}万笔", flush=True)
        else:
            print("skip parse; keep seed", flush=True)
    except Exception as e:
        print(f"ERR fetch: {e}; keep seed", flush=True)

    rows = sorted(existing.values(), key=lambda r: int(r["year"]), reverse=True)
    if not rows:
        print("ERROR: no rows", file=sys.stderr)
        return 2
    atomic_write(args.out, rows)
    print(f"wrote {args.out} n={len(rows)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

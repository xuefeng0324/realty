#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取珠海市住房公积金管理中心「住房公积金动态」季/年累计运行指标。

列表：https://gjj.zhuhai.gov.cn/zwgk/gzdt/
口径：动态稿披露的缴存/提取/贷款；**非商品房成交均价**。
注意：珠海完整「年度报告」正文可能未单独公开，本源以「动态(YYYY年1-N月)」为准。

用法：
  python scripts/crawl_zh_provident_dynamics.py
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
OUT = ROOT / "static" / "zh_provident_dynamics.csv"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
LIST_BASE = "https://gjj.zhuhai.gov.cn/zwgk/gzdt/"

FIELDS = [
    "city",
    "year",
    "month_end",
    "as_of_date",
    "publish_date",
    "deposit_amount_yi",
    "deposit_yoy_pct",
    "extract_amount_yi",
    "extract_yoy_pct",
    "extract_rate_pct",
    "loan_issued_yi",
    "loan_issued_yoy_pct",
    "loan_balance_yi",
    "loan_ratio_pct",
    "paid_persons",
    "deposit_balance_yi",
    "title",
    "source_org",
    "source_url",
]

TITLE_RE = re.compile(r"珠海市住房公积金动态[（(]?(20\d{2})年\s*1\s*[-—～至]\s*(\d{1,2})\s*月")
SEED_URLS = [
    "https://gjj.zhuhai.gov.cn/zwgk/gzdt/content/post_3900021.html",
    "https://gjj.zhuhai.gov.cn/zwgk/gzdt/content/post_3889655.html",
    "https://gjj.zhuhai.gov.cn/zwgk/gzdt/content/post_3850671.html",
    "https://gjj.zhuhai.gov.cn/zwgk/gzdt/content/post_3820337.html",
    "https://gjj.zhuhai.gov.cn/zwgk/gzdt/content/post_3804552.html",
]


def fetch_text(url: str, timeout: int = 40) -> str:
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
        return "https://gjj.zhuhai.gov.cn" + href
    return href


def plain(html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text)


def fnum(s: str) -> float:
    return float(s.replace(",", ""))


def wan_to_yi(wan: float) -> float:
    return round(wan / 10000, 4)


def discover_urls(max_pages: int = 5) -> list[str]:
    urls: list[str] = []
    pages = [LIST_BASE] + [f"{LIST_BASE}index_{i}.html" for i in range(2, max_pages + 1)]
    for list_url in pages:
        try:
            html = fetch_text(list_url, timeout=25)
        except Exception as e:
            print(f"skip list {list_url}: {e}", flush=True)
            continue
        for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*)</a>', html):
            title = unescape(m.group(2)).strip()
            if "住房公积金动态" not in title:
                continue
            urls.append(abs_url(m.group(1)))
    return urls


def parse_report(url: str, html: str) -> dict | None:
    text = plain(html)
    tm = TITLE_RE.search(text) or TITLE_RE.search(unescape(re.sub(r"<[^>]+>", " ", html)))
    # title tag fallback
    if not tm:
        tm = re.search(
            r"住房公积金动态[（(]?(20\d{2})年\s*1\s*[-—～至]\s*(\d{1,2})\s*月",
            html,
        )
    if not tm:
        return None
    year = int(tm.group(1))
    month_end = int(tm.group(2))

    def one(*pats: str) -> float:
        for p in pats:
            m = re.search(p, text)
            if m:
                return fnum(m.group(1))
        return 0.0

    # 期间缴存额（万元）
    deposit_wan = one(
        rf"{year}年.*?缴存额([\d,]+)万元",
        r"住房公积金缴存额([\d,]+)万元",
        r"全市住房公积金缴存额([\d,]+)万元",
    )
    extract_wan = one(
        r"共提取([\d,]+)万元",
        r"提取([\d,]+)万元用于",
    )
    loan_wan = one(
        r"发放住房公积金个人购房贷款([\d,]+)万元",
        r"发放个人购房贷款([\d,]+)万元",
    )
    loan_balance_wan = one(r"期末贷款余额([\d,]+)万元", r"贷款余额([\d,]+)万元")
    deposit_balance_wan = one(r"期末累计缴存余额([\d,]+)万元", r"累计缴存余额([\d,]+)万元")

    deposit_yoy = one(r"缴存额[\d,]+万元，同比增长([\d.]+)%", r"缴存额[\d,]+万元，同比下降([\d.]+)%")
    # handle 下降 as negative - check separately
    if re.search(r"缴存额[\d,]+万元，同比下降", text):
        deposit_yoy = -abs(deposit_yoy)
    extract_yoy = one(r"提取金额同比增长([\d.]+)%", r"提取金额同比下降([\d.]+)%")
    if re.search(r"提取金额同比下降", text):
        extract_yoy = -abs(extract_yoy)
    loan_yoy = one(r"发放住房公积金个人购房贷款[\d,]+万元，同比增长([\d.]+)%", r"同比增长([\d.]+)%")
    # loan yoy is tricky - look near 发放
    lm = re.search(r"发放住房公积金个人购房贷款[\d,]+万元，同比增长([\d.]+)%", text)
    if lm:
        loan_yoy = fnum(lm.group(1))
    elif re.search(r"发放住房公积金个人购房贷款[\d,]+万元，同比下降([\d.]+)%", text):
        m2 = re.search(r"发放住房公积金个人购房贷款[\d,]+万元，同比下降([\d.]+)%", text)
        loan_yoy = -fnum(m2.group(1)) if m2 else 0.0

    extract_rate = one(r"提取率为([\d.]+)%")
    loan_ratio = one(r"个贷率为([\d.]+)%")
    paid_persons = one(r"实际缴存人数([\d,]+)")

    as_of = ""
    am = re.search(r"截至(\d{4}年\d{1,2}月\d{1,2}日)", text)
    if am:
        # 2026年3月31日 → 2026-03-31
        dm = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", am.group(1))
        if dm:
            as_of = f"{dm.group(1)}-{int(dm.group(2)):02d}-{int(dm.group(3)):02d}"
    if not as_of:
        as_of = f"{year}-{month_end:02d}-01"

    pub = ""
    pm = re.search(r"来源：\s*本网\s*(\d{4}-\d{2}-\d{2})", html)
    if not pm:
        pm = re.search(r"(\d{4}-\d{2}-\d{2})\s*\d{2}:\d{2}", html)
    if pm:
        pub = pm.group(1)

    if deposit_wan <= 0 and loan_wan <= 0:
        return None

    return {
        "city": "珠海",
        "year": str(year),
        "month_end": str(month_end),
        "as_of_date": as_of,
        "publish_date": pub,
        "deposit_amount_yi": f"{wan_to_yi(deposit_wan):g}",
        "deposit_yoy_pct": f"{deposit_yoy:g}",
        "extract_amount_yi": f"{wan_to_yi(extract_wan):g}",
        "extract_yoy_pct": f"{extract_yoy:g}",
        "extract_rate_pct": f"{extract_rate:g}",
        "loan_issued_yi": f"{wan_to_yi(loan_wan):g}",
        "loan_issued_yoy_pct": f"{loan_yoy:g}",
        "loan_balance_yi": f"{wan_to_yi(loan_balance_wan):g}",
        "loan_ratio_pct": f"{loan_ratio:g}",
        "paid_persons": f"{int(paid_persons) if paid_persons else 0}",
        "deposit_balance_yi": f"{wan_to_yi(deposit_balance_wan):g}",
        "title": f"珠海市住房公积金动态（{year}年1-{month_end}月）",
        "source_org": "珠海市住房公积金管理中心",
        "source_url": url,
    }


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
    ap.add_argument("--list-pages", type=int, default=5)
    args = ap.parse_args()

    urls = list(dict.fromkeys(SEED_URLS + discover_urls(args.list_pages)))
    print(f"try {len(urls)} urls", flush=True)
    best: dict[tuple[str, str], dict] = {}
    for url in urls:
        try:
            html = fetch_text(url)
            row = parse_report(url, html)
            if not row:
                print(f"skip parse {url}", flush=True)
                continue
            key = (row["year"], row["month_end"])
            prev = best.get(key)
            if prev is None or (row["publish_date"] >= prev.get("publish_date", "")):
                best[key] = row
            print(
                f"ok {row['year']}-1-{row['month_end']} "
                f"dep={row['deposit_amount_yi']}亿 loan={row['loan_issued_yi']}亿 "
                f"ratio={row['loan_ratio_pct']}%",
                flush=True,
            )
        except Exception as e:
            print(f"ERR {url}: {e}", flush=True)

    rows = sorted(best.values(), key=lambda r: (int(r["year"]), int(r["month_end"])), reverse=True)
    if not rows:
        print("ERROR: no rows", file=sys.stderr)
        return 2
    atomic_write(args.out, rows)
    print(f"wrote {args.out} n={len(rows)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从央行 PBOC 公告抓取最新 LPR，合并进 static/seed/lpr_history.csv。

列表：http://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125440/3876551/index.html
口径：1 年期 / 5 年期以上 LPR；房贷加点沿用上一行（一线示意，非官方加点公告）。

用法：
  python scripts/crawl_lpr_history.py
  python scripts/crawl_lpr_history.py --max 24
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
OUT = ROOT / "static" / "seed" / "lpr_history.csv"
LIST_URL = "http://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125440/3876551/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

FIELDS = ["month", "lpr_1y", "lpr_5y", "mortgage_first", "mortgage_second", "source"]


def fetch_text(url: str) -> str:
    raw = urlopen(Request(url, headers=UA), context=CTX, timeout=60).read()
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", "replace")


def abs_url(href: str) -> str:
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return "http://www.pbc.gov.cn" + href
    return href


def list_lpr_notices(html: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*贷款市场报价利率[^<]*)</a>', html):
        title = unescape(m.group(2)).strip()
        if "报价行" in title:
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


def parse_month(title: str) -> str:
    m = re.search(r"(20\d{2})年(\d{1,2})月", title)
    if not m:
        return ""
    return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}"


def parse_rates(html: str) -> tuple[float, float] | None:
    text = unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)))
    text = re.sub(r"\s+", " ", text)
    m1 = re.search(r"1年期LPR为([\d.]+)%", text)
    m5 = re.search(r"5年期以上LPR为([\d.]+)%", text)
    if not m1 or not m5:
        return None
    return float(m1.group(1)), float(m5.group(1))


def load_existing(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def atomic_write(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=str(path.parent), suffix=".tmp"
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=18)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    existing = load_existing(args.out)
    by_month = {r["month"]: r for r in existing if r.get("month")}
    if not by_month:
        print("ERROR: empty baseline CSV; run compute_lpr_history.py first", file=sys.stderr)
        return 2

    html = fetch_text(LIST_URL)
    notices = list_lpr_notices(html)[: args.max]
    print(f"found {len(notices)} LPR notices", flush=True)
    added = 0
    updated = 0

    # process oldest→newest so mortgage bp can cascade for brand-new months
    for url, title in reversed(notices):
        month = parse_month(title)
        if not month:
            continue
        try:
            detail = fetch_text(url)
            rates = parse_rates(detail)
            if not rates:
                print(f"no rates: {title}", flush=True)
                continue
            lpr1, lpr5 = rates
            prev = by_month.get(month)
            if prev and abs(float(prev["lpr_1y"]) - lpr1) < 1e-9 and abs(float(prev["lpr_5y"]) - lpr5) < 1e-9:
                continue
            # inherit bp from previous month row if inserting new
            anchor = prev
            if not anchor:
                earlier = [m for m in by_month if m < month]
                if earlier:
                    anchor = by_month[max(earlier)]
            if not anchor:
                bp_first, bp_second = -30.0, 35.0
            else:
                bp_first = round((float(anchor["mortgage_first"]) - float(anchor["lpr_5y"])) * 100)
                bp_second = round((float(anchor["mortgage_second"]) - float(anchor["lpr_5y"])) * 100)
            row = {
                "month": month,
                "lpr_1y": f"{lpr1:g}",
                "lpr_5y": f"{lpr5:g}",
                "mortgage_first": f"{round(lpr5 + bp_first / 100.0, 2):g}",
                "mortgage_second": f"{round(lpr5 + bp_second / 100.0, 2):g}",
                "source": "PBOC公开公告",
            }
            if prev:
                updated += 1
            else:
                added += 1
            by_month[month] = row
            print(f"ok {month} 1y={lpr1} 5y={lpr5}", flush=True)
        except Exception as e:
            print(f"ERR {title}: {e}", flush=True)

    rows = [by_month[m] for m in sorted(by_month)]
    atomic_write(args.out, rows)
    print(f"wrote {args.out} n={len(rows)} added={added} updated={updated}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

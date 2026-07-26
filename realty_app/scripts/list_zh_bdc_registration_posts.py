#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""列出珠海不动产登记中心「新增商品房 / 存量房转移」季报表，对照本地 CSV 缺口。

官网正文仅为 PNG（无 HTML 表/XLS），本脚本**不** OCR、不改 CSV。
新季发布后：打开 PNG → 抄录「合计」行 → 追加 static/zh_bdc_registration.csv。

用法：
  python scripts/list_zh_bdc_registration_posts.py
"""
from __future__ import annotations

import csv
import re
import ssl
import sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "static" / "zh_bdc_registration.csv"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
INDEX_URLS = [
    "https://bdc.zhuhai.gov.cn/zwgk/sjfb/index.html",
    "https://bdc.zhuhai.gov.cn/zwgk/sjfb/index_2.html",
    "https://bdc.zhuhai.gov.cn/zwgk/sjfb/index_3.html",
]
WANTED = ("新增商品房", "存量房转移")


def fetch(url: str) -> str:
    req = Request(url, headers=UA)
    with urlopen(req, context=CTX, timeout=40) as resp:
        raw = resp.read()
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", "replace")


def load_known_posts() -> set[str]:
    if not CSV_PATH.is_file():
        return set()
    known: set[str] = set()
    with CSV_PATH.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            url = (row.get("source_url") or "").strip()
            m = re.search(r"post_(\d+)\.html", url)
            if m:
                known.add(m.group(1))
    return known


def main() -> int:
    known = load_known_posts()
    found: list[tuple[str, str]] = []
    seen: set[str] = set()
    for url in INDEX_URLS:
        try:
            html = fetch(url)
        except Exception as exc:
            print(f"WARN fetch {url}: {exc}", file=sys.stderr)
            continue
        for m in re.finditer(r'href="([^"]*post_(\d+)\.html)"\s+title="([^"]+)"', html):
            pid, title = m.group(2), m.group(3)
            if pid in seen:
                continue
            if not any(k in title for k in WANTED):
                continue
            seen.add(pid)
            found.append((pid, title))

    print(f"known_in_csv={len(known)} listed={len(found)}")
    missing = 0
    for pid, title in found:
        mark = "OK" if pid in known else "NEED"
        if mark == "NEED":
            missing += 1
        print(f"[{mark}] post_{pid}  {title}")
        print(f"       https://bdc.zhuhai.gov.cn/zwgk/sjfb/content/post_{pid}.html")
    print(f"missing={missing}")
    return 0 if missing == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 m.anjuke.com 列表页为已有 REAL 挂牌补 cover_url（不抓详情、不伪造）。

匹配：source_url / source_listing_id 中的 /sale/{id}.html
输出：原地更新 static/seed/listings.csv（新增或填充 cover_url 列）

用法：
  python scripts/enrich_listing_covers.py
  python scripts/enrich_listing_covers.py --max-pages 3 --cities sz,gz,zh
"""
from __future__ import annotations

import argparse
import csv
import random
import re
import sys
import time
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
LISTINGS = ROOT / "static" / "seed" / "listings.csv"
UA_POOL = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
]
CITY_CODE = {"sz": "深圳", "gz": "广州", "zh": "珠海"}


def fetch(url: str) -> str:
    ua = random.choice(UA_POOL)
    req = Request(
        url,
        headers={
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": "https://m.anjuke.com/",
        },
    )
    with urlopen(req, timeout=25) as resp:
        raw = resp.read()
    return raw.decode("utf-8", "replace")


def parse_covers(html: str) -> dict[str, str]:
    """sale_id -> cover_url"""
    out: dict[str, str] = {}
    # 以挂牌锚点为中心取前后窗口，找最近 ajkimg
    for m in re.finditer(r"/sale/(\d+)\.html", html):
        sid = m.group(1)
        if sid in out:
            continue
        window = html[max(0, m.start() - 800) : m.end() + 1200]
        imgs = re.findall(
            r"(https?://pic\d*\.ajkimg\.com/[^\"'\s>]+)",
            window,
            flags=re.I,
        )
        if not imgs:
            continue
        url = unescape(imgs[0]).split("?")[0]
        # 过滤站内 icon
        if "pages.anjukestatic" in url or "/fe/esf/" in url:
            continue
        out[sid] = url
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-pages", type=int, default=4)
    ap.add_argument("--cities", default="sz,gz,zh")
    ap.add_argument("--sleep", type=float, default=2.2)
    args = ap.parse_args()

    rows = list(csv.DictReader(LISTINGS.open(encoding="utf-8-sig")))
    if not rows:
        print("empty listings", file=sys.stderr)
        return 1
    fields = list(rows[0].keys())
    if "cover_url" not in fields:
        fields.append("cover_url")
        for r in rows:
            r.setdefault("cover_url", "")

    by_sid: dict[str, list[dict]] = {}
    for r in rows:
        url = r.get("source_url") or ""
        m = re.search(r"/sale/(\d+)\.html", url)
        if m:
            by_sid.setdefault(m.group(1), []).append(r)
        sid = (r.get("source_listing_id") or "").strip()
        if sid and re.fullmatch(r"\d+", sid):
            by_sid.setdefault(sid, []).append(r)

    found: dict[str, str] = {}
    for code in [c.strip() for c in args.cities.split(",") if c.strip()]:
        for page in range(1, args.max_pages + 1):
            url = (
                f"https://m.anjuke.com/{code}/sale/"
                if page == 1
                else f"https://m.anjuke.com/{code}/sale/p{page}/"
            )
            print(f"[fetch] {CITY_CODE.get(code, code)} p{page} {url}")
            try:
                html = fetch(url)
            except Exception as exc:  # noqa: BLE001
                print(f"  ERR {type(exc).__name__}: {exc}")
                break
            if len(html) < 8000:
                print(f"  short page {len(html)}B — stop city")
                break
            batch = parse_covers(html)
            print(f"  covers {len(batch)}")
            found.update(batch)
            time.sleep(args.sleep + random.uniform(0, 0.8))

    updated = 0
    for sid, cover in found.items():
        for r in by_sid.get(sid, []):
            if (r.get("cover_url") or "").strip() == cover:
                continue
            r["cover_url"] = cover
            updated += 1

    with LISTINGS.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})

    filled = sum(1 for r in rows if (r.get("cover_url") or "").strip())
    print(f"[done] matched_ids={len(found)} row_updates={updated} filled_total={filled} → {LISTINGS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

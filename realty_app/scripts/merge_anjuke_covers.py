#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用标准库抓 m.anjuke 列表，merge 进 listings.csv（保留 DERIVED，补 REAL+cover）。

不依赖 requests/bs4。风控时短页则跳过该城。

用法：
  python scripts/merge_anjuke_covers.py
  python scripts/merge_anjuke_covers.py --max-pages 2 --cities sz,gz,zh
"""
from __future__ import annotations

import argparse
import csv
import random
import re
import time
from datetime import date
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
LISTINGS = ROOT / "static" / "seed" / "listings.csv"
COMMUNITIES = ROOT / "static" / "seed" / "communities.csv"

CITY = {
    "sz": (2, "深圳"),
    "gz": (1, "广州"),
    "zh": (3, "珠海"),
}
UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
)

_PRICE = re.compile(r"(\d+(?:\.\d+)?)\s*万")
_UNIT = re.compile(r"(\d+)\s*元")
_ROOM = re.compile(r"(\d+)室")
_AREA = re.compile(r"([\d.]+)\s*㎡")


def fetch(url: str) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": "https://m.anjuke.com/",
        },
    )
    with urlopen(req, timeout=25) as resp:
        return resp.read().decode("utf-8", "replace")


def load_communities() -> dict[int, list[int]]:
    out: dict[int, list[int]] = {1: [], 2: [], 3: []}
    if not COMMUNITIES.exists():
        return out
    for r in csv.DictReader(COMMUNITIES.open(encoding="utf-8-sig")):
        cid = int(r["city_id"])
        if cid in out:
            out[cid].append(int(r["community_id"]))
    return out


def parse_cards(
    html: str,
    city_id: int,
    city_name: str,
    communities: list[int],
    start_id: int,
) -> list[dict]:
    rows: list[dict] = []
    listing_id = start_id
    for m in re.finditer(r'href="(/[^"]*?/sale/(\d+)\.html)"', html):
        href, sid = m.group(1), m.group(2)
        window = html[max(0, m.start() - 200) : m.end() + 1800]
        text = unescape(re.sub(r"<[^>]+>", " ", window))
        text = re.sub(r"\s+", " ", text)
        pm, um, am = _PRICE.search(text), _UNIT.search(text), _AREA.search(text)
        if not (pm and um and am):
            continue
        imgs = re.findall(r"(https?://pic\d*\.ajkimg\.com/[^\"'\s>]+)", window, flags=re.I)
        cover = ""
        for raw in imgs:
            u = unescape(raw).split("?")[0]
            if "/fe/esf/" in u:
                continue
            cover = u
            break
        room = _ROOM.search(text)
        title_m = re.search(r">([^<]{4,60})</a>", window)
        title = (title_m.group(1).strip() if title_m else f"安居客 {sid}")[:80]
        url = "https://m.anjuke.com" + href if href.startswith("/") else href
        beds = int(room.group(1)) if room else 2
        rows.append(
            {
                "listing_id": str(listing_id),
                "city_id": str(city_id),
                "community_id": str(random.choice(communities) if communities else city_id * 1000),
                "title": title,
                "source": f"{city_name}安居客",
                "source_kind": "REAL",
                "source_listing_id": sid,
                "source_url": url,
                "total_price_10k": str(int(float(pm.group(1)))),
                "unit_price": um.group(1),
                "area_sqm": str(round(float(am.group(1)), 1)),
                "listing_type": "二手房",
                "bedrooms": str(beds),
                "bathrooms": str(max(1, beds - 1)),
                "orientation": "南向",
                "floor_number": "中层",
                "has_elevator": "True",
                "decorate_type": "精装",
                "build_year": "2015",
                "nearest_metro_distance_m": "",
                "school_ids_json": "[]",
                "tags_json": "[]",
                "crawl_date": date.today().isoformat(),
                "cover_url": cover,
            }
        )
        listing_id += 1
    seen: set[str] = set()
    uniq: list[dict] = []
    for r in rows:
        sid = r["source_listing_id"]
        if sid in seen:
            continue
        seen.add(sid)
        uniq.append(r)
    return uniq

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-pages", type=int, default=2)
    ap.add_argument("--cities", default="sz,gz,zh")
    ap.add_argument("--sleep", type=float, default=2.5)
    args = ap.parse_args()

    existing = list(csv.DictReader(LISTINGS.open(encoding="utf-8-sig")))
    fields = list(existing[0].keys()) if existing else []
    if "cover_url" not in fields:
        fields.append("cover_url")
        for r in existing:
            r.setdefault("cover_url", "")

    by_url = {(r.get("source_url") or "").strip(): r for r in existing if (r.get("source_url") or "").strip()}
    by_sid = {
        (r.get("source_listing_id") or "").strip(): r
        for r in existing
        if (r.get("source_listing_id") or "").strip().isdigit()
    }

    max_id = max((int(r["listing_id"]) for r in existing if str(r.get("listing_id", "")).isdigit()), default=900000)
    communities = load_communities()
    fresh: list[dict] = []
    next_id = max_id + 1

    for code in [c.strip() for c in args.cities.split(",") if c.strip()]:
        if code not in CITY:
            continue
        city_id, name = CITY[code]
        for page in range(1, args.max_pages + 1):
            url = (
                f"https://m.anjuke.com/{code}/sale/"
                if page == 1
                else f"https://m.anjuke.com/{code}/sale/p{page}/"
            )
            print(f"[fetch] {name} p{page} {url}")
            try:
                html = fetch(url)
            except Exception as exc:  # noqa: BLE001
                print(f"  ERR {type(exc).__name__}: {exc}")
                break
            print(f"  len={len(html)}")
            if len(html) < 8000:
                print("  short page — stop city")
                break
            batch = parse_cards(html, city_id, name, communities.get(city_id, []), next_id)
            print(f"  parsed={len(batch)} with_cover={sum(1 for r in batch if r.get('cover_url'))}")
            for r in batch:
                next_id = max(next_id, int(r["listing_id"]) + 1)
            fresh.extend(batch)
            time.sleep(args.sleep + random.uniform(0, 1))

    updated = 0
    inserted = 0
    for r in fresh:
        url = r["source_url"]
        sid = r["source_listing_id"]
        target = by_url.get(url) or by_sid.get(sid)
        if target:
            if r.get("cover_url") and target.get("cover_url") != r["cover_url"]:
                target["cover_url"] = r["cover_url"]
                updated += 1
            # 刷新 REAL 价区字段
            if (target.get("source_kind") or "").upper() == "REAL":
                for k in ("total_price_10k", "unit_price", "area_sqm", "title", "crawl_date"):
                    if r.get(k):
                        target[k] = r[k]
        else:
            existing.append(r)
            by_url[url] = r
            by_sid[sid] = r
            inserted += 1

    with LISTINGS.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in existing:
            w.writerow({k: r.get(k, "") for k in fields})

    filled = sum(1 for r in existing if (r.get("cover_url") or "").strip())
    print(f"[done] fresh={len(fresh)} updated={updated} inserted={inserted} cover_filled={filled} → {LISTINGS}")
    return 0 if (updated or inserted) else 2


if __name__ == "__main__":
    raise SystemExit(main())

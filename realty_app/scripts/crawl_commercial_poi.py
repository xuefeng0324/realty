"""
crawl_commercial_poi.py
========================
v0.19.0 new-2: 高德 /v3/place/around 拉商业 POI → poi_commercial.csv

3 类:
  - restaurant  (餐饮)        keywords="餐饮服务"  radius=1000m
  - bank        (银行)        keywords="银行"      radius=1500m
  - convenience (便利店)      keywords="便利店"    radius=1000m

输出 schema (同 poi_seed.csv):
  community_id, poi_category, poi_rank, poi_name, poi_type, distance_m, lat, lng, address

跑法:
  python scripts/crawl_commercial_poi.py fetch --key <your_key>
"""
from __future__ import annotations
import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
GEO_CSV = REPO_ROOT / "static" / "seed" / "communities_geo.csv"
OUT_CSV = REPO_ROOT / "static" / "seed" / "poi_commercial.csv"
API_BASE = "https://restapi.amap.com"
REQUEST_DELAY = 0.2
TOP = 5

POI_KINDS = [
    ("restaurant",  "餐饮服务", 1000),
    ("bank",        "银行",     1500),
    ("convenience", "便利店",   1000),
]


def call_around(keywords: str, location: str, key: str, radius: int) -> list[dict]:
    qs = "&".join(f"{k}={urllib.parse.quote_plus(str(v))}" for k, v in {
        "key": key, "keywords": keywords, "location": location,
        "radius": radius, "offset": TOP, "extensions": "base",
    }.items())
    url = f"{API_BASE}/v3/place/around?{qs}"
    for attempt in range(3):
        try:
            time.sleep(REQUEST_DELAY)
            with urllib.request.urlopen(url, timeout=20) as r:
                data = json.loads(r.read().decode("utf-8", errors="replace"))
                if data.get("status") == "1":
                    return data.get("pois", [])
                info = data.get("info", "")
                if "USER_DAILY_QUERY_OVER_LIMIT" in info or "QUOTA" in info.upper():
                    sys.exit(f"  [!] quota 用尽: {info}")
                if attempt == 2:
                    print(f"    [warn] {keywords}: {info}")
        except urllib.error.HTTPError as e:
            if attempt == 2:
                print(f"    [warn] HTTP {e.code}")
        except Exception as e:
            if attempt == 2:
                print(f"    [warn] {type(e).__name__}: {e}")
    return []


def load_geo() -> list[dict]:
    rows = list(csv.DictReader(open(GEO_CSV, encoding="utf-8-sig")))
    # 必须有 lat/lng
    out = []
    for r in rows:
        try:
            lat = float(r["lat"])
            lng = float(r["lng"])
            out.append({**r, "lat": lat, "lng": lng})
        except (ValueError, KeyError):
            continue
    return out


def fetch_community(c: dict, key: str) -> list[dict]:
    cid = c["community_id"]
    loc = f"{c['lng']:.6f},{c['lat']:.6f}"
    rows = []
    for cat, kw, radius in POI_KINDS:
        pois = call_around(kw, loc, key, radius)
        pois = sorted(pois, key=lambda p: float(p.get("distance") or 1e18))[:3]
        for rank, p in enumerate(pois, 1):
            try:
                lng, lat = p["location"].split(",")
                lat_f, lng_f = float(lat), float(lng)
            except (ValueError, KeyError):
                continue
            rows.append({
                "community_id": cid,
                "poi_category": cat,
                "poi_rank": rank,
                "poi_name": p["name"],
                "poi_type": p.get("type", ""),
                "distance_m": int(p.get("distance", 0)),
                "lat": f"{lat_f:.6f}",
                "lng": f"{lng_f:.6f}",
                "address": p.get("address", "")
            })
    return rows


def cmd_fetch(args):
    if not args.key:
        sys.exit("[ERR] --key 必填")
    communities = load_geo()
    print(f"[fetch] {len(communities)} 小区 × {len(POI_KINDS)} 类 POI (餐饮/银行/便利店)")
    print(f"[fetch] 预计 {len(communities) * len(POI_KINDS)} 次 API 调用")
    out: list[dict] = []
    for i, c in enumerate(communities, 1):
        name = c.get("community_name", f"#{c['community_id']}")
        print(f"  [{i:>2}/{len(communities)}] {name} ...", end="", flush=True)
        rows = fetch_community(c, args.key)
        out.extend(rows)
        print(f" {len(rows)} POI")
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "community_id", "poi_category", "poi_rank", "poi_name",
            "poi_type", "distance_m", "lat", "lng", "address"
        ])
        w.writeheader()
        for r in out:
            w.writerow(r)
    print(f"\n[ok] wrote {OUT_CSV} ({len(out)} rows)")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["fetch", "dry"])
    p.add_argument("--key", default=os.environ.get("AMAP_KEY", ""))
    args = p.parse_args()
    if args.cmd == "fetch":
        cmd_fetch(args)
    elif args.cmd == "dry":
        print("dry run: 49 小区 × 3 类 = 147 次 API 调用")
        print("用 'fetch --key <your_key>' 真正拉取")


if __name__ == "__main__":
    main()
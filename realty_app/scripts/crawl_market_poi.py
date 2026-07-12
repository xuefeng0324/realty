"""
crawl_market_poi.py — v0.32.0 new-10 菜市场 POI 扩充
=================================================

高德 /v3/place/around 拉"菜市场/农贸市场" POI → poi_market.csv

v0.31.0 生活便利度的打分系统只覆盖 5 类 (mall/park/subway/school/hospital)，
菜市场是日常生活高频配套 ("买菜便利度") 但原 POI 列表没有。
所以本脚本扩充 1 类 (菜市场)，跑完后：
  - poi_market.csv 新增
  - v0.32.0 生活便利度 v2 把菜市场加进打分 (100 → 120 满分)
  - map-view POI overlay 新增 🥬 菜市场类别

输出 schema (同 poi_seed.csv):
  community_id, poi_category, poi_rank, poi_name, poi_type, distance_m, lat, lng, address

配额消耗：52 小区 × 1 类 = 52 次（5000-30000 配额内 ✅）

跑法:
  python scripts/crawl_market_poi.py fetch --key <your_key>
  python scripts/crawl_market_poi.py dry  --key <your_key>
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
OUT_CSV = REPO_ROOT / "static" / "seed" / "poi_market.csv"
API_BASE = "https://restapi.amap.com"
REQUEST_DELAY = 0.2
TOP = 5
RADIUS_M = 1500  # 1.5km 内 5 个

# 菜市场用关键词组 (高德 typecode 不一定准确，用 keywords 更稳)
POI_KIND = ("market", "菜市场", RADIUS_M)
# 备用关键词
ALT_KEYWORDS = ["菜市场", "农贸市场", "肉菜市场", "集市"]


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


def fetch_for_community(c: dict, key: str) -> list[dict]:
    """单小区, 用 4 个备用关键词分别试, 取合并去重后距离最近的 TOP"""
    cid = c["community_id"]
    loc = f"{c['lng']:.6f},{c['lat']:.6f}"
    all_pois: dict[str, dict] = {}
    for kw in ALT_KEYWORDS:
        pois = call_around(kw, loc, key, RADIUS_M)
        for p in pois:
            pid = p.get("id") or p.get("name", "")
            if pid not in all_pois:
                all_pois[pid] = p
    sorted_pois = sorted(all_pois.values(), key=lambda p: float(p.get("distance") or 1e18))[:3]
    rows = []
    for rank, p in enumerate(sorted_pois, 1):
        try:
            lng, lat = p["location"].split(",")
            lat_f, lng_f = float(lat), float(lng)
        except (ValueError, KeyError):
            continue
        rows.append({
            "community_id": cid,
            "poi_category": "market",
            "poi_rank": rank,
            "poi_name": p.get("name", ""),
            "poi_type": p.get("type", ""),
            "distance_m": int(p.get("distance", 0)),
            "lat": f"{lat_f:.6f}",
            "lng": f"{lng_f:.6f}",
            "address": p.get("address", "")
        })
    return rows


def load_geo() -> list[dict]:
    rows = list(csv.DictReader(open(GEO_CSV, encoding="utf-8-sig")))
    out = []
    for r in rows:
        try:
            lat = float(r["lat"])
            lng = float(r["lng"])
            out.append({**r, "lat": lat, "lng": lng})
        except (ValueError, KeyError):
            continue
    return out


def cmd_fetch(args):
    if not args.key:
        sys.exit("[ERR] --key 必填")
    communities = load_geo()
    print(f"[fetch] {len(communities)} 小区 × 1 类 POI (菜市场)")
    print(f"[fetch] 预计 {len(communities) * len(ALT_KEYWORDS)} 次 API 调用 (4 keywords/cid)")
    out: list[dict] = []
    for i, c in enumerate(communities, 1):
        name = c.get("community_name", f"#{c['community_id']}")
        print(f"  [{i:>2}/{len(communities)}] {name} ...", end="", flush=True)
        rows = fetch_for_community(c, args.key)
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


def cmd_dry(args):
    if not args.key:
        sys.exit("[ERR] --key 必填")
    communities = load_geo()[:3]
    print(f"[dry] {len(communities)} 小区, 4 keywords each = {len(communities) * len(ALT_KEYWORDS)} 次 API\n")
    for c in communities:
        rows = fetch_for_community(c, args.key)
        print(f"--- {c['community_name']} ({c['lat']}, {c['lng']}) ---")
        for r in rows:
            print(f"  #{r['poi_rank']} {r['poi_name']} ({r['distance_m']}m) {r['poi_type'][:40]}")
        print()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["fetch", "dry"])
    p.add_argument("--key", default=os.environ.get("AMAP_KEY", ""))
    args = p.parse_args()
    if args.cmd == "fetch":
        cmd_fetch(args)
    elif args.cmd == "dry":
        cmd_dry(args)


if __name__ == "__main__":
    main()
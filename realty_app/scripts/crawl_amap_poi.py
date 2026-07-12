"""
高德周边 POI 抓取 → poi_seed.csv
==================================

读 communities_geo.csv 里的小区，对每个小区取附近 5 类 POI（每类取最近 3 个），写入 poi_seed.csv。
输出 schema:
    community_id, poi_category, poi_rank, poi_name, poi_type, distance_m, lat, lng, address

配额消耗：23 小区 × 5 类 × 1 次 = 115 次（5000-30000 配额内 ✅）

UI 集成（手动 patch，不强制）：
  listing-detail 可选显示"距离地铁 xxx 米 / 距离学校 xxx 米"
  dashboard 可选按"地铁最近"排序

调用示例：
    python scripts/crawl_amap_poi.py fetch --key <your_key>
    python scripts/crawl_amap_poi.py dry  --key <your_key>
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

DEFAULT_KEY = os.environ.get("AMAP_KEY", "")
GEO_CSV = Path(__file__).resolve().parents[1] / "static" / "seed" / "communities_geo.csv"
OUT_CSV = Path(__file__).resolve().parents[1] / "static" / "seed" / "poi_seed.csv"

API_BASE = "https://restapi.amap.com"
REQUEST_DELAY = 0.2  # 200ms

# 5 类 POI 取最近 top3
POI_KINDS = [
    ("subway",    "地铁站"),
    ("school",    "小学"),
    ("hospital",  "医院"),
    ("mall",      "商场"),
    ("park",      "公园"),
]
# 不同类别不同半径：医院通常较远（关外 / 新区）；地铁/学校/商场/公园 1.5km 足
POI_RADIUS_M = {
    "subway": 1500,
    "school": 1500,
    "hospital": 3000,  # v0.6.0 扩半径
    "mall": 1500,
    "park": 1500,
}
DEFAULT_RADIUS_M = 1500
TOP = 5  # 给 5 个，UI 可只读最近 3


def call_around(keywords: str, location: str, key: str, radius: int) -> list[dict]:
    qs = "&".join(f"{k}={urllib.parse.quote_plus(str(v))}" for k, v in {
        "key": key, "keywords": keywords, "location": location,
        "radius": radius, "offset": TOP, "extensions": "base",
    }.items())
    url = f"{API_BASE}/v3/place/around?{qs}"
    last_err = None
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
                last_err = info
        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code}"
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
        time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"around {keywords} @ {location}: {last_err}")


def load_geo() -> list[dict]:
    if not GEO_CSV.exists():
        print(f"[ERR] not found: {GEO_CSV}")
        print(f"      先跑：python scripts/crawl_amap_geo.py fetch --key ...")
        sys.exit(2)
    with open(GEO_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    # 过滤失败项
    return [r for r in rows if r.get("lat") and r.get("lng")]


def fetch_for_community(community: dict, key: str) -> list[dict]:
    """对单小区抓 5 类 POI，每类 top3"""
    cid = int(community["community_id"])
    loc = f"{float(community['lng']):.6f},{float(community['lat']):.6f}"
    rows = []
    for cat, kw in POI_KINDS:
        radius = POI_RADIUS_M.get(cat, DEFAULT_RADIUS_M)
        try:
            pois = call_around(kw, loc, key, radius)
        except Exception as e:
            print(f"    [warn] {community['community_name']} {kw}: {e}")
            continue
        # 取按 distance 升序的前 3
        pois = sorted(pois, key=lambda p: float(p.get("distance") or 1e18))[:3]
        for rank, p in enumerate(pois, 1):
            lng, lat = p["location"].split(",")
            rows.append({
                "community_id": cid,
                "poi_category": cat,
                "poi_rank": rank,
                "poi_name": p["name"],
                "poi_type": p.get("type", ""),
                "distance_m": int(p.get("distance", 0)),
                "lat": f"{float(lat):.6f}",
                "lng": f"{float(lng):.6f}",
                "address": p.get("address", ""),
            })
    return rows


def cmd_fetch(args):
    if not args.key:
        sys.exit("[ERR] --key 必填")
    communities = load_geo()
    print(f"[fetch] {len(communities)} 个小区 × {len(POI_KINDS)} 类 POI 各 {TOP} 个")
    out: list[dict] = []
    for i, c in enumerate(communities, 1):
        name = c["community_name"]
        print(f"  [{i:>2}/{len(communities)}] {name} ...", end="", flush=True)
        n_before = len(out)
        rows = fetch_for_community(c, args.key)
        out.extend(rows)
        print(f" +{len(rows)} rows")

    cols = ["community_id", "poi_category", "poi_rank", "poi_name",
            "poi_type", "distance_m", "lat", "lng", "address"]
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in out:
            w.writerow({k: r.get(k) for k in cols})

    # 统计
    cat_counts: dict[str, int] = {}
    for r in out:
        cat_counts[r["poi_category"]] = cat_counts.get(r["poi_category"], 0) + 1
    print(f"\n[fetch] 写入 {OUT_CSV} ({len(out)} 行)")
    for cat, _ in POI_KINDS:
        print(f"  {cat:<10s}: {cat_counts.get(cat, 0)} 行")


def cmd_dry(args):
    if not args.key:
        sys.exit("[ERR] --key 必填")
    communities = load_geo()[:3]
    for c in communities:
        print(f"\n--- {c['community_name']} ({c['lat']}, {c['lng']}) ---")
        rows = fetch_for_community(c, args.key)
        # 按类别展示
        cats = {}
        for r in rows:
            cats.setdefault(r["poi_category"], []).append(r)
        for cat, _ in POI_KINDS:
            items = cats.get(cat, [])
            print(f"  [{cat}] {len(items)} 条:")
            for r in items:
                print(f"    #{r['poi_rank']} {r['poi_name']} ({r['distance_m']}m) {r['poi_type']}")


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("dry", "fetch"):
        print("Usage: python crawl_amap_poi.py [dry|fetch] --key ...", file=sys.stderr)
        sys.exit(2)
    cmd = sys.argv[1]
    p = argparse.ArgumentParser()
    p.add_argument("--key", default=DEFAULT_KEY)
    args = p.parse_args(sys.argv[2:])
    if not args.key:
        sys.exit("[ERR] --key 必填")
    if cmd == "fetch":
        cmd_fetch(args)
    else:
        cmd_dry(args)


if __name__ == "__main__":
    main()
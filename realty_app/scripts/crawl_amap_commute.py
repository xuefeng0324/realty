"""
crawl_amap_commute.py — v0.24.0 new-5 通勤时长
=========================================

为每个有 lat/lng 的 community 计算 → 城市核心 CBD 的通勤时长。

API 端点：
1. /v3/place/text — 搜「福田 CBD」「珠江新城」POI，取坐标作为目的地
2. /v3/direction/transit/integrated — 公交通勤方案，取 duration
3. /v3/direction/walking — 步行通勤方案，取 duration (fallback)

策略：
- 仅对已有 lat/lng 的 community 计算 (来自 communities_geo.csv)
- 每城市 1 个 CBD (深圳=福田CBD, 广州=珠江新城)
- 限制请求数：每城市最多 30 个 community (免 quota)
- 输出 commute.csv: community_id, city, cbd_name, walk_minutes, transit_minutes, distance_m
"""
import csv
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

# 与现有 crawler 一致的 API key
AMAP_KEY = os.environ.get("AMAP_KEY", "f22d0a9e25abc8512dbdbe37ac3ba139")
ROOT = Path(__file__).resolve().parents[1]
SEED_DIR = ROOT / "static" / "seed"

# 城市核心 CBD (POI 关键词)
CITY_CBD = {
    "深圳": {"name": "福田CBD", "keyword": "福田CBD"},
    "广州": {"name": "珠江新城", "keyword": "珠江新城"},
}

API_BASE = "https://restapi.amap.com/v3"


def http_get_json(url: str, timeout: int = 10):
    req = urllib.request.Request(url, headers={"User-Agent": "realty_app_commute/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def search_cbd(city: str, keyword: str):
    """用 /v3/place/text 搜 CBD 中心点坐标"""
    params = {
        "key": AMAP_KEY,
        "keywords": keyword,
        "city": city,
        "offset": 1,
        "extensions": "base"
    }
    url = f"{API_BASE}/place/text?{urllib.parse.urlencode(params)}"
    try:
        data = http_get_json(url)
    except Exception as e:
        print(f"[cbd] {city}/{keyword} search failed: {e}")
        return None
    if data.get("status") != "1":
        print(f"[cbd] {city}/{keyword} status != 1: {data.get('info')}")
        return None
    pois = data.get("pois") or []
    if not pois:
        print(f"[cbd] {city}/{keyword} no pois")
        return None
    p = pois[0]
    try:
        loc = p["location"].split(",")
        return {"name": p["name"], "lat": float(loc[1]), "lng": float(loc[0])}
    except (KeyError, ValueError, IndexError):
        return None


def transit_minutes(origin_lng: float, origin_lat: float, dest_lng: float, dest_lat: float, city: str):
    """/v3/direction/transit/integrated → 第一方案的 duration (秒)"""
    params = {
        "key": AMAP_KEY,
        "origin": f"{origin_lng},{origin_lat}",
        "destination": f"{dest_lng},{dest_lat}",
        "city": city,
        "strategy": 0,  # 推荐
        "nightflag": 0,
        "date": time.strftime("%Y-%m-%d"),
        "time": "08:30"  # 早高峰参考
    }
    url = f"{API_BASE}/direction/transit/integrated?{urllib.parse.urlencode(params)}"
    try:
        data = http_get_json(url, timeout=15)
    except Exception as e:
        print(f"    [transit] failed: {e}")
        return None
    if data.get("status") != "1":
        print(f"    [transit] {city} status: {data.get('status')} info: {data.get('info')}")
        return None
    route = data.get("route") or {}
    transits = route.get("transits") or []
    if not transits:
        return None
    # 第一方案
    try:
        duration_sec = float(transits[0].get("duration", 0))
        distance_m = float(route.get("distance", 0))
        return {
            "minutes": round(duration_sec / 60, 1),
            "distance_m": round(distance_m, 0)
        }
    except (KeyError, ValueError, TypeError):
        return None


def walking_minutes(origin_lng: float, origin_lat: float, dest_lng: float, dest_lat: float):
    """步行时长 (秒) — walking API 不需 city"""
    params = {
        "key": AMAP_KEY,
        "origin": f"{origin_lng},{origin_lat}",
        "destination": f"{dest_lng},{dest_lat}"
    }
    url = f"{API_BASE}/direction/walking?{urllib.parse.urlencode(params)}"
    try:
        data = http_get_json(url, timeout=15)
    except Exception as e:
        print(f"    [walking] failed: {e}")
        return None
    if data.get("status") != "1":
        return None
    route = data.get("route") or {}
    paths = route.get("paths") or []
    if not paths:
        return None
    try:
        duration_sec = float(paths[0].get("duration", 0))
        distance_m = float(paths[0].get("distance", 0))
        return {
            "minutes": round(duration_sec / 60, 1),
            "distance_m": round(distance_m, 0)
        }
    except (KeyError, ValueError, TypeError):
        return None


def load_communities_with_geo():
    """读 communities_geo.csv → community_id → {lat, lng, city_id, city_name}"""
    communities = []
    city_path = SEED_DIR / "cities.csv"
    city_map = {}
    with open(city_path, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            city_map[int(r["city_id"])] = r["city_name"]

    with open(SEED_DIR / "communities_geo.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            cid = int(r["community_id"])
            try:
                lat = float(r["lat"])
                lng = float(r["lng"])
            except (KeyError, ValueError):
                continue
            # 通过 communities.csv 取 city_id
            communities.append({
                "community_id": cid,
                "lat": lat,
                "lng": lng
            })

    # 用 communities.csv 关联 city
    with open(SEED_DIR / "communities.csv", encoding="utf-8-sig") as f:
        cid_to_city = {int(r["community_id"]): int(r["city_id"]) for r in csv.DictReader(f)}

    out = []
    for c in communities:
        city_id = cid_to_city.get(c["community_id"])
        if city_id is None:
            continue
        city_name = city_map.get(city_id)
        if city_name not in CITY_CBD:
            continue
        c["city_id"] = city_id
        c["city_name"] = city_name
        out.append(c)
    return out


def main():
    max_per_city = int(os.environ.get("COMMUTE_MAX_PER_CITY", "30"))
    sleep_sec = float(os.environ.get("COMMUTE_SLEEP", "0.3"))

    communities = load_communities_with_geo()
    print(f"加载 {len(communities)} 个有 geo 的 community")

    by_city = defaultdict(list)
    for c in communities:
        by_city[c["city_name"]].append(c)

    # 1. 搜每个城市 CBD 坐标
    cbd_coords = {}
    for city in CITY_CBD:
        if not by_city.get(city):
            continue
        info = CITY_CBD[city]
        cbd = search_cbd(city, info["keyword"])
        if not cbd:
            print(f"⚠️ {city} CBD 未找到，跳过")
            continue
        cbd_coords[city] = cbd
        print(f"✅ {city} CBD: {cbd['name']} ({cbd['lng']:.4f}, {cbd['lat']:.4f})")
        time.sleep(sleep_sec)

    rows = []
    total_calls = 0
    for city, cbd in cbd_coords.items():
        cbs = by_city.get(city, [])
        print(f"\n=== {city}: {len(cbs)} 个 community, 上限 {max_per_city} ===")
        for c in cbs[:max_per_city]:
            t = transit_minutes(c["lng"], c["lat"], cbd["lng"], cbd["lat"], city)
            total_calls += 1
            time.sleep(sleep_sec)
            if not t:
                # fallback: walking
                t = walking_minutes(c["lng"], c["lat"], cbd["lng"], cbd["lat"])
                total_calls += 1
                time.sleep(sleep_sec)
            if not t:
                print(f"  ⚠️ #{c['community_id']} 失败")
                continue
            row = {
                "community_id": c["community_id"],
                "city_id": c["city_id"],
                "city_name": city,
                "cbd_name": cbd["name"],
                "cbd_lat": cbd["lat"],
                "cbd_lng": cbd["lng"],
                "transit_minutes": t["minutes"],
                "transit_distance_m": t["distance_m"]
            }
            rows.append(row)
            print(f"  #{c['community_id']:>3} → {cbd['name']}: {t['minutes']:>5.1f} min ({t['distance_m']/1000:.1f} km)")

    # 写 csv
    out_path = SEED_DIR / "commute.csv"
    fieldnames = [
        "community_id", "city_id", "city_name",
        "cbd_name", "cbd_lat", "cbd_lng",
        "transit_minutes", "transit_distance_m"
    ]
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"\n✅ 写 {len(rows)} 行 → {out_path}")
    print(f"   总 API 调用: {total_calls}")


if __name__ == "__main__":
    main()
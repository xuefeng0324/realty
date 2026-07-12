"""
crawl_amap_metro.py
====================
给 metro_planning.csv 的 start_station / end_station 调高德 POI text search 拿坐标，
输出 metro_planning_geo.csv 用于地图 polyline 渲染。

数据流:
  metro_planning.csv (21 行) → start/end station name + city
    → 高德 place/text search (CITY_LIMIT + " + station_name)
    → 取第 1 个 POI 的 lat/lng
    → metro_planning_geo.csv

输出:
  static/seed/metro_planning_geo.csv
  schema: line_id, start_lat, start_lng, start_formatted_address,
          start_confidence, end_lat, end_lng, end_formatted_address, end_confidence

Usage:
  python scripts/crawl_amap_metro.py            # 实跑
  python scripts/crawl_amap_metro.py --dry      # 试跑不写
"""
from __future__ import annotations
import argparse
import csv
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_CSV = REPO_ROOT / "static" / "seed" / "metro_planning.csv"
OUT_CSV = REPO_ROOT / "static" / "seed" / "metro_planning_geo.csv"

# 城市名 (用于拼查询串, 提高精度)
CITY_LIMIT = {
    "2": "深圳",
    "1": "广州",
    "3": "珠海"
}

API_URL = "https://restapi.amap.com/v3/place/text"


def http_get(url: str, timeout: int = 8) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 realty-app"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def search_station(key: str, city: str, api_key: str) -> tuple[float | None, float | None, str, str]:
    """调高德 place/text search 拿 (lat, lng, formatted_address, name).
    返回 (None, None, "", "") 表示没找到.
    """
    query = f"{city}{key}"
    params = {
        "key": api_key,
        "keywords": query,
        "city": city,
        "citylimit": "true",
        "offset": "1",
        "page": "1",
        "extensions": "base"
    }
    url = API_URL + "?" + urllib.parse.urlencode(params)
    try:
        body = http_get(url)
        data = json.loads(body)
        if data.get("status") != "1":
            return None, None, "", ""
        pois = data.get("pois") or []
        if not pois:
            return None, None, "", ""
        p = pois[0]
        loc = p.get("location", "")  # "lng,lat"
        if "," not in loc:
            return None, None, "", ""
        lng, lat = loc.split(",", 1)
        return float(lat), float(lng), p.get("address") or "", p.get("name") or ""
    except Exception as e:
        print(f"  [warn] {key} 失败: {e}", file=sys.stderr)
        return None, None, "", ""


def confidence_for(name: str, formatted: str, query: str) -> str:
    """根据返回的 POI 名判断匹配质量.
    - high: POI 名包含 query 关键词
    - medium: POI 名包含 "站/地铁/高铁/城际/路/街/村/区/院" 等地名关键字
    - low: 其它
    """
    if not name:
        return "low"
    # 高优先级: 名字包含查询关键词 (前海 / 红树湾南 / 凤凰城 等)
    if query and query in name:
        return "high"
    # 中优先级: 名字包含交通/地名关键词
    if any(c in name for c in ["站", "地铁", "高铁", "城际", "路口", "枢纽"]):
        return "high"
    return "medium"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true", help="试跑不写")
    ap.add_argument("--key", default="f22d0a9e25abc8512dbdbe37ac3ba139", help="高德 API key")
    args = ap.parse_args()

    api_key = args.key
    rows_in = []
    with open(SRC_CSV, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            rows_in.append(r)
    print(f"loaded {len(rows_in)} metro lines")

    rows_out = []
    for r in rows_in:
        line_id = r["line_id"]
        city_id = r["city_id"]
        city = CITY_LIMIT.get(city_id, "")
        line_name = r["line_name"]
        start_st = r.get("start_station", "")
        end_st = r.get("end_station", "")
        print(f"  [{line_id}] {line_name}: {start_st} ↔ {end_st} ({city})")
        s_lat, s_lng, s_addr, s_name = (None, None, "", "")
        e_lat, e_lng, e_addr, e_name = (None, None, "", "")
        if city and start_st:
            s_lat, s_lng, s_addr, s_name = search_station(start_st, city, api_key)
            time.sleep(0.05)
        if city and end_st:
            e_lat, e_lng, e_addr, e_name = search_station(end_st, city, api_key)
            time.sleep(0.05)
        rows_out.append({
            "line_id": line_id,
            "line_name": line_name,
            "city_id": city_id,
            "start_station": start_st,
            "end_station": end_st,
            "start_lat": s_lat if s_lat is not None else "",
            "start_lng": s_lng if s_lng is not None else "",
            "start_formatted_address": s_addr,
            "start_matched_name": s_name,
            "start_confidence": confidence_for(s_name, s_addr, start_st) if s_lat is not None else "missing",
            "end_lat": e_lat if e_lat is not None else "",
            "end_lng": e_lng if e_lng is not None else "",
            "end_formatted_address": e_addr,
            "end_matched_name": e_name,
            "end_confidence": confidence_for(e_name, e_addr, end_st) if e_lat is not None else "missing",
        })

    if args.dry:
        for r in rows_out:
            print(f"  {r['line_name']}: {r['start_station']}->{r['start_lat']},{r['start_lng']} ({r['start_confidence']}) | {r['end_station']}->{r['end_lat']},{r['end_lng']} ({r['end_confidence']})")
        return

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows_out[0].keys())
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows_out:
            w.writerow(r)
    print(f"wrote {OUT_CSV} ({len(rows_out)} rows)")
    high = sum(1 for r in rows_out if r["start_confidence"] == "high" and r["end_confidence"] == "high")
    print(f"  high: {high}/{len(rows_out)} (start+end 都 high)")


if __name__ == "__main__":
    main()
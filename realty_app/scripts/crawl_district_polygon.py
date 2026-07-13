"""
crawl_district_polygon.py — v0.46.0 map-11 行政区多边形爬取

通过高德 /v3/config/district 拉取每个城市的 district 边界 (polyline), 输出 district_polygon.csv。
多边形格式: "lng1,lat1;lng2,lat2;lng3,lat3..." (跟 amap polyline 一致)。
海珠/天河这种核心区在 Polygon 里可能有洞 (海珠区有海珠湖),所以需要保留 rings。

输出: district_polygon.csv
  city_code, district_code, district_name, center_lng, center_lat, polyline_count, polygons_json

polygons_json: JSON array of ring arrays, e.g. [[ring1_pts], [ring2_pts]]
"""
from __future__ import annotations
import csv
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DISTRICTS = REPO_ROOT / "static" / "seed" / "admin_districts.csv"
OUT = REPO_ROOT / "static" / "seed" / "district_polygon.csv"

AMAP_KEY = os.environ.get("AMAP_KEY", "f22d0a9e25abc8512dbdbe37ac3ba139")


def fetch_district(adcode: str) -> dict | None:
    """Return dict with polyline + center or None on failure."""
    url = "https://restapi.amap.com/v3/config/district"
    params = {
        "key": AMAP_KEY,
        "keywords": adcode,
        "subdistrict": "0",
        "extensions": "all",
        "output": "json"
    }
    q = urllib.parse.urlencode(params)
    full = f"{url}?{q}"
    try:
        req = urllib.request.Request(full, headers={"User-Agent": "realty-crawler/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  fetch err {adcode}: {e}")
        return None
    if data.get("status") != "1":
        print(f"  status err {adcode}: {data.get('info')}")
        return None
    districts = data.get("districts") or []
    if not districts:
        return None
    d = districts[0]
    polyline = d.get("polyline") or ""
    center = d.get("center") or ""
    return {"polyline": polyline, "center": center}


def decode_polyline(polyline: str) -> list[tuple[float, float]]:
    """amap polyline "lng,lat;lng,lat;..." -> [(lng, lat)]"""
    pts = []
    for token in polyline.split(";"):
        if not token:
            continue
        parts = token.split(",")
        if len(parts) != 2:
            continue
        try:
            pts.append((float(parts[0]), float(parts[1])))
        except ValueError:
            continue
    return pts


def main():
    # 收集要拉取的 (adcode, name) 去重
    targets: dict[str, str] = {}  # adcode -> name
    with open(DISTRICTS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            ac = r.get("district_code") or ""
            nm = r.get("district_name") or ""
            if ac and ac not in targets:
                targets[ac] = nm

    print(f"[plan] 拉取 {len(targets)} 个行政区边界")

    rows = []
    for adcode, name in sorted(targets.items()):
        # 已经存在就跳过 (增量)
        existing = {}
        if OUT.exists():
            with open(OUT, encoding="utf-8-sig") as f:
                for r in csv.DictReader(f):
                    if r.get("district_code") == adcode:
                        existing = r
                        break
        if existing.get("polyline_count") and existing["polyline_count"] != "0":
            print(f"  skip {name} ({adcode}) - cached")
            # 保留旧记录
            rows.append({
                "district_code": existing.get("district_code", adcode),
                "district_name": existing.get("district_name", name),
                "center_lng": existing.get("center_lng", ""),
                "center_lat": existing.get("center_lat", ""),
                "polyline_count": existing.get("polyline_count", "0"),
                "polygons_json": existing.get("polygons_json", "[]")
            })
            continue

        print(f"  fetch {name} ({adcode}) ...")
        d = fetch_district(adcode)
        if not d or not d.get("polyline"):
            print(f"    fail {name}")
            rows.append({
                "district_code": adcode,
                "district_name": name,
                "center_lng": "",
                "center_lat": "",
                "polyline_count": "0",
                "polygons_json": "[]"
            })
            time.sleep(0.3)
            continue
        # polyline 用 | 分隔多个多边形 (不同环), 含洞情况
        # amap 约定: 多边形之间用 | 分隔, 一个多边形内是 ; 分隔点
        raw_polys = d["polyline"].split("|")
        all_rings: list[list[tuple[float, float]]] = []
        for rp in raw_polys:
            ring = decode_polyline(rp)
            if ring:
                all_rings.append(ring)
        center_lng = center_lat = ""
        if d["center"]:
            parts = d["center"].split(",")
            if len(parts) == 2:
                center_lng, center_lat = parts[0], parts[1]
        rows.append({
            "district_code": adcode,
            "district_name": name,
            "center_lng": center_lng,
            "center_lat": center_lat,
            "polyline_count": str(len(all_rings)),
            "polygons_json": json.dumps(all_rings, ensure_ascii=False)
        })
        print(f"    OK {name}: {len(all_rings)} rings, first ring {len(all_rings[0]) if all_rings else 0} pts")
        time.sleep(0.5)  # 限流

    cols = ["district_code", "district_name", "center_lng", "center_lat", "polyline_count", "polygons_json"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"[ok] wrote {OUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
"""
crawl_amap_hospital.py
======================
用高德 POI 校验 hospitals.csv 的经纬度 + 补 amap_poi_id + formatted_address。

输入：static/seed/hospitals.csv (50 条)
输出：static/seed/hospitals_geo.csv
       [hospital_id, lat, lng, amap_poi_id, formatted_address, match_confidence, source]

策略：
  1. 高德 text 搜索 "医院简称/官方名 + 城市" → 取 type 含 "综合医院"/"三级甲等医院"/"专科医院"/"中医医院" 的 POI
  2. 反查经纬度 + 地址
  3. 与原 CSV 经纬度对比，距离 < 300m 算 high；300-1000m 算 medium；>1000m / 找不到算 low（保留原值）

配额：50 条 × 2 次（text + reverse） ≈ 100 次（5000-30000/天配额内 ✅）

运行：
  set AMAP_KEY=xxx
  python scripts/crawl_amap_hospital.py            # 实际拉
  python scripts/crawl_amap_hospital.py --dry      # 只打印不会写
"""
from __future__ import annotations
import argparse
import csv
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
HOSPITALS_CSV = REPO_ROOT / "static" / "seed" / "hospitals.csv"
OUT_CSV = REPO_ROOT / "static" / "seed" / "hospitals_geo.csv"

CITY_NAMES = {1: "广州", 2: "深圳", 3: "珠海"}

# 高德 POI type 关键词（命中的优先）
HOSPITAL_TYPES = (
    "综合医院", "三级甲等医院", "三级医院", "二级甲等医院",
    "专科医院", "中医医院", "中西医结合医院", "妇幼保健院",
)

API_BASE = "https://restapi.amap.com"
REQUEST_DELAY = 0.2

POI_CACHE: dict[str, list] = {}


def call(api: str, params: dict, key: str, retries: int = 3) -> dict:
    params = {**params, "key": key, "output": "json"}
    qs = "&".join(f"{k}={urllib.parse.quote_plus(str(v))}" for k, v in params.items())
    url = f"{api}?{qs}"
    last_err: str | None = None
    for attempt in range(retries):
        try:
            time.sleep(REQUEST_DELAY)
            with urllib.request.urlopen(url, timeout=20) as r:
                data = json.loads(r.read().decode("utf-8", errors="replace"))
                if data.get("status") == "1":
                    return data
                info = data.get("info", "")
                if "USER_DAILY_QUERY_OVER_LIMIT" in info or "QUOTA" in info.upper():
                    sys.exit(f"  [!] 高德 quota 用尽: {info}")
                last_err = f"{info} (infocode={data.get('infocode')})"
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace") if e.fp else ""
            last_err = f"HTTP {e.code}: {body[:200]}"
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
        time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"call {api} failed: {last_err}")


def text_search_hospital(name: str, city_cn: str, key: str) -> list[dict]:
    """关键字搜索 + 过滤医院类型，按 type 匹配度排序"""
    cache_key = f"text:{city_cn}:{name}"
    if cache_key in POI_CACHE:
        return POI_CACHE[cache_key]
    data = call(
        f"{API_BASE}/v3/place/text",
        {"keywords": name, "city": city_cn, "citylimit": "true", "offset": 20, "types": "090100|090101|090102|090200|090201"},
        key,
    )
    pois = data.get("pois", [])
    # 评分：name 完全匹配 + type 命中 > 仅 type 命中 > 仅 name 包含
    out = sorted(
        pois,
        key=lambda p: (
            -(4 if p.get("name") == name and any(t in p.get("type", "") for t in HOSPITAL_TYPES) else
              3 if any(t in p.get("type", "") for t in HOSPITAL_TYPES) else
              2 if name[:4] in p.get("name", "") else
              1 if "医院" in p.get("name", "") else 0)
        ),
    )
    POI_CACHE[cache_key] = out
    return out


def reverse_geocode(lng_lat: str, key: str) -> dict:
    data = call(
        f"{API_BASE}/v3/geocode/regeo",
        {"location": lng_lat, "extensions": "base", "batch": "false"},
        key,
    )
    return data.get("regeocode", {})


def haversine_m(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    """两个经纬度之间的距离（米）"""
    R = 6371000.0
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return R * c


def resolve_hospital(row: dict, key: str) -> dict:
    """返回 {lat, lng, amap_poi_id, formatted_address, confidence, source}"""
    city_cn = CITY_NAMES[int(row["city_id"])]
    # 优先用官方名 → display_name
    candidates = [row["official_name"], row["display_name"]]
    for kw in candidates:
        if not kw:
            continue
        for p in text_search_hospital(kw, city_cn, key):
            loc = p.get("location", "")
            if "," not in loc:
                continue
            try:
                lng, lat = map(float, loc.split(","))
            except ValueError:
                continue
            rg = reverse_geocode(loc, key) or {}
            addr = rg.get("formatted_address", p.get("address", ""))
            dist_m = haversine_m(float(row["lng"]), float(row["lat"]), lng, lat)
            if dist_m < 500:
                conf = "high"
            elif dist_m < 2000:
                conf = "medium"
            else:
                conf = "low"
            return {
                "lat": lat,
                "lng": lng,
                "amap_poi_id": p.get("id", ""),
                "formatted_address": addr,
                "confidence": conf,
                "source": "amap_text",
                "distance_m": round(dist_m, 1),
            }
    # 找不到 → 保留原值
    return {
        "lat": float(row["lat"]),
        "lng": float(row["lng"]),
        "amap_poi_id": "",
        "formatted_address": row["address"],
        "confidence": "low",
        "source": "fallback",
        "distance_m": -1.0,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=os.environ.get("AMAP_KEY", ""), help="高德 API key")
    ap.add_argument("--dry", action="store_true", help="dry run")
    ap.add_argument("--limit", type=int, default=0, help="只处理前 N 条（测试）")
    args = ap.parse_args()

    if not args.key:
        sys.exit("需要 --key 或 AMAP_KEY")

    with open(HOSPITALS_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if args.limit > 0:
        rows = rows[: args.limit]

    out_rows = []
    for i, row in enumerate(rows):
        try:
            r = resolve_hospital(row, args.key)
        except Exception as e:
            print(f"  [{i+1}/{len(rows)}] {row['official_name']} 失败: {e}", file=sys.stderr)
            r = {
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
                "amap_poi_id": "",
                "formatted_address": row["address"],
                "confidence": "low",
                "source": "error",
                "distance_m": -1.0,
            }
        out_rows.append({"hospital_id": row["hospital_id"], **r})
        flag = "" if r["confidence"] == "high" else f" [{r['confidence']}, dist={r['distance_m']}m]"
        print(f"  [{i+1}/{len(rows)}] {row['official_name']} ({CITY_NAMES[int(row['city_id'])]}) → {r['lat']:.4f},{r['lng']:.4f} via {r['source']}{flag}")

    if args.dry:
        print(f"\n[dry] would write {len(out_rows)} rows to {OUT_CSV}")
        return

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "hospital_id", "lat", "lng", "amap_poi_id",
            "formatted_address", "confidence", "source", "distance_m",
        ])
        w.writeheader()
        for r in out_rows:
            w.writerow(r)
    print(f"\nwrote {OUT_CSV} ({len(out_rows)} rows)")

    # 统计
    from collections import Counter
    c = Counter(r["confidence"] for r in out_rows)
    print(f"confidence: {dict(c)}")


if __name__ == "__main__":
    main()
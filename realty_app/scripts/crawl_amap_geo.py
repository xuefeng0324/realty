"""
高德 geocode 填充（communities.csv 加经纬度 + 补 district）
==========================================================

输入：static/seed/communities.csv（23 个 seed + 已追加的新小区）
输出：static/seed/communities_geo.csv（[community_id, lat, lng, district, amap_poi_id, formatted_address]）

调用：4 个高德接口
  1. text           关键字搜索 → 找到匹配小区 POI（验证小区真的存在）
  2. geocode/geo    纯地理编码 → 经纬度（兜底）
  3. around(bus=...) 如果上面有结果，验证最近公交/地铁距离（可选）
  4. geocode/regeo  经纬度 → 行政区（district）

配额消耗：1 个小区平均 2-3 次请求（text + geocode + reverse）
         79 个小区 × 3 次 ≈ 240 次（5000-30000 配额内 ✅）

前置：
  - export AMAP_KEY=<your_key>
  - 或设 KEY 环境变量
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# 默认 Key，从环境变量读；不在仓库里硬编码（防止泄露）
DEFAULT_KEY = os.environ.get("AMAP_KEY", "")
SEED_COMMUNITIES = Path(__file__).resolve().parents[1] / "static" / "seed" / "communities.csv"
OUT_CSV = Path(__file__).resolve().parents[1] / "static" / "seed" / "communities_geo.csv"

# 城市→中文名映射（与 communities.csv 一致）
CITY_NAMES = {1: "广州", 2: "深圳", 3: "珠海"}

API_BASE = "https://restapi.amap.com"
REQUEST_DELAY = 0.2  # 200ms，礼貌

POI_CACHE: dict[str, dict] = {}


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


# ---------- 3 个高德接口封装 ----------

def text_search(name: str, city_cn: str, key: str) -> list[dict]:
    """关键字搜索 → POI 列表。优先取 type 含 '住宅小区'/'住宅区'"""
    cache_key = f"text:{city_cn}:{name}"
    if cache_key in POI_CACHE:
        return POI_CACHE[cache_key]
    data = call(
        f"{API_BASE}/v3/place/text",
        {"keywords": name, "city": city_cn, "citylimit": "true", "offset": 20},
        key,
    )
    pois = data.get("pois", [])
    # 评分：住宅小区 > 住宅区 > 楼宇 > 其他；同分取第一个
    out = sorted(
        pois,
        key=lambda p: (
            -(3 if "住宅小区" in p.get("type", "") else
              2 if "住宅区" in p.get("type", "") else
              1 if "楼宇" in p.get("type", "") else 0)
        ),
    )
    POI_CACHE[cache_key] = out
    return out


def geocode(address: str, city_cn: str, key: str) -> dict | None:
    """address → {location, formatted_address, adcode}"""
    cache_key = f"geo:{city_cn}:{address}"
    if cache_key in POI_CACHE:
        return POI_CACHE[cache_key]
    data = call(
        f"{API_BASE}/v3/geocode/geo",
        {"address": address, "city": city_cn},
        key,
    )
    gcs = data.get("geocodes", [])
    out = gcs[0] if gcs else None
    POI_CACHE[cache_key] = out
    return out


def reverse_geocode(lng_lat: str, key: str) -> dict | None:
    """经纬度 → {formatted_address, addressComponent.district, adcode}"""
    cache_key = f"regeo:{lng_lat}"
    if cache_key in POI_CACHE:
        return POI_CACHE[cache_key]
    data = call(
        f"{API_BASE}/v3/geocode/regeo",
        {"location": lng_lat, "extensions": "base", "batch": "false"},
        key,
    )
    rc = data.get("regeocode", {})
    POI_CACHE[cache_key] = rc
    return rc


# ---------- 单小区解析 ----------

def resolve_community(name: str, city_cn: str, key: str) -> dict:
    """综合 text + geocode + regeo 推断小区经纬度和 district。

    优先级：
      1. text 搜索（如'华润城润府'，命中 type 含'住宅小区'的 POI）→ 用该 POI 的经纬度
      2. geocode（如'华润城润府小区'或'广东省深圳市南山区华润城润府'）→ 用 geocode 结果
      3. reject None

    返回：{
        'lat': float,
        'lng': float,
        'district': str,
        'formatted_address': str,
        'amap_poi_id': str | None,
        'confidence': 'high' | 'medium' | 'low',
        'source': 'text' | 'geocode',
        'raw': ...
    }
    """
    # 1) text 搜索
    try:
        for p in text_search(name, city_cn, key):
            t = p.get("type", "")
            if "住宅小区" in t or "住宅区" in t:
                loc = p.get("location", "")  # "lng,lat"
                if "," in loc:
                    lng, lat = map(float, loc.split(","))
                    rg = reverse_geocode(loc, key) or {}
                    addr = rg.get("formatted_address", p.get("address", ""))
                    district = rg.get("addressComponent", {}).get("district", "")
                    return {
                        "lat": lat,
                        "lng": lng,
                        "district": district,
                        "formatted_address": addr,
                        "amap_poi_id": p.get("id", ""),
                        "confidence": "high",
                        "source": "text",
                    }
    except Exception as e:
        print(f"    [text warn] {name}: {e}")

    # 2) geocode 兜底
    try:
        # 尝试 "xx小区" 后缀（geocode 更喜欢这种）
        for addr_try in [f"{name}小区", name, f"{city_cn}{name}"]:
            gc = geocode(addr_try, city_cn, key)
            if gc:
                loc = gc.get("location", "")
                if "," in loc:
                    lng, lat = map(float, loc.split(","))
                    rg = reverse_geocode(loc, key) or {}
                    addr = gc.get("formatted_address", "")
                    district = rg.get("addressComponent", {}).get("district", "")
                    return {
                        "lat": lat,
                        "lng": lng,
                        "district": district,
                        "formatted_address": addr,
                        "amap_poi_id": gc.get("adcode", ""),
                        "confidence": "medium",
                        "source": "geocode",
                    }
    except Exception as e:
        print(f"    [geocode warn] {name}: {e}")

    return {
        "lat": None,
        "lng": None,
        "district": "",
        "formatted_address": "",
        "amap_poi_id": "",
        "confidence": "fail",
        "source": "none",
    }


# ---------- 主流程 ----------

def load_communities() -> list[dict]:
    if not SEED_COMMUNITIES.exists():
        print(f"[ERR] not found: {SEED_COMMUNITIES}")
        return []
    with open(SEED_COMMUNITIES, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def cmd_fetch(args):
    if not args.key:
        print("[ERR] 必须提供 --key（或 AMAP_KEY 环境变量）")
        sys.exit(2)
    cities = load_communities()
    print(f"[fetch] 总共 {len(cities)} 个小区，待 geocode")
    out_rows: list[dict] = []

    high = med = fail = 0
    for i, row in enumerate(cities, 1):
        cid = int(row["community_id"])
        name = row["community_name"].strip()
        city_id = int(row["city_id"])
        city_cn = CITY_NAMES.get(city_id, "")

        print(f"  [{i:>3}/{len(cities)}] city={city_cn} {name} ...", end="", flush=True)
        result = resolve_community(name, city_cn, args.key)
        result["community_id"] = cid
        result["city_id"] = city_id
        result["community_name"] = name
        out_rows.append(result)

        if result["confidence"] == "high":
            high += 1
            print(f" OK high ({result['source']}): {result['lat']:.6f},{result['lng']:.6f} district='{result['district']}'")
        elif result["confidence"] == "medium":
            med += 1
            print(f" OK med  ({result['source']}): {result['lat']:.6f},{result['lng']:.6f}")
        else:
            fail += 1
            print(f" ❌ fail")

    # 写 CSV
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    cols = [
        "community_id", "city_id", "community_name",
        "lat", "lng", "district", "formatted_address",
        "amap_poi_id", "confidence", "source",
    ]
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in out_rows:
            # 格式化浮点
            for k in ("lat", "lng"):
                if r.get(k) is not None:
                    r[k] = f"{r[k]:.6f}"
            w.writerow({k: r.get(k) for k in cols})
    print(f"\n[fetch] 写入 {OUT_CSV} ({len(out_rows)} 行) high={high} med={med} fail={fail}")


def cmd_dry(args):
    """跑前 3 个小区看效果，不写文件"""
    if not args.key:
        print("[ERR] 必须提供 --key")
        sys.exit(2)
    cities = load_communities()[:3]
    for row in cities:
        cid = int(row["community_id"])
        name = row["community_name"].strip()
        city_id = int(row["city_id"])
        city_cn = CITY_NAMES.get(city_id, "")
        print(f"\n--- city={city_cn} {name} (id={cid}) ---")
        result = resolve_community(name, city_cn, args.key)
        print(json.dumps(result, ensure_ascii=False, indent=2))


def main():
    """Usage:
      python crawl_amap_geo.py dry  --key ...
      python crawl_amap_geo.py fetch --key ...
    """
    if len(sys.argv) < 2 or sys.argv[1] not in ("dry", "fetch"):
        print("Usage: python crawl_amap_geo.py [dry|fetch] --key ...", file=sys.stderr)
        sys.exit(2)
    cmd = sys.argv[1]
    rest = sys.argv[2:]
    p = argparse.ArgumentParser()
    p.add_argument("--key", default=DEFAULT_KEY,
                   help="高德 Web 服务 Key（也可用环境变量 AMAP_KEY）")
    args = p.parse_args(rest)

    if not args.key:
        print("[ERR] 必须提供 --key（或 AMAP_KEY 环境变量）", file=sys.stderr)
        sys.exit(2)

    if cmd == "fetch":
        cmd_fetch(args)
    else:
        cmd_dry(args)


if __name__ == "__main__":
    main()
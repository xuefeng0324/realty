"""
crawl_amap_weather.py
======================
给三座目标城市 (深圳/广州/珠海) 调高德 weather API:
  - 实况: base
  - 预报: all (未来 4 天)

输出:
  static/seed/weather.csv
  schema: city_id, city_name, adcode, report_type, report_time,
          weather, temperature, winddirection, windpower, humidity,
          forecast_json (仅 forecast 行带, JSON 字符串包含 casts)

AQI 字段留空,因为高德 weather API 不提供 AQI。

Usage:
  python scripts/crawl_amap_weather.py            # 实跑
  python scripts/crawl_amap_weather.py --dry      # 试跑不写
"""
from __future__ import annotations
import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_CSV = REPO_ROOT / "static" / "seed" / "weather.csv"

API_URL = "https://restapi.amap.com/v3/weather/weatherInfo"

# 城市 adcode (440300=深圳, 440100=广州, 440400=珠海)
CITIES = [
    {"city_id": 2, "city_name": "深圳", "adcode": "440300"},
    {"city_id": 1, "city_name": "广州", "adcode": "440100"},
    {"city_id": 3, "city_name": "珠海", "adcode": "440400"},
]


def http_get(url: str, timeout: int = 8) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 realty-app"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def fetch_weather(city: dict, ext: str, api_key: str) -> dict:
    params = {
        "key": api_key,
        "city": city["adcode"],
        "extensions": ext
    }
    url = API_URL + "?" + urllib.parse.urlencode(params)
    body = http_get(url)
    return json.loads(body)


def parse_live(city: dict, data: dict) -> dict:
    """解析 base 实况."""
    if data.get("status") != "1":
        return {"city_id": city["city_id"], "report_type": "live", "ok": False, "info": data.get("info", "")}
    lives = data.get("lives") or []
    if not lives:
        return {"city_id": city["city_id"], "report_type": "live", "ok": False, "info": "no lives"}
    lv = lives[0]
    return {
        "city_id": city["city_id"],
        "city_name": city["city_name"],
        "adcode": city["adcode"],
        "report_type": "live",
        "report_time": lv.get("reporttime", ""),
        "weather": lv.get("weather", ""),
        "temperature": lv.get("temperature", ""),
        "winddirection": lv.get("winddirection", ""),
        "windpower": lv.get("windpower", ""),
        "humidity": lv.get("humidity", ""),
        "forecast_json": "",
        "ok": True
    }


def parse_forecast(city: dict, data: dict) -> dict:
    """解析 all 预报 (含 4 天 casts)."""
    if data.get("status") != "1":
        return {"city_id": city["city_id"], "report_type": "forecast", "ok": False, "info": data.get("info", "")}
    fcs = data.get("forecasts") or []
    if not fcs:
        return {"city_id": city["city_id"], "report_type": "forecast", "ok": False, "info": "no forecasts"}
    fc = fcs[0]
    return {
        "city_id": city["city_id"],
        "city_name": city["city_name"],
        "adcode": city["adcode"],
        "report_type": "forecast",
        "report_time": fc.get("reporttime", ""),
        "weather": "",
        "temperature": "",
        "winddirection": "",
        "windpower": "",
        "humidity": "",
        "forecast_json": json.dumps(fc.get("casts") or [], ensure_ascii=False),
        "ok": True
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--key", default="f22d0a9e25abc8512dbdbe37ac3ba139")
    args = ap.parse_args()

    api_key = args.key
    rows: list[dict] = []
    for city in CITIES:
        print(f"fetching {city['city_name']} ({city['adcode']})...")
        try:
            live_data = fetch_weather(city, "base", api_key)
            time.sleep(0.2)
            fc_data = fetch_weather(city, "all", api_key)
        except Exception as e:
            print(f"  [warn] {city['city_name']} 失败: {e}", file=sys.stderr)
            continue
        rows.append(parse_live(city, live_data))
        rows.append(parse_forecast(city, fc_data))

    ok_rows = [r for r in rows if r.get("ok")]
    print(f"\n共 {len(rows)} 行 (ok={len(ok_rows)}, fail={len(rows) - len(ok_rows)})")

    if args.dry:
        for r in ok_rows:
            print(f"  [{r['city_name']}] {r['report_type']}: {r.get('weather') or r.get('forecast_json', '')[:80]}")
        return

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "city_id", "city_name", "adcode", "report_type", "report_time",
        "weather", "temperature", "winddirection", "windpower", "humidity", "forecast_json"
    ]
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            r.pop("ok", None)
            r.pop("info", None)
            w.writerow({k: r.get(k, "") for k in fieldnames})
    print(f"wrote {OUT_CSV} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
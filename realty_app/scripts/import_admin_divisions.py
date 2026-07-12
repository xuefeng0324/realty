"""
import_admin_divisions.py
========================
下载 modood/Administrative-divisions-of-China 的省/市/区 3 级数据，
对齐到 realty_app 已支持的 3 城（深圳/广州/珠海），输出
static/seed/admin_districts.csv

数据源：https://github.com/modood/Administrative-divisions-of-China
许可：MIT
字段：
  city_id          app 内 city_id  (1=广州,2=深圳,3=珠海)
  city_code        国家统计局 6 位市代码 (4403, 4401, 4404)
  district_code    国家统计局 6 位区代码
  district_name    区名（官方口径）
  source           modood/Administrative-divisions-of-China @ master

使用：
    python scripts/import_admin_divisions.py fetch
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_CSV = REPO_ROOT / "static" / "seed" / "admin_districts.csv"

SOURCE_URL = (
    "https://raw.githubusercontent.com/modood/"
    "Administrative-divisions-of-China/master/dist/areas.json"
)

# app city_id ↔ 国家统计局 6 位 city_code
CITY_CODE_TO_APP_ID = {
    "4401": 1,  # 广州
    "4403": 2,  # 深圳
    "4404": 3,  # 珠海
}


def fetch_areas_json() -> list[dict]:
    req = urllib.request.Request(SOURCE_URL, headers={
        "User-Agent": "Mozilla/5.0 (realty_app seed importer)",
        "Accept-Encoding": "gzip, deflate",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                import gzip
                body = gzip.decompress(body)
            return json.loads(body.decode("utf-8"))
    except urllib.error.URLError as e:
        sys.exit(f"FAIL: {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry", action="store_true", help="只打摘要，不写")
    args = parser.parse_args()

    rows = fetch_areas_json()
    print(f"[fetch] modood/Admin: {len(rows)} 个区/县级")

    # 过滤 3 城 (city_id 1/2/3)
    out: list[dict] = []
    for r in rows:
        cc = r.get("cityCode", "")
        city_id = CITY_CODE_TO_APP_ID.get(cc)
        if city_id is None:
            continue
        out.append({
            "city_id": city_id,
            "city_code": cc,
            "district_code": r.get("code", ""),
            "district_name": r.get("name", ""),
        })

    # 按 (city_id, district_name) 排序
    out.sort(key=lambda r: (r["city_id"], r["district_name"]))

    print(f"[filter] 三城（深圳/广州/珠海）：{len(out)} 个区")
    cnt_by_city: dict[int, int] = {}
    for r in out:
        cnt_by_city[r["city_id"]] = cnt_by_city.get(r["city_id"], 0) + 1
    for cid, n in cnt_by_city.items():
        print(f"  city_id={cid}: {n} 个区")

    # 8 列
    fields = ["city_id", "city_code", "district_code", "district_name"]
    if args.dry:
        print(f"\n[dry] 未写 {OUT_CSV}")
        for r in out[:8]:
            print(f"  sample: city_id={r['city_id']} dist={r['district_name']} code={r['district_code']}")
        return

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in out:
            w.writerow(r)
    print(f"\nwrote {OUT_CSV} ({len(out)} rows)")


if __name__ == "__main__":
    main()

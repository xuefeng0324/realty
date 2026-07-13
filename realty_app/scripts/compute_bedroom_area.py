"""
compute_bedroom_area.py — v0.42.0 trend-22 户型 × 面积 联合分布
================================================================

读 listings.csv, 对每 (city, bedrooms, area_sqm_bucket) 算 count + median_unit_price。
5 户型 (1/2/3/4/5) × 6 面积桶 (<50, 50-80, 80-110, 110-150, 150-200, 200+) = 最多 30 桶。

输出: bedroom_area.csv
  city_id, city_name, bedrooms, area_bucket, count, share, median_unit_price
"""
from __future__ import annotations
import csv
import statistics
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS = REPO_ROOT / "static" / "seed" / "listings.csv"
CITIES = REPO_ROOT / "static" / "seed" / "cities.csv"
OUT = REPO_ROOT / "static" / "seed" / "bedroom_area.csv"


def n(v):
    if v is None or v == "":
        return None
    try:
        x = float(v);
        return x if x == x else None
    except (ValueError, TypeError):
        return None


def bucket_area(v):
    a = n(v)
    if a is None:
        return "未知"
    if a < 50: return "<50"
    if a < 80: return "50-80"
    if a < 110: return "80-110"
    if a < 150: return "110-150"
    if a < 200: return "150-200"
    return "200+"


def main():
    city_names: dict[int, str] = {}
    with open(CITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try: city_names[int(r["city_id"])] = r["city_name"]
            except: continue

    by_city_bucket: dict[tuple, list[float]] = defaultdict(list)
    by_city_total: dict[int, int] = defaultdict(int)
    with open(LISTINGS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["city_id"])
                bed = r.get("bedrooms")
                if not bed: continue
                bed = int(bed)
                area = bucket_area(r.get("area_sqm"))
                if area == "未知": continue
                price = n(r.get("unit_price"))
                if price is None or price <= 0: continue
                by_city_bucket[(cid, bed, area)].append(price)
                by_city_total[cid] += 1
            except (ValueError, KeyError):
                continue

    rows = []
    for (cid, bed, area), prices in by_city_bucket.items():
        if len(prices) < 3: continue
        rows.append({
            "city_id": cid,
            "city_name": city_names.get(cid, str(cid)),
            "bedrooms": bed,
            "area_bucket": area,
            "count": len(prices),
            "share": round(len(prices) / by_city_total[cid], 4) if by_city_total[cid] > 0 else 0,
            "median_unit_price": round(statistics.median(prices))
        })

    rows.sort(key=lambda r: (r["city_id"], r["bedrooms"], r["area_bucket"]))

    cols = ["city_id", "city_name", "bedrooms", "area_bucket", "count", "share", "median_unit_price"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"[ok] wrote {OUT} ({len(rows)} rows)")

    by_city: dict[int, int] = defaultdict(int)
    for r in rows: by_city[r["city_id"]] += 1
    for c in sorted(by_city):
        print(f"  cityId={c} ({city_names.get(c, '?')}): {by_city[c]} 桶")

    # top 1 per (city, bedrooms)
    for c in sorted(by_city):
        c_rows = [r for r in rows if r["city_id"] == c]
        for bed in [1, 2, 3, 4, 5]:
            b_rows = [r for r in c_rows if r["bedrooms"] == bed]
            if not b_rows: continue
            top = max(b_rows, key=lambda r: r["count"])
            print(f"  {city_names.get(c)} {bed}室: {top['area_bucket']} {top['count']} 套 中位 {top['median_unit_price']}元")


if __name__ == "__main__":
    main()
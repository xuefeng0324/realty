"""
compute_orientation_floor.py — v0.43.0 trend-23 朝向 × 楼层 交叉分析
========================================================================

读 listings.csv, 对每 (city, orientation, floor_bucket) 算 count + share + median_unit_price
+ premium_pct_vs_city_median。

保留的 orientation: ["东南", "南", "西", "南北通透", "北", "东", "南北"] (top 7)
保留的 floor_bucket: ["低楼层", "中楼层", "高楼层", "顶层"] (canonical 4)

输出: orientation_floor.csv
  city_id, city_name, orientation, floor_bucket, count, share, median_unit_price, premium_pct
"""
from __future__ import annotations
import csv
import statistics
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS = REPO_ROOT / "static" / "seed" / "listings.csv"
CITIES = REPO_ROOT / "static" / "seed" / "cities.csv"
OUT = REPO_ROOT / "static" / "seed" / "orientation_floor.csv"

# canonical categories
ORIENTATIONS = ["东南", "南", "西", "南北通透", "北", "东", "南北"]
FLOOR_BUCKETS = ["低楼层", "中楼层", "高楼层", "顶层"]


def n(v):
    if v is None or v == "":
        return None
    try:
        x = float(v);
        return x if x == x else None
    except (ValueError, TypeError):
        return None


def main():
    city_names: dict[int, str] = {}
    with open(CITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try: city_names[int(r["city_id"])] = r["city_name"]
            except: continue

    # (city, orientation, floor) -> [unit_prices]
    by_cell: dict[tuple, list[float]] = defaultdict(list)
    # city -> [unit_prices] (for city median)
    by_city: dict[int, list[float]] = defaultdict(list)

    with open(LISTINGS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["city_id"])
                o = r.get("orientation") or ""
                fl = r.get("floor_number") or ""
                if o not in ORIENTATIONS: continue
                if fl not in FLOOR_BUCKETS: continue
                p = n(r.get("unit_price"))
                if p is None or p <= 0: continue
                by_cell[(cid, o, fl)].append(p)
                by_city[cid].append(p)
            except (ValueError, KeyError):
                continue

    city_median: dict[int, float] = {c: statistics.median(ps) for c, ps in by_city.items() if len(ps) >= 5}

    rows = []
    for (cid, o, fl), prices in by_cell.items():
        if cid not in city_median: continue
        if len(prices) < 5: continue
        cm = city_median[cid]
        premium_pct = round((statistics.median(prices) - cm) / cm * 100, 1) if cm > 0 else 0
        rows.append({
            "city_id": cid,
            "city_name": city_names.get(cid, str(cid)),
            "orientation": o,
            "floor_bucket": fl,
            "count": len(prices),
            "share": round(len(prices) / len(by_city[cid]), 4) if by_city[cid] else 0,
            "median_unit_price": round(statistics.median(prices)),
            "premium_pct": premium_pct
        })

    rows.sort(key=lambda r: (r["city_id"], r["orientation"], r["floor_bucket"]))

    cols = ["city_id", "city_name", "orientation", "floor_bucket", "count", "share", "median_unit_price", "premium_pct"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"[ok] wrote {OUT} ({len(rows)} rows)")

    by_city: dict[int, int] = defaultdict(int)
    for r in rows: by_city[r["city_id"]] += 1
    for c in sorted(by_city):
        print(f"  cityId={c} ({city_names.get(c, '?')}): {by_city[c]} cells, median={int(city_median[c])}")

    # insights
    for c in sorted(by_city):
        c_rows = [r for r in rows if r["city_id"] == c]
        if not c_rows: continue
        best = max(c_rows, key=lambda r: r["premium_pct"])
        worst = min(c_rows, key=lambda r: r["premium_pct"])
        print(f"  {city_names[c]} 最贵: {best['orientation']}/{best['floor_bucket']} +{best['premium_pct']}%")
        print(f"  {city_names[c]} 最贱: {worst['orientation']}/{worst['floor_bucket']} {worst['premium_pct']}%")


if __name__ == "__main__":
    main()
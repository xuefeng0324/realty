"""
compute_decorate_age.py — v0.44.0 trend-24 装修 × 楼龄 联合分析
==================================================================

读 listings.csv, 对每 (city, decorate_type, age_bucket) 算 count/share/median_unit_price
+ premium_pct vs city median。

保留 decorate_type: ["豪装", "精装", "普装", "毛坯"] (top 4)
age_bucket (按 build_year):
  - ≤1999 (老破小)
  - 2000-2004
  - 2005-2009
  - 2010-2014
  - 2015-2019
  - 2020+ (次新)

输出: decorate_age.csv
  city_id, city_name, decorate, age_bucket, count, share, median_unit_price, premium_pct
"""
from __future__ import annotations
import csv
import statistics
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS = REPO_ROOT / "static" / "seed" / "listings.csv"
CITIES = REPO_ROOT / "static" / "seed" / "cities.csv"
OUT = REPO_ROOT / "static" / "seed" / "decorate_age.csv"

DECORATES = ["豪装", "精装", "普装", "毛坯"]


def n(v):
    if v is None or v == "":
        return None
    try:
        x = float(v);
        return x if x == x else None
    except (ValueError, TypeError):
        return None


def age_bucket(year_str: str) -> str | None:
    y = n(year_str)
    if y is None:
        return None
    yi = int(y)
    if yi <= 1999: return "≤1999"
    if yi <= 2004: return "2000-2004"
    if yi <= 2009: return "2005-2009"
    if yi <= 2014: return "2010-2014"
    if yi <= 2019: return "2015-2019"
    return "2020+"


def main():
    city_names: dict[int, str] = {}
    with open(CITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try: city_names[int(r["city_id"])] = r["city_name"]
            except: continue

    by_cell: dict[tuple, list[float]] = defaultdict(list)
    by_city: dict[int, list[float]] = defaultdict(list)

    with open(LISTINGS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["city_id"])
                dec = r.get("decorate_type") or ""
                ab = age_bucket(r.get("build_year") or "")
                if dec not in DECORATES or ab is None: continue
                p = n(r.get("unit_price"))
                if p is None or p <= 0: continue
                by_cell[(cid, dec, ab)].append(p)
                by_city[cid].append(p)
            except (ValueError, KeyError):
                continue

    city_median = {c: statistics.median(ps) for c, ps in by_city.items() if len(ps) >= 5}

    rows = []
    for (cid, dec, ab), prices in by_cell.items():
        if cid not in city_median: continue
        if len(prices) < 5: continue
        cm = city_median[cid]
        median = statistics.median(prices)
        premium_pct = round((median - cm) / cm * 100, 1) if cm > 0 else 0
        rows.append({
            "city_id": cid,
            "city_name": city_names.get(cid, str(cid)),
            "decorate": dec,
            "age_bucket": ab,
            "count": len(prices),
            "share": round(len(prices) / len(by_city[cid]), 4) if by_city[cid] else 0,
            "median_unit_price": round(median),
            "premium_pct": premium_pct
        })

    rows.sort(key=lambda r: (r["city_id"], r["decorate"], r["age_bucket"]))

    cols = ["city_id", "city_name", "decorate", "age_bucket", "count", "share", "median_unit_price", "premium_pct"]
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

    # insights: 找每个城市的"豪装次新"溢价最大 vs "毛坯老破小"折价最大
    for c in sorted(by_city):
        c_rows = [r for r in rows if r["city_id"] == c]
        # 豪装次新 (dec=豪装, age=2020+)
        hx = [r for r in c_rows if r["decorate"] == "豪装" and r["age_bucket"] == "2020+"]
        mp = [r for r in c_rows if r["decorate"] == "毛坯" and (r["age_bucket"] == "≤1999" or r["age_bucket"] == "2000-2004")]
        if hx:
            print(f"  {city_names[c]} 豪装次新 (2020+): {hx[0]['count']} 套 中位 {hx[0]['median_unit_price']} +{hx[0]['premium_pct']}%")
        if mp:
            mp_sorted = sorted(mp, key=lambda r: r["premium_pct"])
            r0 = mp_sorted[0]
            print(f"  {city_names[c]} 毛坯老破小 ({r0['age_bucket']}): {r0['count']} 套 中位 {r0['median_unit_price']} {r0['premium_pct']}%")


if __name__ == "__main__":
    main()
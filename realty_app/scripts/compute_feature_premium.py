"""
compute_feature_premium.py — v0.39.0 trend-19 特征溢价榜
=========================================================

复用 layout_distribution.csv (已经按 city × dimension × bucket 算出 median_unit_price),
对每 (city, dimension), 用该 city 所有 listing 的 median_unit_price 作为基线 (100),
算每个 bucket 的溢价 (premium) = bucket_median / city_median - 1。

输出: feature_premium.csv
  city_id, city_name, dimension, bucket, count, share, median_unit_price,
  city_median_unit_price, premium_pct
"""
from __future__ import annotations
import csv
import statistics
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS = REPO_ROOT / "static" / "seed" / "listings.csv"
CITIES = REPO_ROOT / "static" / "seed" / "cities.csv"
OUT = REPO_ROOT / "static" / "seed" / "feature_premium.csv"


def n(v):
    if v is None or v == "":
        return None
    try:
        x = float(v)
        return x if x == x else None
    except (ValueError, TypeError):
        return None


def load_listings_by_city() -> dict[int, list[dict]]:
    out: dict[int, list[dict]] = {}
    with open(LISTINGS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["city_id"])
                out.setdefault(cid, []).append(r)
            except (KeyError, ValueError):
                continue
    return out


def load_city_names() -> dict[int, str]:
    out: dict[int, str] = {}
    with open(CITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                out[int(r["city_id"])] = r["city_name"]
            except (KeyError, ValueError):
                continue
    return out


def main():
    print("加载 listings.csv...")
    by_city = load_listings_by_city()
    city_names = load_city_names()
    print(f"  城市数: {len(by_city)}")

    rows = []
    for city_id, listings in sorted(by_city.items()):
        # 取该城市所有 listing 的 unit_price 中位数
        prices = [n(l["unit_price"]) for l in listings]
        prices = [p for p in prices if p is not None and p > 0]
        if not prices:
            continue
        city_median = statistics.median(prices)
        city_name = city_names.get(city_id, str(city_id))
        # 按 (dimension, bucket) 聚合
        buckets: dict[tuple, list[dict]] = {}
        for l in listings:
            # 5 个维度
            for dim_key, dim_name, getter in [
                ("bedrooms", "bedrooms", lambda x: (str(x.get("bedrooms") or "未知") + "室") if x.get("bedrooms") else "未知"),
                ("area_sqm", "area_sqm", lambda x: bucket_area(x.get("area_sqm"))),
                ("orientation", "orientation", lambda x: (x.get("orientation") or "未知").strip()),
                ("decorate_type", "decorate", lambda x: (x.get("decorate_type") or "未知").strip()),
            ]:
                # 跳过非本维度的属性
                bucket_val = getter(l)
                key = (dim_name, bucket_val)
                buckets.setdefault(key, []).append(l)
        # 写每条
        for (dim, bucket), items in sorted(buckets.items()):
            # 跳过 "未知" 桶 (没有信息价值)
            if bucket == "未知":
                continue
            bprices = [n(l["unit_price"]) for l in items]
            bprices = [p for p in bprices if p is not None and p > 0]
            if not bprices:
                continue
            bmedian = statistics.median(bprices)
            premium = (bmedian / city_median - 1) if city_median > 0 else 0
            rows.append({
                "city_id": city_id,
                "city_name": city_name,
                "dimension": dim,
                "bucket": bucket,
                "count": len(items),
                "share": round(len(items) / len(listings), 4) if listings else 0,
                "median_unit_price": round(bmedian),
                "city_median_unit_price": round(city_median),
                "premium_pct": round(premium * 100, 1)
            })

    cols = ["city_id", "city_name", "dimension", "bucket", "count", "share",
            "median_unit_price", "city_median_unit_price", "premium_pct"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"\n[ok] wrote {OUT} ({len(rows)} rows)")

    # 统计
    by_city_count: dict[int, int] = {}
    by_dim_count: dict[str, int] = {}
    for r in rows:
        by_city_count[r["city_id"]] = by_city_count.get(r["city_id"], 0) + 1
        by_dim_count[r["dimension"]] = by_dim_count.get(r["dimension"], 0) + 1
    for c, n_ in sorted(by_city_count.items()):
        print(f"  cityId={c}: {n_} 行")
    print(f"  维度: {dict(by_dim_count)}")

    # 找几个极端例子
    for c in sorted(by_city_count):
        c_rows = [r for r in rows if r["city_id"] == c]
        if not c_rows:
            continue
        top = max(c_rows, key=lambda r: r["premium_pct"])
        bot = min(c_rows, key=lambda r: r["premium_pct"])
        print(f"  cityId={c} 最贵: {top['dimension']}/{top['bucket']} = {top['premium_pct']:+.1f}%")
        print(f"  cityId={c} 最便宜: {bot['dimension']}/{bot['bucket']} = {bot['premium_pct']:+.1f}%")


def bucket_area(v):
    n_v = n(v)
    if n_v is None:
        return "未知"
    if n_v < 50:
        return "<50"
    if n_v < 80:
        return "50-80"
    if n_v < 110:
        return "80-110"
    if n_v < 150:
        return "110-150"
    if n_v < 200:
        return "150-200"
    return "200+"


def bucket_floor(v):
    n_v = n(v)
    if n_v is None:
        return "未知"
    if n_v <= 5:
        return "低楼层"
    if n_v <= 15:
        return "中楼层"
    return "高楼层"


if __name__ == "__main__":
    main()
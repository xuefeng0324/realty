"""
compute_district_trend.py
==========================
从 listings.csv 按 (city_id, district_name, week_end) 聚合均价/中位数/房源数，
生成 district_trend.csv（板块级周维度价格序列）。

数据源：static/seed/listings.csv（v0.3.0 530+ + v0.4.0 60+ 真链家 = 1286 条）
输出：static/seed/district_trend.csv

字段：
  city_id, district_name, week_end, listing_count,
  avg_unit_price, median_unit_price, min_unit_price, max_unit_price

运行：
  python scripts/compute_district_trend.py
"""
from __future__ import annotations
import csv
import statistics
from collections import defaultdict
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS_CSV = REPO_ROOT / "static" / "seed" / "listings.csv"
COMMUNITIES_CSV = REPO_ROOT / "static" / "seed" / "communities.csv"
OUT_CSV = REPO_ROOT / "static" / "seed" / "district_trend.csv"


def week_end_from_date(iso: str) -> str:
    """取最近的周日（向过去回溯）"""
    d = datetime.strptime(iso, "%Y-%m-%d")
    weekday = d.weekday()  # 0=Mon
    days_back = (weekday + 1) % 7  # 0=Sun -> 0; 1=Mon -> 1; ... 6=Sat -> 6
    d = d.replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    d = d - timedelta(days=days_back)
    return d.strftime("%Y-%m-%d")


def main() -> None:
    # 1) 加载 community_id -> district_name 映射
    cid_to_district: dict[int, str] = {}
    with open(COMMUNITIES_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            try:
                cid_to_district[int(r["community_id"])] = r.get("district_name") or ""
            except (ValueError, KeyError):
                continue

    # 2) 加载 listings
    rows: list[dict] = []
    with open(LISTINGS_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["community_id"])
                up = float(r["unit_price"]) if r.get("unit_price") else None
                cd = r.get("crawl_date") or ""
                city_id = int(r["city_id"])
            except (ValueError, KeyError):
                continue
            if up is None or up <= 0 or not cd:
                continue
            district = cid_to_district.get(cid, "")
            if not district:
                continue
            rows.append({
                "city_id": city_id,
                "district_name": district,
                "week_end": week_end_from_date(cd[:10]),
                "unit_price": up,
            })

    print(f"loaded {len(rows)} valid listings")

    # 3) 按 (city_id, district_name, week_end) 聚合
    bucket: dict[tuple[int, str, str], list[float]] = defaultdict(list)
    for r in rows:
        key = (r["city_id"], r["district_name"], r["week_end"])
        bucket[key].append(r["unit_price"])

    # 4) 写 csv
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "city_id", "district_name", "week_end", "listing_count",
            "avg_unit_price", "median_unit_price", "min_unit_price", "max_unit_price",
        ])
        for (cid, dn, we), prices in sorted(bucket.items()):
            w.writerow([
                cid, dn, we, len(prices),
                round(statistics.mean(prices), 2),
                round(statistics.median(prices), 2),
                min(prices),
                max(prices),
            ])

    n_districts = len(set((c, d) for c, d, _ in bucket.keys()))
    n_weeks = len(set(w for _, _, w in bucket.keys()))
    print(f"wrote {OUT_CSV} ({len(bucket)} rows, {n_districts} districts, {n_weeks} weeks)")


if __name__ == "__main__":
    main()
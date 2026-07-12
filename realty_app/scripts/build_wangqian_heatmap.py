"""
build_wangqian_heatmap.py
===========================
从 daily_wangqian.csv (granularity=district) 按 (city, district, category, week_end)
聚合 units/area_sqm → wangqian_district_weekly.csv。

数据源：static/daily_wangqian.csv (v0.3.0+ 已有 264 条 district 数据)
输出：static/seed/wangqian_district_weekly.csv

字段：
  city, district, category, week_end, days, total_units, total_area_sqm,
  avg_daily_units, avg_daily_area_sqm

用途：dashboard "近 30 天网签热度榜" 卡片 (按近 N 天套数/面积排序)

运行：
  python scripts/build_wangqian_heatmap.py
"""
from __future__ import annotations
import csv
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_CSV = REPO_ROOT / "static" / "daily_wangqian.csv"
OUT_CSV = REPO_ROOT / "static" / "seed" / "wangqian_district_weekly.csv"


def week_end_from_date(iso: str) -> str:
    """取最近的周日（向过去回溯）"""
    d = datetime.strptime(iso, "%Y-%m-%d")
    days_back = (d.weekday() + 1) % 7
    d = d - timedelta(days=days_back)
    return d.strftime("%Y-%m-%d")


def main() -> None:
    rows = []
    with open(SRC_CSV, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r.get("granularity") != "district":
                continue
            try:
                units = int(r.get("units") or 0)
                area = float(r.get("area_sqm") or 0.0)
            except ValueError:
                continue
            rows.append({
                "city": r["city"],
                "district": r["district"],
                "category": r["category"],
                "date": r["date"],
                "units": units,
                "area_sqm": area,
            })

    print(f"loaded {len(rows)} district rows")

    # 按 (city, district, category, week_end) 聚合
    bucket: dict[tuple[str, str, str, str], list[dict]] = defaultdict(list)
    for r in rows:
        key = (r["city"], r["district"], r["category"], week_end_from_date(r["date"]))
        bucket[key].append(r)

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "city", "district", "category", "week_end",
            "days", "total_units", "total_area_sqm",
            "avg_daily_units", "avg_daily_area_sqm"
        ])
        for (city, district, category, week_end), days_rows in sorted(bucket.items()):
            days = len(days_rows)
            total_units = sum(r["units"] for r in days_rows)
            total_area = sum(r["area_sqm"] for r in days_rows)
            w.writerow([
                city, district, category, week_end,
                days, total_units, round(total_area, 2),
                round(total_units / days, 2),
                round(total_area / days, 2)
            ])

    n_districts = len(set((c, d) for c, d, _, _ in bucket.keys()))
    n_weeks = len(set(w for _, _, _, w in bucket.keys()))
    print(f"wrote {OUT_CSV} ({len(bucket)} rows, {n_districts} districts, {n_weeks} weeks)")


if __name__ == "__main__":
    main()
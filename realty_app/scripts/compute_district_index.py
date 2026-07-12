"""
compute_district_index.py — v0.29.0 trend-13 板块房价指数
=========================================================

基于 district_trend.csv 计算每周「区房价指数」(base 100 = 该区最早周中位价)。

输出:
  static/seed/district_index.csv
  columns: city_id, district_name, week_end, median_unit_price,
           index_value, mom_change, yoy_change, listing_count

规则:
  - index_value = median_unit_price / 该区 baseline_week_median * 100
  - baseline_week = 该区最早有数据的周 (>= 4 listings)
  - mom_change = (current - prev_week) / prev_week
  - yoy_change = (current - 52_weeks_ago) / 52_weeks_ago (如无则为 "")
"""
from __future__ import annotations
import csv
import statistics
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DISTRICT_TREND = REPO_ROOT / "static" / "seed" / "district_trend.csv"
OUT = REPO_ROOT / "static" / "seed" / "district_index.csv"


def main():
    # 1) 加载 district_trend
    rows = []
    with open(DISTRICT_TREND, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["city_id"])
                dn = r["district_name"]
                we = r["week_end"]
                cnt = int(r["listing_count"])
                med = float(r["median_unit_price"])
            except (KeyError, ValueError):
                continue
            rows.append({
                "city_id": cid,
                "district_name": dn,
                "week_end": we,
                "listing_count": cnt,
                "median_unit_price": med
            })
    print(f"加载 {len(rows)} 行 district_trend")

    # 2) 按 (city_id, district_name) 分组 → 按 week_end 排序
    by_district: dict[tuple[int, str], list[dict]] = defaultdict(list)
    for r in rows:
        by_district[(r["city_id"], r["district_name"])].append(r)
    for k in by_district:
        by_district[k].sort(key=lambda x: x["week_end"])

    # 3) 计算每个区的 baseline (该区最早 week_end 且 listing_count >= 4)
    def find_baseline(items: list[dict]) -> float | None:
        # 找最早 4 周的中位价均值 (避免 baseline 单点抖动)
        baseline_items = [it for it in items if it["listing_count"] >= 4]
        if not baseline_items:
            return None
        # 取最早一周
        return baseline_items[0]["median_unit_price"]

    out_rows: list[dict] = []
    for (cid, dn), items in by_district.items():
        baseline = find_baseline(items)
        if baseline is None or baseline <= 0:
            continue
        # 按 week_end 索引便于 mom/yoy
        by_week = {it["week_end"]: it for it in items}
        sorted_weeks = sorted(by_week.keys())
        for i, we in enumerate(sorted_weeks):
            cur = by_week[we]
            idx = round(cur["median_unit_price"] / baseline * 100, 2)
            # mom
            mom = ""
            if i > 0:
                prev = by_week[sorted_weeks[i - 1]]
                if prev["median_unit_price"] > 0:
                    m = (cur["median_unit_price"] - prev["median_unit_price"]) / prev["median_unit_price"]
                    mom = round(m * 100, 2)
            # yoy (52 周前近似 364 天)
            try:
                from datetime import datetime, timedelta
                cur_dt = datetime.strptime(we, "%Y-%m-%d")
                yoy_dt = cur_dt - timedelta(days=364)
                yoy_we = yoy_dt.strftime("%Y-%m-%d")
                if yoy_we in by_week:
                    yoy_item = by_week[yoy_we]
                    if yoy_item["median_unit_price"] > 0:
                        y = (cur["median_unit_price"] - yoy_item["median_unit_price"]) / yoy_item["median_unit_price"]
                        yoy_str = round(y * 100, 2)
                    else:
                        yoy_str = ""
                else:
                    yoy_str = ""
            except Exception:
                yoy_str = ""

            out_rows.append({
                "city_id": cid,
                "district_name": dn,
                "week_end": we,
                "median_unit_price": cur["median_unit_price"],
                "index_value": idx,
                "mom_change": mom,
                "yoy_change": yoy_str,
                "listing_count": cur["listing_count"]
            })

    fieldnames = ["city_id", "district_name", "week_end", "median_unit_price",
                  "index_value", "mom_change", "yoy_change", "listing_count"]
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(out_rows)
    print(f"✅ 写 {len(out_rows)} 行 index → {OUT}")

    n_districts = len(set((r["city_id"], r["district_name"]) for r in out_rows))
    print(f"  {n_districts} 个 (city, district) 区")


if __name__ == "__main__":
    main()
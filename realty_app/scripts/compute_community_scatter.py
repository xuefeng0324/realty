"""
compute_community_scatter.py — v0.45.0 trend-25 总价 × 单价 双轴散点
======================================================================

读 listings.csv + communities.csv, 对每个 community 计算:
  - count, median_unit_price, median_total_price_10w (万)
  - median_area (㎡), median_bedrooms
  - area_cohort: "小户型(<60)" / "改善(60-110)" / "大户型(>110)"

输出: community_scatter.csv (4 quadrant scatter points)
  city_id, city_name, community_id, community_name, district_name,
  count, median_unit_price, median_total_price_10w, median_area, area_cohort

Quadrants (城市内分):
  - 高单 (>= city_median_unit) && 高总 (>= city_median_total) = "豪宅"
  - 高单 + 低总 = "学区"
  - 低单 + 高总 = "改善大户型"
  - 低单 + 低总 = "洼地"
"""
from __future__ import annotations
import csv
import statistics
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS = REPO_ROOT / "static" / "seed" / "listings.csv"
CITIES = REPO_ROOT / "static" / "seed" / "cities.csv"
COMMUNITIES = REPO_ROOT / "static" / "seed" / "communities.csv"
OUT = REPO_ROOT / "static" / "seed" / "community_scatter.csv"


def n(v):
    if v is None or v == "":
        return None
    try:
        x = float(v);
        return x if x == x else None
    except (ValueError, TypeError):
        return None


def area_cohort(area: float) -> str:
    if area < 60: return "小户型"
    if area < 110: return "改善"
    return "大户型"


def main():
    city_names: dict[int, str] = {}
    with open(CITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try: city_names[int(r["city_id"])] = r["city_name"]
            except: continue

    comm_names: dict[int, tuple[str, str]] = {}  # community_id -> (name, district)
    with open(COMMUNITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                comm_names[int(r["community_id"])] = (r["community_name"], r.get("district_name") or "")
            except: continue

    # community_id -> [unit_price, total_price_10w, area]
    # 注意: total_price_10w 全空, 从 unit_price × area 算
    by_comm: dict[tuple, list] = defaultdict(lambda: ([], [], []))
    with open(LISTINGS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["city_id"])
                comm_id = int(r["community_id"])
                up = n(r.get("unit_price"))
                a = n(r.get("area_sqm"))
                if up is None or up <= 0: continue
                if a is None or a <= 0: continue
                tp = up * a / 10000.0  # 元/㎡ × ㎡ / 10000 = 万元
                if tp <= 0: continue
                by_comm[(cid, comm_id)][0].append(up)
                by_comm[(cid, comm_id)][1].append(tp)
                by_comm[(cid, comm_id)][2].append(a)
            except (ValueError, KeyError):
                continue

    # 计算每个城市的中位 (用于 quadrant 划分)
    by_city_ups: dict[int, list] = defaultdict(list)
    by_city_tps: dict[int, list] = defaultdict(list)
    for (cid, _), (ups, tps, _) in by_comm.items():
        by_city_ups[cid].extend(ups)
        by_city_tps[cid].extend(tps)
    city_med_up = {c: statistics.median(us) for c, us in by_city_ups.items() if len(us) >= 5}
    city_med_tp = {c: statistics.median(ts) for c, ts in by_city_tps.items() if len(ts) >= 5}

    rows = []
    quadrants: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for (cid, comm_id), (ups, tps, areas) in by_comm.items():
        if cid not in city_med_up: continue
        if len(ups) < 3: continue  # min listings per community
        mup = statistics.median(ups)
        mtp = statistics.median(tps)
        mara = statistics.median(areas)
        cohort = area_cohort(mara)
        # quadrant
        high_up = mup >= city_med_up[cid]
        high_tp = mtp >= city_med_tp[cid]
        if high_up and high_tp: q = "豪宅板块"
        elif high_up and not high_tp: q = "学区刚需"
        elif not high_up and high_tp: q = "改善低密"
        else: q = "价值洼地"
        quadrants[cid][q] += 1

        name, district = comm_names.get(comm_id, ("?", ""))
        rows.append({
            "city_id": cid,
            "city_name": city_names.get(cid, str(cid)),
            "community_id": comm_id,
            "community_name": name,
            "district_name": district,
            "count": len(ups),
            "median_unit_price": round(mup),
            "median_total_price_10w": round(mtp),
            "median_area": round(mara),
            "area_cohort": cohort,
            "quadrant": q
        })

    rows.sort(key=lambda r: (r["city_id"], -r["median_unit_price"]))

    cols = ["city_id", "city_name", "community_id", "community_name", "district_name",
            "count", "median_unit_price", "median_total_price_10w", "median_area", "area_cohort", "quadrant"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"[ok] wrote {OUT} ({len(rows)} rows)")

    by_city: dict[int, int] = defaultdict(int)
    for r in rows: by_city[r["city_id"]] += 1
    for c in sorted(by_city):
        print(f"  cityId={c} ({city_names.get(c, '?')}): {by_city[c]} communities, "
              f"median_unit={int(city_med_up[c])}, median_total={int(city_med_tp[c])} 万")
        print(f"    quadrants: {dict(quadrants[c])}")

    # insights
    for c in sorted(by_city):
        c_rows = [r for r in rows if r["city_id"] == c]
        if not c_rows: continue
        # 豪宅板块 top 3
        luxury = sorted([r for r in c_rows if r["quadrant"] == "豪宅板块"], key=lambda x: -x["median_unit_price"])[:3]
        bargain = sorted([r for r in c_rows if r["quadrant"] == "价值洼地"], key=lambda x: x["median_unit_price"])[:3]
        xq = sorted([r for r in c_rows if r["quadrant"] == "学区刚需"], key=lambda x: -x["median_unit_price"])[:3]
        if luxury: print(f"    {city_names[c]} 豪宅板块 top3: {[(x['community_name'], x['median_unit_price'], x['median_total_price_10w']) for x in luxury]}")
        if xq: print(f"    {city_names[c]} 学区刚需 top3: {[(x['community_name'], x['median_unit_price'], x['median_total_price_10w']) for x in xq]}")
        if bargain: print(f"    {city_names[c]} 价值洼地 top3: {[(x['community_name'], x['median_unit_price'], x['median_total_price_10w']) for x in bargain]}")


if __name__ == "__main__":
    main()
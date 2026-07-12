"""
compute_listing_school_premium.py
==================================
v0.17.0 trend-6: 给每个 listing 打上学区评分 + 溢价率。

数据流:
  listings.csv (1286) + communities.csv (52, district_name) + schools.csv (58, district_name) + school_indicators.csv (58, latest_level_score_raw)
    → 按 (city_id, district_name) 把 schools 聚合到该区,得到 school_score
    → 给每个 listing 打 school_score (来自其 community.district_name)
    → 给每个 listing 打 school_ids_json (同区学校的 id 列表)
    → 算溢价率: 优先用 (区 median / 全市 median - 1) 近似,加到 listings.csv
    → 输出:
        static/seed/listing_school_premium.csv (1292 行: 1286 真实 + 6 header)
          columns: listing_id, city_id, district_name, community_id,
                   school_count, avg_school_score, premium_ratio_est

跑法:
  python scripts/compute_listing_school_premium.py
"""
from __future__ import annotations
import csv
import json
import statistics
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS = REPO_ROOT / "static" / "seed" / "listings.csv"
COMMUNITIES = REPO_ROOT / "static" / "seed" / "communities.csv"
SCHOOLS = REPO_ROOT / "static" / "seed" / "schools.csv"
INDICATORS = REPO_ROOT / "static" / "seed" / "school_indicators.csv"
OUT = REPO_ROOT / "static" / "seed" / "listing_school_premium.csv"


def load_csv(p: Path) -> list[dict]:
    with open(p, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def main():
    listings = load_csv(LISTINGS)
    communities = load_csv(COMMUNITIES)
    schools = load_csv(SCHOOLS)
    indicators = load_csv(INDICATORS)

    # school_id -> score
    score_map: dict[str, float] = {}
    for r in indicators:
        sid = r.get("school_id", "").strip()
        score = r.get("latest_level_score_raw", "").strip()
        if sid and score:
            try:
                score_map[sid] = float(score)
            except ValueError:
                pass

    # 按 (city_id, district_name) 聚合学校 id 列表 + 评分
    schools_by_district: dict[tuple[str, str], list[str]] = defaultdict(list)
    scores_by_district: dict[tuple[str, str], list[float]] = defaultdict(list)
    for r in schools:
        cid = r.get("city_id", "").strip()
        dn = r.get("district_name", "").strip()
        sid = r.get("school_id", "").strip()
        if not (cid and dn and sid):
            continue
        key = (cid, dn)
        schools_by_district[key].append(sid)
        if sid in score_map:
            scores_by_district[key].append(score_map[sid])

    # (city_id, district_name) -> avg school score
    avg_school_score_by_district: dict[tuple[str, str], float] = {}
    for k, scs in scores_by_district.items():
        if scs:
            avg_school_score_by_district[k] = sum(scs) / len(scs)

    # community_id -> (city_id, district_name)
    community_district: dict[str, tuple[str, str]] = {}
    for r in communities:
        cid = r.get("community_id", "").strip()
        city = r.get("city_id", "").strip()
        dn = r.get("district_name", "").strip()
        if cid:
            community_district[cid] = (city, dn)

    # 先算 city_median_unit_price (全市挂牌中位单价)
    city_unit_prices: dict[str, list[float]] = defaultdict(list)
    district_unit_prices: dict[tuple[str, str], list[float]] = defaultdict(list)
    for r in listings:
        cid = r.get("city_id", "").strip()
        up = r.get("unit_price", "").strip()
        if not (cid and up):
            continue
        try:
            v = float(up)
        except ValueError:
            continue
        if v <= 0:
            continue
        city_unit_prices[cid].append(v)
        com_id = r.get("community_id", "").strip()
        if com_id and com_id in community_district:
            c_city, c_dn = community_district[com_id]
            if c_city == cid and c_dn:
                district_unit_prices[(cid, c_dn)].append(v)

    city_median: dict[str, float] = {}
    for k, vs in city_unit_prices.items():
        if vs:
            city_median[k] = statistics.median(vs)

    district_median: dict[tuple[str, str], float] = {}
    for k, vs in district_unit_prices.items():
        if vs:
            district_median[k] = statistics.median(vs)

    # 写 listing_school_premium.csv
    rows: list[dict] = []
    for r in listings:
        lid = r.get("listing_id", "").strip()
        cid = r.get("city_id", "").strip()
        com_id = r.get("community_id", "").strip()
        if not (lid and cid):
            continue
        if com_id not in community_district:
            continue
        c_city, c_dn = community_district[com_id]
        if c_city != cid or not c_dn:
            continue
        key = (cid, c_dn)
        sids = schools_by_district.get(key, [])
        score = avg_school_score_by_district.get(key, 0.0)
        # 溢价率 = (区中位 / 全市中位 - 1) * 100
        d_med = district_median.get(key, 0.0)
        c_med = city_median.get(cid, 0.0)
        if d_med and c_med:
            premium = (d_med / c_med - 1) * 100
        else:
            premium = 0.0
        rows.append({
            "listing_id": lid,
            "city_id": cid,
            "district_name": c_dn,
            "community_id": com_id,
            "school_count": len(sids),
            "avg_school_score": round(score, 2),
            "premium_ratio_est": round(premium, 2)
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "listing_id", "city_id", "district_name", "community_id",
            "school_count", "avg_school_score", "premium_ratio_est"
        ])
        w.writeheader()
        for r in rows:
            w.writerow(r)

    # 统计
    cnt = len(rows)
    with_score = sum(1 for r in rows if r["avg_school_score"] > 0)
    with_premium = sum(1 for r in rows if r["premium_ratio_est"] != 0)
    print(f"wrote {OUT}")
    print(f"  total rows: {cnt}")
    print(f"  with school score > 0: {with_score} ({with_score * 100 // cnt}%)")
    print(f"  with non-zero premium: {with_premium} ({with_premium * 100 // cnt}%)")
    # 简单洞察
    top5 = sorted(rows, key=lambda r: r["premium_ratio_est"], reverse=True)[:5]
    print("\nTop 5 premium listings:")
    for r in top5:
        print(f"  listing #{r['listing_id']} ({r['district_name']}): "
              f"score={r['avg_school_score']:.1f}  premium={r['premium_ratio_est']:+.1f}%")


if __name__ == "__main__":
    main()
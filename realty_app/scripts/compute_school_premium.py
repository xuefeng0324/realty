"""
compute_school_premium.py
==========================
计算"学区溢价榜"：
1. 按 (city_id, district_name) 把 schools 聚合：每区平均学区评分 (school_score)
2. 给每条 listing 关联其 community 所在区的 school_score
3. 按区聚合 listings：school_score + median unit_price
4. 算区级学区溢价：(区 median / 全市 median - 1)
5. 同时输出"小区级"：按 community 聚合
6. 写 school_premium_district.csv + school_premium_community.csv

数据源：
  listings.csv (1286 条)
  communities.csv (52 个小区)
  schools.csv (58 个学校)
  school_indicators.csv (58 条评分)

输出：
  static/seed/school_premium_district.csv
  static/seed/school_premium_community.csv

字段 (district):
  city_id, district_name, school_count, avg_school_score,
  listing_count, median_unit_price, district_premium_ratio

字段 (community):
  community_id, city_id, district_name, community_name,
  school_count, avg_school_score, listing_count, median_unit_price

运行：
  python scripts/compute_school_premium.py
"""
from __future__ import annotations
import csv
import statistics
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS_CSV = REPO_ROOT / "static" / "seed" / "listings.csv"
COMMUNITIES_CSV = REPO_ROOT / "static" / "seed" / "communities.csv"
SCHOOLS_CSV = REPO_ROOT / "static" / "seed" / "schools.csv"
INDICATORS_CSV = REPO_ROOT / "static" / "seed" / "school_indicators.csv"
OUT_DISTRICT = REPO_ROOT / "static" / "seed" / "school_premium_district.csv"
OUT_COMMUNITY = REPO_ROOT / "static" / "seed" / "school_premium_community.csv"


def load_school_scores() -> dict[int, float]:
    """school_id -> latest_level_score_raw"""
    scores: dict[int, float] = {}
    with open(INDICATORS_CSV, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                sid = int(r["school_id"])
                score = float(r["latest_level_score_raw"])
            except (ValueError, KeyError):
                continue
            if score > 0:
                scores[sid] = score
    return scores


def infer_school_district(official_name: str) -> str | None:
    """从学校 official_name 推断所在区
    例: '深圳实验学校小学部' -> None (市直属)
        '南山区实验学校麒麟中学' -> '南山区'
        '福田外国语学校' -> '福田区'
    """
    name = official_name or ""
    # 常见深圳/广州/珠海的区
    districts = [
        "南山区", "福田区", "罗湖区", "宝安区", "龙岗区", "龙华区",
        "盐田区", "坪山区", "光明区", "大鹏新区",
        "天河区", "越秀区", "海珠区", "荔湾区", "白云区", "黄埔区",
        "番禺区", "花都区", "南沙区", "从化区", "增城区",
        "香洲区", "斗门区", "金湾区"
    ]
    for d in districts:
        if d in name:
            return d
    return None  # 市直属


def load_school_district_map() -> dict[str, list[tuple[int, float]]]:
    """district_name (in communities.csv) -> [(school_id, score), ...]
    用 schools.csv 的 district_name 列（v0.11.0 新增）
    """
    scores = load_school_scores()
    bucket: dict[str, list[tuple[int, float]]] = defaultdict(list)
    with open(SCHOOLS_CSV, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                sid = int(r["school_id"])
            except (ValueError, KeyError):
                continue
            if sid not in scores:
                continue
            d = (r.get("district_name") or "").strip()
            if not d:
                continue
            bucket[d].append((sid, scores[sid]))
    return bucket


def main() -> None:
    # 1. 区级 schools 评分
    district_schools = load_school_district_map()
    district_score: dict[str, float] = {
        d: statistics.mean([s for _, s in lst]) for d, lst in district_schools.items() if lst
    }
    print(f"loaded schools for {len(district_score)} districts")
    for d, s in sorted(district_score.items()):
        print(f"  {d}: {s:.2f} (n={len(district_schools[d])})")

    # 2. community_id -> (city_id, district_name, community_name)
    cid_meta: dict[int, dict] = {}
    with open(COMMUNITIES_CSV, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["community_id"])
                cid_meta[cid] = {
                    "city_id": int(r["city_id"]),
                    "district_name": r.get("district_name") or "",
                    "community_name": r.get("community_name") or ""
                }
            except (ValueError, KeyError):
                continue

    # 3. listings 按 (city_id, district_name) 聚合 unit_price
    district_prices: dict[tuple[int, str], list[float]] = defaultdict(list)
    community_prices: dict[int, list[float]] = defaultdict(list)
    with open(LISTINGS_CSV, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["community_id"])
                up = float(r["unit_price"]) if r.get("unit_price") else None
            except (ValueError, KeyError):
                continue
            if up is None or up <= 0:
                continue
            meta = cid_meta.get(cid)
            if not meta:
                continue
            district_prices[(meta["city_id"], meta["district_name"])].append(up)
            community_prices[cid].append(up)

    print(f"loaded {sum(len(v) for v in district_prices.values())} listings across {len(district_prices)} (city,district)")
    print(f"loaded {sum(len(v) for v in community_prices.values())} listings across {len(community_prices)} communities")

    # 4. 全市均价 (city 维度)
    city_prices: dict[int, list[float]] = defaultdict(list)
    for (cid, dn), prices in district_prices.items():
        city_prices[cid].extend(prices)
    city_median: dict[int, float] = {}
    for cid, prices in city_prices.items():
        if prices:
            city_median[cid] = statistics.median(prices)

    # 5. 写区级 csv
    OUT_DISTRICT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_DISTRICT, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "city_id", "district_name", "school_count",
            "avg_school_score", "listing_count",
            "median_unit_price", "city_median_unit_price", "premium_ratio"
        ])
        for (city_id, dn), prices in sorted(district_prices.items()):
            cm = city_median.get(city_id, 0)
            median_p = statistics.median(prices) if prices else 0
            premium = (median_p - cm) / cm if cm > 0 else 0
            schools = district_schools.get(dn, [])
            score = statistics.mean([s for _, s in schools]) if schools else 0
            w.writerow([
                city_id, dn, len(schools),
                round(score, 2),
                len(prices),
                round(median_p, 2),
                round(cm, 2),
                round(premium, 4)
            ])
    print(f"wrote {OUT_DISTRICT}")

    # 6. 写社区级 csv
    with open(OUT_COMMUNITY, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "community_id", "city_id", "district_name", "community_name",
            "school_count", "avg_school_score",
            "listing_count", "median_unit_price"
        ])
        for cid, prices in sorted(community_prices.items()):
            meta = cid_meta.get(cid)
            if not meta:
                continue
            schools = district_schools.get(meta["district_name"], [])
            score = statistics.mean([s for _, s in schools]) if schools else 0
            median_p = statistics.median(prices) if prices else 0
            w.writerow([
                cid, meta["city_id"], meta["district_name"], meta["community_name"],
                len(schools), round(score, 2),
                len(prices), round(median_p, 2)
            ])
    print(f"wrote {OUT_COMMUNITY}")


if __name__ == "__main__":
    main()
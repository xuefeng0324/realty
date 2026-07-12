"""
compute_listing_tags.py — v0.28.0 new-6 房源 tags 标签云
========================================================

为每个 listing 基于其特征打上语义标签 (用于 dashboard 标签云卡片)。

派生标签规则 (按优先级, 命中即加):
  户型相关: 一房 / 两房 / 三房 / 四房 / 大户型 (>=150㎡)
  价格相关: 笋盘 (低于 city 中位 70%) / 高价 (高于 city 中位 1.5x)
  朝向相关: 朝南 / 南北通透
  装修相关: 豪装 / 精装 / 简装 / 毛坯
  学区相关: 名校区 (该区 school_count >= 3 且 score >= 80)
  地铁相关: 近地铁 (≤500m) / 地铁可达 (≤1500m)
  楼龄相关: 楼龄新 (build_year >= 2015) / 老破小 (build_year <= 2000 且 area<70)
  楼层相关: 高楼层 (floor_number >= 20)
  电梯相关: 带电梯
  平台标签 (来自 listings.tags_json): VR房源 / 随时看房 / ...

输出:
  static/seed/listing_tags.csv (1286+ 行)
  columns: listing_id, city_id, district_name, tag (单 tag 一行, 用于标签云统计)

也输出聚合:
  static/seed/listing_tags_summary.csv (per city x tag count)
"""
from __future__ import annotations
import csv
import json
import statistics
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS = REPO_ROOT / "static" / "seed" / "listings.csv"
COMMUNITIES = REPO_ROOT / "static" / "seed" / "communities.csv"
POI = REPO_ROOT / "static" / "seed" / "poi_seed.csv"
LISTING_PREMIUM = REPO_ROOT / "static" / "seed" / "listing_school_premium.csv"
OUT_TAGS = REPO_ROOT / "static" / "seed" / "listing_tags.csv"
OUT_SUMMARY = REPO_ROOT / "static" / "seed" / "listing_tags_summary.csv"


def load_csv(p: Path) -> list[dict]:
    with open(p, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def parse_int(v: str | None) -> int | None:
    if v is None or v == "":
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def parse_float(v: str | None) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def derive_tags(row: dict, ctx: dict) -> list[str]:
    """根据 listing + ctx (邻区/学区/POI) 派生 tags."""
    tags: list[str] = []
    city_id = parse_int(row.get("city_id")) or 0
    bedrooms = parse_int(row.get("bedrooms"))
    area = parse_float(row.get("area_sqm"))
    unit_price = parse_float(row.get("unit_price"))
    orient = (row.get("orientation") or "").strip()
    decorate = (row.get("decorate_type") or "").strip()
    build_year = parse_int(row.get("build_year"))
    floor_number = parse_int(row.get("floor_number"))
    has_elevator = (row.get("has_elevator") or "").strip().lower() in ("1", "true", "yes", "y", "是")
    community_id = parse_int(row.get("community_id"))
    district = row.get("district_name") or ""

    # 户型
    if bedrooms == 1:
        tags.append("一房")
    elif bedrooms == 2:
        tags.append("两房")
    elif bedrooms == 3:
        tags.append("三房")
    elif bedrooms == 4:
        tags.append("四房")
    if area is not None and area >= 150:
        tags.append("大户型")

    # 价格 (按 city median 比较)
    city_median = ctx.get("city_median_unit_price", {}).get(city_id)
    if unit_price is not None and city_median:
        if unit_price < city_median * 0.7:
            tags.append("笋盘")
        elif unit_price > city_median * 1.5:
            tags.append("高价")

    # 朝向
    if "南" in orient:
        tags.append("朝南")
    if orient in ("南北通透", "南北"):
        tags.append("南北通透")

    # 装修
    if decorate == "豪装":
        tags.append("豪装")
    elif decorate == "精装":
        tags.append("精装")
    elif decorate == "简装":
        tags.append("简装")
    elif decorate == "毛坯":
        tags.append("毛坯")

    # 学区
    school_score = ctx.get("listing_school_score", {}).get(parse_int(row.get("listing_id")) or -1)
    if school_score is not None and school_score >= 80:
        tags.append("名校区")

    # 地铁
    metro_dist = parse_float(row.get("nearest_metro_distance_m"))
    if metro_dist is not None:
        if metro_dist <= 500:
            tags.append("近地铁")
        elif metro_dist <= 1500:
            tags.append("地铁可达")

    # 楼龄
    if build_year is not None:
        if build_year >= 2015:
            tags.append("楼龄新")
        elif build_year <= 2000 and area is not None and area < 70:
            tags.append("老破小")

    # 楼层
    if floor_number is not None and floor_number >= 20:
        tags.append("高楼层")

    # 电梯
    if has_elevator:
        tags.append("带电梯")

    # 平台 tags
    raw_tags = row.get("tags_json") or ""
    if raw_tags and raw_tags != "[]":
        try:
            parsed = json.loads(raw_tags)
            if isinstance(parsed, list):
                for t in parsed:
                    if isinstance(t, str) and t.strip() and t.strip() not in tags:
                        tags.append(t.strip())
        except (json.JSONDecodeError, ValueError):
            pass

    return tags


def main():
    listings = load_csv(LISTINGS)
    print(f"加载 {len(listings)} 行 listings")

    # city 中位价
    city_median: dict[int, float] = {}
    by_city: dict[int, list[float]] = defaultdict(list)
    for r in listings:
        cid = parse_int(r.get("city_id"))
        up = parse_float(r.get("unit_price"))
        if cid is not None and up is not None:
            by_city[cid].append(up)
    for cid, prices in by_city.items():
        if prices:
            city_median[cid] = statistics.median(prices)
    print(f"city 中位价: {city_median}")

    # listing 学区评分
    listing_score: dict[int, float] = {}
    if LISTING_PREMIUM.exists():
        for r in load_csv(LISTING_PREMIUM):
            lid = parse_int(r.get("listing_id"))
            score = parse_float(r.get("avg_school_score"))
            if lid is not None and score is not None and score > 0:
                listing_score[lid] = score
        print(f"  学区评分覆盖 {len(listing_score)} 个 listing")

    ctx = {
        "city_median_unit_price": city_median,
        "listing_school_score": listing_score
    }

    # 派生 tags + 输出
    tag_counter: Counter = Counter()
    by_city_tag: dict[tuple[int, str], int] = defaultdict(int)
    out_rows: list[dict] = []
    for r in listings:
        lid = parse_int(r.get("listing_id"))
        cid = parse_int(r.get("city_id"))
        if lid is None or cid is None:
            continue
        tags = derive_tags(r, ctx)
        for t in tags:
            tag_counter[t] += 1
            by_city_tag[(cid, t)] += 1
            out_rows.append({
                "listing_id": lid,
                "city_id": cid,
                "district_name": r.get("district_name") or "",
                "tag": t
            })

    fieldnames = ["listing_id", "city_id", "district_name", "tag"]
    with open(OUT_TAGS, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(out_rows)
    print(f"✅ 写 {len(out_rows)} 行 tags → {OUT_TAGS}")

    # 汇总 (city, tag) -> count
    city_name = {1: "广州", 2: "深圳", 3: "珠海"}
    summary_rows: list[dict] = []
    for (cid, t), cnt in sorted(by_city_tag.items(), key=lambda x: (-x[1], x[0][1])):
        summary_rows.append({
            "city_id": cid,
            "city_name": city_name.get(cid, ""),
            "tag": t,
            "count": cnt,
            "share": round(cnt / len(listings) * (len([r for r in listings if parse_int(r.get("city_id")) == cid]) / max(1, len(listings))), 4)
        })

    with open(OUT_SUMMARY, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["city_id", "city_name", "tag", "count", "share"])
        w.writeheader()
        w.writerows(summary_rows)
    print(f"✅ 写 {len(summary_rows)} 行 summary → {OUT_SUMMARY}")

    print("\nTop 15 tags:")
    for t, c in tag_counter.most_common(15):
        print(f"  {t}: {c}")


if __name__ == "__main__":
    main()
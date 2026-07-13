"""
compute_listing_freshness.py — v0.41.0 trend-21 房源新鲜度 / 挂牌量时间分布
============================================================================

对每 (city, community), 算:
  - total_listings  总挂牌数
  - recent_4w_count  最近 4 周 crawl_date 的数量 (活跃)
  - new_2w_count    最近 2 周的数量 (新挂牌)
  - stale_count     超过 12 周没刷新的数量 (滞销)
  - freshness_score 0-100 = (recent + new*2) / total * 100
  - median_age_days 中位在挂天数 = (today - crawl_date) 中位

输出: listing_freshness.csv
"""
from __future__ import annotations
import csv
import statistics
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS = REPO_ROOT / "static" / "seed" / "listings.csv"
CITIES = REPO_ROOT / "static" / "seed" / "cities.csv"
COMMUNITIES = REPO_ROOT / "static" / "seed" / "communities.csv"
OUT = REPO_ROOT / "static" / "seed" / "listing_freshness.csv"

# 用 listings 中最大的 crawl_date 作为 today
TODAY = datetime(2026, 7, 13)  # 项目当前日期


def n(v):
    if v is None or v == "":
        return None
    try:
        x = float(v)
        return x if x == x else None
    except (ValueError, TypeError):
        return None


def main():
    city_names: dict[int, str] = {}
    with open(CITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                city_names[int(r["city_id"])] = r["city_name"]
            except (KeyError, ValueError):
                continue

    comm_meta: dict[int, dict] = {}
    with open(COMMUNITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                comm_meta[int(r["community_id"])] = r
            except (KeyError, ValueError):
                continue

    # group by (city_id, community_id) → list of crawl_date
    by_community: dict[tuple, list[str]] = defaultdict(list)
    with open(LISTINGS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                key = (int(r["city_id"]), int(r["community_id"]))
                cd = (r.get("crawl_date") or "").strip()
                if cd:
                    by_community[key].append(cd)
            except (KeyError, ValueError):
                continue

    rows = []
    for (city_id, community_id), dates in by_community.items():
        # parse dates
        parsed = []
        for d in dates:
            try:
                parsed.append(datetime.strptime(d, "%Y-%m-%d"))
            except ValueError:
                continue
        if not parsed:
            continue

        total = len(parsed)
        # 跳过小样本 (1-3 套的纯新小区 freshness=100 噪声)
        if total < 5:
            continue
        ages = [(TODAY - d).days for d in parsed]
        recent_4w = sum(1 for a in ages if a <= 28)
        new_2w = sum(1 for a in ages if a <= 14)
        stale = sum(1 for a in ages if a > 84)
        median_age = statistics.median(ages) if ages else None

        freshness = round(min(100, (recent_4w * 1.0 + new_2w * 2.0) / max(total, 1) * 100), 1)

        meta = comm_meta.get(community_id, {})
        rows.append({
            "city_id": city_id,
            "city_name": city_names.get(city_id, str(city_id)),
            "community_id": community_id,
            "community_name": meta.get("community_name") or f"小区{community_id}",
            "district_name": meta.get("district_name") or "",
            "total_listings": total,
            "recent_4w_count": recent_4w,
            "new_2w_count": new_2w,
            "stale_count": stale,
            "freshness_score": freshness,
            "median_age_days": round(median_age) if median_age is not None else ""
        })

    rows.sort(key=lambda r: (r["city_id"], -r["freshness_score"]))

    cols = ["city_id", "city_name", "community_id", "community_name", "district_name",
            "total_listings", "recent_4w_count", "new_2w_count", "stale_count",
            "freshness_score", "median_age_days"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"[ok] wrote {OUT} ({len(rows)} rows)")

    by_city_count: dict[int, int] = defaultdict(int)
    for r in rows:
        by_city_count[r["city_id"]] += 1
    for c in sorted(by_city_count):
        print(f"  cityId={c} ({city_names.get(c, '?')}): {by_city_count[c]} 小区")

    # 找最活跃 (top 3 freshness) per city
    for c in sorted(by_city_count):
        c_rows = [r for r in rows if r["city_id"] == c][:3]
        print(f"  most fresh ({city_names.get(c, '?')}):")
        for r in c_rows:
            print(f"    {r['community_name']:>12}  total={r['total_listings']:>3}  recent_4w={r['recent_4w_count']:>3}  new_2w={r['new_2w_count']:>3}  stale={r['stale_count']:>3}  fresh={r['freshness_score']:>5}")


if __name__ == "__main__":
    main()
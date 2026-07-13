"""
compute_district_metadata.py — v0.38.0 trend-18 区情画像元数据
==============================================================

把现成 4 类 csv join 出每个 (城市, 区) 的画像元数据, 输出 district_meta.csv。
  - admin_districts.csv        : 行政区代码 (440305 = 南山区)
  - district_index.csv         : 房价指数 (基准 100, 周/月同比)
  - school_premium_district.csv: 学区溢价 (avg_school_score / premium_ratio)
  - listings.csv               : 计算 listing_count + median_build_year
  - communities_geo.csv        : 计算该区 community 数

输出: district_meta.csv
  city_id, district_name, admin_code, area_code,
  community_count, listing_count, median_build_year,
  median_unit_price (最新), index_value (本周), mom_change (%), yoy_change (%),
  avg_school_score, premium_ratio, school_count
"""
from __future__ import annotations
import csv
import statistics
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
ADMIN = REPO_ROOT / "static" / "seed" / "admin_districts.csv"
DIST_IDX = REPO_ROOT / "static" / "seed" / "district_index.csv"
SCH_PRE = REPO_ROOT / "static" / "seed" / "school_premium_district.csv"
LISTINGS = REPO_ROOT / "static" / "seed" / "listings.csv"
COMM_GEO = REPO_ROOT / "static" / "seed" / "communities_geo.csv"
OUT = REPO_ROOT / "static" / "seed" / "district_meta.csv"


def n(v):
    if v is None or v == "":
        return None
    try:
        x = float(v)
        return x if x == x else None
    except (ValueError, TypeError):
        return None


def load_admin() -> dict[tuple, str]:
    """(city_id, district_name) → admin_code (e.g. '440305')"""
    out = {}
    with open(ADMIN, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                key = (int(r["city_id"]), r["district_name"])
                out[key] = r["district_code"]
            except (KeyError, ValueError):
                continue
    return out


def load_district_index_latest() -> dict[tuple, dict]:
    """(city_id, district_name) → 最近一周的 idx row"""
    latest: dict[tuple, str] = {}  # key → weekEnd
    rows: dict[tuple, dict] = {}
    with open(DIST_IDX, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                key = (int(r["city_id"]), r["district_name"])
                we = r["week_end"]
                if key not in latest or we > latest[key]:
                    latest[key] = we
                    rows[key] = r
            except (KeyError, ValueError):
                continue
    return rows


def load_school_premium() -> dict[tuple, dict]:
    """(city_id, district_name) → school_premium_district row"""
    out = {}
    with open(SCH_PRE, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                key = (int(r["city_id"]), r["district_name"])
                out[key] = r
            except (KeyError, ValueError):
                continue
    return out


def load_listings_by_district() -> dict[tuple, list[dict]]:
    """(city_id, district_name) → [listings]"""
    # listings 没有 district_name 直接列, 但 communities.csv 有
    comm_dist: dict[int, str] = {}
    with open(REPO_ROOT / "static" / "seed" / "communities.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                comm_dist[int(r["community_id"])] = r.get("district_name") or ""
            except (KeyError, ValueError):
                continue
    # listings 还要 city_id
    comm_city: dict[int, int] = {}
    with open(REPO_ROOT / "static" / "seed" / "communities.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                comm_city[int(r["community_id"])] = int(r["city_id"])
            except (KeyError, ValueError):
                continue
    out: dict[tuple, list[dict]] = defaultdict(list)
    with open(LISTINGS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["community_id"])
                district = comm_dist.get(cid, "")
                city = comm_city.get(cid, 0)
                if not district:
                    continue
                key = (city, district)
                out[key].append(r)
            except (KeyError, ValueError):
                continue
    return out


def load_communities_by_district() -> dict[tuple, int]:
    out: dict[tuple, int] = defaultdict(int)
    with open(REPO_ROOT / "static" / "seed" / "communities.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                key = (int(r["city_id"]), r.get("district_name") or "")
                out[key] += 1
            except (KeyError, ValueError):
                continue
    return out


def main():
    print("加载数据...")
    admin = load_admin()
    print(f"  admin_districts: {len(admin)} 个区")
    idx = load_district_index_latest()
    print(f"  district_index (latest): {len(idx)} 个区 (有指数数据)")
    spd = load_school_premium()
    print(f"  school_premium_district: {len(spd)} 个区")
    lbd = load_listings_by_district()
    print(f"  listings_by_district: {len(lbd)} 个区")
    cbd = load_communities_by_district()
    print(f"  communities_by_district: {len(cbd)} 个区")

    # keys = union of all
    keys = set(admin.keys()) | set(idx.keys()) | set(spd.keys()) | set(lbd.keys()) | set(cbd.keys())
    print(f"合并 keys: {len(keys)}")

    rows = []
    for key in sorted(keys, key=lambda k: (k[0], k[1])):
        city_id, district_name = key
        # 行政区代码
        ac = admin.get(key, "")
        area_code = ac[:4] if len(ac) >= 4 else ""  # 4403
        # district_index
        idx_row = idx.get(key, {})
        idx_value = n(idx_row.get("index_value"))
        mom = n(idx_row.get("mom_change"))
        yoy = n(idx_row.get("yoy_change"))
        median_price_latest = n(idx_row.get("median_unit_price"))
        # school_premium
        spd_row = spd.get(key, {})
        try:
            school_count = int(spd_row.get("school_count") or 0)
        except (ValueError, TypeError):
            school_count = 0
        avg_school_score = n(spd_row.get("avg_school_score"))
        premium_ratio = n(spd_row.get("premium_ratio"))
        # listings
        listings = lbd.get(key, [])
        listing_count = len(listings)
        build_years = [n(l["build_year"]) for l in listings]
        build_years = [b for b in build_years if b is not None and b > 1900]
        median_by = round(statistics.median(build_years)) if build_years else None
        # community count
        community_count = cbd.get(key, 0)

        rows.append({
            "city_id": city_id,
            "district_name": district_name,
            "admin_code": ac,
            "area_code": area_code,
            "community_count": community_count,
            "listing_count": listing_count,
            "median_build_year": median_by or "",
            "median_unit_price": round(median_price_latest) if median_price_latest else "",
            "index_value": round(idx_value, 1) if idx_value is not None else "",
            "mom_change_pct": round(mom, 2) if mom is not None else "",
            "yoy_change_pct": round(yoy, 2) if yoy is not None else "",
            "avg_school_score": round(avg_school_score, 1) if avg_school_score is not None else "",
            "premium_ratio_pct": round(premium_ratio * 100, 1) if premium_ratio is not None else "",
            "school_count": int(school_count)
        })

    cols = ["city_id", "district_name", "admin_code", "area_code",
            "community_count", "listing_count", "median_build_year",
            "median_unit_price", "index_value", "mom_change_pct", "yoy_change_pct",
            "avg_school_score", "premium_ratio_pct", "school_count"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"\n[ok] wrote {OUT} ({len(rows)} rows)")

    # 统计
    by_city: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_city[r["city_id"]].append(r)
    for cid in sorted(by_city):
        items = by_city[cid]
        has_admin = sum(1 for r in items if r["admin_code"])
        has_price = sum(1 for r in items if r["median_unit_price"])
        has_school = sum(1 for r in items if r["avg_school_score"] != "")
        print(f"  cityId={cid}: {len(items)} 个区, admin={has_admin}, price={has_price}, school={has_school}")


if __name__ == "__main__":
    main()
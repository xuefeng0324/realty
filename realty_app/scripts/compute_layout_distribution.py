"""
compute_layout_distribution.py — v0.25.0 new-7 户型分布
====================================================

按 (city_id, bedrooms_bucket, area_bucket, orientation, decorate_type)
聚合 listings.csv，输出 4 张子表 + 城市汇总。

Buckets:
  bedrooms: 1室/2室/3室/4室/5室+
  area_sqm: <50/50-80/80-110/110-150/150+
  orientation: 南/东南/南北通透/西/东/北/其他
  decorate: 精装/普装/毛坯/豪装/简装/其他

每个 bucket 输出：count, share (0-1), median_unit_price, avg_area_sqm
"""
import csv
import json
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTINGS_CSV = ROOT / "static" / "seed" / "listings.csv"
CITIES_CSV = ROOT / "static" / "seed" / "cities.csv"
OUT_CSV = ROOT / "static" / "seed" / "layout_distribution.csv"


def bucket_bedrooms(n: str) -> str:
    try:
        b = int(n)
    except (ValueError, TypeError):
        return "未知"
    if b <= 1:
        return "1室"
    if b == 2:
        return "2室"
    if b == 3:
        return "3室"
    if b == 4:
        return "4室"
    return "5室+"


def bucket_area(a: str) -> str:
    try:
        sqm = float(a)
    except (ValueError, TypeError):
        return "未知"
    if sqm < 50:
        return "<50"
    if sqm < 80:
        return "50-80"
    if sqm < 110:
        return "80-110"
    if sqm < 150:
        return "110-150"
    return "150+"


def normalize_orientation(o: str) -> str:
    """合并同义朝向 (如 南北 -> 南北通透)"""
    if not o:
        return "未知"
    s = o.strip()
    if s in ("南", "东南", "南北", "南北通透", "西南", "西", "东", "北", "西北", "东北"):
        return "南北通透" if s == "南北" else s
    return "其他"


def normalize_decorate(d: str) -> str:
    if not d:
        return "未知"
    s = d.strip()
    allowed = {"精装", "普装", "毛坯", "豪装", "简装"}
    return s if s in allowed else "其他"


def load_cities() -> dict:
    city_map = {}
    with open(CITIES_CSV, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            city_map[int(r["city_id"])] = r["city_name"]
    return city_map


def aggregate(rows: list, city_map: dict):
    """聚合 4 个维度 → 输出行"""
    # 通用统计辅助
    def stats(values: list):
        if not values:
            return None, None, 0
        prices = [v[0] for v in values if v[0] is not None]
        areas = [v[1] for v in values if v[1] is not None]
        cnt = len(values)
        med_price = statistics.median(prices) if prices else None
        avg_area = round(sum(areas) / len(areas), 1) if areas else None
        return med_price, avg_area, cnt

    # 按 (city_id, dimension, bucket) 聚合
    by_dim = defaultdict(list)  # key=(city_id, dim, bucket) → [(unit_price, area_sqm)]
    total_by_city = defaultdict(int)

    for r in rows:
        try:
            cid = int(r["city_id"])
        except (KeyError, ValueError):
            continue
        try:
            up = float(r["unit_price"]) if r.get("unit_price") else None
        except (ValueError, TypeError):
            up = None
        try:
            area = float(r["area_sqm"]) if r.get("area_sqm") else None
        except (ValueError, TypeError):
            area = None
        total_by_city[cid] += 1

        # 4 维度各贡献一份
        for dim, bucket_value in [
            ("bedrooms", bucket_bedrooms(r.get("bedrooms", ""))),
            ("area_sqm", bucket_area(r.get("area_sqm", ""))),
            ("orientation", normalize_orientation(r.get("orientation", ""))),
            ("decorate", normalize_decorate(r.get("decorate_type", "")))
        ]:
            by_dim[(cid, dim, bucket_value)].append((up, area))

    out_rows = []
    for (cid, dim, bucket), values in by_dim.items():
        med_price, avg_area, cnt = stats(values)
        total = total_by_city[cid]
        share = cnt / total if total > 0 else 0
        out_rows.append({
            "city_id": cid,
            "city_name": city_map.get(cid, ""),
            "dimension": dim,
            "bucket": bucket,
            "count": cnt,
            "share": round(share, 4),
            "median_unit_price": round(med_price, 0) if med_price is not None else "",
            "avg_area_sqm": avg_area if avg_area is not None else ""
        })

    return out_rows, dict(total_by_city)


def main():
    rows = []
    with open(LISTINGS_CSV, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            rows.append(r)
    print(f"加载 {len(rows)} 行 listings")

    city_map = load_cities()
    out_rows, total_by_city = aggregate(rows, city_map)

    fieldnames = [
        "city_id", "city_name", "dimension", "bucket",
        "count", "share", "median_unit_price", "avg_area_sqm"
    ]
    with open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(out_rows)

    print(f"✅ 写 {len(out_rows)} 行 → {OUT_CSV}")
    for cid, total in sorted(total_by_city.items()):
        print(f"  cityId={cid} ({city_map.get(cid)}): {total} 房源")
    # 各维度 bucket 数
    for dim in ("bedrooms", "area_sqm", "orientation", "decorate"):
        cnt = sum(1 for r in out_rows if r["dimension"] == dim)
        print(f"  dim={dim}: {cnt} 行")


if __name__ == "__main__":
    main()
"""
compute_tag_combination.py — v0.40.0 trend-20 标签组合 (tag combination) 热度
============================================================================

读 listing_tags.csv, 对每个 listing 取 4-7 个 tag, 计算 tag pair (2-combination) 频率。
输出 tag_combination.csv
  city_id, city_name, tag_a, tag_b, count, share (在所有 pair 中), avg_unit_price

排除单独出现一次 (噪声)；至少 count >= 3。
"""
from __future__ import annotations
import csv
import statistics
from collections import defaultdict, Counter
from itertools import combinations
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTING_TAGS = REPO_ROOT / "static" / "seed" / "listing_tags.csv"
LISTINGS = REPO_ROOT / "static" / "seed" / "listings.csv"
CITIES = REPO_ROOT / "static" / "seed" / "cities.csv"
OUT = REPO_ROOT / "static" / "seed" / "tag_combination.csv"


def n(v):
    if v is None or v == "":
        return None
    try:
        x = float(v)
        return x if x == x else None
    except (ValueError, TypeError):
        return None


def main():
    # 1) listing → city_id, unit_price
    listing_meta: dict[int, tuple[int, float | None]] = {}
    with open(LISTINGS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                lid = int(r["listing_id"])
                cid = int(r["city_id"])
                p = n(r["unit_price"])
                listing_meta[lid] = (cid, p)
            except (KeyError, ValueError):
                continue

    # 2) listing → set of tags
    listing_tags: dict[int, set[str]] = defaultdict(set)
    with open(LISTING_TAGS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                lid = int(r["listing_id"])
                tag = r["tag"].strip()
                if tag:
                    listing_tags[lid].add(tag)
            except (KeyError, ValueError):
                continue

    # 3) load city names
    city_names: dict[int, str] = {}
    with open(CITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                city_names[int(r["city_id"])] = r["city_name"]
            except (KeyError, ValueError):
                continue

    # 4) enumerate pairs per city
    pair_counter: dict[tuple, list[int]] = defaultdict(list)
    # key = (city_id, tag_a, tag_b) -> [listing_id]
    for lid, tags in listing_tags.items():
        if lid not in listing_meta:
            continue
        cid, _ = listing_meta[lid]
        # sorted to avoid duplicate (a,b) vs (b,a)
        for a, b in combinations(sorted(tags), 2):
            pair_counter[(cid, a, b)].append(lid)

    # 5) 统计 + 平均价
    rows = []
    # 按城市总数
    total_pairs: dict[int, int] = defaultdict(int)
    for (cid, _, _), lids in pair_counter.items():
        total_pairs[cid] += len(lids)

    for (cid, a, b), lids in pair_counter.items():
        if len(lids) < 3:
            continue
        prices = [listing_meta[lid][1] for lid in lids if listing_meta[lid][1] is not None]
        avg_p = statistics.median(prices) if prices else None
        rows.append({
            "city_id": cid,
            "city_name": city_names.get(cid, str(cid)),
            "tag_a": a,
            "tag_b": b,
            "count": len(lids),
            "share": round(len(lids) / total_pairs[cid], 4) if total_pairs[cid] > 0 else 0,
            "avg_unit_price": round(avg_p) if avg_p is not None else ""
        })

    # 排序: 城市内按 count 降序
    rows.sort(key=lambda r: (r["city_id"], -r["count"]))

    cols = ["city_id", "city_name", "tag_a", "tag_b", "count", "share", "avg_unit_price"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"[ok] wrote {OUT} ({len(rows)} rows)")

    by_city: dict[int, int] = defaultdict(int)
    for r in rows:
        by_city[r["city_id"]] += 1
    for c in sorted(by_city):
        print(f"  cityId={c} ({city_names.get(c, '?')}): {by_city[c]} 个 pair")

    # 展示 top 3 per city
    for c in sorted(by_city):
        c_rows = [r for r in rows if r["city_id"] == c][:5]
        print(f"  top 5 ({city_names.get(c, '?')}):")
        for r in c_rows:
            avg = f"{r['avg_unit_price']}元" if r['avg_unit_price'] != "" else "—"
            print(f"    {r['tag_a']:>4} + {r['tag_b']:<4}  {r['count']:>3} 套  share={r['share']:.3f}  中位 {avg}")


if __name__ == "__main__":
    main()
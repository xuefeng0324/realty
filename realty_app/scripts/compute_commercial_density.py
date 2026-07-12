"""
compute_commercial_density.py
==============================
v0.19.0 new-2: 给每个小区算「商业热度」评分 + 各类 POI 计数。

评分模型 (满分 100):
  - 餐饮 (restaurant):  0..50 分, 0..3 个 POI → 0/20/35/50
  - 银行 (bank):        0..30 分, 0..3 个 POI → 0/12/22/30
  - 便利店 (convenience): 0..20 分, 0..3 个 POI → 0/8/14/20

距离权重:
  - 最近 POI ≤ 300m:    full score
  - 最近 POI 300-800m:   × 0.7
  - 最近 POI 800-1500m:  × 0.4
  - 最近 POI > 1500m:    × 0.1
(同一类别 POI 中取最近的距离打分)

输出:
  static/seed/community_commercial.csv
    community_id, city_id, district_name, community_name,
    restaurant_count, bank_count, convenience_count,
    nearest_restaurant_m, nearest_bank_m, nearest_convenience_m,
    commercial_score (0-100, 整数)

跑法:
  python scripts/compute_commercial_density.py
"""
from __future__ import annotations
import csv
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
COMMUNITIES_CSV = REPO_ROOT / "static" / "seed" / "communities.csv"
COMMERCIAL_CSV = REPO_ROOT / "static" / "seed" / "poi_commercial.csv"
OUT_CSV = REPO_ROOT / "static" / "seed" / "community_commercial.csv"

# 每类最多 3 个 POI 取最近 → 分数阶梯
#   index 0,1,2,3 = 0个, 1个, 2个, 3个
SCORE_TABLE = {
    "restaurant":  [0, 20, 35, 50],
    "bank":        [0, 12, 22, 30],
    "convenience": [0,  8, 14, 20],
}


def dist_weight(d_m: int | None) -> float:
    if d_m is None:
        return 0.0
    if d_m <= 300:
        return 1.0
    if d_m <= 800:
        return 0.7
    if d_m <= 1500:
        return 0.4
    return 0.1


def main():
    com_rows = list(csv.DictReader(open(COMMUNITIES_CSV, encoding="utf-8-sig")))
    poi_rows = list(csv.DictReader(open(COMMERCIAL_CSV, encoding="utf-8-sig")))
    print(f"communities: {len(com_rows)}, commercial POI rows: {len(poi_rows)}")

    # community_id -> { city_id, district_name, community_name }
    com_meta: dict[str, dict] = {}
    for r in com_rows:
        com_meta[r["community_id"]] = {
            "city_id": r.get("city_id", ""),
            "district_name": r.get("district_name", ""),
            "community_name": r.get("community_name", "")
        }

    # (community_id, category) -> list of distances
    by_com_cat: dict[tuple[str, str], list[int]] = defaultdict(list)
    for r in poi_rows:
        cid = r["community_id"]
        cat = r["poi_category"]
        try:
            d = int(r["distance_m"])
        except (ValueError, KeyError):
            continue
        by_com_cat[(cid, cat)].append(d)

    out_rows: list[dict] = []
    for cid, meta in com_meta.items():
        rest_d = by_com_cat.get((cid, "restaurant"), [])
        bank_d = by_com_cat.get((cid, "bank"), [])
        conv_d = by_com_cat.get((cid, "convenience"), [])

        # 评分
        n_rest = min(len(rest_d), 3)
        n_bank = min(len(bank_d), 3)
        n_conv = min(len(conv_d), 3)

        # 距离权重 (取最近)
        w_rest = dist_weight(min(rest_d) if rest_d else None)
        w_bank = dist_weight(min(bank_d) if bank_d else None)
        w_conv = dist_weight(min(conv_d) if conv_d else None)

        score = (
            SCORE_TABLE["restaurant"][n_rest] * w_rest
            + SCORE_TABLE["bank"][n_bank] * w_bank
            + SCORE_TABLE["convenience"][n_conv] * w_conv
        )
        score = round(score, 1)

        out_rows.append({
            "community_id": cid,
            "city_id": meta["city_id"],
            "district_name": meta["district_name"],
            "community_name": meta["community_name"],
            "restaurant_count": n_rest,
            "bank_count": n_bank,
            "convenience_count": n_conv,
            "nearest_restaurant_m": min(rest_d) if rest_d else "",
            "nearest_bank_m": min(bank_d) if bank_d else "",
            "nearest_convenience_m": min(conv_d) if conv_d else "",
            "commercial_score": score
        })

    out_rows.sort(key=lambda r: -float(r["commercial_score"]))

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "community_id", "city_id", "district_name", "community_name",
            "restaurant_count", "bank_count", "convenience_count",
            "nearest_restaurant_m", "nearest_bank_m", "nearest_convenience_m",
            "commercial_score"
        ])
        w.writeheader()
        for r in out_rows:
            w.writerow(r)

    # 统计
    with_score = sum(1 for r in out_rows if float(r["commercial_score"]) > 0)
    print(f"\nwrote {OUT_CSV}")
    print(f"  total: {len(out_rows)} communities")
    print(f"  with score > 0: {with_score} ({with_score * 100 // len(out_rows)}%)")
    print(f"  avg score: {sum(float(r['commercial_score']) for r in out_rows) / len(out_rows):.1f}")
    # Top 5
    print("\nTop 5 商业热度:")
    for r in out_rows[:5]:
        print(f"  {r['community_name']} ({r['district_name']}): "
              f"score={r['commercial_score']} "
              f"rest={r['restaurant_count']} bank={r['bank_count']} conv={r['convenience_count']}")
    # Bottom 5
    print("\nBottom 5 商业热度:")
    for r in out_rows[-5:]:
        print(f"  {r['community_name']} ({r['district_name']}): "
              f"score={r['commercial_score']} "
              f"rest={r['restaurant_count']} bank={r['bank_count']} conv={r['convenience_count']}")


if __name__ == "__main__":
    main()
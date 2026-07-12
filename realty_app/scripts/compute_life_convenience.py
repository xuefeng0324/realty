"""
compute_life_convenience.py — v0.31.0 new-9 生活便利度
====================================================

基于 poi_seed.csv 计算每个 community 的生活便利度综合分。

打分规则 (满分 100):
  mall     ≤500m: 25, ≤1000m: 20, ≤1500m: 10, >1500m: 0
  park     ≤500m: 15, ≤1000m: 10, ≤1500m: 5,  >1500m: 0
  subway   ≤300m: 25, ≤500m: 20,  ≤800m: 15,  ≤1500m: 5
  school   ≤500m: 10, ≤1000m: 7,  ≤1500m: 4
  hospital ≤1000m: 15, ≤2000m: 10, ≤3000m: 5

总 max = 100

输出: life_convenience.csv
  community_id, city_id, district_name, community_name,
  mall_near, park_near, subway_near, school_near, hospital_near,
  score (0-100)
"""
from __future__ import annotations
import csv
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
POI = REPO_ROOT / "static" / "seed" / "poi_seed.csv"
COMMUNITIES = REPO_ROOT / "static" / "seed" / "communities.csv"
OUT = REPO_ROOT / "static" / "seed" / "life_convenience.csv"

THRESHOLDS = {
    "mall": [(500, 25), (1000, 20), (1500, 10), (99999, 0)],
    "park": [(500, 15), (1000, 10), (1500, 5), (99999, 0)],
    "subway": [(300, 25), (500, 20), (800, 15), (1500, 5), (99999, 0)],
    "school": [(500, 10), (1000, 7), (1500, 4), (99999, 0)],
    "hospital": [(1000, 15), (2000, 10), (3000, 5), (99999, 0)]
}


def score_for(dist: float | None, cat: str) -> int:
    if dist is None:
        return 0
    for thr, pts in THRESHOLDS[cat]:
        if dist <= thr:
            return pts
    return 0


def main():
    # 1) community_id -> (city_id, district_name, community_name)
    cid_info: dict[int, dict] = {}
    with open(COMMUNITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["community_id"])
                cid_info[cid] = {
                    "city_id": int(r["city_id"]),
                    "district_name": r.get("district_name") or "",
                    "community_name": r.get("community_name") or f"#{cid}"
                }
            except (KeyError, ValueError):
                continue
    print(f"加载 {len(cid_info)} 个 community")

    # 2) 加载 POI, 计算每个 community 每个 cat 的最近距离
    nearest: dict[tuple[int, str], float] = {}
    with open(POI, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["community_id"])
                cat = r["poi_category"]
                dist = float(r["distance_m"]) if r.get("distance_m") else None
            except (KeyError, ValueError):
                continue
            if dist is None or cat not in THRESHOLDS:
                continue
            key = (cid, cat)
            cur = nearest.get(key)
            if cur is None or dist < cur:
                nearest[key] = dist

    # 3) 算分
    rows: list[dict] = []
    for cid, info in cid_info.items():
        scores = {}
        for cat in THRESHOLDS:
            dist = nearest.get((cid, cat))
            scores[cat] = score_for(dist, cat)
        total = sum(scores.values())
        rows.append({
            "community_id": cid,
            "city_id": info["city_id"],
            "district_name": info["district_name"],
            "community_name": info["community_name"],
            "mall_near": scores["mall"],
            "park_near": scores["park"],
            "subway_near": scores["subway"],
            "school_near": scores["school"],
            "hospital_near": scores["hospital"],
            "score": total
        })

    fieldnames = ["community_id", "city_id", "district_name", "community_name",
                  "mall_near", "park_near", "subway_near", "school_near", "hospital_near", "score"]
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"✅ 写 {len(rows)} 行 → {OUT}")

    # 4) 统计分布
    by_city = defaultdict(list)
    for r in rows:
        by_city[r["city_id"]].append(r)
    for cid in sorted(by_city):
        scores = [r["score"] for r in by_city[cid]]
        avg = round(sum(scores) / len(scores), 1)
        max_score = max(scores)
        print(f"  cityId={cid}: {len(scores)} 个社区, avg={avg}, max={max_score}")


if __name__ == "__main__":
    main()
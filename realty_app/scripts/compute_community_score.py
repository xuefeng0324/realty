"""
compute_community_score.py — v0.33.0 trend-15 小区综合评分 v2
============================================================

把现成 6 类分数合成 1 个综合评分 (0-100)，让用户一眼看出哪个小区"最适合自住"。

评分维度 (满分 100):
  life        50 分  - life_convenience.csv score100 (生活便利度 6 维加权)
  school      30 分  - school_premium_community.csv avg_school_score (0-100, 直接缩放)
  commute     20 分  - commute.csv minutes (转 0-100: ≤30min=100, 60min=50, ≥120min=0)

输出: community_score.csv
  community_id, city_id, district_name, community_name,
  life_score (0-100), school_score (0-100), commute_score (0-100),
  total_score (0-100), rank_city
"""
from __future__ import annotations
import csv
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LIFE = REPO_ROOT / "static" / "seed" / "life_convenience.csv"
SCHOOL = REPO_ROOT / "static" / "seed" / "school_premium_community.csv"
COMMUTE = REPO_ROOT / "static" / "seed" / "commute.csv"
COMMUNITIES = REPO_ROOT / "static" / "seed" / "communities.csv"
OUT = REPO_ROOT / "static" / "seed" / "community_score.csv"


def to_float(v) -> float | None:
    try:
        if v is None or v == "":
            return None
        return float(v)
    except (ValueError, TypeError):
        return None


def load_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def commute_score(minutes: float | None) -> float:
    """通勤分钟数 → 0-100 分数 (≤30 min = 100, 60 = 50, ≥120 = 0)"""
    if minutes is None:
        return 0.0
    if minutes <= 30:
        return 100.0
    if minutes >= 120:
        return 0.0
    # 30-60: 100→50, 60-120: 50→0 (线性)
    if minutes <= 60:
        return 100.0 - (minutes - 30) * (50 / 30)
    return 50.0 - (minutes - 60) * (50 / 60)


def main():
    # 1) communities
    cid_info: dict[int, dict] = {}
    for r in load_csv(COMMUNITIES):
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

    # 2) life_convenience: score100
    life_map: dict[int, float] = {}
    for r in load_csv(LIFE):
        try:
            cid = int(r["community_id"])
            s100 = to_float(r.get("score100"))
            if s100 is not None:
                life_map[cid] = s100
        except (KeyError, ValueError):
            continue
    print(f"加载 {len(life_map)} 个生活便利度")

    # 3) school_premium_community: avg_school_score (0-100)
    school_map: dict[int, float] = {}
    for r in load_csv(SCHOOL):
        try:
            cid = int(r["community_id"])
            sc = to_float(r.get("avg_school_score"))
            if sc is not None:
                school_map[cid] = sc
        except (KeyError, ValueError):
            continue
    print(f"加载 {len(school_map)} 个学区评分")

    # 4) commute: transit_minutes (取最小时)
    commute_map: dict[int, float] = {}
    for r in load_csv(COMMUTE):
        try:
            cid = int(r["community_id"])
            mins = to_float(r.get("transit_minutes"))
            if mins is None:
                continue
            cur = commute_map.get(cid)
            if cur is None or mins < cur:
                commute_map[cid] = mins
        except (KeyError, ValueError):
            continue
    print(f"加载 {len(commute_map)} 个通勤时间")

    # 5) 综合分 (权重: life=50%, school=30%, commute=20%)
    rows = []
    for cid, info in cid_info.items():
        life = life_map.get(cid, 0.0)
        school = school_map.get(cid, 0.0)
        comm_min = commute_map.get(cid)
        comm = commute_score(comm_min)
        total = round(life * 0.5 + school * 0.3 + comm * 0.2, 1)
        rows.append({
            "community_id": cid,
            "city_id": info["city_id"],
            "district_name": info["district_name"],
            "community_name": info["community_name"],
            "life_score": round(life, 1),
            "school_score": round(school, 1),
            "commute_minutes": round(comm_min, 0) if comm_min else "",
            "commute_score": round(comm, 1),
            "total_score": total,
            "rank_city": 0  # 占位
        })

    # 6) 按城市内排序 + 写 rank_city
    by_city: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_city[r["city_id"]].append(r)
    for cid in by_city:
        by_city[cid].sort(key=lambda r: r["total_score"], reverse=True)
        for i, r in enumerate(by_city[cid], 1):
            r["rank_city"] = i

    rows.sort(key=lambda r: (r["city_id"], r["rank_city"]))

    fieldnames = ["community_id", "city_id", "district_name", "community_name",
                  "life_score", "school_score", "commute_minutes", "commute_score",
                  "total_score", "rank_city"]
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"✅ 写 {len(rows)} 行 → {OUT}")

    # 7) 统计分布
    for cid in sorted(by_city):
        items = by_city[cid]
        scores = [r["total_score"] for r in items]
        avg = round(sum(scores) / len(scores), 1)
        max_score = max(scores)
        top1 = items[0]
        print(f"  cityId={cid}: {len(scores)} 个社区, avg={avg}, max={max_score}, top1={top1['community_name']} ({top1['total_score']})")


if __name__ == "__main__":
    main()
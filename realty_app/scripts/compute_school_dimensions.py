"""
compute_school_dimensions.py — v0.47.0 school-4 学区指标加权细分

读 school_indicators.csv (raw 5 列指标) + schools.csv (校名+城市+区), 计算:
  - 6 维度的 city 内 ranking (0-100 分)
  - 综合 score (动态加权, 4 维)
  - per-city top 10 (综合最强 + 各维度单独最强)

输出: school_dimensions.csv
  city_id, city_name, school_id, school_name, district_name, school_type,
  level_score, is_group, group_strength, district_balance, trend_delta,
  composite_score, is_top_city_overall

排名: 城市内, 在 6 个维度上各算 rank (1 = 最好),
composite_score = 100 - avg(rank_in_dim * weights) * 100
"""
from __future__ import annotations
import csv
import statistics
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SCHOOLS = REPO_ROOT / "static" / "seed" / "schools.csv"
INDICATORS = REPO_ROOT / "static" / "seed" / "school_indicators.csv"
CITIES = REPO_ROOT / "static" / "seed" / "cities.csv"
OUT = REPO_ROOT / "static" / "seed" / "school_dimensions.csv"

# 6 维权重 (默认平权)
DEFAULT_WEIGHTS = {
    "level_score": 0.40,      # 综合水平最重
    "is_group": 0.05,          # 是否集团校
    "group_strength": 0.20,    # 集团实力
    "district_balance": 0.15,  # 区域均衡
    "trend_delta": 0.10        # 趋势
}


def n(v):
    if v is None or v == "":
        return None
    try:
        x = float(v);
        return x if x == x else None
    except (ValueError, TypeError):
        return None


def norm_trend(t):
    """trend_delta 可以是负值, 归一化到 0-100 (-10..+10 -> 0..100)"""
    if t is None: return 50
    return min(100, max(0, 50 + t * 5))


def main():
    city_names: dict[int, str] = {}
    with open(CITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try: city_names[int(r["city_id"])] = r["city_name"]
            except: continue

    school_meta: dict[int, dict] = {}
    with open(SCHOOLS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                sid = int(r["school_id"])
                school_meta[sid] = {
                    "city_id": int(r["city_id"]),
                    "name": r.get("official_name") or r.get("display_name") or "",
                    "district": r.get("district_name") or "",
                    "type": r.get("school_type") or ""
                }
            except: continue

    # 读指标 + 合并 meta
    by_school: dict[int, dict] = {}
    with open(INDICATORS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                sid = int(r["school_id"])
                ls = n(r.get("latest_level_score_raw"))
                gf = (r.get("group_school_flag_raw") or "").lower() in ("true", "1", "yes")
                gs = n(r.get("group_school_strength_raw"))
                db = n(r.get("district_balance_level_raw"))
                td = n(r.get("trend_delta_raw"))
                meta = school_meta.get(sid, {})
                by_school[sid] = {
                    "school_id": sid,
                    "city_id": meta.get("city_id", 0),
                    "name": meta.get("name", ""),
                    "district_name": meta.get("district", ""),
                    "school_type": meta.get("type", ""),
                    "level_score": ls if ls is not None else 0,
                    "is_group": 1.0 if gf else 0.0,
                    "group_strength": gs if gs is not None else 0,
                    "district_balance": db if db is not None else 0,
                    "trend_delta": td if td is not None else 0,
                    "trend_norm": norm_trend(td)
                }
            except: continue

    # 按 city 分组, 计算每个维度的排序分 (百分位)
    by_city: dict[int, list] = defaultdict(list)
    for sid, s in by_school.items():
        by_city[s["city_id"]].append(sid)

    rows = []
    for cid, sids in by_city.items():
        if not sids: continue
        # 各维度排名 (越大越好)
        def rank_score(key: str) -> dict[int, float]:
            sorted_sids = sorted(sids, key=lambda x: by_school[x][key], reverse=True)
            n = len(sorted_sids)
            return {sid: (n - i) / n * 100 for i, sid in enumerate(sorted_sids)}

        r_level = rank_score("level_score")
        r_group = rank_score("is_group")
        r_group_s = rank_score("group_strength")
        r_district = rank_score("district_balance")
        r_trend = rank_score("trend_norm")

        for sid in sids:
            s = by_school[sid]
            composite = (
                r_level[sid] * DEFAULT_WEIGHTS["level_score"] +
                r_group[sid] * DEFAULT_WEIGHTS["is_group"] +
                r_group_s[sid] * DEFAULT_WEIGHTS["group_strength"] +
                r_district[sid] * DEFAULT_WEIGHTS["district_balance"] +
                r_trend[sid] * DEFAULT_WEIGHTS["trend_delta"]
            )
            rows.append({
                "city_id": cid,
                "city_name": city_names.get(cid, str(cid)),
                "school_id": sid,
                "school_name": s["name"],
                "district_name": s["district_name"],
                "school_type": s["school_type"],
                "level_score": s["level_score"],
                "is_group": int(s["is_group"]) if s["is_group"] else 0,
                "group_strength": s["group_strength"],
                "district_balance": s["district_balance"],
                "trend_delta": s["trend_delta"],
                "composite_score": round(composite, 1)
            })

    rows.sort(key=lambda r: (r["city_id"], -r["composite_score"]))

    cols = ["city_id", "city_name", "school_id", "school_name", "district_name", "school_type",
            "level_score", "is_group", "group_strength", "district_balance", "trend_delta",
            "composite_score"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"[ok] wrote {OUT} ({len(rows)} rows)")

    # insights
    by_city: dict[int, int] = defaultdict(int)
    for r in rows: by_city[r["city_id"]] += 1
    for c in sorted(by_city):
        c_rows = [r for r in rows if r["city_id"] == c]
        avg = statistics.median([r["composite_score"] for r in c_rows])
        best = c_rows[0]
        worst = c_rows[-1]
        print(f"  {city_names[c]} ({by_city[c]} 校): median={avg:.1f}, top={best['school_name']}({best['composite_score']}), bottom={worst['school_name']}({worst['composite_score']})")
        # 趋势最强 (涨幅最大)
        trend_top = sorted(c_rows, key=lambda r: -r["trend_delta"])[0]
        print(f"  {city_names[c]} 涨幅最强: {trend_top['school_name']} ({trend_top['trend_delta']:+})")
        # 集团校
        group_top = sorted([r for r in c_rows if r["is_group"] == 1], key=lambda r: -r["group_strength"])
        if group_top:
            print(f"  {city_names[c]} 集团最强: {group_top[0]['school_name']} (group_strength={group_top[0]['group_strength']})")


if __name__ == "__main__":
    main()
"""
compute_metro_benefit.py — v0.36.0 map-10 地铁规划受益
========================================================

对每个社区 / 每条规划/在建地铁线，算"距离起/终点站多远"，给出受益分。

数据源:
- communities_geo.csv (小区 lat/lng)
- metro_planning_geo.csv (起/终点 lat/lng + open_year_expected + status)

算法:
- 用 haversine 算 小区 → 线路起/终点 的最近距离
- 优先选最近 station, 与该线的 status/open_year 结合:
    在建(2026~2029): weight 1.2  (即将到来的最大利好)
    规划(>2028):     weight 1.0
    即将开通(<=2026): weight 1.5  (已经板上钉钉)
- 距离 → 受益分 (0-100):
    ≤ 300m  : 100
    ≤ 500m  : 90
    ≤ 800m  : 75
    ≤ 1200m : 60
    ≤ 2000m : 40
    ≤ 3000m : 20
    > 3000m : 0
- 取所有线路中受益分最高那条 = 最终受益分

输出: metro_benefit.csv
  community_id, city_id, district, community_name,
  nearest_line_id, nearest_line_name, nearest_line_status,
  nearest_station_name, nearest_distance_m, open_year_expected,
  benefit_score (0-100)
"""
from __future__ import annotations
import csv
import math
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
COMMUNITIES = REPO_ROOT / "static" / "seed" / "communities_geo.csv"
GEOS = REPO_ROOT / "static" / "seed" / "metro_planning_geo.csv"
OUT = REPO_ROOT / "static" / "seed" / "metro_benefit.csv"


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def distance_score(m: float) -> int:
    if m <= 300:
        return 100
    if m <= 500:
        return 90
    if m <= 800:
        return 75
    if m <= 1200:
        return 60
    if m <= 2000:
        return 40
    if m <= 3000:
        return 20
    return 0


def status_weight(status: str | None, open_year: int | None) -> float:
    """根据 status × open_year 给个时效乘数"""
    sy = open_year if open_year is not None else 2030
    if status == "即将开通":
        return 1.5
    if status == "在建":
        return 1.2
    if status == "规划":
        # 越远权重略低 (太远的规划可信度差)
        if sy <= 2030:
            return 1.0
        return 0.7
    return 1.0


def load_communities() -> list[dict]:
    rows = []
    with open(COMMUNITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                rows.append({
                    "community_id": int(r["community_id"]),
                    "city_id": int(r["city_id"]),
                    "community_name": r.get("community_name") or f"#{r['community_id']}",
                    "district": r.get("district") or "",
                    "lat": float(r["lat"]),
                    "lng": float(r["lng"]),
                })
            except (KeyError, ValueError):
                continue
    return rows


def load_stations() -> list[dict]:
    """
    把 metro_planning.csv + metro_planning_geo.csv join,
    输出每个 station (start 或 end) 一行:
      line_id, line_name, city_id, status, open_year_expected, lat, lng, station_name
    """
    # 1) 加载 lines (status, open_year, city_id)
    line_info: dict[int, dict] = {}
    with open(REPO_ROOT / "static" / "seed" / "metro_planning.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                line_info[int(r["line_id"])] = {
                    "line_name": r.get("line_name") or "",
                    "city_id": int(r["city_id"]) if r.get("city_id") else None,
                    "status": r.get("status") or "规划",
                    "open_year": int(r["open_year_expected"]) if r.get("open_year_expected") else None
                }
            except (KeyError, ValueError):
                continue
    # 2) 加载每个 line 的 start/end 坐标
    stations = []
    with open(GEOS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                lid = int(r["line_id"])
                info = line_info.get(lid, {})
                # start
                if r.get("start_lat") and r.get("start_lng"):
                    try:
                        stations.append({
                            "line_id": lid,
                            "line_name": info.get("line_name") or r.get("line_name") or "",
                            "city_id": info.get("city_id"),
                            "status": info.get("status") or "规划",
                            "open_year": info.get("open_year"),
                            "station_name": r.get("start_station") or "?",
                            "lat": float(r["start_lat"]),
                            "lng": float(r["start_lng"])
                        })
                    except ValueError:
                        pass
                # end
                if r.get("end_lat") and r.get("end_lng"):
                    try:
                        stations.append({
                            "line_id": lid,
                            "line_name": info.get("line_name") or r.get("line_name") or "",
                            "city_id": info.get("city_id"),
                            "status": info.get("status") or "规划",
                            "open_year": info.get("open_year"),
                            "station_name": r.get("end_station") or "?",
                            "lat": float(r["end_lat"]),
                            "lng": float(r["end_lng"])
                        })
                    except ValueError:
                        pass
            except (KeyError, ValueError):
                continue
    return stations


def best_for_community(c: dict, stations: list[dict]) -> dict | None:
    """对单小区找 best station: 考虑 status 权重, 必须同城"""
    best = None
    for s in stations:
        if s["line_name"] == "" or c["city_id"] is None:
            continue
        # 跨城市不匹配 — 必须 station.city_id == community.city_id
        if s["city_id"] is not None and s["city_id"] != c["city_id"]:
            continue
        d = haversine_m(c["lat"], c["lng"], s["lat"], s["lng"])
        raw = distance_score(d)
        weighted = raw * status_weight(s["status"], s["open_year"])
        # 排序: 先按 weighted 降序, 再按 distance 升序
        is_better = False
        if best is None:
            is_better = True
        elif weighted > best["weighted_score"]:
            is_better = True
        elif weighted == best["weighted_score"] and d < best["distance_m"]:
            is_better = True
        if is_better:
            best = {
                "line_id": s["line_id"],
                "line_name": s["line_name"],
                "status": s["status"],
                "open_year": s["open_year"],
                "station_name": s["station_name"],
                "distance_m": d,
                "raw_score": raw,
                "weighted_score": weighted
            }
    if best is None:
        return None
    # 用 weighted_score 作为最终受益分 (0-100, 截断)
    final = min(100, round(best["weighted_score"]))
    return {
        "line_id": best["line_id"],
        "line_name": best["line_name"],
        "status": best["status"],
        "open_year": best["open_year"],
        "station_name": best["station_name"],
        "distance_m": round(best["distance_m"], 0),
        "benefit_score": final
    }


def main():
    communities = load_communities()
    print(f"加载 {len(communities)} 个社区")
    stations = load_stations()
    print(f"加载 {len(stations)} 个规划站 (start/end 合计)")

    by_city_stations: dict[int, list[dict]] = {}
    # 注意: lat/lng 都没填 city_id — 已知 metro_planning 全是深圳 line (city_id=2)
    # 不区分按 city_id 处理, 但要避开广州 (city_id=1) 误匹配
    for c in communities:
        # 仅对 city_id=2(深圳) / city_id=3(珠海) 应用, 广州地铁规划暂未录入
        if c["city_id"] not in (2, 3):
            # 写 0 分 (无受益)
            by_city_stations.setdefault(c["city_id"], [])

    # 计算
    rows = []
    by_score: dict[int, list[dict]] = {}
    for c in communities:
        best = best_for_community(c, stations)
        if best is None:
            rows.append({
                "community_id": c["community_id"],
                "city_id": c["city_id"],
                "district": c["district"],
                "community_name": c["community_name"],
                "nearest_line_id": "",
                "nearest_line_name": "",
                "nearest_line_status": "",
                "nearest_station_name": "",
                "nearest_distance_m": "",
                "open_year_expected": "",
                "benefit_score": 0
            })
            continue
        rows.append({
            "community_id": c["community_id"],
            "city_id": c["city_id"],
            "district": c["district"],
            "community_name": c["community_name"],
            "nearest_line_id": best["line_id"],
            "nearest_line_name": best["line_name"],
            "nearest_line_status": best["status"],
            "nearest_station_name": best["station_name"],
            "nearest_distance_m": int(best["distance_m"]),
            "open_year_expected": best["open_year"] or "",
            "benefit_score": best["benefit_score"]
        })
        by_score.setdefault(c["city_id"], []).append({"name": c["community_name"], "score": best["benefit_score"]})

    cols = ["community_id", "city_id", "district", "community_name",
            "nearest_line_id", "nearest_line_name", "nearest_line_status",
            "nearest_station_name", "nearest_distance_m",
            "open_year_expected", "benefit_score"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"\n[ok] wrote {OUT} ({len(rows)} rows)")
    # 统计
    for cid, lst in by_score.items():
        if not lst:
            continue
        lst.sort(key=lambda r: r["score"], reverse=True)
        top = lst[:5]
        print(f"  cityId={cid}: Top 5 受规划地铁利好小区:")
        for r in top:
            print(f"    {r['name']:20s} 受益分 {r['score']}")


if __name__ == "__main__":
    main()
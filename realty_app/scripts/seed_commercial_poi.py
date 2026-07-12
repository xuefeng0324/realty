"""
seed_commercial_poi.py
=======================
v0.19.0 new-2: 从现有 poi_seed.csv 中按 poi_name 关键词提取 3 类商业 POI
   - restaurant (餐饮): 含 "餐厅 / 食堂 / 咖啡 / 奶茶 / 茶餐厅 / 火锅 / 烧烤"
   - bank (银行): 含 "银行 / ATM / 信用社 / 储蓄"
   - convenience (便利店): 含 "便利店 / 7-11 / 全家 / 罗森 / 美宜佳 / 喜士多"

输出:
  static/seed/poi_commercial.csv (含 commercial 类的 POI, 同样 schema)
    community_id, poi_category, poi_rank, poi_name, poi_type, distance_m, lat, lng, address

注：
  - 这个脚本是 *离线模拟*：因为 49 社区 × 3 类 = 147 次 API 调用成本较高
  - 实际部署时若用户愿意付费，可改用 crawl_commercial_poi.py 调用 /v3/place/around
  - 当前实现先保证功能完整 + 数据流通畅

跑法:
  python scripts/seed_commercial_poi.py
"""
from __future__ import annotations
import csv
import re
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_CSV = REPO_ROOT / "static" / "seed" / "poi_seed.csv"
OUT_CSV = REPO_ROOT / "static" / "seed" / "poi_commercial.csv"

# 关键词 → commercial 类别
# 注意：name 包含 "美食" 也算餐饮（POI type 经常含 "餐饮服务"）
KEYWORDS: list[tuple[str, list[str]]] = [
    ("restaurant", [
        "餐厅", "食堂", "咖啡", "奶茶", "茶餐厅", "火锅", "烧烤",
        "面馆", "小吃", "肯德基", "麦当劳", "必胜客", "星巴克",
        "瑞幸", "喜茶", "奈雪", "美食", "快餐", "西餐", "日料",
        "寿司", "粤菜", "湘菜", "川菜", "东北菜", "海鲜", "自助餐"
    ]),
    ("bank", [
        "银行", "ATM", "信用合作社", "储蓄所", "工行", "建行",
        "农行", "中行", "招行", "交行", "浦发", "民生", "兴业"
    ]),
    ("convenience", [
        "便利店", "7-11", "7-ELEVEN", "全家", "罗森", "美宜佳",
        "喜士多", "易捷", "便利蜂", "十足", "好邻居", "华润万家便利",
        "屈臣氏", "万宁", "苏宁小店"
    ]),
]


def classify(name: str, poi_type: str) -> str | None:
    """返回 'restaurant' / 'bank' / 'convenience' / None"""
    text = (name + " " + poi_type).lower()
    # 优先 bank: 含 "银行"/"ATM"
    if any(k.lower() in text for k in ["atm", "银行"]):
        return "bank"
    if any(k.lower() in text for k in ["便利店", "7-11", "7-eleven", "全家", "罗森", "美宜佳", "喜士多"]):
        return "convenience"
    if any(k.lower() in text for k in ["餐厅", "食堂", "咖啡", "奶茶", "火锅", "烧烤", "快餐", "美食", "西餐", "日料"]):
        return "restaurant"
    return None


def main():
    rows = list(csv.DictReader(open(SRC_CSV, encoding="utf-8-sig")))
    print(f"read {len(rows)} POI rows from {SRC_CSV.name}")

    # 按 (community_id, category) 分桶
    by_com_cat: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in rows:
        cid = r["community_id"]
        cat = r["poi_category"]
        # 只看 已有 5 类: subway/school/hospital/mall/park
        if cat not in ("subway", "school", "hospital", "mall", "park"):
            continue
        poi = {
            "community_id": cid,
            "poi_name": r["poi_name"],
            "poi_type": r["poi_type"],
            "distance_m": r["distance_m"],
            "lat": r["lat"],
            "lng": r["lng"],
            "address": r["address"]
        }
        classified = classify(r["poi_name"], r["poi_type"])
        if classified:
            by_com_cat[(cid, classified)].append(poi)

    # 输出
    out_rows: list[dict] = []
    for (cid, cat), pois in by_com_cat.items():
        # 按 distance_m 升序, 取前 3
        pois_sorted = sorted(pois, key=lambda p: int(p["distance_m"]))[:3]
        for rank, p in enumerate(pois_sorted, 1):
            out_rows.append({
                "community_id": cid,
                "poi_category": cat,
                "poi_rank": rank,
                "poi_name": p["poi_name"],
                "poi_type": p["poi_type"],
                "distance_m": p["distance_m"],
                "lat": p["lat"],
                "lng": p["lng"],
                "address": p["address"]
            })

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "community_id", "poi_category", "poi_rank", "poi_name",
            "poi_type", "distance_m", "lat", "lng", "address"
        ])
        w.writeheader()
        for r in out_rows:
            w.writerow(r)

    # 统计
    cnt_cat: dict[str, int] = defaultdict(int)
    for r in out_rows:
        cnt_cat[r["poi_category"]] += 1
    cnt_com = len(set(r["community_id"] for r in out_rows))
    print(f"wrote {OUT_CSV}")
    print(f"  total rows: {len(out_rows)}")
    print(f"  communities covered: {cnt_com}")
    for cat in ("restaurant", "bank", "convenience"):
        print(f"  {cat}: {cnt_cat.get(cat, 0)} rows")
    # 平均每个 community
    if cnt_com > 0:
        for cat in ("restaurant", "bank", "convenience"):
            avg = cnt_cat.get(cat, 0) / cnt_com
            print(f"  avg {cat} per community: {avg:.1f}")


if __name__ == "__main__":
    main()
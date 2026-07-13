"""
compute_listing_keyword.py — v0.41.0 trend-21 房源标题关键词热度
================================================================

读 listings.csv 的 title 字段, 用关键词正则匹配统计每关键词命中数。
关键词来自房地产销售常见卖点 (用正则按出现次数统计)。

输出: listing_keyword.csv
  city_id, city_name, keyword, count, share, median_unit_price

仅保留 count >= 5 的关键词, 按 city 内 count 降序。
"""
from __future__ import annotations
import csv
import re
import statistics
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS = REPO_ROOT / "static" / "seed" / "listings.csv"
CITIES = REPO_ROOT / "static" / "seed" / "cities.csv"
OUT = REPO_ROOT / "static" / "seed" / "listing_keyword.csv"

# 房地产常见卖点关键词 (按 hit 顺序检查, 不重复计数同 listing)
KEYWORDS = [
    "南北通透",
    "满五唯一",
    "近地铁",
    "学区房",
    "精装修",
    "豪装",
    "普装",
    "毛坯",
    "中高楼层",
    "低楼层",
    "高楼层",
    "中间层",
    "朝南",
    "朝北",
    "板楼",
    "塔楼",
    "复式",
    "错层",
    "loft",
    "loft公寓",
    "大平层",
    "一梯两户",
    "一梯一户",
    "两梯三户",
    "两梯四户",
    "近学校",
    "近医院",
    "近商圈",
    "近公园",
    "近江",
    "江景",
    "湖景",
    "山景",
    "海景",
    "复式公寓",
    "loft复式",
    "顶层复式",
    "底楼复式",
    "赠送面积",
    "产权清晰",
    "可贷款",
    "随时看房",
    "业主诚售",
    "急售",
    "降价",
    "新房",
    "次新",
    "满二",
    "满五",
    "免税",
    "红本在手",
    "学位未用",
    "学位在用",
    "实验小学",
    "外国语学校",
    "地铁口",
    "BRT",
    "公交直达",
    "购物中心",
    "万达",
    "万象城",
    "海岸城",
    "万象天地",
    "壹方城",
    "COCO Park",
    "印象城",
    "益田假日",
    "KKMALL",
    "万象汇",
    "Mixc",
    "Sephora",
    "无遮挡",
    "采光好",
    "通风好",
    "安静",
    "拎包入住",
    "全屋定制",
    "豪装全配",
    "新装修",
    "全南向",
    "全明格局",
    "户型方正",
    "合理布局",
    "双卫",
    "三卫",
    "带车位",
    "带花园",
    "带露台",
    "带阁楼",
    "带储藏室",
    "带书房",
    "带衣帽间",
    "loft户型",
    "一房一厅",
    "两房一厅",
    "两房两厅",
    "三房两厅",
    "四房两厅",
    "四房三厅",
    "五房两厅",
    "顶层复式",
]


def n(v):
    if v is None or v == "":
        return None
    try:
        x = float(v)
        return x if x == x else None
    except (ValueError, TypeError):
        return None


def main():
    # 1) 加载 city names
    city_names: dict[int, str] = {}
    with open(CITIES, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                city_names[int(r["city_id"])] = r["city_name"]
            except (KeyError, ValueError):
                continue

    # 2) 加载 listings, 按 city 分组
    by_city: dict[int, list[dict]] = defaultdict(list)
    with open(LISTINGS, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                cid = int(r["city_id"])
                by_city[cid].append(r)
            except (KeyError, ValueError):
                continue

    rows = []
    for city_id, listings in sorted(by_city.items()):
        city_name = city_names.get(city_id, str(city_id))
        kw_hits: dict[str, list[dict]] = defaultdict(list)
        for l in listings:
            title = (l.get("title") or "").lower()
            if not title:
                continue
            for kw in KEYWORDS:
                if kw.lower() in title:
                    kw_hits[kw].append(l)
                    # 不 break, 让同一 listing 命中多个不同 kw

        # 统计
        total = len(listings)
        for kw, hits in kw_hits.items():
            if len(hits) < 5:
                continue
            prices = [n(l["unit_price"]) for l in hits]
            prices = [p for p in prices if p is not None and p > 0]
            med = statistics.median(prices) if prices else None
            rows.append({
                "city_id": city_id,
                "city_name": city_name,
                "keyword": kw,
                "count": len(hits),
                "share": round(len(hits) / total, 4) if total > 0 else 0,
                "median_unit_price": round(med) if med is not None else ""
            })

    rows.sort(key=lambda r: (r["city_id"], -r["count"]))

    cols = ["city_id", "city_name", "keyword", "count", "share", "median_unit_price"]
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
        print(f"  cityId={c} ({city_names.get(c, '?')}): {by_city_count[c]} 关键词")

    # top 5 per city
    for c in sorted(by_city_count):
        c_rows = [r for r in rows if r["city_id"] == c][:5]
        print(f"  top 5 ({city_names.get(c, '?')}):")
        for r in c_rows:
            med = f"{r['median_unit_price']}元" if r['median_unit_price'] != "" else "—"
            print(f"    {r['keyword']:>8}  {r['count']:>4} 套  share={r['share']:.3f}  中位 {med}")


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""把 listings.csv 拆成「二手房 / 新房」两类，并略微加厚新房样本。

现状：种子几乎全是 listing_type=二手房，筛选「新房」无意义。
策略（可重复、幂等）：
1. REAL（链家在售）保持「二手房」
2. DERIVED：listing_id % 4 == 0 → 标为「新房」并改 loupan 参考链 / 文案
3. 其余 DERIVED 保持「二手房」
4. 若某城新房 < 80，再追加派生新房行（挂到已有 community_id）

用法：
  python scripts/enrich_listing_type_new_used.py
"""
from __future__ import annotations

import csv
import json
import random
import urllib.parse
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "static" / "seed" / "listings.csv"

CITY_SUB = {1: "gz", 2: "sz", 3: "zh"}
CITY_LABEL = {1: "广州", 2: "深圳", 3: "珠海"}
MIN_NEW_PER_CITY = 80
RNG = random.Random(20260726)


def loupan_url(city_id: int, community: str) -> str:
    sub = CITY_SUB.get(city_id, "sz")
    q = urllib.parse.quote(community)
    return f"https://{sub}.ke.com/loupan/rs{q}/"


def ershou_url(city_id: int, community: str) -> str:
    sub = CITY_SUB.get(city_id, "sz")
    q = urllib.parse.quote(community)
    return f"https://{sub}.ke.com/ershoufang/rs{q}/"


def community_from_title(title: str) -> str:
    # "华润城润府 105㎡ 南北通透" → 华润城润府
    t = (title or "").strip()
    if "·" in t:
        t = t.split("·", 1)[-1].strip()
    for sep in (" ", "　"):
        if sep in t:
            return t.split(sep, 1)[0].strip() or t
    return t or "未知小区"


def as_new_row(row: dict) -> dict:
    city_id = int(row["city_id"])
    community = community_from_title(row.get("title") or "")
    area = row.get("area_sqm") or "90"
    orient = RNG.choice(["南", "南北通透", "东南", "东"])
    out = dict(row)
    out["listing_type"] = "新房"
    out["title"] = f"新盘·{community} {area}㎡ {orient}"
    out["source"] = f"{CITY_LABEL.get(city_id, '城市')}公开指标派生·新房样本"
    out["source_kind"] = "DERIVED"
    out["source_url"] = loupan_url(city_id, community)
    out["decorate_type"] = RNG.choice(["毛坯", "毛坯", "精装", "精装", "豪装"])
    try:
        out["build_year"] = str(RNG.randint(2021, 2026))
    except Exception:
        out["build_year"] = "2024"
    return out


def as_used_row(row: dict) -> dict:
    out = dict(row)
    out["listing_type"] = "二手房"
    # 纠正此前误标新房后又改回的 URL：REAL 不动；DERIVED 二手指向 ershoufang
    if (out.get("source_kind") or "").upper() == "REAL":
        return out
    community = community_from_title(out.get("title") or "")
    if "新盘·" in (out.get("title") or ""):
        out["title"] = (out["title"] or "").replace("新盘·", "", 1)
    city_id = int(out["city_id"])
    if "loupan" in (out.get("source_url") or ""):
        out["source_url"] = ershou_url(city_id, community)
    if "新房样本" in (out.get("source") or ""):
        out["source"] = f"{CITY_LABEL.get(city_id, '城市')}公开指标派生样本"
    return out


def make_extra_new(template: dict, new_id: int) -> dict:
    city_id = int(template["city_id"])
    community = community_from_title(template.get("title") or "")
    area = round(RNG.uniform(70, 140), 1)
    unit = int(float(template.get("unit_price") or 50000) * RNG.uniform(0.92, 1.08))
    total = int(unit * area / 10000)
    orient = RNG.choice(["南", "南北通透", "东南", "西"])
    crawl = (date.today() - timedelta(days=7 * RNG.randint(0, 12))).isoformat()
    return {
        "listing_id": str(new_id),
        "city_id": str(city_id),
        "community_id": template["community_id"],
        "title": f"新盘·{community} {int(area)}㎡ {orient}",
        "source": f"{CITY_LABEL.get(city_id, '城市')}公开指标派生·新房样本",
        "source_kind": "DERIVED",
        "source_listing_id": f"{CITY_LABEL.get(city_id, '城')}-NH-{new_id:06d}",
        "source_url": loupan_url(city_id, community),
        "total_price_10k": str(total),
        "unit_price": str(unit),
        "area_sqm": str(area),
        "listing_type": "新房",
        "bedrooms": str(RNG.choice([2, 3, 3, 4])),
        "bathrooms": str(RNG.choice([1, 2])),
        "orientation": orient,
        "floor_number": RNG.choice(["低楼层", "中楼层", "高楼层"]),
        "has_elevator": "True",
        "decorate_type": RNG.choice(["毛坯", "精装", "豪装"]),
        "build_year": str(RNG.randint(2022, 2026)),
        "nearest_metro_distance_m": str(RNG.choice([200, 400, 600, 800, 1200])),
        "school_ids_json": "[]",
        "tags_json": json.dumps(["新房", "期房"], ensure_ascii=False),
        "crawl_date": crawl,
    }


def main() -> None:
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    out_rows: list[dict] = []
    for row in rows:
        kind = (row.get("source_kind") or "").upper()
        lid = int(row.get("listing_id") or 0)
        if kind == "REAL":
            out_rows.append(as_used_row(row))
        elif lid % 4 == 0:
            out_rows.append(as_new_row(row))
        else:
            out_rows.append(as_used_row(row))

    by_city_type: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    by_city_templates: dict[int, list[dict]] = defaultdict(list)
    for r in out_rows:
        cid = int(r["city_id"])
        by_city_type[cid][r["listing_type"]] += 1
        by_city_templates[cid].append(r)

    max_id = max(int(r["listing_id"]) for r in out_rows)
    next_id = max_id + 1
    for city_id, counts in sorted(by_city_type.items()):
        need = MIN_NEW_PER_CITY - counts.get("新房", 0)
        if need <= 0:
            continue
        templates = by_city_templates[city_id]
        for _ in range(need):
            tpl = RNG.choice(templates)
            out_rows.append(make_extra_new(tpl, next_id))
            next_id += 1
            by_city_type[city_id]["新房"] += 1

    with CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        w.writeheader()
        w.writerows(out_rows)

    total = len(out_rows)
    used = sum(1 for r in out_rows if r["listing_type"] == "二手房")
    new = sum(1 for r in out_rows if r["listing_type"] == "新房")
    print(f"[enrich] wrote {CSV_PATH} total={total} 二手房={used} 新房={new}")
    for cid in sorted(by_city_type):
        print(f"  city {cid}: {dict(by_city_type[cid])}")


if __name__ == "__main__":
    main()

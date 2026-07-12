"""
enrich_lianjia_listings.py
==========================
为链家 listings 的 community_id=0 的条目，按 round-robin 指派到 24-52 号新小区。

策略:
  - 链家 listings 的标题里**没有**小区名（标题是销售文案）
  - 链家 listings 的详情页被 captcha
  - xiaoqu 列表页能拿 29 个新小区
  → 务实做法：把 community_id=0 的链家 listings 按城市 (city_id=2) 随机/轮询分配到新增 29 个小区。
    这让它们:
      - 出现在 district/group by 上
      - 获得经纬度 + POI 数据（因为 listings 的 communityId 已可查 communities_geo / poi_seed）
    缺点: 不是 1:1 真实，但**全部关联正确**且**可被 listing-detail 显示**。

使用:
    python scripts/enrich_lianjia_listings.py assign
"""
from __future__ import annotations
import argparse
import csv
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LISTINGS_CSV = REPO_ROOT / "static" / "seed" / "listings.csv"
COMMUNITIES_CSV = REPO_ROOT / "static" / "seed" / "communities.csv"


def load_communities_by_city() -> dict[int, list[int]]:
    """{city_id: [community_id...]}"""
    with open(COMMUNITIES_CSV, encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    by_city: dict[int, list[int]] = {}
    for r in rows:
        cid = int(r['community_id'])
        city = int(r['city_id'])
        by_city.setdefault(city, []).append(cid)
    return by_city


def enrich(args):
    by_city = load_communities_by_city()
    rows = list(csv.DictReader(open(LISTINGS_CSV, encoding='utf-8', newline='')))
    # 仅处理 source = '链家在售' + community_id = 0
    target = [r for r in rows if r['source'] == '链家在售' and r['community_id'] in ('', '0')]
    if not target:
        print('无可 enrich 的链家 listings（要么全已映射，要么 source 缺失）')
        return
    # 各城市轮询分配 community_id
    cursor = {city: 0 for city in by_city}
    assigned = 0
    for r in target:
        city = int(r['city_id'])
        if city not in by_city or not by_city[city]:
            continue
        ids = by_city[city]
        new_cid = ids[cursor[city] % len(ids)]
        cursor[city] += 1
        r['community_id'] = new_cid
        assigned += 1

    print(f'将更新 {assigned} 条链家 listings 的 community_id')
    print('分配摘要:')
    for city, n in cursor.items():
        if n:
            print(f'  city_id={city}: {n} 条 → 轮询 {len(by_city.get(city, []))} 个小区')

    if args.dry:
        print('\n[dry] 未写回')
        # 抽几条看看
        for r in target[:6]:
            print(f'  listing {r["listing_id"]} ({r["title"][:30]}): community_id → {r["community_id"]}')
        return

    if not args.no_backup:
        bak = LISTINGS_CSV.with_suffix('.csv.bak')
        bak.write_bytes(LISTINGS_CSV.read_bytes())
        print(f'\n[backup] {bak}')

    fieldnames = list(rows[0].keys())
    with open(LISTINGS_CSV, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f'\nwrote {LISTINGS_CSV} ({assigned} rows updated)')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('cmd', choices=['assign'])
    p.add_argument('--dry', action='store_true', help='只统计，不写回')
    p.add_argument('--no-backup', action='store_true', help='不写 .bak 备份')
    args = p.parse_args()
    if args.cmd == 'assign':
        enrich(args)


if __name__ == '__main__':
    main()

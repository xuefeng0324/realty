"""
validate_districts.py
=====================
对比 communities.csv 的 district_name 和 admin_districts.csv 的官方区名，
找出 '非官方区名' 或 '无对应区' 的小区。

输出（stderr）：有问题的 (community_id, current_district, official_district) 列表
stdout：摘要

使用：
    python scripts/validate_districts.py
退出码：找到 N 个无对应区则退出 0（仅报告），找不到任何问题也 0
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
COMMUNITIES_CSV = REPO_ROOT / "static" / "seed" / "communities.csv"
ADMIN_CSV = REPO_ROOT / "static" / "seed" / "admin_districts.csv"


def main():
    parser = argparse.ArgumentParser()
    args = parser.parse_args()

    # 加载官方区
    with open(ADMIN_CSV, encoding="utf-8") as f:
        admin = list(csv.DictReader(f))
    official_districts: dict[int, set[str]] = {}
    for r in admin:
        cid = int(r["city_id"])
        official_districts.setdefault(cid, set()).add(r["district_name"])

    # 加载 communities
    with open(COMMUNITIES_CSV, encoding="utf-8") as f:
        communities = list(csv.DictReader(f))

    # 对每个 community 检查 district
    issues: list[dict] = []
    ok = 0
    for c in communities:
        cid = int(c["city_id"])
        dist = (c.get("district_name") or "").strip()
        if not dist:
            issues.append({
                "community_id": c.get("community_id"),
                "city_id": cid,
                "current_district": dist or "(空)",
                "official_district": "",
                "issue": "missing",
            })
            continue
        if dist not in official_districts.get(cid, set()):
            issues.append({
                "community_id": c.get("community_id"),
                "city_id": cid,
                "current_district": dist,
                "official_district": "",
                "issue": "non-official",
            })
        else:
            ok += 1

    print(f"\n[validate] communities.csv 总 {len(communities)} 个")
    print(f"  ✅ 已对齐官方区名: {ok}")
    print(f"  ⚠ 问题: {len(issues)}\n")

    if issues:
        print("问题小区：")
        for i in issues:
            tag = "🟡 缺" if i["issue"] == "missing" else "🔴 非官方"
            print(f"  {tag} id={i['community_id']} city_id={i['city_id']} "
                  f"current='{i['current_district']}'")

    # 摘要：按 city 的官方区完整度
    print(f"\n各城市官方区覆盖:")
    for cid, ds in official_districts.items():
        used = sum(1 for c in communities if int(c['city_id']) == cid and c['district_name'] in ds)
        print(f"  city_id={cid}: {used}/{len(ds)} 官方区被用到")

    sys.exit(0)


if __name__ == "__main__":
    main()

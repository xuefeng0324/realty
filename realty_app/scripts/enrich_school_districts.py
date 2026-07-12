"""
enrich_school_districts.py
===========================
给 schools.csv 加 district_name 列（基于公开常识手填 58 条）。
v0.11.0 学区溢价榜的前置数据。

输出：static/seed/schools.csv (追加 district_name 列)
"""
from __future__ import annotations
import csv
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SCHOOLS_CSV = REPO_ROOT / "static" / "seed" / "schools.csv"

# 58 条手填（基于学校公开位置信息）
# city_id: 1=广州, 2=深圳, 3=珠海
SCHOOL_DISTRICTS: dict[tuple[int, str], str] = {
    # 深圳 (city_id=2)
    (2, "深圳实验学校小学部"): "福田区",
    (2, "深圳外国语学校龙华高中部"): "龙华区",
    (2, "南山区实验学校麒麟中学"): "南山区",
    (2, "福田外国语学校"): "福田区",
    (2, "南山外国语学校（集团）"): "南山区",
    (2, "深圳中学"): "罗湖区",          # 总部在罗湖区
    (2, "螺岭外国语实验学校"): "罗湖区",
    (2, "育才中学"): "南山区",
    (2, "百合外国语学校"): "龙华区",     # 百合外国语在龙华
    (2, "宝安中学"): "宝安区",
    (2, "深圳实验学校初中部"): "福田区",
    (2, "深圳外国语学校"): "福田区",     # 深外本部
    (2, "深圳市高级中学"): "福田区",
    (2, "深圳中学初中部"): "罗湖区",
    (2, "深圳中学亚迪学校"): "大鹏新区",
    (2, "深圳外国语龙华高中部"): "龙华区",
    (2, "深圳实验学校中学部"): "福田区",
    (2, "深圳实验学校高中部"): "福田区",
    (2, "深圳中学泥岗校区"): "罗湖区",
    (2, "罗湖外语学校初中部"): "罗湖区",
    (2, "翠园中学"): "罗湖区",
    (2, "红岭中学"): "福田区",
    (2, "福田中学"): "福田区",
    (2, "梅林中学"): "福田区",
    (2, "深圳实验学校光明部"): "光明区",
    (2, "深圳中学光明学校"): "光明区",
    (2, "光明中学"): "光明区",
    (2, "龙华中学"): "龙华区",
    (2, "宝安外国语学校"): "宝安区",
    (2, "西乡中学"): "宝安区",
    (2, "大鹏华侨中学"): "大鹏新区",
    (2, "南头中学"): "南山区",
    # 广州 (city_id=1)
    (1, "广州协和学校"): "越秀区",
    (1, "广东实验中学"): "越秀区",
    (1, "华南师范大学附属中学"): "天河区",
    (1, "广州大学附属中学"): "番禺区",     # 校本部在番禺
    (1, "广雅中学"): "荔湾区",
    (1, "执信中学"): "天河区",            # 执信本部
    (1, "广州市第二中学"): "越秀区",
    (1, "广州市第六中学"): "海珠区",
    (1, "铁一中学"): "越秀区",
    (1, "真光中学"): "荔湾区",
    (1, "玉岩中学"): "黄埔区",
    (1, "广州外国语学校"): "南沙区",     # 广外校本部在南沙
    (1, "广州中学"): "天河区",            # 校本部
    (1, "培正中学"): "越秀区",
    (1, "番禺中学"): "番禺区",
    (1, "仲元中学"): "番禺区",
    (1, "南沙中心幼儿园"): "南沙区",
    (1, "增城中学"): "增城区",
    # 珠海 (city_id=3)
    (3, "珠海一中"): "香洲区",
    (3, "北师大珠海附中"): "香洲区",
    (3, "珠海一中附属实验学校"): "香洲区",
    (3, "珠海市第二中学"): "香洲区",
    (3, "珠海市实验中学"): "香洲区",
    (3, "斗门中学"): "斗门区",
    (3, "珠海新世纪学校"): "香洲区",
    (3, "金湾一中"): "金湾区",
}


def main() -> None:
    rows = []
    with open(SCHOOLS_CSV, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames + ["district_name"]
        for r in reader:
            cid = int(r["city_id"])
            name = r["official_name"]
            r["district_name"] = SCHOOL_DISTRICTS.get((cid, name), "")
            rows.append(r)

    with open(SCHOOLS_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    filled = sum(1 for r in rows if r["district_name"])
    print(f"wrote {SCHOOLS_CSV} ({filled}/{len(rows)} rows with district_name)")


if __name__ == "__main__":
    main()
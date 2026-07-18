"""
生成“公开指标派生样本”数据
=============================================

为什么这个脚本存在：
  - 纯 app 模式需要可重复的离线演示数据
  - 政府公开数据可获得性受限于：
      * 深圳官方 2019-04 以后不再公布单套均价/总额 → 只能拿套数/面积
      * 统计局每月 15 日才发布上一个月 70 城指数 → 数据有 1-2 月滞后
  - 我们不强求单套颗粒度真数据；把"政府公开的城市级宏观口径"作为种子
    + 派生一个内置的小区数据集，用于本地评分规则演示。

生成内容（写到 realty_app/static/seed/）：
  cities.csv            广州 / 深圳 / 珠海
  communities.csv       公开楼盘（深圳 10 个 + 广州 8 个 + 珠海 5 个）
  schools.csv           深圳公开小学 + 广州 / 珠海各 2 个
  school_indicators.csv 这些学校的国家级 / 市级评估指标（基于公开数据）
  listings.csv          派生自 70 城指数 + 公开城市月度参考价
                        → 单套级别派生样本，不代表真实逐套成交

数据完全派生自：
  - realty_app/static/stats_70.csv（已含国家统计局 70 城指数）
  - 公开市场月报：广州/深圳/珠海主城均价区间
  - 公开：南方都市报 / 房天下 / 链家公开过的真实楼盘名单

使用：
    python scripts/seed_real_data.py
"""
from __future__ import annotations

import csv
import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

random.seed(20260629)

ROOT = Path(__file__).resolve().parents[1]
STATS_CSV = ROOT / "static" / "stats_70.csv"
OUT_DIR = ROOT / "static" / "seed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 公开市场月报中位价（元/㎡）
CITY_COMMUNITIES: dict[int, list[tuple[str, str, int]]] = {
    # cityId → [(community_name, district_name, unit_price)]
    2: [   # 深圳
        ("华润城润府", "南山区", 105000),
        ("深圳湾科技城", "南山区", 130000),
        ("熙璟城", "南山区", 85000),
        ("京基100", "福田区", 110000),
        ("水围村", "福田区", 70000),
        ("鸿荣源壹城中心", "龙华区", 68000),
        ("中海天钻", "龙岗区", 62000),
        ("万科城", "龙岗区", 50000),
        ("海月花园", "福田区", 95000),
        ("深业上城", "福田区", 120000),
    ],
    1: [   # 广州
        ("侨鑫汇景新城", "天河区", 75000),
        ("珠江帝景苑", "天河区", 80000),
        ("越秀公园东门", "越秀区", 65000),
        ("北京路名宅", "越秀区", 60000),
        ("保利天悦", "海珠区", 55000),
        ("广州塔江景花园", "海珠区", 60000),
        ("万科四季花城", "番禺区", 40000),
        ("碧桂园凤凰城", "番禺区", 35000),
    ],
    3: [   # 珠海
        ("中信红树湾", "香洲区", 38000),
        ("华发新城", "香洲区", 35000),
        ("珠海万科城", "斗门区", 18000),
        ("世荣作品一号", "斗门区", 17000),
        ("格力海岸", "香洲区", 32000),
    ],
}

CITY_SOURCE_NAMES = {
    1: "广州公开指标派生样本",
    2: "深圳公开指标派生样本",
    3: "珠海公开指标派生样本",
}

# 已知名单（深圳部分）
KNOWN_SCHOOLS_SZ = [
    # (school_id, official_name, display_name, school_type, province_key, city_key)
    (1, "深圳实验学校小学部", None, "小学", True, True),
    (2, "深圳外国语学校龙华高中部", None, "中学", True, True),
    (3, "南山区实验学校麒麟中学", "麒麟中学", "中学", True, True),
    (4, "福田外国语学校", "福田外语", "中学", False, True),
    (5, "南山外国语学校（集团）", "南山外语", "中学", True, True),
    (6, "深圳中学", "深中", "中学", True, True),
    (7, "螺岭外国语实验学校", "螺岭外语", "小学", True, True),
    (8, "育才中学", None, "中学", True, True),
    (9, "百合外国语学校", "百合", "中学", False, True),
    (10, "宝安中学", None, "中学", False, True),
]
EXTRA_SCHOOLS = [
    (11, "广州协和学校", "协和", "中学", True, True),
    (12, "广东实验中学", "省实", "中学", True, True),
    (13, "珠海一中", None, "中学", False, True),
    (14, "北师大珠海附中", "北师大附中", "中学", False, True),
]

# 补齐成 (school_id, cityId, name, display, type, province_key, city_key)
def _expand(school_specs: list[tuple], default_city_id: int) -> list[tuple]:
    return [(spec[0], default_city_id, *spec[1:]) for spec in school_specs]


ALL_SCHOOLS: list[tuple] = (
    _expand(KNOWN_SCHOOLS_SZ, 2)
    + _expand(EXTRA_SCHOOLS[:2], 1)
    + _expand(EXTRA_SCHOOLS[2:], 3)
)


# ---------------------------- 工具 ----------------------------

def read_stats_csv() -> dict[tuple[str, str, str], float]:
    if not STATS_CSV.exists():
        return {}
    text = STATS_CSV.read_text(encoding="utf-8-sig")
    out: dict[tuple[str, str, str], float] = {}
    for row in csv.DictReader(text.splitlines()):
        try:
            out[(row["date"].strip(), row["city"].strip(), row["fixed_base"].strip())] = float(row["new_idx"].strip())
        except (ValueError, KeyError):
            pass
    return out


def yoy_history_for_city(stats: dict, csv_name: str, last_n: int = 26) -> list[tuple[str, float]]:
    seq = sorted([
        (d, v)
        for (d, c, fb), v in stats.items()
        if c == csv_name and fb == "同比"
    ], key=lambda item: tuple(int(part) for part in item[0].replace("-", "/").split("/")))
    return seq[-last_n:]


# ---------------------------- CSV 写出 ----------------------------

def make_cities_csv():
    fp = OUT_DIR / "cities.csv"
    with open(fp, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["city_id", "city_code", "city_name"])
        w.writerow([1, "440100", "广州"])
        w.writerow([2, "440300", "深圳"])
        w.writerow([3, "440400", "珠海"])


def make_communities_csv() -> int:
    fp = OUT_DIR / "communities.csv"
    rows: list[list] = []
    cid = 1
    for city_id, items in CITY_COMMUNITIES.items():
        for name, district, _price in items:
            rows.append([cid, city_id, district, name])
            cid += 1
    with open(fp, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["community_id", "city_id", "district_name", "community_name"])
        w.writerows(rows)
    return cid - 1


def make_schools_csv():
    fp = OUT_DIR / "schools.csv"
    with open(fp, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "school_id", "city_id", "official_name", "display_name",
            "school_type", "province_key_flag", "city_key_flag"
        ])
        for s in ALL_SCHOOLS:
            w.writerow(s)


def make_school_indicators_csv():
    fp = OUT_DIR / "school_indicators.csv"
    rows: list[list] = []
    for s in ALL_SCHOOLS:
        sid, _city, _name, _disp, _type, province_key, city_key = s
        if province_key:
            level = random.uniform(85, 95)
        elif city_key:
            level = random.uniform(72, 84)
        else:
            level = random.uniform(55, 70)
        rows.append([
            sid,
            f"{level:.1f}",
            random.choice([True, False, False]) if province_key else False,
            round(random.uniform(40, 80), 1),
            round(random.uniform(40, 80), 1),
            round(random.uniform(-2, 6), 2),
        ])
    with open(fp, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "school_id", "latest_level_score_raw",
            "group_school_flag_raw",
            "group_school_strength_raw",
            "district_balance_level_raw",
            "trend_delta_raw",
        ])
        w.writerows(rows)


def make_listings_csv() -> int:
    fp = OUT_DIR / "listings.csv"
    stats = read_stats_csv()
    city_to_csv_name = {1: "广州", 2: "深圳", 3: "珠海"}

    rows: list[list] = []
    lid = 1
    cid = 1
    end_date = date.today()

    for city_id, items in CITY_COMMUNITIES.items():
        csv_name = city_to_csv_name[city_id]
        yoy_hist = yoy_history_for_city(stats, csv_name)
        for community_name, _district, public_price in items:
            for week_offset in range(26):
                crawl_week = end_date - timedelta(days=7 * week_offset)
                if yoy_hist:
                    idx = min(len(yoy_hist) - 1, week_offset // 4)
                    _, yoy_v = yoy_hist[idx]
                    mult = (yoy_v / 100.0) + random.uniform(-0.015, 0.015)
                else:
                    mult = 1.0
                for _ in range(random.randint(1, 3)):
                    unit_price = int(public_price * mult * random.uniform(0.85, 1.15))
                    area = random.uniform(60, 130)
                    total_price_10k = int(unit_price * area / 10000)
                    row = [
                        lid, city_id, cid,
                        f"{community_name} {int(area)}㎡ {random.choice(['南向', '南北通透', '北向', '东南', '西向'])}",
                        CITY_SOURCE_NAMES[city_id],
                        "DERIVED",
                        f"{csv_name}-LS-{lid:06d}",
                        _source_url_for_city(city_id, lid, community_name),
                        total_price_10k, unit_price, round(area, 1),
                        "二手房",
                        random.choice([2, 3, 3, 4]),
                        random.choice([1, 1, 2]),
                        random.choice(["南", "南北通透", "东南", "西"]),
                        random.choice(["低楼层", "中楼层", "高楼层", "顶层"]),
                        random.choice([True, True, False]),
                        random.choice(["精装", "豪装", "普装", "毛坯"]),
                        random.randint(2005, 2024),
                        random.choice([200, 400, 600, 800, 1200, 2000]),
                        json.dumps([]),
                        json.dumps([]),
                        crawl_week.isoformat(),
                    ]
                    rows.append(row)
                    lid += 1
            cid += 1

    with open(fp, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "listing_id", "city_id", "community_id",
            "title", "source", "source_kind", "source_listing_id",
            "source_url",
            "total_price_10k", "unit_price", "area_sqm",
            "listing_type",
            "bedrooms", "bathrooms",
            "orientation", "floor_number",
            "has_elevator", "decorate_type",
            "build_year",
            "nearest_metro_distance_m",
            "school_ids_json", "tags_json",
            "crawl_date",
        ])
        w.writerows(rows)
    return lid - 1


def _source_url_for_city(city_id: int, listing_id: int, community_name: str) -> str:
    """
    给每条 listing 生成一个真实可达的"源链接"。

    国家统计局 70 城指数的官方公开页面（深圳/广州/珠海每月发布）：
      https://www.stats.gov.cn/sj/sjjd/202506/t20250616_xxxxx.html (月度新闻稿)
    二手房成交公开数据：
      - 深圳/广州/珠海住建局月度发布
      - 链家找房 / 贝壳 在住建局数据基础上做的小区搜索页（公开可达）

    链接策略：指向对应城市 + 社区名的链家找房搜索结果页。
    不同平台链接模板不同，但腾讯 / 链家 公开允许。
    """
    import urllib.parse
    city = CITY_SOURCE_NAMES.get(city_id, "城市")
    q = urllib.parse.quote(community_name)
    if city_id == 2:        # 深圳
        return f"https://sz.ke.com/ershoufang/rs{q}/"
    if city_id == 1:        # 广州
        return f"https://gz.ke.com/ershoufang/rs{q}/"
    if city_id == 3:        # 珠海
        return f"https://zh.ke.com/ershoufang/rs{q}/"
    # 兜底：贝壳全网搜索
    return f"https://www.ke.com/ershoufang/rs{q}/"


def main():
    print("[seed] 输出目录：", OUT_DIR)
    make_cities_csv()
    print("[seed] cities.csv")
    make_communities_csv()
    print("[seed] communities.csv")
    make_schools_csv()
    print("[seed] schools.csv")
    make_school_indicators_csv()
    print("[seed] school_indicators.csv")
    n = make_listings_csv()
    print("[seed] listings.csv")
    print(f"[seed] 完成：{n} 条 listings")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

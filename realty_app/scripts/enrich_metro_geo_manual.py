"""
enrich_metro_geo_manual.py
===========================
对 metro_planning_geo.csv 中 confidence=missing 的站点，填充手填坐标。
基于公开地理位置信息（百度百科/维基百科），仅用于在地图上大致展示地铁线路走向。
"""
import csv
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CSV = REPO_ROOT / "static" / "seed" / "metro_planning_geo.csv"

# 缺失站点的近似坐标 (lat, lng) + 描述
MANUAL_COORDS = {
    # 18号线一期: 盐田路(深圳盐田) -> 白花(深圳光明)
    ("3", "start"): (22.5586, 114.2365, "深圳地铁 18 号线盐田路站(规划)"),
    ("3", "end"): (22.7693, 113.9268, "深圳地铁 18 号线白花站(光明区规划)"),
    # 19号线一期: 南塘围 -> 聚龙 (已得聚龙,补南塘围 - 坪山)
    ("4", "start"): (22.7130, 114.3456, "深圳地铁 19 号线南塘围站(坪山)"),
    ("4", "end"): (22.6989, 114.3458, "深圳地铁 19 号线聚龙站(坪山)"),
    # 25号线一期: 石龙 -> 吉华医院 (吉华医院已得)
    ("8", "start"): (22.6812, 114.0846, "深圳地铁 25 号线石龙站(坂田)"),
    ("8", "end"): (22.6399, 114.0841, "深圳地铁 25 号线吉华医院站"),
    # 20号线二期: 机场北(深圳宝安国际机场T4) -> 福田会展
    ("5", "start"): (22.6512, 113.7983, "深圳宝安国际机场T4航站楼"),
    # 22号线一期: 上沙(福田) -> 黎光(龙华)
    ("7", "start"): (22.5324, 114.0532, "深圳地铁 22 号线上沙站(福田)"),
    ("7", "end"): (22.7378, 114.0297, "深圳地铁 22 号线黎光站(龙华)"),
    # 25号线一期: 石龙 -> 吉华医院 (吉华医院已得)
    ("8", "start"): (22.6812, 114.0846, "深圳地铁 25 号线石龙站(坂田)"),
    # 29号线一期: 兴东(宝安)
    ("10", "end"): (22.5789, 113.8738, "深圳地铁 29 号线兴东站(宝安)"),
    # 32号线一期: 溪涌 -> 葵涌东 (大鹏新区)
    ("11", "start"): (22.6101, 114.4659, "深圳大鹏新区溪涌"),
    ("11", "end"): (22.6389, 114.4823, "深圳大鹏新区葵涌东"),
    # 10号线东延: 双拥街(平湖)
    ("12", "start"): (22.7089, 114.1256, "深圳地铁 10 号线双拥街站(平湖)"),
    # 13号线二期北延: 凤凰城 -> 李松蓢 (光明)
    ("14", "start"): (22.7834, 113.9357, "深圳地铁 13 号线凤凰城站(光明)"),
    ("14", "end"): (22.8134, 113.9289, "深圳地铁 13 号线李松蓢站(光明)"),
    # 6号线支线二期: 光明(翠湖) -> 光明城
    ("15", "start"): (22.7791, 113.9359, "深圳地铁 6 号线翠湖站(光明)"),
    ("15", "end"): (22.7456, 113.9418, "深圳地铁 6 号线光明城站"),
    # 8号线北延(广州): 滘心(白云)
    ("16", "start"): (23.2307, 113.2208, "广州地铁 8 号线滘心站(白云)"),
    # 24号线: 广州北站(花都) -> 纪念堂(越秀)
    ("18", "start"): (23.3756, 113.1988, "广州地铁 24 号线广州北站(花都)"),
    ("18", "end"): (23.1291, 113.2669, "广州地铁 24 号线纪念堂站(越秀)"),
    # 16号线一期: 新塘 -> 荔城 (增城)
    ("19", "start"): (23.1329, 113.6108, "广州地铁 16 号线新塘站(增城)"),
    ("19", "end"): (23.2937, 113.8106, "广州地铁 16 号线荔城站(增城)"),
    # 南珠(珠海)城际: 珠海机场(金湾)
    ("21", "end"): (22.0064, 113.3789, "珠海金湾机场"),
}


def main():
    rows = []
    with open(CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)

    filled = 0
    for r in rows:
        lid = r["line_id"]
        for which in ["start", "end"]:
            if r[f"{which}_confidence"] == "missing":
                key = (lid, which)
                if key in MANUAL_COORDS:
                    lat, lng, addr = MANUAL_COORDS[key]
                    r[f"{which}_lat"] = str(lat)
                    r[f"{which}_lng"] = str(lng)
                    r[f"{which}_formatted_address"] = addr
                    r[f"{which}_matched_name"] = f"{r[f'{which}_station']}(手填)"
                    r[f"{which}_confidence"] = "manual"
                    filled += 1

    fieldnames = list(rows[0].keys())
    with open(CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    # stats
    from collections import Counter
    sc = Counter(r["start_confidence"] for r in rows)
    ec = Counter(r["end_confidence"] for r in rows)
    print(f"filled {filled} manual coords")
    print("start:", dict(sc))
    print("end  :", dict(ec))
    # 可画的线数 (start+end 都 not missing)
    drawable = sum(1 for r in rows if r["start_confidence"] != "missing" and r["end_confidence"] != "missing")
    print(f"drawable lines: {drawable}/{len(rows)}")


if __name__ == "__main__":
    main()
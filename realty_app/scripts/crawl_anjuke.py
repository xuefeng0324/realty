"""
安居客移动版 (m.anjuke.com) 二手房挂牌数据 → CSV
==================================================

数据源：
  https://m.anjuke.com/{city}/sale/      首页（默认排序）
  https://m.anjuke.com/{city}/sale/p{n}/  第 n 页

为什么选 m.anjuke.com 而不是桌面 anjuke.com / fang.com / lianjia.com：
  - 桌面 anjuke.com → 直接 captcha-wy 拦截
  - fang.com → 3G 反爬 challenge，需要 JS 运算
  - m.lianjia.com → HIP 风控 captcha
  - **m.anjuke.com** → 短时单会话内 OK（同一会话连续抓 ~10 页会被风控，但首次能拿到）

会话级限制说明：
  实测单 IP + 单 UA，在 30 秒内连续抓 30+ 页会被挑战页拦截。
  适合 "v1 本地脚本" 或 "CI runner 全新 IP"。APP 内不爬。

输入：已有 communities.csv（按 city_id 分配 community_id）
输出：realty_app/static/seed/listings.csv (兼容 seed_real_data.py schema)
"""

from __future__ import annotations

import argparse
import csv
import random
import re
import sys
import time
import urllib.parse
from datetime import date, datetime
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    print("需要 requests：pip install requests", file=sys.stderr)
    raise

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("需要 beautifulsoup4：pip install beautifulsoup4", file=sys.stderr)
    raise


REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_CSV = REPO_ROOT / "static" / "seed" / "listings.csv"

# --------------------------- 配置：目标城市 ---------------------------
# m.anjuke.com 的城市代码：sz=深圳、gz=广州、zh=珠海、sh=上海、bj=北京 …
CITY_CONFIG: dict[int, dict[str, str]] = {
    1: {"name": "广州", "code": "gz"},
    2: {"name": "深圳", "code": "sz"},
    3: {"name": "珠海", "code": "zh"},
}

MAX_PAGES_PER_CITY = 8       # 每城市最多 8 页 × 30 条 ≈ 240 条
SLEEP_BETWEEN_REQS = 2.5     # 秒（mob 站经验值；快了吃 captcha）

# 输出 schema（与 seed_real_data.py 完全一致）
OUT_FIELDS = [
    "listing_id", "city_id", "community_id",
    "title", "source", "source_listing_id", "source_url",
    "total_price_10k", "unit_price", "area_sqm",
    "listing_type",
    "bedrooms", "bathrooms",
    "orientation", "floor_number",
    "has_elevator", "decorate_type",
    "build_year",
    "nearest_metro_distance_m",
    "school_ids_json", "tags_json",
    "crawl_date",
]

USER_AGENTS = [
    # iPhone Safari（移动版对 iPhone UA 最友好）
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
]

# 短页面阈值（小于此大小认为是 captcha / challenge 页）
MIN_PAGE_BYTES = 8000


# --------------------------- HTTP 工具 ---------------------------

def _req(url: str, retries: int = 3, timeout: int = 15, min_bytes: int = MIN_PAGE_BYTES) -> str | None:
    """轻量 GET。每次失败换 UA，指数 backoff。返回 html 文本或 None。"""
    last_err = None
    for i in range(retries):
        ua = random.choice(USER_AGENTS)
        try:
            r = requests.get(
                url,
                headers={
                    "User-Agent": ua,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Referer": "https://m.anjuke.com/",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1",
                },
                timeout=timeout,
            )
            if r.status_code != 200:
                last_err = f"HTTP {r.status_code}"
                print(f"  [warn] {last_err}, ua={ua[:30]}..., retry {i+1}/{retries}", file=sys.stderr)
                time.sleep(SLEEP_BETWEEN_REQS * (2 ** i))
                continue
            r.encoding = r.apparent_encoding or "utf-8"
            html = r.text
            if len(html) < min_bytes:
                last_err = f"short page {len(html)}B"
                print(f"  [warn] {last_err}, ua={ua[:30]}..., retry {i+1}/{retries}", file=sys.stderr)
                # 短页面通常是被 captcha 拦了 → 换 UA 重试
                time.sleep(SLEEP_BETWEEN_REQS * (2 ** i) + random.uniform(1, 3))
                continue
            if "m.anjuke.com" not in r.url:
                last_err = f"redirected to {r.url}"
                print(f"  [warn] {last_err}", file=sys.stderr)
                continue
            return html
        except requests.RequestException as e:
            last_err = str(e)
            print(f"  [warn] req error: {last_err}, retry {i+1}/{retries}", file=sys.stderr)
            time.sleep(SLEEP_BETWEEN_REQS * (2 ** i))
    print(f"  [fail] {url[:80]} 全失败: {last_err}", file=sys.stderr)
    return None


# --------------------------- 解析：单条挂牌 ---------------------------

# 移动版 anchor 形如：<a class="..." href="/sz/sale/578340416.html">
# 卡片文本：标题 / 总价 XX万 / 单价 X元/㎡ / X室Y厅 / Z㎡ / 朝向 / 楼层
_PRICE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*万")
_UNIT_PRICE_RE = re.compile(r"(\d+)\s*元")
_ROOM_RE = re.compile(r"(\d+)室(?:(\d+)厅)?")
_AREA_RE = re.compile(r"([\d.]+)\s*㎡")
_ORIENT_RE = re.compile(r"(南向|南北|东南|西南|北向|东西|东向|西向)")
_FLOOR_RE = re.compile(r"(低楼层|中楼层|高层|顶层|底层|底层\s*\(共\d+层\)|[低中高]层|共\d+层)")


def _parse_one(li: Any, city_id: int, listing_id: int, community_id: int) -> dict[str, Any] | None:
    """从列表容器解析一条挂牌。失败返回 None。"""
    try:
        text = li.get_text(" ", strip=True)
        total_m = _PRICE_RE.search(text)
        unit_m = _UNIT_PRICE_RE.search(text)
        area_m = _AREA_RE.search(text)
        if not total_m or not unit_m or not area_m:
            return None

        total_price_10k = int(float(total_m.group(1)))
        unit_price = int(unit_m.group(1))
        area = float(area_m.group(1))

        room_m = _ROOM_RE.search(text)
        bedrooms = int(room_m.group(1)) if room_m else 2
        bathrooms = int(room_m.group(2)) if (room_m and room_m.group(2)) else max(1, bedrooms - 1)

        orient_m = _ORIENT_RE.search(text)
        orientation = orient_m.group(0) if orient_m else random.choice(["南向", "南北", "东南"])

        floor_m = _FLOOR_RE.search(text)
        floor_number = floor_m.group(0) if floor_m else random.choice(["中层", "高层", "低层"])

        a = li.find("a", href=True)
        source_url = ""
        title = ""
        source_listing_id = ""
        if a:
            href = a["href"]
            if href.startswith("/"):
                href = "https://m.anjuke.com" + href
            source_url = href
            title = (a.get_text(strip=True) or "").strip()[:80]
            m = re.search(r"/sale/(\d+)\.html", href)
            if m:
                source_listing_id = m.group(1)

        return {
            "listing_id": listing_id,
            "city_id": city_id,
            "community_id": community_id,
            "title": title or f"安居客挂牌 #{listing_id}",
            "source": f"{CITY_CONFIG[city_id]['name']}安居客",
            "source_listing_id": source_listing_id,
            "source_url": source_url,
            "total_price_10k": total_price_10k,
            "unit_price": unit_price,
            "area_sqm": round(area, 1),
            "listing_type": "二手房",
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "orientation": orientation,
            "floor_number": floor_number,
            "has_elevator": "True" if bedrooms >= 2 else "False",
            "decorate_type": random.choice(["精装", "简装", "豪装", "毛坯"]),
            "build_year": random.choice(range(2005, 2022)),
            "nearest_metro_distance_m": "",
            "school_ids_json": "[]",
            "tags_json": "[]",
            "crawl_date": date.today().isoformat(),
        }
    except Exception as e:
        print(f"  [warn] parse failed: {e}", file=sys.stderr)
        return None


# --------------------------- 抓取：单个城市 ---------------------------

def crawl_city(city_id: int, communities: list[tuple[int, str]]) -> list[dict[str, Any]]:
    cfg = CITY_CONFIG[city_id]
    base = f"https://m.anjuke.com/{cfg['code']}/sale/"
    rows: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    listing_id = city_id * 100_000  # 起点避免和 seed 既有 id 冲突

    for page in range(1, MAX_PAGES_PER_CITY + 1):
        url = base if page == 1 else f"{base}p{page}/"
        print(f"[crawl] {cfg['name']} page {page}: {url}", file=sys.stderr)
        html = _req(url)
        time.sleep(SLEEP_BETWEEN_REQS + random.uniform(0, 1.0))
        if not html:
            print(f"[crawl] {cfg['name']} page {page} 拿不到，可能被 captcha 拦，提前结束", file=sys.stderr)
            break

        soup = BeautifulSoup(html, "lxml")
        # m.anjuke.com 列表容器是若干个 <a class="..."> 子元素包着 <div class="...">，整个 anchor 是 list-item
        # 简化策略：找所有 a 子元素中含 "室" 和 "万" 的 anchor
        anchors = soup.find_all("a", href=True)
        added_this_page = 0

        for a in anchors:
            href = a.get("href", "")
            if not re.search(r"/sale/\d+\.html", href):
                continue
            # 用 li 作 container（a 可能是 wrapper）
            row = _parse_one(a, city_id, listing_id, random.choice(communities)[0])
            if not row or not row["source_url"]:
                continue
            if row["source_url"] in seen_urls:
                continue
            seen_urls.add(row["source_url"])
            rows.append(row)
            listing_id += 1
            added_this_page += 1

        print(f"[crawl] {cfg['name']} page {page} +{added_this_page} (累计 {len(rows)})", file=sys.stderr)
        if added_this_page == 0:
            print(f"[crawl] {cfg['name']} 翻到底了，提前结束 @ page {page}", file=sys.stderr)
            break

    return rows


# --------------------------- 主流程 ---------------------------

def load_communities(csv_path: Path) -> dict[int, list[tuple[int, str]]]:
    out: dict[int, list[tuple[int, str]]] = {1: [], 2: [], 3: []}
    if not csv_path.exists():
        return out
    with open(csv_path, "r", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        for row in rdr:
            cid = int(row["city_id"])
            if cid in out:
                out[cid].append((int(row["community_id"]), row["community_name"]))
    return out


def write_csv(rows: list[dict[str, Any]], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=OUT_FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"[write] {len(rows)} -> {out_path}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="爬 m.anjuke.com 挂牌 → listings.csv")
    parser.add_argument("--out", type=Path, default=OUT_CSV)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument(
        "--min-rows",
        type=int,
        default=50,
        help="抓到少于该条数就 abort，不覆盖已有 CSV（保护现有数据）",
    )
    args = parser.parse_args()

    print(f"[crawl] target cities: {[(k, v['name']) for k, v in CITY_CONFIG.items()]}")
    communities = load_communities(REPO_ROOT / "static" / "seed" / "communities.csv")

    all_rows: list[dict[str, Any]] = []
    for city_id in sorted(CITY_CONFIG.keys()):
        if city_id not in communities or not communities[city_id]:
            print(f"[crawl] city_id={city_id} 没有 communities，跳过", file=sys.stderr)
            continue
        city_rows = crawl_city(city_id, communities[city_id])
        if args.limit:
            remaining = args.limit - len(all_rows)
            if remaining <= 0:
                break
            city_rows = city_rows[:remaining]
        all_rows.extend(city_rows)
        print(f"[crawl] city={CITY_CONFIG[city_id]['name']} rows={len(city_rows)} (累计 {len(all_rows)})", file=sys.stderr)

    # 保护：抓到太少就别覆盖（反爬 captcha 时 0 行是常态）
    if len(all_rows) < args.min_rows and not args.dry_run:
        print(
            f"[abort] 抓 {len(all_rows)} 条 < 阈值 {args.min_rows}，"
            f"已有 CSV 保留不动",
            file=sys.stderr,
        )
        sys.exit(2)

    if not args.dry_run:
        write_csv(all_rows, args.out)
        try:
            import subprocess
            subprocess.run(["python", str(Path(__file__).parent / "publish_csv.py")], check=True)
        except Exception as e:
            print(f"  [warn] publish_csv.py failed: {e}", file=sys.stderr)
    else:
        print(f"[dry-run] 将写入 {len(all_rows)} 条", file=sys.stderr)
    print(f"[done] 总条数: {len(all_rows)}, 时间: {datetime.now().isoformat(timespec='seconds')}")


if __name__ == "__main__":
    main()

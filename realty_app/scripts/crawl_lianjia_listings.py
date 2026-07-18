"""
链家在售二手房挂牌抓取 → listings.csv
=========================================

数据源（实测可达，2026-07-12）：
  https://{city}.lianjia.com/ershoufang/pg{n}/

为什么不用 xjkj123/Lianjia 那个 ajax API：
  - 实测 ajax.lianjia.com/map/search/ershoufang/ 现在返回 404（API 已下线）
  - 但 HTML 公开列表页能直接拿到，70+ 个城市不限速（实测 170KB/页 30 条卡片）

为什么只用 stdlib：
  - 仓库 scripts/ 现有依赖只有 requests，本脚本刻意只用标准库，避免额外依赖

输入：城市列表
输出：realty_app/static/seed/listings.csv（与 seed schema 完全兼容）

已知限制：
  - 区域筛选页（/ershoufang/{区}/pg1/）触发 anti-bot；只扫首页分页能稳定拿数据
  - 单 IP 高频会被风控；推荐 CI runner 全新 IP 跑（GitHub Actions 自动新 IP）
  - 列表页 has_elevator 字段不显示；build_year 部分房源缺数据

使用：
    python scripts/crawl_lianjia_listings.py fetch --city 深圳 --pages 5
    python scripts/crawl_lianjia_listings.py fetch --city 广州 --pages 5
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]  # realty_app/
OUT_CSV = REPO_ROOT / "static" / "seed" / "listings.csv"

# 城市配置：中文名 → (子域名, city_id, listing_type)
CITY_CONFIG: dict[str, tuple[str, int, str]] = {
    "深圳": ("sz", 2, "二手房"),
    "广州": ("gz", 1, "二手房"),
    "珠海": ("zh", 3, "二手房"),
    "上海": ("sh", 4, "二手房"),
    "北京": ("bj", 5, "二手房"),
}

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


# ---------- HTTP ----------

def fetch(url: str, city_code: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Cookie": f"select_city={city_code}",
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read()
            if resp.headers.get("Content-Encoding") == "gzip":
                body = gzip.decompress(body)
            return resp.status, body.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
            if e.headers.get("Content-Encoding") == "gzip":
                body = gzip.decompress(body)
            return e.code, body.decode("utf-8", errors="replace")
        except Exception:
            return e.code, ""
    except Exception as e:
        return -1, str(e)


# ---------- HTML → 文本 ----------

class _StripTags(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []

    def handle_data(self, data):
        self._chunks.append(data)

    @property
    def text(self) -> str:
        return re.sub(r"\s+", " ", "".join(self._chunks)).strip()


def strip(html_fragment: str) -> str:
    p = _StripTags()
    try:
        p.feed(html_fragment)
        p.close()
    except Exception:
        return re.sub(r"<[^>]+>", " ", html_fragment)
    return p.text


# ---------- li 卡片切分（用深度计数器正确处理嵌套） ----------

def find_li_blocks(html: str) -> list[tuple[int, int]]:
    blocks: list[tuple[int, int]] = []
    for m in re.finditer(r"<li\b[^>]*>", html, re.IGNORECASE):
        attrs = m.group(0)
        if "class=" not in attrs or "clear" not in attrs:
            continue
        if "/ershoufang/" not in html[m.end():m.end() + 3000]:
            continue
        depth = 1
        scan = m.end()
        end_idx = -1
        while depth > 0:
            n_open = html.find("<li", scan)
            n_close = html.find("</li>", scan)
            if n_close == -1:
                break
            if n_open != -1 and n_open < n_close:
                after = html[n_open + 3:n_open + 4]
                if after in (" ", ">", "\t", "\n"):
                    depth += 1
                scan = n_open + 3
            else:
                depth -= 1
                scan = n_close + 5
                if depth == 0:
                    end_idx = n_close
        if end_idx > 0:
            blocks.append((m.start(), end_idx))
    return blocks


# ---------- 单卡片解析 ----------

def parse_card(block: str, city_id: int, listing_type: str) -> dict | None:
    href_m = re.search(r'href="(https?://[^"]*/ershoufang/(\d+)\.html)"', block)
    if not href_m:
        return None
    source_url = href_m.group(1)
    source_listing_id = href_m.group(2)

    title_m = re.search(r'class="title">.*?<a[^>]*>([^<]+)</a>', block, re.DOTALL)
    title = strip(title_m.group(1)) if title_m else ""

    community_m = re.search(
        r'class="positionInfo".*?<a[^>]*>([^<]+)</a>',
        block,
        re.DOTALL,
    )
    community_name = strip(community_m.group(1)) if community_m else ""

    hi_m = re.search(r'class="houseInfo"[^>]*>(.*?)</div>', block, re.DOTALL)
    houseinfo = strip(hi_m.group(1)) if hi_m else ""
    parts = re.split(r"\s*\|\s*|\s{2,}", houseinfo)
    parts = [p.strip() for p in parts if p.strip()]

    orientation = None
    area_sqm = None
    bedrooms = None
    bathrooms = None
    floor_number = None
    decorate_type = None
    build_year = None
    building_type = None

    for p in parts:
        if re.fullmatch(r"[东南西北]+(?:通|通透)?", p):
            orientation = p
        elif "平米" in p:
            m2 = re.search(r"([\d.]+)", p)
            if m2:
                area_sqm = float(m2.group(1))
        elif "室" in p and "厅" in p:
            m3 = re.search(r"(\d+)室(\d+)厅", p)
            if m3:
                bedrooms = int(m3.group(1))
                bathrooms = int(m3.group(2))
        elif "楼层" in p or "层" in p:
            floor_number = p
        elif p in ("精装", "豪装", "普装", "毛坯", "简装", "其他"):
            decorate_type = p
        elif p in ("塔楼", "板楼", "板塔结合", "平房"):
            building_type = p
        elif "年" in p and re.search(r"\d{4}年", p):
            m4 = re.search(r"(\d{4})", p)
            if m4:
                build_year = int(m4.group(1))

    # 总价：<div class="totalPrice totalPrice2"><i> </i><span class="">230</span><i>万</i></div>
    tp_m = re.search(
        r'class="totalPrice[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\d.]+)</span>',
        block,
    )
    total_price_10k = float(tp_m.group(1)) if tp_m else None

    # 单价：<span>44,231元/平</span> 或旧版"单价96873元/平米"
    up_m = re.search(r'<span[^>]*>\s*([\d,]+)\s*元/(?:平|平米)\s*</span>', block)
    if not up_m:
        up_m = re.search(r"单价\s*([\d,]+)\s*元/(?:平|平米)", block)
    unit_price = int(up_m.group(1).replace(",", "")) if up_m else None

    # 地铁：距离1号线高新园站200米
    subway_m = re.search(r"距离(\d+号线[^<]*?)站(\d+)米", block)
    nearest_metro_distance_m = int(subway_m.group(2)) if subway_m else None

    # tags
    tag_block_m = re.search(r'class="tag">(.*?)</div>', block, re.DOTALL)
    tags: list[str] = []
    if tag_block_m:
        inner = tag_block_m.group(1)
        for tm in re.finditer(r'<span[^>]*class="([^"]+)"[^>]*>([^<]*)</span>', inner):
            cls, text = tm.group(1), tm.group(2).strip()
            if text and cls not in ("good", "is_ke_yan", "icon", "houseIcon"):
                tags.append(text)

    return {
        "community_name_raw": community_name,  # 临时字段，CSV 不导出
        "city_id": city_id,
        "title": title,
        "source": "链家在售",
        "source_kind": "REAL",
        "source_listing_id": source_listing_id,
        "source_url": source_url,
        "total_price_10k": total_price_10k,
        "unit_price": unit_price,
        "area_sqm": area_sqm,
        "listing_type": listing_type,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "orientation": orientation,
        "floor_number": floor_number,
        "has_elevator": None,
        "decorate_type": decorate_type,
        "build_year": build_year,
        "nearest_metro_distance_m": nearest_metro_distance_m,
        "school_ids_json": "[]",
        "tags_json": json.dumps(tags, ensure_ascii=False),
        "crawl_date": date.today().isoformat(),
    }


# ---------- community 映射 ----------

def load_community_map() -> tuple[dict[str, int], int]:
    """communities.csv → ({community_name: community_id}, next_id)
    返回 next_id 用于分配新小区 ID
    """
    p = REPO_ROOT / "static" / "seed" / "communities.csv"
    result: dict[str, int] = {}
    max_id = 0
    if not p.exists():
        return result, 1
    with open(p, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cid_str = row.get("community_id", "").strip()
            name = row.get("community_name", "").strip()
            if cid_str and name:
                cid = int(cid_str)
                result[name] = cid
                if cid > max_id:
                    max_id = cid
    return result, max_id + 1


COMMUNITIES_CSV = REPO_ROOT / "static" / "seed" / "communities.csv"


def update_communities_csv(new_rows: list[tuple[int, int, str, str]]):
    """追加新小区到 communities.csv。rows = [(community_id, city_id, district, name), ...]

    默认 NO-OP：列表页无 district，写入空 district 会让 queries.ts 把这些 listing 排除
    在 district compare 之外。最好单独 run `enrich_communities.py`（TODO）抓详情页补齐。
    启用方法：--update-communities CLI flag。
    """
    if not new_rows:
        return
    with open(COMMUNITIES_CSV, "a", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        for cid, city_id, district, name in new_rows:
            w.writerow([cid, city_id, district, name])
    print(f"  wrote {COMMUNITIES_CSV} (+{len(new_rows)} new communities)")


# ---------- 写 CSV ----------

CSV_COLS = [
    "listing_id", "city_id", "community_id", "title", "source", "source_kind",
    "source_listing_id", "source_url", "total_price_10k", "unit_price",
    "area_sqm", "listing_type", "bedrooms", "bathrooms", "orientation",
    "floor_number", "has_elevator", "decorate_type", "build_year",
    "nearest_metro_distance_m", "school_ids_json", "tags_json", "crawl_date",
]


def write_csv(rows: list[dict], out: Path = OUT_CSV):
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLS, extrasaction="ignore")
        w.writeheader()
        for i, r in enumerate(rows, 1):
            r["listing_id"] = i
            w.writerow({k: r.get(k) for k in CSV_COLS})
    print(f"  wrote {out} ({len(rows)} rows)")


# ---------- 主流程 ----------

def fetch_city(city: str, pages: int, delay_sec: float = 2.0) -> tuple[list[dict], list[tuple[int, int, str, str]]]:
    """抓取单城 listings。

    返回 (cards, new_communities)
      cards            list[dict]  每条房源（community_id 已分配）
      new_communities  list[(cid, city_id, district, name)]  本次新发现的小区（追加到 communities.csv）
    """
    if city not in CITY_CONFIG:
        print(f"[ERR] 未知城市：{city}（可选：{list(CITY_CONFIG.keys())}）")
        return [], []
    subdomain, city_id, listing_type = CITY_CONFIG[city]

    community_map, next_cid = load_community_map()
    print(f"[fetch] {city} city_id={city_id} pages={pages} (delay {delay_sec}s)")
    print(f"  existing communities: {len(community_map)}, next_id={next_cid}")

    all_cards: list[dict] = []
    seen_ids: set[str] = set()
    new_communities: list[tuple[int, int, str, str]] = []

    for page in range(1, pages + 1):
        url = f"https://{subdomain}.lianjia.com/ershoufang/pg{page}/"
        code, body = fetch(url, city_code=subdomain)
        if code != 200:
            print(f"  page {page}: HTTP {code}, skip")
            time.sleep(delay_sec)
            continue

        blocks = find_li_blocks(body)
        page_count = 0
        for start, end in blocks:
            card = parse_card(body[start:end + 5], city_id, listing_type)
            if not card:
                continue
            sid = card["source_listing_id"]
            if sid in seen_ids:
                continue
            seen_ids.add(sid)
            # 映射 community_id（fallback → 自动建新小区）
            cn = card.pop("community_name_raw", "")
            if cn and cn in community_map:
                # 已知小区（seed 里那 23 个）：直接用其 ID
                card["community_id"] = community_map[cn]
            elif cn:
                # 新小区：写 0（避免被 queries.ts 用 communityId 找到但 district 为空跳过）。
                # 真实 community_id 由后续 enrich_communities.py 补全后写入。
                card["community_id"] = 0
                # 但**只在显式 --update-communities 时**才把新小区登记到 communities.csv
                new_cid = next_cid
                next_cid += 1
                community_map[cn] = new_cid  # 仅供后续 enrich 阶段使用
                new_communities.append((new_cid, city_id, "", cn))
            else:
                card["community_id"] = 0
            all_cards.append(card)
            page_count += 1

        print(f"  page {page}: {page_count} cards (total {len(all_cards)})")
        time.sleep(delay_sec)

    print(f"[fetch] {city} 完成：{len(all_cards)} 条房源 / 待 enrich 小区 {len(new_communities)} 个")
    return all_cards, new_communities


def load_existing_rows() -> list[dict]:
    """读现有 listings.csv 的全部行（用于 append 模式去重）"""
    if not OUT_CSV.exists():
        return []
    with open(OUT_CSV, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def cmd_fetch(args):
    new_rows, new_communities = fetch_city(args.city, args.pages, args.delay)
    if not new_rows:
        sys.exit(2)

    # 默认不动 communities.csv（避免新建空 district 拖累 district compare 测试）；
    # 显式 --update-communities 才追加。Todo：另跑 enrich_communities.py 抓详情页补 district
    if args.update_communities and new_communities:
        update_communities_csv(new_communities)
    elif new_communities:
        print(f"  [skip] 新增 {len(new_communities)} 个小区未写入 communities.csv（district 字段为空会影响 district 维度查询）")
        print(f"         如要写入，加 --update-communities，或稍后跑 enrich_communities.py 补详情页")

    if args.append:
        # 追加模式：保留旧行，按 source_listing_id 去重，重排 listing_id
        existing = load_existing_rows()
        existing_ids = {r.get("source_listing_id") for r in existing if r.get("source_listing_id")}
        added = [r for r in new_rows if r["source_listing_id"] not in existing_ids]
        print(f"[append] 旧 {len(existing)} 行 + 新增 {len(added)} 条（去重后）")
        # 重排 listing_id（连续）
        all_rows: list[dict] = []
        # 保留旧行（保留原 listing_id；空缺在末尾补）
        for r in existing:
            r.pop("community_name_raw", None)
            all_rows.append(r)
        # 新行不指定 listing_id，由 write_csv 统一编号
        next_id = max(
            (int(r.get("listing_id", 0)) for r in all_rows if r.get("listing_id", "").isdigit()),
            default=0,
        ) + 1
        for r in added:
            r["listing_id"] = next_id
            next_id += 1
        write_csv(all_rows + added, OUT_CSV)
    else:
        # 默认覆盖模式（向后兼容）
        write_csv(new_rows, OUT_CSV)


def cmd_dry(args):
    """dry-run：抓一页看解析质量，不写文件"""
    rows = fetch_city(args.city, pages=1, delay_sec=0)
    if not rows:
        sys.exit(2)
    print(f"\n=== {args.city} 第 1 页解析示例（前 5 条）===")
    for r in rows[:5]:
        print(json.dumps({k: r.get(k) for k in (
            "source_listing_id", "title", "total_price_10k",
            "unit_price", "area_sqm", "bedrooms", "orientation",
            "floor_number", "decorate_type", "build_year",
            "nearest_metro_distance_m",
        )}, ensure_ascii=False, indent=2))
    print(f"\n覆盖率（来自 {len(rows)} 条）：")
    for f in ("total_price_10k", "unit_price", "area_sqm", "bedrooms",
              "orientation", "decorate_type", "build_year", "nearest_metro_distance_m"):
        c = sum(1 for r in rows if r.get(f) is not None)
        print(f"  {f}: {c}/{len(rows)} ({c/len(rows)*100:.0f}%)")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("fetch", help="抓取并写入 listings.csv")
    f.add_argument("--city", required=True, choices=list(CITY_CONFIG.keys()))
    f.add_argument("--pages", type=int, default=10,
                   help="每城抓多少页（每页 ~30 条）")
    f.add_argument("--delay", type=float, default=2.0,
                   help="页间隔秒数（防风控）")
    f.add_argument("--append", action="store_true",
                   help="追加模式：保留原 listings.csv 内容，按 source_listing_id 去重")
    f.add_argument("--update-communities", action="store_true",
                   help="同时把新发现的小区追加进 communities.csv（district 字段为空，会影响 district 维度查询）")
    f.set_defaults(func=cmd_fetch)

    d = sub.add_parser("dry", help="抓 1 页 + 打印覆盖率，不写文件")
    d.add_argument("--city", required=True, choices=list(CITY_CONFIG.keys()))
    d.set_defaults(func=cmd_dry)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

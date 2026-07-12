"""enrich_lianjia_xq.py v1 — 抓链家 /xiaoqu/pg1/ 提取真小区 (id, name, district, bizcircle)

实测可拿:
  HTTP 200, 146KB, 30 个 xiaoquListItem
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
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]  # realty_app/
OUT_CSV = REPO_ROOT / "static" / "seed" / "xq_seed.csv"
COMMUNITIES_CSV = REPO_ROOT / "static" / "seed" / "communities.csv"

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
      'AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/120.0.0.0 Safari/537.36')

CITY_CONFIG: dict[str, tuple[str, int]] = {
    "深圳": ("sz", 2),
    # 广州/珠海 暂未测过 (gate 没跑)
}


def fetch(url: str, retries: int = 3, delay: float = 2.0) -> tuple[int, str]:
    """抓页面，返回 (HTTP status, decoded body)。CAPTCHA/风控视为 200 + 6KB 短 body"""
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
    })
    last_err = ''
    for i in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                body = r.read()
                if r.headers.get('Content-Encoding') == 'gzip':
                    body = gzip.decompress(body)
                body = body.decode('utf-8', errors='replace')
                # 风控识别：体小于 10KB 且含 "验证码/CAPTCHA/登录"
                if len(body) < 10_000 and ('请输入验证码' in body or '人机验证' in body):
                    return 429, body  # 伪状态码表示风控
                return r.status, body
        except Exception as e:
            last_err = str(e)
            time.sleep(delay)
    return -1, last_err


def find_xq_li_blocks(html: str) -> list[tuple[int, int]]:
    """xiaoqu 列表页 li 切分：以 class="clear xiaoquListItem" 为锚点的 li 范围"""
    blocks = []
    for m in re.finditer(r'<li[^>]*class="[^"]*\bxiaoquListItem\b[^"]*"[^>]*>', html):
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


SLUG_TO_DISTRICT = {
    'nanshanqu': '南山区',
    'futianqu': '福田区',
    'luohuqu': '罗湖区',
    'baoanqu': '宝安区',
    'longgangqu': '龙岗区',
    'longhuaqu': '龙华区',
    'yantianqu': '盐田区',
    'guangmingqu': '光明区',
    'pingshanxinqu': '坪山区',
    'dapengxinqu': '大鹏新区',
    'longgangzhen': '龙岗区',  # 某些活动页别名
}


def parse_block(blk: str) -> dict | None:
    """单个 li 解析：
       xq_id (链家内部 ID) + 小区名 + district + bizcircle
    """
    # xq_id
    xid_m = re.search(r'(?:href|data-id|data-housecode)="[^"]*xiaoqu/(\d+)/?"', blk)
    # 小区名：优先 href 内文本
    name_m = re.search(
        r'<a[^>]*href="https?://[^"]*xiaoqu/\d+/"[^>]*>\s*([^<]+?)\s*</a>',
        blk,
    )
    if not name_m:
        # alt text
        name_m = re.search(r'alt="([^"]+)"', blk)
    name = name_m.group(1).strip() if name_m else None
    if not name or any(k in name for k in ['全部', '筛选', '显示', '排序', '上传', '点击', '更多', '地图']):
        return None

    # positionInfo
    pos = re.search(r'class="positionInfo"[^>]*>(.*?)</div>', blk, re.DOTALL)
    district_slug = None
    district_name = None
    bizcircle = None
    if pos:
        inner = pos.group(1)
        # 区域: <a href="https://sz.lianjia.com/xiaoqu/futianqu/" class="district" title="福田区小区">福田区</a>
        d_m = re.search(r'href="[^"]*?/xiaoqu/([a-z0-9]+)/?"\s+class="district"', inner)
        if d_m:
            district_slug = d_m.group(1)
        # 区域名: title="福田区小区" 拿 "福田区"
        dname_m = re.search(r'class="district"\s+title="([^"]*?区?)"', inner)
        if dname_m:
            district_name = dname_m.group(1)
        # 商圈
        biz_m = re.search(r'href="[^"]*?/xiaoqu/[^"/]+/"[^>]*?class="bizcircle"[^>]*?>([^<]+)</a>', inner)
        if biz_m:
            bizcircle = biz_m.group(1).strip()

    district = district_name
    if district and district.endswith('小区'):
        district = district[:-2]  # 去掉"小区" 留 "福田区"
    if not district and district_slug:
        district = SLUG_TO_DISTRICT.get(district_slug, '')
    return {
        'xq_id': xid_m.group(1) if xid_m else None,
        'name': name,
        'district_slug': district_slug,
        'district': district or None,
        'bizcircle': bizcircle,
    }


def fetch_city_xqs(city: str, pages: int, delay_sec: float) -> list[dict]:
    if city not in CITY_CONFIG:
        raise SystemExit(f"未知城市：{city}。已知: {list(CITY_CONFIG.keys())}")
    subdomain, _ = CITY_CONFIG[city]
    out: list[dict] = []
    seen: set[str] = set()
    for pg in range(1, pages + 1):
        url = f"https://{subdomain}.lianjia.com/xiaoqu/pg{pg}/"
        code, body = fetch(url)
        if code != 200:
            print(f"  pg{pg}: HTTP {code}, skip (CAPTCHA/网络错误)")
            break
        blocks = find_xq_li_blocks(body)
        page_count = 0
        for s, e in blocks:
            row = parse_block(body[s:e + 5])
            if row and row['xq_id'] and row['xq_id'] not in seen:
                seen.add(row['xq_id'])
                out.append(row)
                page_count += 1
        print(f"  pg{pg}: {page_count} 个新小区 (累计 {len(out)})")
        if page_count == 0:
            print(f"  pg{pg}: 0 个新区，停止翻页（防止 IP 风控）")
            break
        time.sleep(delay_sec)
    return out


def load_communities_max_id() -> int:
    if not COMMUNITIES_CSV.exists():
        return 0
    mx = 0
    with open(COMMUNITIES_CSV, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            v = r.get('community_id', '').strip()
            if v.isdigit() and int(v) > mx:
                mx = int(v)
    return mx


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='cmd', required=True)

    p_fetch = sub.add_parser('fetch', help='抓 xiaoqu 列表页 → stdout 摘要 (默认 dry)')
    p_fetch.add_argument('--city', default='深圳')
    p_fetch.add_argument('--pages', type=int, default=1, help='最多翻几页 (pg1 通常够用 30 个)')
    p_fetch.add_argument('--delay', type=float, default=1.5)

    p_write = sub.add_parser('write', help='抓 + 写入 communities.csv 末尾追加新小区')
    p_write.add_argument('--city', default='深圳')
    p_write.add_argument('--pages', type=int, default=1)
    p_write.add_argument('--delay', type=float, default=1.5)
    p_write.add_argument('--dry', action='store_true', help='不写，只打印将写入的行')

    args = parser.parse_args()

    if args.cmd == 'fetch':
        rows = fetch_city_xqs(args.city, args.pages, args.delay)
        print(f"\n[{args.city}] unique xq: {len(rows)}")
        for r in rows[:20]:
            print(f"  xq_id={r['xq_id']}\t{r['name']}\tdistrict={r['district'] or '(unknown)'}\tbiz={r['bizcircle'] or '(unknown)'}")
        # 落 xq_seed.csv 供调试
        OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
        with open(OUT_CSV, 'w', encoding='utf-8', newline='') as f:
            w = csv.DictWriter(f, fieldnames=['xq_id', 'name', 'district_slug', 'district', 'bizcircle'])
            w.writeheader()
            for r in rows:
                w.writerow(r)
        print(f"\n  wrote {OUT_CSV}")

    elif args.cmd == 'write':
        rows = fetch_city_xqs(args.city, args.pages, args.delay)
        next_cid = load_communities_max_id() + 1
        out_rows = []
        for i, r in enumerate(rows):
            cid = next_cid + i
            district = r['district'] or ''
            out_rows.append((cid, 2 if args.city == '深圳' else 0, district, r['name']))
        print(f"\n将追加 {len(out_rows)} 个小区到 communities.csv (next id={next_cid})")
        for cid, city_id, d, n in out_rows[:8]:
            print(f"  {cid}\t{city_id}\t{d or '?'}\t{n}")
        if args.dry:
            print('\n[dry] 未实际写文件')
            return
        with open(COMMUNITIES_CSV, 'a', encoding='utf-8', newline='') as f:
            w = csv.writer(f)
            for row in out_rows:
                w.writerow(row)
        print(f'\nwrote {COMMUNITIES_CSV} (+{len(out_rows)} 行)')


if __name__ == '__main__':
    main()

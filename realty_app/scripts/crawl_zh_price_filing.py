#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取珠海住建局「商品房价格备案公示」HTML 表摘要。

列表：https://zjj.zhuhai.gov.cn/zjj/hygl/ywgsgg/spfjgbags/
（index.html + index_2.html …）

口径：政府公示的**销售价格备案**（建筑面积均价 / 套内均价）。
**≠ 挂牌价、≠ 成交价、≠ 日更网签、≠ 70 城指数**。

用法：
  python scripts/crawl_zh_price_filing.py
  python scripts/crawl_zh_price_filing.py --max-pages 3 --max-posts 20
"""
from __future__ import annotations

import argparse
import csv
import re
import ssl
import time
from html import unescape
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "zh_price_filing.csv"
BASE = "https://zjj.zhuhai.gov.cn/zjj/hygl/ywgsgg/spfjgbags"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

FIELDS = [
    "post_id",
    "publish_date",
    "updated_date",
    "project_name",
    "district",
    "address",
    "units",
    "area_sqm",
    "avg_price_building",
    "avg_price_inner",
    "list_title",
    "source_org",
    "source_url",
]

DISTRICT_PATTERNS = [
    ("香洲区", re.compile(r"香洲")),
    ("金湾区", re.compile(r"金湾")),
    ("斗门区", re.compile(r"斗门")),
    ("高新区", re.compile(r"高新|唐家|前岛|科技")),
    ("横琴", re.compile(r"横琴")),
    ("保税区", re.compile(r"保税")),
]


def infer_district(address: str, title: str = "") -> str:
    blob = f"{address} {title}"
    for name, pat in DISTRICT_PATTERNS:
        if pat.search(blob):
            return name
    return "其他"


def fetch(url: str, timeout: int = 45, retries: int = 4) -> str:
    last: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urlopen(Request(url, headers=UA), context=CTX, timeout=timeout) as resp:
                raw = resp.read()
            for enc in ("utf-8", "gbk"):
                try:
                    return raw.decode(enc)
                except Exception:
                    continue
            return raw.decode("utf-8", "replace")
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(0.6 * attempt)
    assert last is not None
    raise last

def textify(html: str) -> str:
    s = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    s = re.sub(r"<style[\s\S]*?</style>", " ", s, flags=re.I)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</(?:p|tr|td|th|div|li|h\d)>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = unescape(s).replace("\xa0", " ")
    return re.sub(r"[ \t]+", " ", s)


def list_url(page: int) -> str:
    if page <= 1:
        return f"{BASE}/index.html"
    return f"{BASE}/index_{page}.html"


def discover_last_page(html: str) -> int:
    last = 1
    for m in re.finditer(rf"{re.escape(BASE)}/index_(\d+)\.html", html):
        last = max(last, int(m.group(1)))
    return last


def parse_list(html: str) -> list[tuple[str, str]]:
    """Return [(url, title), ...] for 备案公示表 entries."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for m in re.finditer(r'<a\b([^>]*)>([\s\S]*?)</a>', html, flags=re.I):
        attrs, inner = m.group(1), m.group(2)
        href_m = re.search(r'href="([^"]+)"', attrs)
        if not href_m:
            continue
        href = href_m.group(1).strip()
        if "/spfjgbags/content/post_" not in href:
            continue
        plain = unescape(re.sub(r"<[^>]+>", "", inner)).strip()
        plain = re.sub(r"\s+", " ", plain)
        title_m = re.search(r'title="([^"]*)"', attrs)
        title = unescape(title_m.group(1)).strip() if title_m else plain
        blob = f"{title} {plain}"
        if "备案公示表" not in blob and "价格备案" not in blob:
            continue
        if href in seen:
            continue
        seen.add(href)
        out.append((href, title or plain))
    return out


def project_from_title(title: str) -> str:
    m = re.search(r"备案公示表[（(](.+?)[）)]", title)
    if not m:
        return ""
    raw = m.group(1).strip()
    # 去掉末尾楼栋/套数描述，尽量保留项目名（含带数字的地名如「斗门39」会截到区名前）
    raw = re.sub(r"(?:[A-Za-z]?\d+[、，,]*)+\d*栋.*$", "", raw)
    raw = re.sub(r"\d+套.*$", "", raw)
    raw = re.sub(r"\s+\d{4}年.*$", "", raw)
    return raw.strip(" ，、")


def clean_list_title(title: str) -> str:
    t = re.sub(r"\s+", " ", title).strip()
    t = re.sub(r"\s*\d{4}年\d{1,2}月\d{1,2}日\s*$", "", t)
    return t.strip()

def parse_post(url: str, list_title: str) -> dict[str, str] | None:
    html = fetch(url)
    t = textify(html)
    post_m = re.search(r"post_(\d+)\.html", url)
    post_id = post_m.group(1) if post_m else ""

    pub_m = re.search(r"发布日期[：:]\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})", html)
    publish = (
        f"{pub_m.group(1)}-{int(pub_m.group(2)):02d}-{int(pub_m.group(3)):02d}"
        if pub_m
        else ""
    )

    upd_m = re.search(r"最后更新日期[：:]\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})", t)
    updated = (
        f"{upd_m.group(1)}-{int(upd_m.group(2)):02d}-{int(upd_m.group(3)):02d}"
        if upd_m
        else ""
    )

    addr_m = re.search(r"地址[：:]\s*([^\n]{4,80})", t)
    address = addr_m.group(1).strip() if addr_m else ""
    address = re.split(r"最后更新日期|预售许可证|序号", address)[0].strip()

    units_m = re.search(r"销售住宅共\s*(\d+)\s*套", t)
    area_m = re.search(r"销售住宅总建筑面积[：:]\s*([\d.]+)\s*㎡", t)
    bld_m = re.search(r"销售均价[：:]\s*([\d.]+)\s*元/㎡（建筑面积）", t)
    inner_m = re.search(r"([\d.]+)\s*元/㎡（套内建筑面积）", t)

    if not units_m and not bld_m:
        # 非表格式公示（通知等）跳过
        return None

    project = project_from_title(list_title)
    if not project:
        pm = re.search(r"项目名称[：:]\s*([^\n]{2,40})", t)
        if pm:
            project = pm.group(1).strip()
            project = re.split(r"预售许可证|地址|最后更新", project)[0].strip()

    return {
        "post_id": post_id,
        "publish_date": publish,
        "updated_date": updated,
        "project_name": project,
        "district": infer_district(address, list_title),
        "address": address,
        "units": units_m.group(1) if units_m else "",
        "area_sqm": area_m.group(1) if area_m else "",
        "avg_price_building": bld_m.group(1) if bld_m else "",
        "avg_price_inner": inner_m.group(1) if inner_m else "",
        "list_title": clean_list_title(list_title),
        "source_org": "珠海市住房和城乡建设局",
        "source_url": url,
    }


def write_csv(rows: list[dict[str, str]]) -> None:
    rows = sorted(
        rows,
        key=lambda r: (r.get("publish_date") or "", r.get("post_id") or ""),
        reverse=True,
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in FIELDS})


def main() -> int:
    ap = argparse.ArgumentParser(description="珠海商品房价格备案公示抓取")
    ap.add_argument("--max-pages", type=int, default=0, help="0=全部页")
    ap.add_argument("--max-posts", type=int, default=0, help="0=全部帖")
    ap.add_argument("--sleep", type=float, default=0.35)
    args = ap.parse_args()

    first = fetch(list_url(1))
    last_page = discover_last_page(first)
    if args.max_pages > 0:
        last_page = min(last_page, args.max_pages)
    print(f"[list] pages 1..{last_page}")

    entries: list[tuple[str, str]] = []
    seen_url: set[str] = set()
    for page in range(1, last_page + 1):
        html = first if page == 1 else fetch(list_url(page))
        batch = parse_list(html)
        for url, title in batch:
            if url in seen_url:
                continue
            seen_url.add(url)
            entries.append((url, title))
        print(f"  page {page}: +{len(batch)} (total unique {len(entries)})")
        if page > 1:
            time.sleep(args.sleep)

    if args.max_posts > 0:
        entries = entries[: args.max_posts]

    rows: list[dict[str, str]] = []
    skipped = 0
    for i, (url, title) in enumerate(entries, 1):
        try:
            row = parse_post(url, title)
        except HTTPError as exc:
            print(f"  [{i}/{len(entries)}] HTTP {exc.code} {url}")
            skipped += 1
            continue
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}/{len(entries)}] ERR {type(exc).__name__}: {exc}")
            skipped += 1
            continue
        if not row:
            skipped += 1
            print(f"  [{i}/{len(entries)}] skip(no table) {url}")
        else:
            rows.append(row)
            print(
                f"  [{i}/{len(entries)}] {row['project_name'] or '?'} "
                f"{row['units']}套 @{row['avg_price_building'] or '-'}"
            )
        time.sleep(args.sleep)

    write_csv(rows)
    print(f"[done] {len(rows)} rows (skipped {skipped}) → {OUT}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())

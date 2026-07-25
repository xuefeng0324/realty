#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广州市规自局土地成交公示中的居住用地（R2/住宅/居住）。

列表：https://ghzyj.gz.gov.cn/ywpd/tdgl/tdjysc/cjgs/
口径：国有建设用地使用权成交结果；仅保留居住类用途；金额为成交价（万元），非房价均价。

用法：
  python scripts/crawl_gz_land_deals.py
  python scripts/crawl_gz_land_deals.py --pages 4 --max-detail 40
"""
from __future__ import annotations

import argparse
import csv
import re
import ssl
import sys
import tempfile
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "gz_land_deals.csv"
LIST_BASE = "https://ghzyj.gz.gov.cn/ywpd/tdgl/tdjysc/cjgs/"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

FIELDS = [
    "city",
    "deal_date",
    "publish_date",
    "district",
    "location",
    "land_use",
    "area_sqm",
    "price_wan",
    "buyer",
    "source_org",
    "source_url",
]

RESIDENTIAL_RE = re.compile(r"居住|住宅|R2|R1|商品住宅|二类居住|一类居住")


def fetch(url: str) -> str:
    req = Request(url, headers=UA)
    with urlopen(req, context=CTX, timeout=45) as resp:
        return resp.read().decode("utf-8", "replace")


def abs_url(href: str) -> str:
    href = href.strip()
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return "https://ghzyj.gz.gov.cn" + href
    return href


def list_urls(pages: int) -> list[str]:
    urls = [LIST_BASE, LIST_BASE + "index.html"]
    for i in range(2, pages + 1):
        urls.append(f"{LIST_BASE}index_{i}.html")
    return urls


def list_detail_links(html: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for m in re.finditer(r'href="([^"]+)"[^>]*title="([^"]+)"', html):
        title = unescape(m.group(2)).strip()
        href = abs_url(m.group(1))
        if "post_" in href and ("成交" in title or "出让结果" in title or "结果公示" in title or "挂出告" in title):
            out.append((href, title))
    # also bare anchors
    for m in re.finditer(r'href="([^"]*post_\d+\.html)"[^>]*>([^<]{6,120})', html):
        title = re.sub(r"\s+", " ", unescape(m.group(2))).strip()
        href = abs_url(m.group(1))
        if any(k in title for k in ("成交", "出让结果", "结果公示", "挂出告")):
            out.append((href, title))
    seen: set[str] = set()
    uniq: list[tuple[str, str]] = []
    for href, title in out:
        if href in seen:
            continue
        seen.add(href)
        uniq.append((href, title))
    return uniq


def plain_text(html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", unescape(text))


def table_kv(html: str) -> dict[str, str]:
    kv: dict[str, str] = {}
    for table in re.findall(r"<table[\s\S]*?</table>", html, flags=re.I):
        for tr in re.findall(r"<tr[\s\S]*?</tr>", table, flags=re.I):
            cells = [
                re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c)).strip()
                for c in re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", tr, flags=re.I)
            ]
            cells = [unescape(c) for c in cells if c]
            if len(cells) >= 2:
                key = re.sub(r"\s+", "", cells[0])
                kv[key] = cells[1]
    return kv


def parse_num(s: str) -> float:
    m = re.search(r"([\d.]+)", s.replace(",", ""))
    return float(m.group(1)) if m else 0.0


def guess_district(location: str, title: str) -> str:
    for d in (
        "天河", "越秀", "海珠", "荔湾", "白云", "黄埔", "番禺", "花都", "南沙", "从化", "增城",
    ):
        if d in location or d in title:
            return d + "区" if not d.endswith("区") else d
    return ""


def parse_detail(url: str, title: str) -> list[dict]:
    html = fetch(url)
    text = plain_text(html)
    kv = table_kv(html)

    pub = ""
    pm = re.search(r'name="PubDate"\s+content="([0-9]{4}-[0-9]{2}-[0-9]{2})', html)
    if not pm:
        pm = re.search(r"发布时间：\s*([0-9]{4}-[0-9]{2}-[0-9]{2})", html)
    if pm:
        pub = pm.group(1)

    location = kv.get("地块位置") or ""
    land_use = kv.get("土地用途") or ""
    area_s = ""
    for k, v in kv.items():
        if "土地面积" in k or "出让土地面积" in k:
            area_s = v
            break
    price_s = ""
    for k, v in kv.items():
        if "成交价" in k:
            price_s = v
            break
    buyer = ""
    for k, v in kv.items():
        if "受让" in k:
            buyer = v
            break

    # prose fallback
    if not location:
        m = re.search(r"地块位置[：:]\s*([^。；]{4,80})", text)
        if m:
            location = m.group(1).strip()
    if not land_use:
        m = re.search(r"土地用途[：:]\s*([^。；]{2,40})", text)
        if m:
            land_use = m.group(1).strip()
    if not area_s:
        m = re.search(r"(?:成交土地面积|出让土地面积|土地面积)[：:为]?\s*([\d.]+)\s*平方米", text)
        if m:
            area_s = m.group(1)
    if not price_s:
        m = re.search(r"成交价(?:款)?[：:]\s*(?:人民币)?\s*([\d.]+)\s*万", text)
        if m:
            price_s = m.group(1)
    if not buyer:
        m = re.search(r"受让(?:单位|人)[：:]\s*([^。；]{2,60})", text)
        if m:
            buyer = m.group(1).strip()

    # residential filter
    blob = f"{title} {location} {land_use} {text[:800]}"
    if not RESIDENTIAL_RE.search(blob):
        return []

    area = parse_num(area_s)
    price = parse_num(price_s)
    if area <= 0 or price <= 0:
        return []

    deal_date = pub
    dm = re.search(r"成交日期[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日", text)
    if dm:
        deal_date = f"{int(dm.group(1)):04d}-{int(dm.group(2)):02d}-{int(dm.group(3)):02d}"

    return [
        {
            "city": "广州",
            "deal_date": deal_date or pub,
            "publish_date": pub,
            "district": guess_district(location, title),
            "location": location[:120],
            "land_use": land_use[:80] or "居住用地",
            "area_sqm": round(area, 2),
            "price_wan": round(price, 2),
            "buyer": buyer[:80],
            "source_org": "广州市规划和自然资源局",
            "source_url": url.replace("http://", "https://"),
        }
    ]


def write_csv(rows: list[dict], path: Path) -> None:
    rows = sorted(rows, key=lambda r: (r.get("deal_date") or "", r.get("price_wan") or 0), reverse=True)
    # dedupe by source_url + location
    seen: set[tuple[str, str]] = set()
    uniq: list[dict] = []
    for r in rows:
        key = (str(r.get("source_url")), str(r.get("location")))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(r)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=str(path.parent)
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        for r in uniq:
            w.writerow({k: r.get(k, "") for k in FIELDS})
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=3)
    ap.add_argument("--max-detail", type=int, default=36)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    links: list[tuple[str, str]] = []
    for lu in list_urls(args.pages):
        try:
            html = fetch(lu)
            links.extend(list_detail_links(html))
        except Exception as e:
            print(f"list fail {lu}: {e}", file=sys.stderr)

    # dedupe links
    seen: set[str] = set()
    uniq_links: list[tuple[str, str]] = []
    for href, title in links:
        if href in seen:
            continue
        seen.add(href)
        uniq_links.append((href, title))

    rows: list[dict] = []
    for href, title in uniq_links[: args.max_detail]:
        try:
            got = parse_detail(href, title)
            if got:
                rows.extend(got)
                print(f"OK residential {got[0]['district']} {got[0]['price_wan']}万 {got[0]['area_sqm']}㎡")
            else:
                print(f"skip non-residential: {title[:40]}")
        except Exception as e:
            print(f"ERR {href}: {e}", file=sys.stderr)

    if not rows:
        print("无居住用地成交行", file=sys.stderr)
        return 2

    write_csv(rows, args.out)
    print(f"wrote {len(rows)} -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

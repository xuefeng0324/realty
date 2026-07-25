#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取深圳公共资源交易中心土地矿业主页居住类地块（列表 API）。

源：https://szggzy.com/cms/api/v1/trade/content/tk-notice/land-list
口径：
  - landUseLike=居住（含一类/二类居住等）
  - 默认仅保留「已成交」状态（landStatus 含已成交 或 auctionResult=CJ）
  - 金额字段仅为列表「起始价」(startingPrice，万元)，**不是成交总价、不是房价均价**

用法：
  python scripts/crawl_sz_land_deals.py
  python scripts/crawl_sz_land_deals.py --pages 8 --page-size 50
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import ssl
import sys
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "sz_land_deals.csv"
API = "https://szggzy.com/cms/api/v1/trade/content/tk-notice/land-list"
UA = {
    "User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)",
    "Content-Type": "application/json;charset=UTF-8",
    "Accept": "application/json",
    "Origin": "https://szggzy.com",
    "Referer": "https://szggzy.com/mobile/jygg/list.html?id=tdky",
}
CTX = ssl.create_default_context()

FIELDS = [
    "city",
    "publish_date",
    "deal_status",
    "district",
    "location",
    "land_use",
    "area_sqm",
    "start_price_wan",
    "land_no",
    "package_code",
    "source_org",
    "source_url",
]

RESIDENTIAL_RE = re.compile(r"居住|住宅|R2|R1|安置")
SOLD_RE = re.compile(r"已成交|成交")


def post_json(body: dict) -> dict:
    raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = Request(API, data=raw, method="POST", headers=UA)
    with urlopen(req, context=CTX, timeout=45) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def as_float(v) -> float:
    try:
        return float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return 0.0


def region_desc(inner: dict) -> str:
    for key in ("landRegion", "packageRegion"):
        r = inner.get(key)
        if isinstance(r, dict) and r.get("desc"):
            return str(r["desc"]).strip()
    return ""


def deal_status(inner: dict) -> str:
    st = str(inner.get("landStatus") or "").strip()
    if st:
        return st
    ar = inner.get("auctionResult")
    if isinstance(ar, dict) and ar.get("desc"):
        return str(ar["desc"]).strip()
    return ""


def is_sold(inner: dict) -> bool:
    st = deal_status(inner)
    if SOLD_RE.search(st):
        return True
    ar = inner.get("auctionResult")
    if isinstance(ar, dict) and str(ar.get("name") or "").upper() == "CJ":
        return True
    return False


def map_row(inner: dict) -> dict | None:
    use = str(inner.get("usesCategoryStr") or "").strip()
    if not RESIDENTIAL_RE.search(use):
        return None
    area = as_float(inner.get("landArea"))
    start = as_float(inner.get("startingPrice"))
    if area <= 0 or start <= 0:
        return None
    pub = str(inner.get("publishTime") or "")[:10]
    land_no = str(inner.get("landNo") or "").strip()
    package = str(inner.get("packageCode") or "").strip()
    # 列表页深链（无单独详情结构化价）
    source_url = (
        f"https://szggzy.com/mobile/jygg/list.html?id=tdky&landNo={land_no}"
        if land_no
        else "https://szggzy.com/mobile/jygg/list.html?id=tdky"
    )
    return {
        "city": "深圳",
        "publish_date": pub,
        "deal_status": deal_status(inner),
        "district": region_desc(inner),
        "location": str(inner.get("landPosition") or "").strip(),
        "land_use": use,
        "area_sqm": f"{area:.2f}".rstrip("0").rstrip(".") if area else "0",
        "start_price_wan": f"{start:.2f}".rstrip("0").rstrip(".") if start else "0",
        "land_no": land_no,
        "package_code": package,
        "source_org": "深圳公共资源交易中心",
        "source_url": source_url,
    }


def crawl(pages: int, page_size: int, sold_only: bool) -> list[dict]:
    rows: list[dict] = []
    seen: set[str] = set()
    # 注意：该 API 的 pageNum 从 0 起算（pageNum=1 会跳过首页）
    for page in range(0, max(0, pages)):
        body = {
            "pageNum": page,
            "pageSize": page_size,
            "landUseLike": "居住",
        }
        if sold_only:
            body["transactionStatusEnum"] = "YCJ"
        raw = post_json(body)
        data = raw.get("data") or {}
        result = data.get("result") or []
        if page == 0:
            pb = data.get("pageBean") or {}
            print(f"pageBean count={pb.get('count')} pages={pb.get('pages')} pageSize={page_size}", flush=True)
        if not result:
            print(f"pageNum {page}: empty, stop", flush=True)
            break
        kept = 0
        for item in result:
            inner = item.get("data") if isinstance(item, dict) else None
            if not isinstance(inner, dict):
                continue
            if sold_only and not is_sold(inner):
                continue
            row = map_row(inner)
            if not row:
                continue
            key = row["land_no"] or f"{row['publish_date']}|{row['location']}|{row['start_price_wan']}"
            if key in seen:
                continue
            seen.add(key)
            rows.append(row)
            kept += 1
        print(f"pageNum {page}: got {len(result)}, kept cumulative {len(rows)} (+{kept})", flush=True)
        pb = data.get("pageBean") or {}
        total_pages = int(pb.get("pages") or 0)
        if total_pages and page + 1 >= total_pages:
            break
    rows.sort(key=lambda r: (r["publish_date"], float(r["start_price_wan"])), reverse=True)
    return rows


def atomic_write(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8-sig", newline="", delete=False, dir=str(path.parent), suffix=".tmp"
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser(description="Crawl Shenzhen residential land deals (start price)")
    ap.add_argument("--pages", type=int, default=6, help="max pages (default 6)")
    ap.add_argument("--page-size", type=int, default=50, help="page size (default 50)")
    ap.add_argument("--include-unsold", action="store_true", help="include non-sold parcels")
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    try:
        rows = crawl(args.pages, args.page_size, sold_only=not args.include_unsold)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    if len(rows) < 3:
        print(f"ERROR: too few rows ({len(rows)}), refuse overwrite", file=sys.stderr)
        return 2
    atomic_write(args.out, rows)
    print(f"wrote {args.out} n={len(rows)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

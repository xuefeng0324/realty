#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从国家外汇管理局抓取「国际收支货物和服务贸易」月度通稿 → CSV。

入口：https://www.safe.gov.cn/safe/whxw/index.html
口径：居民与非居民货物/服务进出口（亿美元）；月度初步数可能与季报不一致。
**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**。

用法：
  python scripts/crawl_safe_bop_trade.py
  python scripts/crawl_safe_bop_trade.py --max 36 --news-pages 24
"""
from __future__ import annotations

import argparse
import csv
import re
import ssl
import tempfile
import time
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "seed" / "safe_bop_trade.csv"
HOME_URL = "https://www.safe.gov.cn/"
NEWS_URL = "https://www.safe.gov.cn/safe/whxw/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
FIELDS = [
    "date",
    "goods_export_usd_yi",
    "goods_import_usd_yi",
    "goods_surplus_usd_yi",
    "services_export_usd_yi",
    "services_import_usd_yi",
    "services_surplus_usd_yi",
    "total_export_usd_yi",
    "total_import_usd_yi",
    "total_surplus_usd_yi",
    "source_url",
]


def fetch_text(url: str) -> str:
    raw = urlopen(Request(url, headers=UA), context=CTX, timeout=90).read()
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", "replace")


def abs_url(href: str) -> str:
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return "https://www.safe.gov.cn" + href
    return href


def news_list_urls(pages: int) -> list[str]:
    out = [NEWS_URL]
    for i in range(2, max(2, pages + 1)):
        out.append(f"https://www.safe.gov.cn/safe/whxw/index_{i}.html")
    return out


def list_notices(*htmls: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for html in htmls:
        for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*)</a>', html):
            title = unescape(re.sub(r"\s+", " ", m.group(2))).strip()
            if "货物和服务贸易" not in title and not (
                "货物贸易" in title and "国际收支" in title
            ):
                continue
            if "解读" in title and "公布" not in title:
                continue
            if not re.search(r"20\d{2}\s*年\s*\d{1,2}\s*月", title):
                continue
            out.append((abs_url(m.group(1)), title))
    seen: set[str] = set()
    uniq: list[tuple[str, str]] = []
    for url, title in out:
        if url in seen:
            continue
        seen.add(url)
        uniq.append((url, title))
    return uniq


def _f(v: float | None) -> str:
    if v is None:
        return ""
    return f"{v:g}"


def parse_body(html: str, source_url: str) -> dict[str, str] | None:
    text = unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)))
    text = re.sub(r"\s+", " ", text).replace("\ufeff", "")
    text = re.sub(r"(?<=\d)\s+(?=\d)", "", text)

    ym = re.search(
        r"按美元计值[，,]\s*(20\d{2})\s*年\s*(\d{1,2})\s*月[，,]\s*我国国际收支货物和服务贸易"
        r"出口\s*([\d.]+)\s*亿美元[，,]\s*进口\s*([\d.]+)\s*亿美元[，,]\s*顺差\s*([\d.]+)\s*亿美元",
        text,
    )
    if not ym:
        ym = re.search(
            r"(20\d{2})\s*年\s*(\d{1,2})\s*月[，,]\s*我国国际收支货物和服务贸易"
            r"出口\s*([\d.]+)\s*亿美元[，,]\s*进口\s*([\d.]+)\s*亿美元[，,]\s*顺差\s*([\d.]+)\s*亿美元",
            text,
        )
    if not ym:
        return None
    y, mo = int(ym.group(1)), int(ym.group(2))
    total_export = float(ym.group(3))
    total_import = float(ym.group(4))
    total_surplus = float(ym.group(5))

    goods_export = goods_import = goods_surplus = None
    services_export = services_import = services_surplus = None

    # HTML 表：项目 | 人民币 | 美元 —— 取美元列
    rows = re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", html, flags=re.I)
    section = ""
    for tr in rows:
        cells = [
            unescape(re.sub(r"<[^>]+>", "", c)).replace("\xa0", " ").strip()
            for c in re.findall(r"<t[hd][^>]*>([\s\S]*?)</t[hd]>", tr, flags=re.I)
        ]
        cells = [re.sub(r"\s+", " ", c) for c in cells if c]
        if len(cells) < 2:
            continue
        name = cells[0]
        # last numeric cell as USD
        nums = []
        for c in cells[1:]:
            c2 = c.replace(",", "").replace("−", "-").replace("—", "-")
            if re.fullmatch(r"-?\d+(?:\.\d+)?", c2):
                nums.append(float(c2))
        if not nums:
            continue
        usd = abs(nums[-1]) if "借方" in name else nums[-1]

        if name.startswith("1.货物") or name.startswith("1．货物"):
            section = "goods"
            goods_surplus = nums[-1]
            continue
        if name.startswith("2.服务") or name.startswith("2．服务"):
            section = "services"
            services_surplus = nums[-1]
            continue
        if name.startswith("2.") or name.startswith("货物和服务"):
            if "货物和服务" in name and "差额" in name:
                section = "total"
            elif name.startswith("2."):
                section = "services_detail"
            continue

        if name == "贷方":
            if section == "goods":
                goods_export = usd
            elif section == "services":
                services_export = usd
        elif name == "借方":
            if section == "goods":
                goods_import = usd
            elif section == "services":
                services_import = usd

    # 派生补齐
    if goods_export is not None and goods_import is not None and goods_surplus is None:
        goods_surplus = goods_export - goods_import
    if services_export is not None and services_import is not None and services_surplus is None:
        services_surplus = services_export - services_import

    return {
        "date": f"{y}-{mo:02d}-01",
        "goods_export_usd_yi": _f(goods_export),
        "goods_import_usd_yi": _f(goods_import),
        "goods_surplus_usd_yi": _f(goods_surplus),
        "services_export_usd_yi": _f(services_export),
        "services_import_usd_yi": _f(services_import),
        "services_surplus_usd_yi": _f(services_surplus),
        "total_export_usd_yi": _f(total_export),
        "total_import_usd_yi": _f(total_import),
        "total_surplus_usd_yi": _f(total_surplus),
        "source_url": source_url,
    }


def load_existing(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for k in FIELDS:
            r.setdefault(k, "")
    return rows


def atomic_write(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=str(path.parent), suffix=".tmp"
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in FIELDS})
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=36)
    ap.add_argument("--news-pages", type=int, default=24)
    ap.add_argument("--sleep", type=float, default=0.35)
    args = ap.parse_args()

    htmls: list[str] = []
    try:
        htmls.append(fetch_text(HOME_URL))
        print("[list] home ok")
    except Exception as exc:  # noqa: BLE001
        print(f"[list] home ERR {exc}")

    for u in news_list_urls(args.news_pages):
        try:
            htmls.append(fetch_text(u))
            print(f"[list] news {u.split('/')[-1]} ok")
            time.sleep(args.sleep)
        except Exception as exc:  # noqa: BLE001
            print(f"[list] news ERR {u}: {exc}")

    notices = list_notices(*htmls)[: args.max]
    print(f"[list] {len(notices)} notices")
    if not notices:
        return 1

    fresh: list[dict[str, str]] = []
    for i, (url, title) in enumerate(notices, 1):
        try:
            row = parse_body(fetch_text(url), url)
            if row:
                fresh.append(row)
                print(f"  [{i}/{len(notices)}] {row['date']} ok · {title[:40]}")
            else:
                print(f"  [{i}] parse fail · {title[:50]}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}] ERR {type(exc).__name__}: {exc}")
        time.sleep(args.sleep)

    by_date = {r["date"]: r for r in load_existing(OUT) if r.get("date")}
    for r in fresh:
        by_date[r["date"]] = r
    rows = sorted(by_date.values(), key=lambda x: x["date"], reverse=True)
    atomic_write(OUT, rows)
    with_goods = sum(1 for r in rows if r.get("goods_export_usd_yi"))
    print(f"[done] {len(rows)} (goods={with_goods}) → {OUT}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())

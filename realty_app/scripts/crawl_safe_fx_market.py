#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从国家外汇管理局抓取「中国外汇市场交易概况」月度通稿 → CSV。

入口：https://www.safe.gov.cn/safe/whxw/index.html（新闻分页）
口径：当月外汇市场总成交（万亿元人民币 / 万亿美元）及对客/银行间、即期/衍生品拆分；
      **≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**。

用法：
  python scripts/crawl_safe_fx_market.py
  python scripts/crawl_safe_fx_market.py --max 30 --news-pages 20
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
OUT = ROOT / "static" / "seed" / "safe_fx_market.csv"
HOME_URL = "https://www.safe.gov.cn/"
NEWS_URL = "https://www.safe.gov.cn/safe/whxw/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
FIELDS = [
    "date",
    "total_rmb_wan_yi",
    "total_usd_wan_yi",
    "client_rmb_wan_yi",
    "interbank_rmb_wan_yi",
    "spot_rmb_wan_yi",
    "derivative_rmb_wan_yi",
    "source_url",
]


def fetch_text(url: str) -> str:
    raw = urlopen(Request(url, headers=UA), context=CTX, timeout=60).read()
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
            if "外汇市场交易概况" not in title:
                continue
            if any(k in title for k in ("年报", "访谈", "答记者", "经营")):
                continue
            # 月度稿标题通常含「YYYY年M月」
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


def _num(m: re.Match[str] | None, g: int = 1) -> str:
    if not m:
        return ""
    return f"{float(m.group(g)):g}"


def parse_body(html: str, source_url: str) -> dict[str, str] | None:
    text = unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)))
    text = re.sub(r"\s+", " ", text).replace("\ufeff", "")
    text = re.sub(r"(?<=\d)\s+(?=\d)", "", text)

    m = re.search(
        r"(20\d{2})\s*年\s*(\d{1,2})\s*月[，,]\s*中国外汇市场[^。]{0,80}总计成交\s*([\d.]+)\s*万亿元人民币（等值\s*([\d.]+)\s*万亿美元）",
        text,
    )
    if not m:
        return None
    y, mo = int(m.group(1)), int(m.group(2))
    total_rmb = m.group(3)
    total_usd = m.group(4)

    client = _num(re.search(r"银行对客户市场成交\s*([\d.]+)\s*万亿元", text))
    interbank = _num(re.search(r"银行间市场成交\s*([\d.]+)\s*万亿元", text))
    spot = _num(re.search(r"即期市场累计成交\s*([\d.]+)\s*万亿元", text))
    derivative = _num(re.search(r"衍生品市场累计成交\s*([\d.]+)\s*万亿元", text))

    return {
        "date": f"{y}-{mo:02d}-01",
        "total_rmb_wan_yi": total_rmb,
        "total_usd_wan_yi": total_usd,
        "client_rmb_wan_yi": client,
        "interbank_rmb_wan_yi": interbank,
        "spot_rmb_wan_yi": spot,
        "derivative_rmb_wan_yi": derivative,
        "source_url": source_url,
    }


def load_existing(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def atomic_write(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=str(path.parent), suffix=".tmp"
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=30)
    ap.add_argument("--news-pages", type=int, default=20)
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
            body = fetch_text(url)
            row = parse_body(body, url)
            print(f"  [{i}/{len(notices)}] {title[:42]} → {'ok' if row else 'skip'}")
            if row:
                fresh.append(row)
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}] ERR {type(exc).__name__}: {exc}")
        time.sleep(args.sleep)

    by_date = {r["date"]: r for r in load_existing(OUT) if r.get("date")}
    for r in fresh:
        by_date[r["date"]] = r
    rows = sorted(by_date.values(), key=lambda x: x["date"], reverse=True)
    atomic_write(OUT, rows)
    print(f"[done] {len(rows)} → {OUT}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())

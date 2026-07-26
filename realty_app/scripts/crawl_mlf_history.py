#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从央行抓取「中期借贷便利（MLF）开展情况」公告 → CSV。

列表：http://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125437/125446/125873/index.html
口径：政策操作利率/投放量；**≠ 房价、≠ 挂牌、≠ 网签**；可与 LPR 对照。

用法：
  python scripts/crawl_mlf_history.py
  python scripts/crawl_mlf_history.py --max 36
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
OUT = ROOT / "static" / "seed" / "mlf_history.csv"
LIST_URL = "http://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125437/125446/125873/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
FIELDS = ["date", "mlf_1y_pct", "amount_yi", "balance_yi", "source_url"]


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
        return "http://www.pbc.gov.cn" + href
    return href


def list_notices(html: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*中期借贷便利[^<]*)</a>', html):
        title = unescape(m.group(2)).strip()
        if "开展情况" not in title and "操作" not in title:
            # 仍保留「开展情况」主系列；招标公告利率可能未出
            if "招标" in title:
                continue
        if "开展情况" not in title:
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


def parse_body(html: str, source_url: str) -> list[dict[str, str]]:
    text = unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)))
    text = re.sub(r"\s+", " ", text)
    rows: list[dict[str, str]] = []
    balance_m = re.search(r"余额为\s*([\d.]+)\s*亿元", text)

    # 多日操作：7月15日操作1000亿元，利率为2.50%
    multi = list(
        re.finditer(
            r"(20\d{2})年(\d{1,2})月(\d{1,2})日操作\s*([\d.]+)\s*亿元[，,]\s*利率为\s*([\d.]+)\s*%",
            text,
        )
    )
    if multi:
        for m in multi:
            y, mo, d, amt, rate = m.groups()
            rows.append(
                {
                    "date": f"{y}-{int(mo):02d}-{int(d):02d}",
                    "mlf_1y_pct": rate,
                    "amount_yi": amt,
                    "balance_yi": balance_m.group(1) if balance_m else "",
                    "source_url": source_url,
                }
            )
        return rows

    # 单日：2025年2月25日，人民银行开展3000亿元…中标利率2.00%
    m = re.search(
        r"(20\d{2})年(\d{1,2})月(\d{1,2})日[，,]?人民银行开展\s*([\d.]+)\s*亿元中期借贷便利"
        r".{0,80}?中标利率\s*([\d.]+)\s*%",
        text,
    )
    if m:
        y, mo, d, amt, rate = m.groups()
        rows.append(
            {
                "date": f"{y}-{int(mo):02d}-{int(d):02d}",
                "mlf_1y_pct": rate,
                "amount_yi": amt,
                "balance_yi": balance_m.group(1) if balance_m else "",
                "source_url": source_url,
            }
        )
    return rows


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
    ap.add_argument("--max", type=int, default=24)
    ap.add_argument("--sleep", type=float, default=0.4)
    args = ap.parse_args()

    list_html = fetch_text(LIST_URL)
    notices = list_notices(list_html)
    # 分页：index_2.html …
    last = 1
    for m in re.finditer(r"index_(\d+)\.html", list_html):
        last = max(last, int(m.group(1)))
    for page in range(2, min(last, 12) + 1):
        page_url = LIST_URL.replace("/index.html", f"/index_{page}.html")
        try:
            notices.extend(list_notices(fetch_text(page_url)))
            time.sleep(args.sleep)
        except Exception as exc:  # noqa: BLE001
            print(f"[list] page {page} ERR {exc}")
            break
    # de-dup
    seen_u: set[str] = set()
    uniq_n: list[tuple[str, str]] = []
    for url, title in notices:
        if url in seen_u:
            continue
        seen_u.add(url)
        uniq_n.append((url, title))
    notices = uniq_n[: args.max]
    print(f"[list] {len(notices)} notices (pages≤{last})")
    if not notices:
        print(list_html[:300])
        return 1

    fresh: list[dict[str, str]] = []
    for i, (url, title) in enumerate(notices, 1):
        try:
            body = fetch_text(url)
            rows = parse_body(body, url)
            print(f"  [{i}/{len(notices)}] {title[:40]} → {len(rows)}")
            fresh.extend(rows)
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}] ERR {type(exc).__name__}: {exc}")
        time.sleep(args.sleep)

    by_date = {r["date"]: r for r in load_existing(OUT)}
    for r in fresh:
        by_date[r["date"]] = r
    rows = sorted(by_date.values(), key=lambda x: x["date"], reverse=True)
    atomic_write(OUT, rows)
    print(f"[done] {len(rows)} → {OUT}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())

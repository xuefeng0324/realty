#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从央行抓取「金融统计数据报告」→ CSV（社融/M2/住户贷款等）。

列表：http://www.pbc.gov.cn/diaochatongjisi/116219/116225/index.html
口径：全国金融统计；**≠ 房价、≠ 挂牌、≠ 网签、≠ 70城**。住户中长期贷款仅为贷款结构代理，非按揭成交。

用法：
  python scripts/crawl_pbc_fin_stats.py
  python scripts/crawl_pbc_fin_stats.py --max 18
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
OUT = ROOT / "static" / "seed" / "pbc_fin_stats.csv"
LIST_URL = "http://www.pbc.gov.cn/diaochatongjisi/116219/116225/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
FIELDS = [
    "period",
    "label",
    "sf_stock_wan_yi",
    "sf_stock_yoy_pct",
    "sf_flow_ytd_wan_yi",
    "m2_wan_yi",
    "m2_yoy_pct",
    "m1_wan_yi",
    "m1_yoy_pct",
    "rmb_loan_ytd_wan_yi",
    "hh_loan_ytd_yi",
    "hh_ml_loan_ytd_yi",
    "ib_repo_pct",
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
        return "http://www.pbc.gov.cn" + href
    return href


def list_notices(html: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*金融统计数据报告[^<]*)</a>', html):
        title = unescape(m.group(2)).strip()
        if "地区" in title:
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


def period_from_title(title: str) -> tuple[str, str] | None:
    m = re.search(r"(20\d{2})年(\d{1,2})月", title)
    if m:
        y, mo = int(m.group(1)), int(m.group(2))
        return f"{y}-{mo:02d}", f"{y}年{mo}月"
    m = re.search(r"(20\d{2})年上半年", title)
    if m:
        y = int(m.group(1))
        return f"{y}-06", f"{y}年上半年"
    m = re.search(r"(20\d{2})年一季度", title)
    if m:
        y = int(m.group(1))
        return f"{y}-03", f"{y}年一季度"
    m = re.search(r"(20\d{2})年前三季度", title)
    if m:
        y = int(m.group(1))
        return f"{y}-09", f"{y}年前三季度"
    m = re.search(r"(20\d{2})年金融统计数据报告", title)
    if m and "月" not in title and "季" not in title and "半年" not in title:
        y = int(m.group(1))
        return f"{y}-12", f"{y}年全年"
    return None


def _num(s: str | None) -> str:
    if not s:
        return ""
    return s.replace(",", "").strip()


def _signed_amount(verb: str, amount: str, wan: str | None) -> str:
    n = float(amount)
    if wan:
        n *= 10000  # 万亿元 → 亿元
    if verb == "减少":
        n = -n
    return f"{n:g}"


def parse_body(html: str, title: str, source_url: str) -> dict[str, str] | None:
    text = unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)))
    text = re.sub(r"\s+", " ", text).replace("\ufeff", "")
    per = period_from_title(title)
    if not per:
        return None
    period, label = per

    sf = re.search(
        r"社会融资规模存量为\s*([\d.]+)\s*万亿元[，,]\s*同比增长\s*([\d.]+)\s*%",
        text,
    )
    flow = re.search(r"社会融资规模增量累计为\s*([\d.]+)\s*万亿元", text)
    m2 = re.search(
        r"广义货币\s*[(\uff08]\s*M2\s*[)\uff09]\s*余额\s*([\d.]+)\s*万亿元\s*[,，]?\s*同比增长\s*([\d.]+)\s*%",
        text,
    )
    m1 = re.search(
        r"狭义货币\s*[(\uff08]\s*M1\s*[)\uff09]\s*余额\s*([\d.]+)\s*万亿元\s*[,，]?\s*同比增长\s*([\d.]+)\s*%",
        text,
    )
    loan = re.search(r"人民币贷款增加\s*([\d.]+)\s*万亿元", text)
    hh = re.search(
        r"住户贷款(增加|减少)\s*([\d.]+)\s*(万)?亿元[，,]其中[，,]短期贷款[^；]{0,80}?"
        r"中长期贷款(增加|减少)\s*([\d.]+)\s*(万)?亿元",
        text,
    )
    repo = re.search(r"质押式(?:债券)?回购(?:月)?加权平均利率为\s*([\d.]+)\s*%", text)

    # 2025 中段部分报告无社融存量段，仅有 M2/贷款；有社融或有 M2 即可入库
    if not (sf or m2):
        return None

    return {
        "period": period,
        "label": label,
        "sf_stock_wan_yi": _num(sf.group(1)) if sf else "",
        "sf_stock_yoy_pct": _num(sf.group(2)) if sf else "",
        "sf_flow_ytd_wan_yi": _num(flow.group(1)) if flow else "",
        "m2_wan_yi": _num(m2.group(1)) if m2 else "",
        "m2_yoy_pct": _num(m2.group(2)) if m2 else "",
        "m1_wan_yi": _num(m1.group(1)) if m1 else "",
        "m1_yoy_pct": _num(m1.group(2)) if m1 else "",
        "rmb_loan_ytd_wan_yi": _num(loan.group(1)) if loan else "",
        "hh_loan_ytd_yi": _signed_amount(hh.group(1), hh.group(2), hh.group(3)) if hh else "",
        "hh_ml_loan_ytd_yi": _signed_amount(hh.group(4), hh.group(5), hh.group(6)) if hh else "",
        "ib_repo_pct": _num(repo.group(1)) if repo else "",
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
    ap.add_argument("--max", type=int, default=18)
    ap.add_argument("--sleep", type=float, default=0.35)
    args = ap.parse_args()

    list_html = fetch_text(LIST_URL)
    notices = list_notices(list_html)
    last = 1
    for m in re.finditer(r"index_(\d+)\.html", list_html):
        last = max(last, int(m.group(1)))
    for page in range(2, min(last, 4) + 1):
        page_url = LIST_URL.replace("/index.html", f"/index_{page}.html")
        try:
            notices.extend(list_notices(fetch_text(page_url)))
            time.sleep(args.sleep)
        except Exception as exc:  # noqa: BLE001
            print(f"[list] page {page} ERR {exc}")
            break

    seen_u: set[str] = set()
    uniq: list[tuple[str, str]] = []
    for url, title in notices:
        if url in seen_u:
            continue
        seen_u.add(url)
        uniq.append((url, title))
    notices = uniq[: args.max]
    print(f"[list] {len(notices)} reports (pages≤{last})")
    if not notices:
        return 1

    fresh: list[dict[str, str]] = []
    for i, (url, title) in enumerate(notices, 1):
        try:
            body = fetch_text(url)
            row = parse_body(body, title, url)
            print(f"  [{i}/{len(notices)}] {title[:36]} → {'ok' if row else 'skip'}")
            if row:
                fresh.append(row)
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}] ERR {type(exc).__name__}: {exc}")
        time.sleep(args.sleep)

    by_period = {r["period"]: r for r in load_existing(OUT)}
    for r in fresh:
        by_period[r["period"]] = r
    rows = sorted(by_period.values(), key=lambda x: x["period"], reverse=True)
    atomic_write(OUT, rows)
    print(f"[done] {len(rows)} → {OUT}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())

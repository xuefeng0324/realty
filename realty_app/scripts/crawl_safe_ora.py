#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从国家外汇管理局「官方储备资产」年表抓取月度分项 → CSV。

入口：https://www.safe.gov.cn/safe/gfcbzc/index.html
口径：月末官方储备资产（亿美元）分项——外汇储备 / IMF 储备头寸 / SDR / 黄金 / 其他 / 合计；
黄金另记持有量（万盎司）。**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**。
可与「外汇储备规模」通稿交叉（通稿外储 ≈ 本表「1.外汇储备」）。

用法：
  python scripts/crawl_safe_ora.py
  python scripts/crawl_safe_ora.py --years 2024,2025,2026
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
OUT = ROOT / "static" / "seed" / "safe_ora.csv"
INDEX_URL = "https://www.safe.gov.cn/safe/gfcbzc/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
FIELDS = [
    "date",
    "forex_usd_yi",
    "imf_usd_yi",
    "sdr_usd_yi",
    "gold_usd_yi",
    "gold_oz_wan",
    "other_usd_yi",
    "total_usd_yi",
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


def list_year_pages(html: str) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*官方储备资产[^<]*)</a>', html):
        title = unescape(re.sub(r"\s+", " ", m.group(2))).strip()
        ym = re.search(r"(20\d{2})", title)
        if not ym:
            continue
        out.append((int(ym.group(1)), abs_url(m.group(1))))
    # dedupe by year, prefer later listing order first occurrence
    seen: set[int] = set()
    uniq: list[tuple[int, str]] = []
    for y, u in out:
        if y in seen:
            continue
        seen.add(y)
        uniq.append((y, u))
    return uniq


def _cell_text(td: str) -> str:
    t = unescape(re.sub(r"<[^>]+>", "", td))
    return re.sub(r"\s+", " ", t.replace("\xa0", " ")).strip()


def _nums(cells: list[str]) -> list[float]:
    out: list[float] = []
    for c in cells:
        c2 = c.replace(",", "").replace("−", "-").replace("—", "")
        if re.fullmatch(r"-?\d+(?:\.\d+)?", c2):
            out.append(float(c2))
    return out


def parse_year_table(html: str, year: int, source_url: str) -> list[dict[str, str]]:
    rows_html = re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", html, flags=re.I)
    months: list[int] = []
    forex: list[float] = []
    imf: list[float] = []
    sdr: list[float] = []
    gold: list[float] = []
    gold_oz: list[float] = []
    other: list[float] = []
    total: list[float] = []

    for tr in rows_html:
        cells = [_cell_text(c) for c in re.findall(r"<t[hd][^>]*>([\s\S]*?)</t[hd]>", tr, flags=re.I)]
        cells = [c for c in cells if c]
        if not cells:
            continue
        head = cells[0]
        # header months: 2026.01 ...
        if "Item" in head or head.startswith("项目"):
            ms = []
            for c in cells[1:]:
                m = re.match(rf"{year}\.(\d{{1,2}})$", c.strip())
                if m:
                    ms.append(int(m.group(1)))
            if ms:
                months = ms
            continue
        if "亿美元" in head or "100million" in head:
            continue

        nums = _nums(cells[1:])
        # USD columns are even indices in USD/SDR pairs
        usd = nums[0::2] if len(nums) >= 2 else nums

        if "外汇储备" in head or "Foreign currency reserves" in head:
            if usd:
                forex = usd
        elif "储备头寸" in head or "IMF reserve position" in head:
            if usd:
                imf = usd
        elif head.strip().startswith("3.") or (
            "SDRs" in head and "注" not in head and "特别提款权" in head
        ):
            if usd:
                sdr = usd
        elif ("黄金" in head or "Gold" in head) and "盎司" not in head:
            if usd:
                gold = usd
        elif "万盎司" in "".join(cells) or (
            "盎司" in "".join(cells) and not head.startswith("4.")
        ):
            oz_nums: list[float] = []
            for c in cells:
                m = re.search(r"([\d.]+)\s*万?盎司", c)
                if m:
                    oz_nums.append(float(m.group(1)))
                    continue
                n = _nums([c])
                if n:
                    oz_nums.append(n[0])
            if oz_nums:
                # 官方表 USD/SDR 两列重复同一盎司 → 成对相等时隔列取样
                if (
                    len(oz_nums) >= 2
                    and len(oz_nums) % 2 == 0
                    and all(
                        abs(oz_nums[i] - oz_nums[i + 1]) < 1e-6
                        for i in range(0, len(oz_nums), 2)
                    )
                ):
                    gold_oz = oz_nums[0::2]
                else:
                    gold_oz = oz_nums
        elif "其他储备资产" in head or "Other reserve assets" in head:
            if usd:
                other = usd
        elif head.startswith("合计") or head.startswith("Total"):
            if usd:
                total = usd

    if not months:
        return []

    out: list[dict[str, str]] = []
    for i, mo in enumerate(months):
        def g(arr: list[float]) -> str:
            if i >= len(arr):
                return ""
            v = arr[i]
            return f"{v:g}"

        fx = g(forex)
        tot = g(total)
        if not fx and not tot:
            continue
        out.append(
            {
                "date": f"{year}-{mo:02d}-01",
                "forex_usd_yi": fx,
                "imf_usd_yi": g(imf),
                "sdr_usd_yi": g(sdr),
                "gold_usd_yi": g(gold),
                "gold_oz_wan": g(gold_oz),
                "other_usd_yi": g(other),
                "total_usd_yi": tot,
                "source_url": source_url,
            }
        )
    return out


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
    ap.add_argument("--years", default="", help="comma years, empty=all from index")
    ap.add_argument("--sleep", type=float, default=0.35)
    args = ap.parse_args()

    index = fetch_text(INDEX_URL)
    pages = list_year_pages(index)
    print(f"[index] {len(pages)} year pages")
    want: set[int] | None = None
    if args.years.strip():
        want = {int(x.strip()) for x in args.years.split(",") if x.strip()}
        pages = [(y, u) for y, u in pages if y in want]

    fresh: list[dict[str, str]] = []
    for i, (year, url) in enumerate(pages, 1):
        try:
            html = fetch_text(url)
            rows = parse_year_table(html, year, url)
            print(f"  [{i}/{len(pages)}] {year} → {len(rows)} months ({url})")
            fresh.extend(rows)
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}] ERR {year} {type(exc).__name__}: {exc}")
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

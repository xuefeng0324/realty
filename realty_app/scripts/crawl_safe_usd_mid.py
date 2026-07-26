#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从国家外汇管理局 RMBQuery 抓取人民币汇率中间价（日度）→ CSV。

入口：https://www.safe.gov.cn/AppStructured/hlw/RMBQuery.do
口径：官网「100 外币折合人民币」原标价；美元另派生 usd_cny=÷100。
列顺序与官网表一致：美元 / 欧元 / 日元 / 港元 / 英镑 …
**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**。

用法：
  python scripts/crawl_safe_usd_mid.py
  python scripts/crawl_safe_usd_mid.py --months 18
"""
from __future__ import annotations

import argparse
import csv
import re
import ssl
import tempfile
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "seed" / "safe_usd_mid.csv"
QUERY_URL = "https://www.safe.gov.cn/AppStructured/hlw/RMBQuery.do"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
# 官网 InfoTable：日期后依次为 美元 欧元 日元 港元 英镑 …
FIELDS = [
    "date",
    "usd_cny",
    "usd_per100",
    "eur_per100",
    "jpy_per100",
    "hkd_per100",
    "gbp_per100",
    "source_url",
]
ROW_RE = re.compile(
    r"<tr[^>]*>\s*<td[^>]*>\s*(20\d{2}-\d{2}-\d{2})\s*</td>"
    r"((?:\s*<td[^>]*>\s*[\d.]+\s*</td>)+)",
    flags=re.I,
)
TD_NUM_RE = re.compile(r"<td[^>]*>\s*([\d.]+)\s*</td>", flags=re.I)


def fetch(url: str, data: bytes | None = None) -> str:
    headers = dict(UA)
    if data is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=data, headers=headers)
    raw = urllib.request.urlopen(req, context=CTX, timeout=90).read()
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", "replace")


def month_windows(months: int, end: date | None = None) -> list[tuple[date, date]]:
    """按月切窗，避免一次查询过长。"""
    end = end or date.today()
    windows: list[tuple[date, date]] = []
    y, m = end.year, end.month
    for _ in range(max(1, months)):
        start = date(y, m, 1)
        if m == 12:
            nxt = date(y + 1, 1, 1)
        else:
            nxt = date(y, m + 1, 1)
        win_end = min(end, nxt - timedelta(days=1))
        windows.append((start, win_end))
        if m == 1:
            y, m = y - 1, 12
        else:
            m -= 1
    return windows


def _f(vals: list[str], i: int) -> str:
    if i >= len(vals):
        return ""
    try:
        v = float(vals[i])
    except ValueError:
        return ""
    return f"{v:g}" if v > 0 else ""


def query_range(start: date, end: date) -> list[dict[str, str]]:
    body = urllib.parse.urlencode(
        {
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "queryYN": "true",
        }
    ).encode()
    html = fetch(QUERY_URL, body)
    out: list[dict[str, str]] = []
    for d, tds_html in ROW_RE.findall(html):
        nums = TD_NUM_RE.findall(tds_html)
        usd_raw = _f(nums, 0)
        if not usd_raw:
            continue
        usd = float(usd_raw) / 100.0
        out.append(
            {
                "date": d,
                "usd_cny": f"{usd:.4f}",
                "usd_per100": usd_raw,
                "eur_per100": _f(nums, 1),
                "jpy_per100": _f(nums, 2),
                "hkd_per100": _f(nums, 3),
                "gbp_per100": _f(nums, 4),
                "source_url": QUERY_URL,
            }
        )
    return out


def load_existing(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def normalize_row(r: dict[str, str]) -> dict[str, str]:
    out = {k: str(r.get(k) or "").strip() for k in FIELDS}
    if not out["usd_cny"] and out["usd_per100"]:
        try:
            out["usd_cny"] = f"{float(out['usd_per100']) / 100.0:.4f}"
        except ValueError:
            pass
    return out


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
    ap.add_argument("--months", type=int, default=18)
    ap.add_argument("--sleep", type=float, default=0.4)
    args = ap.parse_args()

    fresh: list[dict[str, str]] = []
    wins = month_windows(args.months)
    print(f"[list] {len(wins)} month windows")
    for i, (a, b) in enumerate(wins, 1):
        try:
            rows = query_range(a, b)
            print(f"  [{i}/{len(wins)}] {a}..{b} → {len(rows)}")
            fresh.extend(rows)
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}] ERR {type(exc).__name__}: {exc}")
        time.sleep(args.sleep)

    by_date = {
        r["date"]: normalize_row(r) for r in load_existing(OUT) if r.get("date")
    }
    for r in fresh:
        by_date[r["date"]] = normalize_row(r)
    rows = sorted(by_date.values(), key=lambda x: x["date"], reverse=True)
    atomic_write(OUT, rows)
    with_eur = sum(1 for r in rows if r.get("eur_per100"))
    with_hkd = sum(1 for r in rows if r.get("hkd_per100"))
    print(f"[done] {len(rows)} (eur={with_eur} hkd={with_hkd}) → {OUT}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取上海银行间同业拆放利率（Shibor）→ CSV。

最新：https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/shibor/shibor.json
历史：https://www.chinamoney.com.cn/ags/ms/cm-u-bk-shibor/ShiborHis?startDate=&endDate=

口径：同业拆放利率（%）；**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**；可与 LPR/MLF/国债收益率对照。

用法：
  python scripts/crawl_shibor.py
  python scripts/crawl_shibor.py --backfill-days 45
"""
from __future__ import annotations

import argparse
import csv
import json
import ssl
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "seed" / "shibor.csv"
LATEST_URL = "https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/shibor/shibor.json"
HIS_URL = "https://www.chinamoney.com.cn/ags/ms/cm-u-bk-shibor/ShiborHis"
PAGE_URL = "https://www.chinamoney.com.cn/chinese/bkshibor/"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
TERM_MAP = {
    "O/N": "on",
    "ON": "on",
    "1W": "w1",
    "2W": "w2",
    "1M": "m1",
    "3M": "m3",
    "6M": "m6",
    "9M": "m9",
    "1Y": "y1",
}
FIELDS = [
    "date",
    "on",
    "w1",
    "w2",
    "m1",
    "m3",
    "m6",
    "m9",
    "y1",
    "source",
    "source_url",
]


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
        return r.read()


def n(v) -> float | None:
    try:
        x = float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return x if x == x else None


def row_from_terms(d: str, terms: dict[str, float | None], source: str, url: str) -> dict[str, str] | None:
    on = terms.get("on")
    if on is None or not (on > 0):
        return None
    out = {
        "date": d,
        "on": f"{on:.4f}".rstrip("0").rstrip(".") if on else "",
        "source": source,
        "source_url": url,
    }
    for k in ("w1", "w2", "m1", "m3", "m6", "m9", "y1"):
        v = terms.get(k)
        out[k] = f"{v:.4f}".rstrip("0").rstrip(".") if v is not None else ""
    return out


def parse_latest(raw: bytes) -> dict[str, str] | None:
    payload = json.loads(raw.decode("utf-8"))
    show = str((payload.get("data") or {}).get("showDateCN") or "")
    d = show[:10]
    if not d:
        return None
    terms: dict[str, float | None] = {}
    for rec in payload.get("records") or []:
        code = str(rec.get("termCode") or rec.get("termCodePath") or "").strip()
        key = TERM_MAP.get(code)
        if not key:
            continue
        terms[key] = n(rec.get("shibor"))
    return row_from_terms(d, terms, "latest_json", LATEST_URL)


def fetch_history(start: str, end: str) -> list[dict[str, str]]:
    qs = urllib.parse.urlencode({"lang": "CN", "startDate": start, "endDate": end})
    url = f"{HIS_URL}?{qs}"
    payload = json.loads(fetch(url).decode("utf-8"))
    rows: list[dict[str, str]] = []
      for rec in payload.get("records") or []:
        d = str(rec.get("showDateCN") or "").strip()
        if not d:
            continue
        terms = {
            "on": n(rec.get("ON")),
            "w1": n(rec.get("1W")),
            "w2": n(rec.get("2W")),
            "m1": n(rec.get("1M")),
            "m3": n(rec.get("3M")),
            "m6": n(rec.get("6M")),
            "m9": n(rec.get("9M")),
            "y1": n(rec.get("1Y")),
        }
        row = row_from_terms(d, terms, "his_api", HIS_URL)
        if row:
            rows.append(row)
    return rows


def load_existing() -> dict[str, dict[str, str]]:
    if not OUT.exists():
        return {}
    with OUT.open(encoding="utf-8-sig", newline="") as f:
        return {row["date"]: row for row in csv.DictReader(f) if row.get("date")}


def write_rows(by_date: dict[str, dict[str, str]]) -> None:
    ordered = sorted(by_date.values(), key=lambda r: str(r.get("date", "")), reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=str(OUT.parent), suffix=".tmp"
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        for r in ordered:
            w.writerow({k: r.get(k, "") for k in FIELDS})
        tmp_path = Path(tmp.name)
    tmp_path.replace(OUT)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill-days", type=int, default=45)
    ap.add_argument("--no-latest", action="store_true")
    ap.add_argument("--sleep", type=float, default=0.2)
    args = ap.parse_args()

    by_date = load_existing()
    touched: list[str] = []

    if args.backfill_days > 0:
        end = date.today()
        start = end - timedelta(days=max(args.backfill_days, 1))
        # API 可能限制单次窗长，按 30 天切片
        cur = start
        while cur <= end:
            chunk_end = min(cur + timedelta(days=29), end)
            try:
                rows = fetch_history(cur.isoformat(), chunk_end.isoformat())
                for row in rows:
                    d = row["date"]
                    prev = by_date.get(d)
                    if prev and prev.get("source") == "latest_json":
                        continue
                    by_date[d] = row
                    touched.append(d)
                print(f"[ok] his {cur}..{chunk_end} n={len(rows)}")
            except Exception as e:  # noqa: BLE001
                print(f"[warn] his {cur}..{chunk_end}: {e}", file=sys.stderr)
            time.sleep(args.sleep)
            cur = chunk_end + timedelta(days=1)

    if not args.no_latest:
        try:
            latest = parse_latest(fetch(LATEST_URL))
            if not latest:
                raise RuntimeError("latest json 解析失败")
            by_date[latest["date"]] = latest
            touched.append(latest["date"])
            print(f"[ok] latest {latest['date']} on={latest['on']}")
        except Exception as e:  # noqa: BLE001
            if not by_date:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_date:
        raise RuntimeError("无 Shibor 可写")
    write_rows(by_date)
    print(f"wrote {OUT} days={len(by_date)} touched={len(set(touched))} page={PAGE_URL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

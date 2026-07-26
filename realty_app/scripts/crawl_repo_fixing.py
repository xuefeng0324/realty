#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取回购定盘利率 / 银银间回购定盘利率 → CSV。

最新：
  https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/currency/frr.json
  https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/currency/fdr.json
历史：
  https://www.chinamoney.com.cn/ags/ms/cm-u-bk-currency/FrrHis?startDate=&endDate=

口径：FR001/007/014、FDR001/007/014（%）；FDR 基于银银间 DR 加权成交定盘。
**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**；可与 Shibor / 逆回购 / LPR 对照。

用法：
  python scripts/crawl_repo_fixing.py
  python scripts/crawl_repo_fixing.py --backfill-days 45
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
OUT = ROOT / "static" / "seed" / "repo_fixing.csv"
FRR_URL = "https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/currency/frr.json"
FDR_URL = "https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/currency/fdr.json"
HIS_URL = "https://www.chinamoney.com.cn/ags/ms/cm-u-bk-currency/FrrHis"
PAGE_URL = "https://www.chinamoney.com.cn/chinese/bkfrr/"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
CODES = ("FR001", "FR007", "FR014", "FDR001", "FDR007", "FDR014")
FIELD_OF = {
    "FR001": "fr001",
    "FR007": "fr007",
    "FR014": "fr014",
    "FDR001": "fdr001",
    "FDR007": "fdr007",
    "FDR014": "fdr014",
}
FIELDS = [
    "date",
    "fr001",
    "fr007",
    "fr014",
    "fdr001",
    "fdr007",
    "fdr014",
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


def fmt(v: float | None) -> str:
    if v is None:
        return ""
    return f"{v:.4f}".rstrip("0").rstrip(".")


def row_from_map(d: str, vals: dict[str, float | None], source: str, url: str) -> dict[str, str] | None:
    if not d:
        return None
    out = {"date": d, "source": source, "source_url": url}
    for field in FIELD_OF.values():
        out[field] = fmt(vals.get(field))
    if not out["fr007"] and not out["fdr007"]:
        return None
    return out


def parse_latest_pair() -> dict[str, str] | None:
    frr = json.loads(fetch(FRR_URL).decode("utf-8"))
    fdr = json.loads(fetch(FDR_URL).decode("utf-8"))
    show = str((frr.get("data") or {}).get("showDateCN") or "")[:10]
    if not show:
        show = str((fdr.get("data") or {}).get("showDateCN") or "")[:10]
    vals: dict[str, float | None] = {f: None for f in FIELD_OF.values()}
    for payload in (frr, fdr):
        for rec in payload.get("records") or []:
            code = str(rec.get("productCode") or "").strip().upper()
            field = FIELD_OF.get(code)
            if not field:
                continue
            vals[field] = n(rec.get("value"))
            if not show:
                show = str(rec.get("produceDate") or "")[:10]
    return row_from_map(show, vals, "latest_json", FRR_URL)


def fetch_history(start: str, end: str) -> list[dict[str, str]]:
    qs = urllib.parse.urlencode({"lang": "CN", "startDate": start, "endDate": end})
    url = f"{HIS_URL}?{qs}"
    payload = json.loads(fetch(url).decode("utf-8"))
    rows: list[dict[str, str]] = []
    for rec in payload.get("records") or []:
        m = rec.get("frValueMap") or {}
        d = str(m.get("date") or rec.get("lfiProducDate") or "").strip()
        vals = {FIELD_OF[c]: n(m.get(c)) for c in CODES}
        row = row_from_map(d, vals, "his_api", HIS_URL)
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
            latest = parse_latest_pair()
            if not latest:
                raise RuntimeError("latest frr/fdr 解析失败")
            by_date[latest["date"]] = latest
            touched.append(latest["date"])
            print(
                f"[ok] latest {latest['date']} fr007={latest['fr007']} fdr007={latest['fdr007']}"
            )
        except Exception as e:  # noqa: BLE001
            if not by_date:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_date:
        raise RuntimeError("无回购定盘利率可写")
    write_rows(by_date)
    print(f"wrote {OUT} days={len(by_date)} touched={len(set(touched))} page={PAGE_URL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

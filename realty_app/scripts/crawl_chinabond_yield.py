#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取中债国债收益率曲线关键期限 → CSV。

最新：https://yield.chinabond.com.cn/cbweb-cbrc-web/cbrc/showCbrc （监管展示表）
历史：中债 yc/searchXyFxsyl API（按交易日回填；与展示表可能有微小差异，最新日以 HTML 为准覆盖）

口径：国债到期收益率（%）；**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**；可与 LPR/MLF/逆回购对照。

用法：
  python scripts/crawl_chinabond_yield.py
  python scripts/crawl_chinabond_yield.py --backfill-days 60
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import ssl
import sys
import tempfile
import time
import urllib.request
from datetime import date, timedelta
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "seed" / "chinabond_yield.csv"
LATEST_URL = "https://yield.chinabond.com.cn/cbweb-cbrc-web/cbrc/showCbrc"
TREE_URL = "https://yield.chinabond.com.cn/cbweb-mn/yc/queryTree?locale=zh_CN"
API_TMPL = (
    "https://yield.chinabond.com.cn/cbweb-mn/yc/searchXyFxsyl"
    "?xyzSelect=txy&&workTimes={date}&&dxbj=4&&qxll=1,&&yqqxN=N&&yqqxK=K"
    "&&ycDefIds={ycid},&&locale=zh_CN"
)
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
CURVE_NAME = "中债国债收益率曲线"
TENORS = [
    ("y3m", 0.25),
    ("y6m", 0.5),
    ("y1y", 1.0),
    ("y3y", 3.0),
    ("y5y", 5.0),
    ("y7y", 7.0),
    ("y10y", 10.0),
    ("y30y", 30.0),
]
FIELDS = [
    "date",
    "y3m",
    "y6m",
    "y1y",
    "y3y",
    "y5y",
    "y7y",
    "y10y",
    "y30y",
    "spread_10y_1y",
    "source",
    "source_url",
]


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_cell = False
        self.in_row = False
        self.cell: list[str] = []
        self.row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "tr":
            self.in_row = True
            self.row = []
        elif self.in_row and tag in {"td", "th"}:
            self.in_cell = True
            self.cell = []

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self.in_cell:
            self.row.append(" ".join("".join(self.cell).split()))
            self.in_cell = False
        elif tag == "tr" and self.in_row:
            if self.row:
                self.rows.append(self.row)
            self.in_row = False


def fetch(url: str, data: bytes | None = None) -> str:
    headers = dict(UA)
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, context=CTX, timeout=60) as resp:
        raw = resp.read()
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", "replace")


def _f(v: float | None) -> str:
    if v is None:
        return ""
    return f"{v:g}"


def _round4(v: float) -> float:
    return round(v, 4)


def pick_tenor(series: list[list[float]], target: float) -> float | None:
    if not series:
        return None
    best = min(series, key=lambda p: abs(float(p[0]) - target))
    if abs(float(best[0]) - target) > 0.05:
        return None
    return _round4(float(best[1]))


def row_from_yields(d: str, yields: dict[str, float | None], source: str, source_url: str) -> dict[str, str]:
    y10 = yields.get("y10y")
    y1 = yields.get("y1y")
    spread = None
    if y10 is not None and y1 is not None:
        spread = _round4(y10 - y1)
    out: dict[str, str] = {
        "date": d,
        "spread_10y_1y": _f(spread),
        "source": source,
        "source_url": source_url,
    }
    for key, _ in TENORS:
        out[key] = _f(yields.get(key))
    return out


def parse_latest_html(html: str) -> dict[str, str] | None:
    plain = " ".join(unescape(re.sub(r"<[^>]+>", " ", html)).split())
    m = re.search(r"(20\d{2}-\d{2}-\d{2})", plain)
    if not m:
        return None
    d = m.group(1)
    parser = TableParser()
    parser.feed(html)
    gov: list[str] | None = None
    for row in parser.rows:
        if row and "Government Bond Yield Curve" in row[0]:
            gov = row
            break
    if not gov or len(gov) < 9:
        return None
    nums = []
    for cell in gov[1:9]:
        try:
            nums.append(_round4(float(cell)))
        except ValueError:
            return None
    yields = {
        "y3m": nums[0],
        "y6m": nums[1],
        "y1y": nums[2],
        "y3y": nums[3],
        "y5y": nums[4],
        "y7y": nums[5],
        "y10y": nums[6],
        "y30y": nums[7],
    }
    return row_from_yields(d, yields, "cbrc_html", LATEST_URL)


def resolve_curve_id() -> str:
    data = json.loads(fetch(TREE_URL))
    for item in data:
        name = str(item.get("name") or "")
        if name == CURVE_NAME or name.startswith("中债国债收益率曲线"):
            cid = str(item.get("id") or "").strip()
            if cid:
                return cid
    raise RuntimeError("queryTree 未找到中债国债收益率曲线")


def fetch_api_day(ycid: str, d: str) -> dict[str, str] | None:
    url = API_TMPL.format(date=d, ycid=ycid)
    try:
        payload = json.loads(fetch(url, data=b""))
    except Exception:  # noqa: BLE001
        return None
    charts = payload.get("ycChartDataList") or []
    if not charts:
        return None
    series = charts[0].get("seriesData") or []
    if not series:
        return None
    yields: dict[str, float | None] = {}
    for key, tenor in TENORS:
        yields[key] = pick_tenor(series, tenor)
    if yields.get("y10y") is None and yields.get("y1y") is None:
        return None
    return row_from_yields(d, yields, "api", url.split("?")[0])


def weekdays_back(n: int, end: date | None = None) -> list[str]:
    end = end or date.today()
    out: list[str] = []
    cur = end
    while len(out) < n:
        if cur.weekday() < 5:
            out.append(cur.isoformat())
        cur -= timedelta(days=1)
    return list(reversed(out))


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
    ap.add_argument("--backfill-days", type=int, default=0, help="API 回填最近 N 个工作日")
    ap.add_argument("--sleep", type=float, default=0.25)
    ap.add_argument("--no-latest", action="store_true")
    args = ap.parse_args()

    by_date = load_existing()
    touched: list[str] = []

    if args.backfill_days > 0:
        try:
            ycid = resolve_curve_id()
            print(f"[api] curve id={ycid}")
        except Exception as e:  # noqa: BLE001
            print(f"[warn] queryTree fail: {e}", file=sys.stderr)
            ycid = ""
        if ycid:
            for d in weekdays_back(args.backfill_days):
                row = fetch_api_day(ycid, d)
                if row and row.get("y10y"):
                    # 不覆盖已有 HTML 正式点
                    prev = by_date.get(d)
                    if prev and prev.get("source") == "cbrc_html":
                        continue
                    by_date[d] = row
                    touched.append(d)
                    print(f"[ok] api {d} 10y={row['y10y']}")
                time.sleep(args.sleep)

    if not args.no_latest:
        try:
            latest = parse_latest_html(fetch(LATEST_URL))
            if not latest:
                raise RuntimeError("HTML 表解析失败")
            by_date[latest["date"]] = latest
            touched.append(latest["date"])
            print(f"[ok] html {latest['date']} 10y={latest['y10y']}")
        except Exception as e:  # noqa: BLE001
            if not by_date:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_date:
        raise RuntimeError("无国债收益率可写")
    write_rows(by_date)
    print(f"wrote {OUT} days={len(by_date)} touched={len(touched)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

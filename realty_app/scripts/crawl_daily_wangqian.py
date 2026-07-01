"""
深圳 / 广州 政府网签（成交）日更抓取 → CSV
============================================

数据源（已实测可匿名访问）：
  深圳住建局 fdc 子站
    - 一手：POST /api/marketInfoShow/getYsfCjxxGsDataNew
    - 二手：POST /api/marketInfoShow/getEsfCjxxGsDataNew
    页面：http://zjj.sz.gov.cn/xxgk/ztzl/pubdata/ （内嵌 iframe）

  广州住建「商品房销售统计」
    - 新房签约（按区）：GET /ysqgk/Api/WebApi/mrxjspfqyxx.ashx
    页面：https://zfcj.gz.gov.cn/zfcj/tjxx/spfxstjxx

⚠️  两城接口均只返回「最近一个交易日」快照，不支持按日期回溯。
    历史序列靠每日定时跑本脚本、--merge 追加到 CSV 积累。

⚠️  广州二手房仅有月度图片公告（存量房交易登记统计信息），暂无稳定日更 API；
    本脚本对广州仅抓「新房/住宅签约」。

输出窄表（与 App `dailyWangqian.ts` 对齐）：
  date,city,category,district,units,area_sqm,granularity,source_url

  category   新房 | 二手
  district   全市 或 行政区名
  granularity city | district

使用：
  python scripts/crawl_daily_wangqian.py fetch
  python scripts/crawl_daily_wangqian.py fetch --merge   # 与已有 CSV 去重合并
  python scripts/crawl_daily_wangqian.py fetch --city 深圳

依赖：pip install requests
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    print("需要 requests：pip install requests", file=sys.stderr)
    raise

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = REPO_ROOT / "static" / "daily_wangqian.csv"

OUT_FIELDS = [
    "date",
    "city",
    "category",
    "district",
    "units",
    "area_sqm",
    "granularity",
    "source_url",
]

SZ_BASE = "https://fdc.zjj.sz.gov.cn"
SZ_NEW_API = f"{SZ_BASE}/api/marketInfoShow/getYsfCjxxGsDataNew"
SZ_SECOND_API = f"{SZ_BASE}/api/marketInfoShow/getEsfCjxxGsDataNew"
SZ_SOURCE = "http://zjj.sz.gov.cn/xxgk/ztzl/pubdata/"

GZ_BASE = "https://zfcj.gz.gov.cn"
GZ_NEW_API = f"{GZ_BASE}/ysqgk/Api/WebApi/mrxjspfqyxx.ashx"
GZ_SOURCE = f"{GZ_BASE}/zfcj/tjxx/spfxstjxx"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


@dataclass(frozen=True)
class Row:
    date: str
    city: str
    category: str
    district: str
    units: int
    area_sqm: float
    granularity: str
    source_url: str

    def key(self) -> tuple[str, ...]:
        return (self.date, self.city, self.category, self.district, self.granularity)

    def as_list(self) -> list[str]:
        return [
            self.date,
            self.city,
            self.category,
            self.district,
            str(self.units),
            f"{self.area_sqm:.2f}",
            self.granularity,
            self.source_url,
        ]


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    return s


def parse_cn_date_day(text: str) -> str:
    """2026年6月30日 → 2026-06-30"""
    m = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", text or "")
    if not m:
        raise ValueError(f"无法解析日期：{text!r}")
    y, mo, d = (int(m.group(i)) for i in range(1, 4))
    return f"{y:04d}-{mo:02d}-{d:02d}"


def parse_gz_datetime(text: str) -> str:
    """2026/6/30 0:00:00 → 2026-06-30"""
    m = re.match(r"(\d{4})/(\d{1,2})/(\d{1,2})", text or "")
    if not m:
        raise ValueError(f"无法解析广州日期：{text!r}")
    y, mo, d = (int(m.group(i)) for i in range(1, 4))
    return f"{y:04d}-{mo:02d}-{d:02d}"


def _sum_pie(items: list[dict[str, Any]]) -> tuple[int, float]:
    units = 0
    area = 0.0
    for it in items or []:
        v = it.get("value")
        if v is None:
            continue
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        # 套数为整数，面积为小数
        if abs(fv - round(fv)) < 1e-6 and fv < 10000:
            units += int(round(fv))
        else:
            area += fv
    return units, area


def fetch_shenzhen(sess: requests.Session) -> list[Row]:
    headers = {
        "Referer": f"{SZ_BASE}/public/marketInfo/smcDayDealInfo.html",
        "Content-Type": "application/json",
    }
    rows: list[Row] = []

    for category, api, referer_page in [
        ("新房", SZ_NEW_API, "smcDayDealInfo.html"),
        ("二手", SZ_SECOND_API, "tmcDayDealInfo.html"),
    ]:
        headers["Referer"] = f"{SZ_BASE}/public/marketInfo/{referer_page}"
        r = sess.post(api, headers=headers, json={}, timeout=30)
        r.raise_for_status()
        body = r.json()
        if body.get("status") != 1:
            raise RuntimeError(f"深圳 {category} 接口异常：{body}")
        data = body.get("data") or {}
        if data.get("result") == "failed":
            raise RuntimeError(f"深圳 {category}：{data.get('error')}")

        day = parse_cn_date_day(str(data.get("xmlDateDay", "")))
        ts_items = data.get("dataTs") or []
        mj_items = data.get("dataMj") or []

        by_district: dict[str, tuple[int, float]] = {}
        for it in ts_items:
            name = str(it.get("name", "")).strip()
            if not name:
                continue
            u = int(round(float(it.get("value") or 0)))
            by_district.setdefault(name, (0, 0.0))
            by_district[name] = (u, by_district[name][1])
        for it in mj_items:
            name = str(it.get("name", "")).strip()
            if not name:
                continue
            a = float(it.get("value") or 0)
            prev = by_district.get(name, (0, 0.0))
            by_district[name] = (prev[0], a)

        total_u = sum(u for u, _ in by_district.values())
        total_a = sum(a for _, a in by_district.values())
        rows.append(
            Row(day, "深圳", category, "全市", total_u, total_a, "city", SZ_SOURCE)
        )
        for dist, (u, a) in sorted(by_district.items()):
            rows.append(
                Row(day, "深圳", category, dist, u, a, "district", SZ_SOURCE)
            )
    return rows


def fetch_guangzhou(sess: requests.Session) -> list[Row]:
    headers = {"Referer": GZ_SOURCE}
    r = sess.get(GZ_NEW_API, headers=headers, timeout=30)
    r.raise_for_status()
    body = r.json()
    items = body.get("data") or []
    if not items:
        raise RuntimeError(f"广州新房签约无数据：{body}")

    day = parse_gz_datetime(str(items[0].get("createTime", "")))
    by_district: dict[str, tuple[int, float]] = {}
    for it in items:
        dist = str(it.get("sectionName", "")).strip()
        if not dist:
            continue
        u = int(it.get("zhuZaiTaoShu") or 0)
        a = float(it.get("zhuZaiArea") or 0)
        by_district[dist] = (u, a)

    total_u = sum(u for u, _ in by_district.values())
    total_a = sum(a for _, a in by_district.values())
    rows = [Row(day, "广州", "新房", "全市", total_u, total_a, "city", GZ_SOURCE)]
    for dist, (u, a) in sorted(by_district.items()):
        rows.append(Row(day, "广州", "新房", dist, u, a, "district", GZ_SOURCE))
    return rows


def read_existing(path: Path) -> list[Row]:
    if not path.exists():
        return []
    rows: list[Row] = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                rows.append(
                    Row(
                        date=str(r.get("date", "")).strip(),
                        city=str(r.get("city", "")).strip(),
                        category=str(r.get("category", "")).strip(),
                        district=str(r.get("district", "")).strip(),
                        units=int(float(r.get("units") or 0)),
                        area_sqm=float(r.get("area_sqm") or 0),
                        granularity=str(r.get("granularity", "city")).strip(),
                        source_url=str(r.get("source_url", "")).strip(),
                    )
                )
            except (TypeError, ValueError):
                continue
    return rows


def merge_rows(existing: list[Row], fresh: list[Row]) -> list[Row]:
    merged: dict[tuple[str, ...], Row] = {r.key(): r for r in existing}
    for r in fresh:
        merged[r.key()] = r
    out = list(merged.values())
    out.sort(key=lambda x: (x.date, x.city, x.category, x.granularity, x.district))
    return out


def write_csv(path: Path, rows: list[Row]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(OUT_FIELDS)
        for r in rows:
            w.writerow(r.as_list())


def cmd_fetch(args: argparse.Namespace) -> int:
    sess = _session()
    fresh: list[Row] = []
    cities = {c.strip() for c in args.city.split(",") if c.strip()}

    if not cities or "深圳" in cities:
        print("[fetch] 深圳 fdc.zjj.sz.gov.cn …")
        sz_rows = fetch_shenzhen(sess)
        fresh.extend(sz_rows)
        city_days = sorted({r.date for r in sz_rows if r.granularity == "city"})
        print(f"  → {len(sz_rows)} 行，交易日 {city_days}")

    if not cities or "广州" in cities:
        print("[fetch] 广州 mrxjspfqyxx.ashx …")
        gz_rows = fetch_guangzhou(sess)
        fresh.extend(gz_rows)
        city_days = sorted({r.date for r in gz_rows if r.granularity == "city"})
        print(f"  → {len(gz_rows)} 行，交易日 {city_days}")

    out_path = Path(args.out)
    if args.merge and out_path.exists():
        merged = merge_rows(read_existing(out_path), fresh)
        print(f"[merge] 合并后共 {len(merged)} 行")
    else:
        merged = merge_rows([], fresh)

    write_csv(out_path, merged)
    print(f"[done] {len(merged)} 行 → {out_path}")
    print(f"       生成时间 {datetime.now().isoformat(timespec='seconds')}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="深圳/广州政府网签日更抓取")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("fetch", help="抓取最新交易日并写出 CSV")
    p.add_argument("--out", default=str(DEFAULT_OUT))
    p.add_argument("--merge", action="store_true", help="与已有 CSV 按主键去重合并")
    p.add_argument(
        "--city",
        default="深圳,广州",
        help="逗号分隔：深圳 / 广州，默认两城都抓",
    )
    p.set_defaults(func=cmd_fetch)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())

"""
深圳 / 广州 政府网签（成交）日更抓取 → CSV
============================================

数据源（已实测可匿名访问）：
  深圳住建局 fdc 子站
    - 全市历史（近 N 日）：POST /api/marketInfoShow/getFjzsInfoData
      页面：https://fdc.zjj.sz.gov.cn/public/marketInfo/housePriceTrendInfo.html
    - 分区最新日：POST getYsfCjxxGsDataNew / getEsfCjxxGsDataNew
      页面：http://zjj.sz.gov.cn/xxgk/ztzl/pubdata/
    - 最近完整月分区：POST getYsfCjxxGsMonthDataNew / getEsfCjxxGsMonthDataNew
      页面：smcMonthDealInfo.html / tmcMonthDealInfo.html（granularity=month/month_district）

  广州住建「商品房销售统计」
    - 新房签约（按区）：GET /ysqgk/Api/WebApi/mrxjspfqyxx.ashx
    页面：https://zfcj.gz.gov.cn/zfcj/tjxx/spfxstjxx

⚠️  两城接口均只返回「最近一个交易日」快照，不支持按日期回溯。
    历史序列靠每日定时跑本脚本、--merge 追加到 CSV 积累。

⚠️  广州二手房仅有月度图片公告（存量房交易登记统计信息），暂无稳定日更 API；
    本脚本对广州仅抓「新房/住宅签约」。

输出窄表（与 App `dailyWangqian.ts` 对齐）：
  date,city,category,scope,district,units,area_sqm,granularity,source_url

  category   新房 | 二手
  scope      住宅 | 全部
             - 住宅：走势页 getFjzsInfoData（商品住房口径，可回溯 90 天）
             - 全部：分区公示 getEsf/YsfCjxxGsDataNew（含非住宅二手，仅最新日）
             深圳二手两套口径不同（住宅 188 ≠ 全部 239，差值为非住宅），故都保留。
  district   全市 或 行政区名
  granularity city | district

使用：
  python scripts/crawl_daily_wangqian.py fetch
  python scripts/crawl_daily_wangqian.py fetch --merge
  python scripts/crawl_daily_wangqian.py fetch --city 深圳 --sz-days 90

依赖：pip install requests
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta
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
    "scope",
    "district",
    "units",
    "area_sqm",
    "granularity",
    "source_url",
]

# 口径：走势页（商品住房）= 住宅；分区公示（含非住宅二手）= 全部
SCOPE_RESIDENTIAL = "住宅"
SCOPE_ALL = "全部"

SZ_BASE = "https://fdc.zjj.sz.gov.cn"
SZ_TREND_API = f"{SZ_BASE}/api/marketInfoShow/getFjzsInfoData"
SZ_TREND_SOURCE = f"{SZ_BASE}/public/marketInfo/housePriceTrendInfo.html"
SZ_NEW_API = f"{SZ_BASE}/api/marketInfoShow/getYsfCjxxGsDataNew"
SZ_SECOND_API = f"{SZ_BASE}/api/marketInfoShow/getEsfCjxxGsDataNew"
SZ_NEW_MONTH_API = f"{SZ_BASE}/api/marketInfoShow/getYsfCjxxGsMonthDataNew"
SZ_SECOND_MONTH_API = f"{SZ_BASE}/api/marketInfoShow/getEsfCjxxGsMonthDataNew"
SZ_DISTRICT_SOURCE = "http://zjj.sz.gov.cn/xxgk/ztzl/pubdata/"

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
    scope: str
    district: str
    units: int
    area_sqm: float
    granularity: str
    source_url: str

    def key(self) -> tuple[str, ...]:
        return (
            self.date,
            self.city,
            self.category,
            self.scope,
            self.district,
            self.granularity,
        )

    def as_list(self) -> list[str]:
        return [
            self.date,
            self.city,
            self.category,
            self.scope,
            self.district,
            str(self.units),
            f"{self.area_sqm:.2f}",
            self.granularity,
            self.source_url,
        ]


class _LegacyTLSAdapter(requests.adapters.HTTPAdapter):
    """兼容旧服务端的 TLS 重协商。

    深圳 fdc 子站在 OpenSSL 3（如 GitHub Actions ubuntu）下会报
    UNSAFE_LEGACY_RENEGOTIATION_DISABLED；本地 Windows/OpenSSL 1.1 无此问题。
    开启 OP_LEGACY_SERVER_CONNECT (0x4) 即可，仅影响握手、不降低证书校验。
    """

    def init_poolmanager(self, *args: Any, **kwargs: Any) -> Any:
        import ssl

        try:
            from urllib3.util.ssl_ import create_urllib3_context

            ctx = create_urllib3_context()
        except Exception:  # pragma: no cover - 退回默认上下文
            ctx = ssl.create_default_context()
        ctx.options |= 0x4  # OP_LEGACY_SERVER_CONNECT
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    s.mount("https://", _LegacyTLSAdapter())
    return s


def parse_cn_date_day(text: str) -> str:
    """2026年6月30日 → 2026-06-30"""
    m = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", text or "")
    if not m:
        raise ValueError(f"无法解析日期：{text!r}")
    y, mo, d = (int(m.group(i)) for i in range(1, 4))
    return f"{y:04d}-{mo:02d}-{d:02d}"


def parse_cn_month(text: str) -> str:
    """2026年6月 → 2026-06-01（用当月 1 号做该月的代表日期，便于 CSV 主键排序）。"""
    m = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月", text or "")
    if not m:
        raise ValueError(f"无法解析月份：{text!r}")
    y, mo = int(m.group(1)), int(m.group(2))
    return f"{y:04d}-{mo:02d}-01"


def parse_gz_datetime(text: str) -> str:
    """2026/6/30 0:00:00 → 2026-06-30"""
    m = re.match(r"(\d{4})/(\d{1,2})/(\d{1,2})", text or "")
    if not m:
        raise ValueError(f"无法解析广州日期：{text!r}")
    y, mo, d = (int(m.group(i)) for i in range(1, 4))
    return f"{y:04d}-{mo:02d}-{d:02d}"


def _fdc_json_headers(referer_path: str) -> dict[str, str]:
    return {
        "Referer": f"{SZ_BASE}{referer_path}",
        "Content-Type": "application/json",
    }


def fetch_shenzhen_city_trend(sess: requests.Session, days: int) -> list[Row]:
    """全市新房/二手近 N 个交易日（getFjzsInfoData，可回溯）。"""
    if days <= 0:
        return []
    end = date.today()
    start = end - timedelta(days=days)
    headers = _fdc_json_headers("/public/marketInfo/housePriceTrendInfo.html")
    r = sess.post(
        SZ_TREND_API,
        headers=headers,
        json={
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "dateType": "",
        },
        timeout=45,
    )
    r.raise_for_status()
    body = r.json()
    if body.get("status") != 1:
        raise RuntimeError(f"深圳趋势接口异常：{body}")
    data = body.get("data") or {}
    if data.get("result") == "failed":
        raise RuntimeError(f"深圳趋势：{data.get('error')}")

    dates = data.get("date") or []
    rows: list[Row] = []
    series = [
        ("新房", data.get("ysfTotalTs") or [], data.get("ysfDealArea") or []),
        ("二手", data.get("esfTotalTs") or [], data.get("esfDealArea") or []),
    ]
    for category, units_arr, area_arr in series:
        for i, day in enumerate(dates):
            try:
                u = int(round(float(units_arr[i])))
                a = float(area_arr[i])
            except (IndexError, TypeError, ValueError):
                continue
            rows.append(
                Row(
                    str(day),
                    "深圳",
                    category,
                    SCOPE_RESIDENTIAL,
                    "全市",
                    u,
                    a,
                    "city",
                    SZ_TREND_SOURCE,
                )
            )
    return rows


def fetch_shenzhen_district_latest(sess: requests.Session) -> list[Row]:
    """最新交易日分区新房/二手（饼图 API）。

    口径说明：
      - 新房 getYsfCjxxGsDataNew 为「商品住房」→ scope=住宅，分区合计与走势页一致。
      - 二手 getEsfCjxxGsDataNew 为「二手房」（含非住宅）→ scope=全部；
        另写一条「全市/全部」汇总行，便于 App 同时展示住宅(走势)与全部(分区)。
    """
    headers = _fdc_json_headers("/public/marketInfo/smcDayDealInfo.html")
    rows: list[Row] = []

    for category, scope, api, referer_page in [
        ("新房", SCOPE_RESIDENTIAL, SZ_NEW_API, "smcDayDealInfo.html"),
        ("二手", SCOPE_ALL, SZ_SECOND_API, "tmcDayDealInfo.html"),
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

        for dist, (u, a) in sorted(by_district.items()):
            rows.append(
                Row(day, "深圳", category, scope, dist, u, a, "district", SZ_DISTRICT_SOURCE)
            )

        # 二手：分区合计写一条「全市/全部」行（住宅口径的全市由走势页负责）。
        if category == "二手":
            total_u = sum(u for u, _ in by_district.values())
            total_a = sum(a for _, a in by_district.values())
            rows.append(
                Row(day, "深圳", "二手", SCOPE_ALL, "全市", total_u, total_a, "city", SZ_DISTRICT_SOURCE)
            )
    return rows


def fetch_shenzhen_month_latest(sess: requests.Session) -> list[Row]:
    """最近完整月的分区成交（新房/二手），granularity=month(全市) / month_district。

    getYsf/EsfCjxxGsMonthDataNew：xmlDateMonth=数据月，dataTs 按区套数、dataMj 按区面积。
    月度也拆住宅(新房=商品住房)/全部(二手=含非住宅)口径，与日更一致。
    """
    headers = _fdc_json_headers("/public/marketInfo/smcMonthDealInfo.html")
    rows: list[Row] = []
    for category, scope, api, referer_page in [
        ("新房", SCOPE_RESIDENTIAL, SZ_NEW_MONTH_API, "smcMonthDealInfo.html"),
        ("二手", SCOPE_ALL, SZ_SECOND_MONTH_API, "tmcMonthDealInfo.html"),
    ]:
        headers["Referer"] = f"{SZ_BASE}/public/marketInfo/{referer_page}"
        r = sess.post(api, headers=headers, json={}, timeout=30)
        r.raise_for_status()
        body = r.json()
        if body.get("status") != 1:
            raise RuntimeError(f"深圳 {category} 月度接口异常：{body}")
        data = body.get("data") or {}
        if data.get("result") == "failed":
            raise RuntimeError(f"深圳 {category} 月度：{data.get('error')}")

        month_day = parse_cn_month(str(data.get("xmlDateMonth", "")))
        ts_items = data.get("dataTs") or []
        mj_items = data.get("dataMj") or []
        by_district: dict[str, tuple[int, float]] = {}
        for it in ts_items:
            name = str(it.get("name", "")).strip()
            if name:
                by_district[name] = (int(round(float(it.get("value") or 0))), 0.0)
        for it in mj_items:
            name = str(it.get("name", "")).strip()
            if name:
                prev = by_district.get(name, (0, 0.0))
                by_district[name] = (prev[0], float(it.get("value") or 0))

        total_u = sum(u for u, _ in by_district.values())
        total_a = sum(a for _, a in by_district.values())
        rows.append(
            Row(month_day, "深圳", category, scope, "全市", total_u, total_a, "month", SZ_DISTRICT_SOURCE)
        )
        for dist, (u, a) in sorted(by_district.items()):
            rows.append(
                Row(month_day, "深圳", category, scope, dist, u, a, "month_district", SZ_DISTRICT_SOURCE)
            )
    return rows


def fetch_shenzhen(sess: requests.Session, sz_days: int) -> list[Row]:
    """深圳：历史全市 + 最新日分区 + 最近完整月分区。"""
    rows = fetch_shenzhen_city_trend(sess, sz_days)
    rows.extend(fetch_shenzhen_district_latest(sess))
    rows.extend(fetch_shenzhen_month_latest(sess))
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
    # 广州 zhuZaiTaoShu 本身即住宅签约口径
    rows = [Row(day, "广州", "新房", SCOPE_RESIDENTIAL, "全市", total_u, total_a, "city", GZ_SOURCE)]
    for dist, (u, a) in sorted(by_district.items()):
        rows.append(Row(day, "广州", "新房", SCOPE_RESIDENTIAL, dist, u, a, "district", GZ_SOURCE))
    return rows


def read_existing(path: Path) -> list[Row]:
    if not path.exists():
        return []
    rows: list[Row] = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                category = str(r.get("category", "")).strip()
                source_url = str(r.get("source_url", "")).strip()
                granularity = str(r.get("granularity", "city")).strip()
                scope = str(r.get("scope", "")).strip()
                if not scope:
                    scope = _infer_scope(category, granularity, source_url)
                rows.append(
                    Row(
                        date=str(r.get("date", "")).strip(),
                        city=str(r.get("city", "")).strip(),
                        category=category,
                        scope=scope,
                        district=str(r.get("district", "")).strip(),
                        units=int(float(r.get("units") or 0)),
                        area_sqm=float(r.get("area_sqm") or 0),
                        granularity=granularity,
                        source_url=source_url,
                    )
                )
            except (TypeError, ValueError):
                continue
    return rows


def _infer_scope(category: str, granularity: str, source_url: str) -> str:
    """旧 CSV 无 scope 列时的兼容推断。

    走势页(housePriceTrendInfo) = 住宅；二手分区公示 = 全部；其余默认住宅。
    """
    if "housePriceTrendInfo" in source_url:
        return SCOPE_RESIDENTIAL
    if category == "二手" and granularity in ("district", "month_district"):
        return SCOPE_ALL
    return SCOPE_RESIDENTIAL


def merge_rows(existing: list[Row], fresh: list[Row]) -> list[Row]:
    merged: dict[tuple[str, ...], Row] = {r.key(): r for r in existing}
    for r in fresh:
        merged[r.key()] = r
    out = list(merged.values())
    out.sort(key=lambda x: (x.date, x.city, x.category, x.scope, x.granularity, x.district))
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
        print(f"[fetch] 深圳 fdc（趋势 {args.sz_days} 天 + 最新日分区）…")
        sz_rows = fetch_shenzhen(sess, args.sz_days)
        fresh.extend(sz_rows)
        city_rows = [r for r in sz_rows if r.granularity == "city" and r.district == "全市"]
        city_days = sorted({r.date for r in city_rows})
        print(
            f"  → {len(sz_rows)} 行，全市交易日 {len(city_days)} 天"
            f"（{city_days[0] if city_days else '?'} … {city_days[-1] if city_days else '?'}）"
        )

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
    p.add_argument(
        "--sz-days",
        type=int,
        default=90,
        help="深圳全市历史回溯天数（getFjzsInfoData），0 表示跳过",
    )
    p.set_defaults(func=cmd_fetch)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())

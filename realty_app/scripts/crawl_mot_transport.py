#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取交通运输部「交通运输经济运行情况」。

用法：
  python scripts/crawl_mot_transport.py
  python scripts/crawl_mot_transport.py --backfill --no-latest

口径：营业性货运量 / 公路·水路 / 港口吞吐量 / 集装箱 / 跨区域人员流动 / 交通固投。
**货运·港口·固投 ≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**（宏观景气弱相关）。
"""
from __future__ import annotations

import argparse
import csv
import html
import re
import sys
import urllib.request
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[1] / "static" / "mot_transport.csv"

BACKFILL_URLS = [
    "https://xxgk.mot.gov.cn/jigou/zhghs/202507/t20250725_4173255.html",  # 2025-H1
    "https://xxgk.mot.gov.cn/jigou/zhghs/202603/t20260326_4202520.html",  # 2026-02 (1—2)
    "https://xxgk.mot.gov.cn/jigou/zhghs/202604/t20260421_4204106.html",  # 2026-Q1
    "https://xxgk.mot.gov.cn/jigou/zhghs/202605/t20260526_4206311.html",  # 2026-04
    "https://xxgk.mot.gov.cn/jigou/zhghs/202606/t20260629_4208442.html",  # 2026-05
    "https://xxgk.mot.gov.cn/jigou/zhghs/202607/t20260721_4210106.html",  # 2026-H1
]

FIELDS = [
    "period",
    "label",
    "publish_date",
    "freight_yi_t",
    "freight_yoy_pct",
    "road_freight_yi_t",
    "road_freight_yoy_pct",
    "water_freight_yi_t",
    "water_freight_yoy_pct",
    "port_yi_t",
    "port_yoy_pct",
    "container_yi_teu",
    "container_yoy_pct",
    "passenger_yi_trips",
    "passenger_yoy_pct",
    "invest_yi_yuan",
    "source_url",
]


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "realty-app-data-refresh/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read().decode("utf-8", errors="replace")


def plain_of(body: str) -> str:
    s = re.sub(r"<script[\s\S]*?</script>", " ", body, flags=re.I)
    s = re.sub(r"<style[\s\S]*?</style>", " ", s, flags=re.I)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).split())


def fnum(s: str) -> float:
    return float(s.replace(",", "").replace(" ", ""))


def _f(v: float | None) -> str:
    if v is None:
        return ""
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return f"{v:g}"


def signed_yoy(direction: str, pct: str) -> float:
    v = fnum(pct)
    return -v if direction in ("下降", "减少", "回落") else v


def first_amt_yoy(plain: str, name: str) -> tuple[float, float] | None:
    m = re.search(
        rf"完成{re.escape(name)}\s*([\d.]+)\s*亿(?:吨|人次|标箱)，同比(增长|下降)\s*([\d.]+)\s*%",
        plain,
    )
    if not m:
        return None
    return fnum(m.group(1)), signed_yoy(m.group(2), m.group(3))


def first_container(plain: str) -> tuple[float, float] | None:
    m = re.search(
        r"完成集装箱吞吐量\s*([\d.]+)\s*(亿标箱|万标箱)，同比(增长|下降)\s*([\d.]+)\s*%",
        plain,
    )
    if not m:
        return None
    amt = fnum(m.group(1))
    if m.group(2) == "万标箱":
        amt = amt / 10000.0
    return amt, signed_yoy(m.group(3), m.group(4))


def first_invest_yi(plain: str) -> float | None:
    m = re.search(r"完成交通固定资产投资\s*([\d.]+)\s*万亿元", plain)
    if m:
        return fnum(m.group(1)) * 10000.0
    m = re.search(r"完成交通固定资产投资\s*([\d.]+)\s*亿元", plain)
    if m:
        return fnum(m.group(1))
    return None


def detect_period(plain: str, url: str) -> tuple[str, str]:
    pub = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)
    year_hint = pub.group(1) if pub else ""

    if re.search(r"(20\d{2})\s*年上半年交通运输经济运行|名称：\s*(20\d{2})\s*年上半年", plain) or (
        "上半年交通运输经济运行情况" in plain and "一季度" not in plain[:80]
    ):
        y = re.search(r"(20\d{2})\s*年上半年", plain)
        year = y.group(1) if y else year_hint
        return f"{year}-H1", f"{year}上半年"

    if re.search(r"前三季度交通运输经济运行", plain):
        y = re.search(r"(20\d{2})", plain) or re.search(r"/t(20\d{2})", url)
        year = y.group(1) if y else year_hint
        return f"{year}-9M", f"{year}前三季度"

    if "一季度交通运输经济运行情况" in plain or re.search(r"名称：\s*一季度交通运输", plain):
        year = year_hint or (re.search(r"(20\d{2})", plain) or [None, ""])[1]
        # publish month often April → year from URL
        return f"{year}-Q1", f"{year}一季度"

    m12 = re.search(r"1\s*[—\-]\s*2\s*月交通运输经济运行", plain)
    if m12:
        year = year_hint
        return f"{year}-02", f"{year}年1—2月"

    m_cum = re.search(r"1\s*[—\-]\s*(\d{1,2})\s*月交通运输经济运行", plain)
    if m_cum:
        year = year_hint
        month = int(m_cum.group(1))
        return f"{year}-{month:02d}", f"{year}年1—{month}月"

    m_single = re.search(r"(?<![—\-1])(\d{1,2})\s*月交通运输经济运行情况", plain)
    if not m_single:
        m_single = re.search(r"名称：\s*(\d{1,2})\s*月交通运输经济运行", plain)
    if m_single:
        month = int(m_single.group(1))
        year = int(year_hint) if year_hint else 0
        # 若公开日在次年 1 月而数据为 12 月
        if pub:
            pub_y, pub_m = int(pub.group(1)), int(pub.group(2))
            year = pub_y if month <= pub_m else pub_y - 1
        return f"{year}-{month:02d}", f"{year}年{month}月"

    raise RuntimeError(f"无法识别期次: {url}")


def parse_release(url: str, body: str) -> dict[str, str]:
    if "xxgk.mot.gov.cn" not in url and "mot.gov.cn" not in url:
        raise RuntimeError(f"非交通运输部域名: {url}")
    plain = plain_of(body)
    period, label = detect_period(plain, url)
    pub = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)

    freight = first_amt_yoy(plain, "营业性货运量")
    if not freight:
        raise RuntimeError(f"缺营业性货运量: {url}")
    road = first_amt_yoy(plain, "公路货运量")
    water = first_amt_yoy(plain, "水路货运量")

    port = first_amt_yoy(plain, "港口货物吞吐量")
    if not port:
        m = re.search(
            r"全国港口完成货物吞吐量\s*([\d.]+)\s*亿吨，同比(增长|下降)\s*([\d.]+)\s*%",
            plain,
        )
        if m:
            port = fnum(m.group(1)), signed_yoy(m.group(2), m.group(3))

    container = first_container(plain)
    passenger = first_amt_yoy(plain, "跨区域人员流动量")
    invest = first_invest_yi(plain)

    return {
        "period": period,
        "label": label,
        "publish_date": "-".join(pub.groups()) if pub else "",
        "freight_yi_t": _f(freight[0]),
        "freight_yoy_pct": _f(freight[1]),
        "road_freight_yi_t": _f(road[0]) if road else "",
        "road_freight_yoy_pct": _f(road[1]) if road else "",
        "water_freight_yi_t": _f(water[0]) if water else "",
        "water_freight_yoy_pct": _f(water[1]) if water else "",
        "port_yi_t": _f(port[0]) if port else "",
        "port_yoy_pct": _f(port[1]) if port else "",
        "container_yi_teu": _f(container[0]) if container else "",
        "container_yoy_pct": _f(container[1]) if container else "",
        "passenger_yi_trips": _f(passenger[0]) if passenger else "",
        "passenger_yoy_pct": _f(passenger[1]) if passenger else "",
        "invest_yi_yuan": _f(invest),
        "source_url": url,
    }


def period_sort_key(period: str) -> tuple:
    m = re.match(r"(20\d{2})(?:-(Q1|H1|9M)|-(\d{2}))?$", period)
    if not m:
        return (0, 0)
    year = int(m.group(1))
    if m.group(2):
        order = {"Q1": 3, "H1": 6, "9M": 9}[m.group(2)]
        return (year, order)
    if m.group(3):
        return (year, int(m.group(3)))
    return (year, 12)


def load_existing() -> dict[str, dict[str, str]]:
    if not OUTPUT.exists():
        return {}
    with OUTPUT.open(encoding="utf-8", newline="") as f:
        return {row["period"]: row for row in csv.DictReader(f) if row.get("period")}


def write_rows(by_period: dict[str, dict[str, str]]) -> None:
    ordered = sorted(
        by_period.values(),
        key=lambda r: period_sort_key(str(r.get("period", ""))),
        reverse=True,
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for row in ordered:
            writer.writerow({k: row.get(k, "") for k in FIELDS})


def merge_one(url: str, by_period: dict[str, dict[str, str]]) -> str:
    parsed = parse_release(url, fetch(url))
    period = str(parsed["period"])
    by_period[period] = parsed
    return period


def find_release() -> str:
    """无稳定列表页：在 backfill 候选中取可解析且期次最新的。"""
    best_url = ""
    best_key: tuple = (0, 0)
    for url in BACKFILL_URLS:
        try:
            parsed = parse_release(url, fetch(url))
            key = period_sort_key(parsed["period"])
            if key > best_key:
                best_key = key
                best_url = url
        except Exception:  # noqa: BLE001
            continue
    if not best_url:
        raise RuntimeError("未找到可解析的交通运输经济运行稿")
    return best_url


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="")
    ap.add_argument("--backfill", action="store_true")
    ap.add_argument("--no-latest", action="store_true")
    args = ap.parse_args()

    by_period: dict[str, dict[str, str]] = {k: dict(v) for k, v in load_existing().items()}
    touched: list[str] = []

    if args.url:
        touched.append(merge_one(args.url, by_period))
    if args.backfill:
        for url in BACKFILL_URLS:
            try:
                touched.append(merge_one(url, by_period))
                print(f"[ok] {touched[-1]} ← {url}")
            except Exception as e:  # noqa: BLE001
                print(f"[warn] backfill skip {url}: {e}", file=sys.stderr)
    if not args.no_latest and not args.url:
        try:
            latest = find_release()
            touched.append(merge_one(latest, by_period))
            print(f"[ok] latest {touched[-1]} ← {latest}")
        except Exception as e:  # noqa: BLE001
            if not touched and not by_period:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_period:
        raise RuntimeError("无交通运输数据可写")
    write_rows(by_period)
    print(f"wrote {OUTPUT} periods={len(by_period)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

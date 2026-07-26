#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广东省统计局「经济运行简况」中含地区生产总值的期次。

列表：http://stats.gd.gov.cn/tjkx185/
口径：GDP/三产增加值；附规上工业、社消零、固投、房开投资、CPI 同比。
**GDP ≠ 城市挂牌/网签均价、≠70城指数**；月度简况常无 GDP 则跳过。

用法：
  python scripts/crawl_gd_economy.py
  python scripts/crawl_gd_economy.py --max 8
"""
from __future__ import annotations

import argparse
import csv
import re
import ssl
import sys
import tempfile
import time
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "gd_economy.csv"
LIST_PAGES = [
    "http://stats.gd.gov.cn/tjkx185/index.html",
    "http://stats.gd.gov.cn/tjkx185/index_2.html",
    "http://stats.gd.gov.cn/tjkx185/index_3.html",
]
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

SEED_BRIEFS: list[tuple[str, str]] = [
    ("http://stats.gd.gov.cn/tjkx185/content/post_4927626.html", "2026年上半年广东经济运行简况"),
    ("http://stats.gd.gov.cn/tjkx185/content/post_4887418.html", "2026年一季度广东经济运行简况"),
    ("http://stats.gd.gov.cn/tjkx185/content/post_4850449.html", "2025年广东经济运行简况"),
]

FIELDS = [
    "region",
    "period",
    "period_label",
    "publish_date",
    "sort_key",
    "gdp_yi",
    "gdp_yoy_pct",
    "primary_va_yi",
    "primary_yoy_pct",
    "secondary_va_yi",
    "secondary_yoy_pct",
    "tertiary_va_yi",
    "tertiary_yoy_pct",
    "industry_yoy_pct",
    "retail_yoy_pct",
    "fa_yoy_pct",
    "re_investment_yoy_pct",
    "cpi_yoy_pct",
    "title",
    "source_org",
    "source_url",
]


def fetch_text(url: str) -> str:
    last_err: Exception | None = None
    candidates = [url]
    if url.startswith("https://"):
        candidates.append("http://" + url[len("https://") :])
    elif url.startswith("http://"):
        candidates.append("https://" + url[len("http://") :])
    for candidate in candidates:
        for attempt in range(3):
            try:
                raw = urlopen(Request(candidate, headers=UA), context=CTX, timeout=60).read()
                for enc in ("utf-8", "gbk"):
                    try:
                        return raw.decode(enc)
                    except Exception:
                        continue
                return raw.decode("utf-8", "replace")
            except Exception as e:
                last_err = e
                time.sleep(0.5 * (attempt + 1))
    raise last_err or RuntimeError(f"fetch failed: {url}")


def plain(html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text)


def fnum(s: str) -> float:
    return float(s.replace(",", ""))


def fmt(v: float) -> str:
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return f"{v:.4f}".rstrip("0").rstrip(".")


def signed_yoy(direction: str, pct: str) -> float:
    v = fnum(pct)
    if direction in ("下降", "减少", "回落"):
        return -v
    # 增长 / 上涨 / 上升
    return v


def parse_period(title: str) -> tuple[str, str, str] | None:
    t = title.replace("—", "-").replace("－", "-")
    m = re.search(r"(20\d{2})\s*年\s*1\s*-\s*(\d{1,2})\s*月", t)
    if m:
        y, mo = int(m.group(1)), int(m.group(2))
        return f"{y}_01_{mo:02d}", f"{y}年1-{mo}月", f"{y}-{mo:02d}"
    m = re.search(r"(20\d{2})\s*年\s*前三季度", t)
    if m:
        y = int(m.group(1))
        return f"{y}_Q3", f"{y}年前三季度", f"{y}-09"
    m = re.search(r"(20\d{2})\s*年\s*上半年", t)
    if m:
        y = int(m.group(1))
        return f"{y}_H1", f"{y}年上半年", f"{y}-06"
    m = re.search(r"(20\d{2})\s*年\s*一季度", t)
    if m:
        y = int(m.group(1))
        return f"{y}_Q1", f"{y}年一季度", f"{y}-03"
    m = re.search(r"(20\d{2})\s*年\s*广东?经济运行简况", t)
    if m and "月" not in t and "季度" not in t and "半年" not in t:
        y = int(m.group(1))
        return str(y), f"{y}年", f"{y}-12"
    return None


def one_yoy(text: str, *pats: str) -> float:
    for p in pats:
        m = re.search(p, text)
        if m:
            return signed_yoy(m.group(1), m.group(2))
    return 0.0


def list_briefs() -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for list_url in LIST_PAGES:
        try:
            html = fetch_text(list_url)
        except Exception as e:
            print(f"skip list {list_url}: {e}", flush=True)
            continue
        for m in re.finditer(r'href="([^"]*post_\d+\.html)"[^>]*>([^<]{0,120})</a>', html):
            title = unescape(m.group(2)).strip()
            if "经济运行简况" not in title:
                continue
            href = m.group(1)
            url = href if href.startswith("http") else ("http://stats.gd.gov.cn" + href if href.startswith("/") else href)
            out.append((url, title))
        time.sleep(0.2)
    seen: set[str] = set()
    uniq: list[tuple[str, str]] = []
    for url, title in out:
        if url in seen:
            continue
        seen.add(url)
        uniq.append((url, title))
    return uniq


def parse_brief(url: str, title: str, html: str) -> dict | None:
    period_info = parse_period(title)
    if not period_info:
        return None
    period, period_label, sort_key = period_info
    text = plain(html)

    gdp_yi = gdp_yoy = 0.0
    m_gdp = re.search(
        r"广东实现地区生产总值([\d.]+)亿元，按不变价格计算，(?:同比|比上年)(增长|下降)([\d.]+)%",
        text,
    )
    if m_gdp:
        gdp_yi = fnum(m_gdp.group(1))
        gdp_yoy = signed_yoy(m_gdp.group(2), m_gdp.group(3))
    else:
        m_gdp2 = re.search(
            r"地区生产总值([\d.]+)亿元，按不变价格计算，(?:同比|比上年)(增长|下降)([\d.]+)%",
            text,
        )
        if m_gdp2:
            gdp_yi = fnum(m_gdp2.group(1))
            gdp_yoy = signed_yoy(m_gdp2.group(2), m_gdp2.group(3))

    if gdp_yi == 0 or gdp_yoy == 0:
        return None

    primary_va = primary_yoy = 0.0
    secondary_va = secondary_yoy = 0.0
    tertiary_va = tertiary_yoy = 0.0
    m_ind = re.search(
        r"第一产业增加值([\d.]+)亿元，(增长|下降)([\d.]+)%[；;]?"
        r"第二产业增加值([\d.]+)亿元，(增长|下降)([\d.]+)%[；;]?"
        r"第三产业增加值([\d.]+)亿元，(增长|下降)([\d.]+)%",
        text,
    )
    if m_ind:
        primary_va = fnum(m_ind.group(1))
        primary_yoy = signed_yoy(m_ind.group(2), m_ind.group(3))
        secondary_va = fnum(m_ind.group(4))
        secondary_yoy = signed_yoy(m_ind.group(5), m_ind.group(6))
        tertiary_va = fnum(m_ind.group(7))
        tertiary_yoy = signed_yoy(m_ind.group(8), m_ind.group(9))

    industry = one_yoy(
        text,
        r"规模以上工业增加值(?:同比|比上年)(增长|下降)([\d.]+)%",
        r"全省规模以上工业增加值(?:同比|比上年)(增长|下降)([\d.]+)%",
    )
    retail = one_yoy(
        text,
        r"社会消费品零售总额(?:同比|比上年)(增长|下降)([\d.]+)%",
        r"全省社会消费品零售总额(?:同比|比上年)(增长|下降)([\d.]+)%",
    )
    fa = one_yoy(
        text,
        r"固定资产投资(?:同比|比上年)(下降|增长)([\d.]+)%",
        r"全省固定资产投资(?:同比|比上年)(下降|增长)([\d.]+)%",
    )
    re_inv = one_yoy(
        text,
        r"房地产开发投资(?:同比|比上年)?(下降|增长)([\d.]+)%",
        r"房地产开发投资(下降|增长)([\d.]+)%",
    )
    cpi = one_yoy(
        text,
        r"居民消费价格指数（CPI）(?:同比|比上年)(上涨|下降)([\d.]+)%",
        r"居民消费价格(?:指数)?(?:同比|比上年)(上涨|下降)([\d.]+)%",
    )

    pub = ""
    pm = re.search(r"(20\d{2}-\d{2}-\d{2})", html)
    if pm:
        pub = pm.group(1)

    return {
        "region": "广东",
        "period": period,
        "period_label": period_label,
        "publish_date": pub,
        "sort_key": sort_key,
        "gdp_yi": fmt(gdp_yi),
        "gdp_yoy_pct": fmt(gdp_yoy),
        "primary_va_yi": fmt(primary_va),
        "primary_yoy_pct": fmt(primary_yoy),
        "secondary_va_yi": fmt(secondary_va),
        "secondary_yoy_pct": fmt(secondary_yoy),
        "tertiary_va_yi": fmt(tertiary_va),
        "tertiary_yoy_pct": fmt(tertiary_yoy),
        "industry_yoy_pct": fmt(industry),
        "retail_yoy_pct": fmt(retail),
        "fa_yoy_pct": fmt(fa),
        "re_investment_yoy_pct": fmt(re_inv),
        "cpi_yoy_pct": fmt(cpi),
        "title": title,
        "source_org": "广东省统计局",
        "source_url": url,
    }


def load_existing(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return {r["period"]: r for r in csv.DictReader(f) if r.get("period")}


def atomic_write(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8-sig", newline="", delete=False, dir=str(path.parent), suffix=".tmp"
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=8)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    briefs = list_briefs()
    if not briefs:
        briefs = list(SEED_BRIEFS)
        print(f"list empty; fallback seeds n={len(briefs)}", flush=True)
    else:
        seen = {u for u, _ in briefs}
        for url, title in SEED_BRIEFS:
            if url not in seen:
                briefs.append((url, title))
        print(f"found {len(briefs)} economy briefs", flush=True)

    merged = load_existing(args.out)
    n_ok = 0
    for url, title in briefs:
        if n_ok >= args.max:
            break
        try:
            html = fetch_text(url)
            row = parse_brief(url, title, html)
            if not row:
                print(f"skip (no GDP) {title}", flush=True)
                continue
            merged[row["period"]] = row
            n_ok += 1
            print(
                f"ok {row['period']} gdp={row['gdp_yi']}亿 yoy={row['gdp_yoy_pct']}% "
                f"re_inv={row['re_investment_yoy_pct']}%",
                flush=True,
            )
        except Exception as e:
            print(f"ERR {title}: {e}", flush=True)

    rows = sorted(merged.values(), key=lambda r: r.get("sort_key", ""), reverse=True)
    if not rows:
        print("ERROR: no rows", file=sys.stderr)
        return 2
    if n_ok == 0:
        print("WARN: no fresh rows; kept existing seed", flush=True)
    atomic_write(args.out, rows)
    print(f"wrote {args.out} n={len(rows)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

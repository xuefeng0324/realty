#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广东省统计局「规模以上工业生产运行简况」。

列表：https://stats.gd.gov.cn/tjkx185/
口径：全省规上工业增加值同比 + 三大门类 + 重点行业；**≠房价三轴、≠城市挂牌/网签**。
与「经济运行简况」中的工业同比字段同源不同篇，本卡取工业专栏全文分项。

用法：
  python scripts/crawl_gd_industrial.py
  python scripts/crawl_gd_industrial.py --max 12
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
OUT = ROOT / "static" / "gd_industrial.csv"
LIST_PAGES = [
    "https://stats.gd.gov.cn/tjkx185/index.html",
    "https://stats.gd.gov.cn/tjkx185/index_2.html",
    "https://stats.gd.gov.cn/tjkx185/index_3.html",
    "https://stats.gd.gov.cn/tjkx185/index_4.html",
]
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

SEED_BRIEFS: list[tuple[str, str]] = [
    ("https://stats.gd.gov.cn/tjkx185/content/post_4927622.html", "2026年上半年广东规模以上工业生产运行简况"),
    ("https://stats.gd.gov.cn/tjkx185/content/post_4916178.html", "2026年1—5月份广东规模以上工业生产运行简况"),
]

FIELDS = [
    "region",
    "period",
    "period_label",
    "publish_date",
    "sort_key",
    "industry_yoy_pct",
    "mining_yoy_pct",
    "manufacturing_yoy_pct",
    "utilities_yoy_pct",
    "electronics_yoy_pct",
    "electrical_yoy_pct",
    "auto_yoy_pct",
    "robot_yoy_pct",
    "ic_yoy_pct",
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
    return -v if direction in ("下降", "减少", "回落") else v


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
    m = re.search(r"(20\d{2})\s*年\s*(\d{1,2})\s*月份?", t)
    if m:
        y, mo = int(m.group(1)), int(m.group(2))
        return f"{y}_{mo:02d}", f"{y}年{mo}月", f"{y}-{mo:02d}"
    m = re.search(r"(20\d{2})\s*年\s*广东?规模以上工业生产运行简况", t)
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


def publish_date(html: str, text: str) -> str:
    m = re.search(r"发布日期[：:]\s*(20\d{2}-\d{2}-\d{2})", text)
    if m:
        return m.group(1)
    m = re.search(r"发布日期[：:]\s*(20\d{2})年(\d{1,2})月(\d{1,2})日", text)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return ""


def abs_url(href: str) -> str:
    href = href.strip()
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http"):
        return href.replace("http://stats.gd.gov.cn", "https://stats.gd.gov.cn")
    if href.startswith("/"):
        return "https://stats.gd.gov.cn" + href
    return href


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
            if "规模以上工业生产运行简况" not in title:
                continue
            out.append((abs_url(m.group(1)), title))
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
    industry = one_yoy(
        text,
        r"全省规模以上工业增加值同比(增长|下降)([\d.]+)%",
        r"规模以上工业增加值同比(增长|下降)([\d.]+)%",
    )
    if industry == 0.0:
        return None
    mining = one_yoy(text, r"采矿业增加值同比(增长|下降)([\d.]+)%", r"规模以上采矿业增加值同比(增长|下降)([\d.]+)%")
    manufacturing = one_yoy(
        text,
        r"制造业增加值(增长|下降)([\d.]+)%",
        r"制造业增加值同比(增长|下降)([\d.]+)%",
    )
    utilities = one_yoy(
        text,
        r"电力、热力、燃气及水生产和供应业增加值(增长|下降)([\d.]+)%",
        r"电力、热力、燃气及水生产和供应业增加值同比(增长|下降)([\d.]+)%",
    )
    electronics = one_yoy(
        text,
        r"计算机、通信和其他电子设备制造业增加值同比(增长|下降)([\d.]+)%",
        r"规模以上计算机、通信和其他电子设备制造业增加值同比(增长|下降)([\d.]+)%",
    )
    electrical = one_yoy(
        text,
        r"电气机械和器材制造业增加值(增长|下降)([\d.]+)%",
        r"电气机械和器材制造业(增长|下降)([\d.]+)%",
    )
    auto = one_yoy(
        text,
        r"汽车制造业增加值(增长|下降)([\d.]+)%",
        r"汽车制造业(增长|下降)([\d.]+)%",
    )
    robot = one_yoy(text, r"工业机器人产品产量同比(增长|下降)([\d.]+)%")
    ic = one_yoy(text, r"集成电路(增长|下降)([\d.]+)%")
    return {
        "region": "广东",
        "period": period,
        "period_label": period_label,
        "publish_date": publish_date(html, text),
        "sort_key": sort_key,
        "industry_yoy_pct": fmt(industry),
        "mining_yoy_pct": fmt(mining),
        "manufacturing_yoy_pct": fmt(manufacturing),
        "utilities_yoy_pct": fmt(utilities),
        "electronics_yoy_pct": fmt(electronics),
        "electrical_yoy_pct": fmt(electrical),
        "auto_yoy_pct": fmt(auto),
        "robot_yoy_pct": fmt(robot),
        "ic_yoy_pct": fmt(ic),
        "title": title,
        "source_org": "广东省统计局",
        "source_url": url,
    }


def atomic_write(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8-sig", newline="", delete=False, dir=str(path.parent)
    ) as tmp:
        writer = csv.DictWriter(tmp, fieldnames=FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in FIELDS})
        tmp_name = tmp.name
    Path(tmp_name).replace(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=12)
    args = ap.parse_args()

    briefs = list(SEED_BRIEFS)
    try:
        listed = list_briefs()
        print(f"[list] {len(listed)} industrial briefs", flush=True)
        for url, title in listed:
            if all(url != u for u, _ in briefs):
                briefs.append((url, title))
    except Exception as e:
        print(f"[list] failed, seeds only: {e}", flush=True)

    merged: dict[str, dict] = {}
    if OUT.exists():
        with OUT.open(encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                p = str(row.get("period", "")).strip()
                if p:
                    merged[p] = row

    ok = 0
    for url, title in briefs[: max(1, args.max)]:
        try:
            html = fetch_text(url)
            row = parse_brief(url, title, html)
            if not row:
                print(f"skip parse {title}", flush=True)
                continue
            merged[row["period"]] = row
            ok += 1
            print(f"[ok] {row['period_label']} industry={row['industry_yoy_pct']}%", flush=True)
        except Exception as e:
            print(f"fail {url}: {e}", flush=True)
        time.sleep(0.35)

    rows = sorted(merged.values(), key=lambda r: str(r.get("sort_key", "")), reverse=True)
    atomic_write(OUT, rows)
    print(f"[done] {ok} fetched, {len(rows)} rows → {OUT}", flush=True)
    return 0 if ok or rows else 1


if __name__ == "__main__":
    sys.exit(main())

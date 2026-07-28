#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广东省统计局「规模以上服务业运行简况」。

列表：https://stats.gd.gov.cn/tjkx185/
口径：规上服务业营业收入同比 + 门类分项；**租赁和商务 / 房地产（不含开发）** 为住房弱相关，
**≠房价三轴、≠商品房开发投资/销售**。

用法：
  python scripts/crawl_gd_services.py
  python scripts/crawl_gd_services.py --max 12
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
OUT = ROOT / "static" / "gd_services.csv"
LIST_PAGES = [
    "https://stats.gd.gov.cn/tjkx185/index.html",
    "https://stats.gd.gov.cn/tjkx185/index_2.html",
    "https://stats.gd.gov.cn/tjkx185/index_3.html",
    "https://stats.gd.gov.cn/tjkx185/index_4.html",
]
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

SEED_BRIEFS: list[tuple[str, str]] = [
    ("https://stats.gd.gov.cn/tjkx185/content/post_4918845.html", "2026年1—5月份广东规模以上服务业运行简况"),
    ("https://stats.gd.gov.cn/tjkx185/content/post_4892650.html", "2026年一季度广东规模以上服务业运行简况"),
    ("https://stats.gd.gov.cn/tjkx185/content/post_4852547.html", "2025年广东规模以上服务业运行简况"),
]

FIELDS = [
    "region",
    "period",
    "period_label",
    "publish_date",
    "sort_key",
    "revenue_yoy_pct",
    "transport_yoy_pct",
    "it_yoy_pct",
    "real_estate_svc_yoy_pct",
    "leasing_yoy_pct",
    "science_yoy_pct",
    "environment_yoy_pct",
    "resident_svc_yoy_pct",
    "education_yoy_pct",
    "health_yoy_pct",
    "culture_yoy_pct",
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
    m = re.search(r"(20\d{2})\s*年\s*广东?规模以上服务业运行简况", t)
    if m and "月" not in t and "季度" not in t and "半年" not in t:
        y = int(m.group(1))
        return str(y), f"{y}年", f"{y}-12"
    return None


def one_yoy(text: str, *pats: str) -> float | None:
    for p in pats:
        m = re.search(p, text)
        if m:
            return signed_yoy(m.group(1), m.group(2))
    return None


def cat_yoy(text: str, name: str) -> float:
    esc = re.escape(name)
    v = one_yoy(text, rf"{esc}(?:同比)?(增长|下降)([\d.]+)%")
    return 0.0 if v is None else v


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
            if "规模以上服务业运行简况" not in title:
                continue
            out.append((abs_url(m.group(1)), title))
        for m in re.finditer(
            r'href="([^"]*post_\d+\.html)"[^>]*title="([^"]+)"',
            html,
            flags=re.I,
        ):
            title = unescape(m.group(2)).strip()
            if "规模以上服务业运行简况" not in title:
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
    revenue = one_yoy(
        text,
        # 常见：实现营业收入同比增长7.3% / 营业收入同比增长6.6%
        r"规模以上服务业(?:实现)?营业收入同比(增长|下降)([\d.]+)%",
        # 偶发插入绝对额：实现营业收入5.54万亿元，同比增长6.7%
        r"规模以上服务业(?:实现)?营业收入[^。]{0,40}?同比(增长|下降)([\d.]+)%",
    )
    if revenue is None:
        return None
    return {
        "region": "广东",
        "period": period,
        "period_label": period_label,
        "publish_date": publish_date(html, text),
        "sort_key": sort_key,
        "revenue_yoy_pct": fmt(revenue),
        "transport_yoy_pct": fmt(cat_yoy(text, "交通运输、仓储和邮政业")),
        "it_yoy_pct": fmt(cat_yoy(text, "信息传输、软件和信息技术服务业")),
        "real_estate_svc_yoy_pct": fmt(cat_yoy(text, "房地产（不含房地产开发）")),
        "leasing_yoy_pct": fmt(cat_yoy(text, "租赁和商务服务业")),
        "science_yoy_pct": fmt(cat_yoy(text, "科学研究和技术服务业")),
        "environment_yoy_pct": fmt(cat_yoy(text, "水利、环境和公共设施管理业")),
        "resident_svc_yoy_pct": fmt(cat_yoy(text, "居民服务、修理和其他服务业")),
        "education_yoy_pct": fmt(cat_yoy(text, "教育")),
        "health_yoy_pct": fmt(cat_yoy(text, "卫生和社会工作")),
        "culture_yoy_pct": fmt(cat_yoy(text, "文化、体育和娱乐业")),
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
        print(f"[list] {len(listed)} services briefs", flush=True)
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
            print(
                f"[ok] {row['period_label']} revenue={row['revenue_yoy_pct']}% "
                f"leasing={row['leasing_yoy_pct']}% re={row['real_estate_svc_yoy_pct']}%",
                flush=True,
            )
        except Exception as e:
            print(f"fail {title}: {e}", flush=True)
        time.sleep(0.35)

    rows = sorted(merged.values(), key=lambda r: str(r.get("sort_key", "")), reverse=True)
    atomic_write(OUT, rows)
    print(f"wrote {OUT} rows={len(rows)} ok={ok}", flush=True)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

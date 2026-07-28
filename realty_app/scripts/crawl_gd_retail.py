#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广东省统计局「消费品市场运行简况」。

列表：https://stats.gd.gov.cn/tjkx185/
口径：全省社消零同比 + 城乡 + 限上商品/餐饮 + 网上零售；**≠房价三轴**。
与「经济运行简况」中的社消零同比字段同源不同篇，本卡取消费品专栏分项。

用法：
  python scripts/crawl_gd_retail.py
  python scripts/crawl_gd_retail.py --max 12
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
OUT = ROOT / "static" / "gd_retail.csv"
LIST_PAGES = [
    "https://stats.gd.gov.cn/tjkx185/index.html",
    "https://stats.gd.gov.cn/tjkx185/index_2.html",
    "https://stats.gd.gov.cn/tjkx185/index_3.html",
    "https://stats.gd.gov.cn/tjkx185/index_4.html",
]
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

SEED_BRIEFS: list[tuple[str, str]] = [
    ("https://stats.gd.gov.cn/tjkx185/content/post_4927609.html", "2026年上半年广东消费品市场运行简况"),
    ("https://stats.gd.gov.cn/tjkx185/content/post_4916177.html", "2026年1—5月份广东消费品市场运行简况"),
]

FIELDS = [
    "region",
    "period",
    "period_label",
    "publish_date",
    "sort_key",
    "retail_total_yi",
    "retail_yoy_pct",
    "urban_yoy_pct",
    "rural_yoy_pct",
    "goods_retail_yoy_pct",
    "catering_yoy_pct",
    "online_retail_yoy_pct",
    "communications_yoy_pct",
    "furniture_yoy_pct",
    "decoration_yoy_pct",
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
    m = re.search(r"(20\d{2})\s*年\s*广东?消费品市场运行简况", t)
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
            if "消费品市场运行简况" not in title:
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


def listed_category_yoy(text: str, category: str) -> float:
    """解析「A类，B类…分别增长 x%、y%…」中某一类同比。"""
    # 中文分号常分隔两段「分别增长」，需与句号同等切开
    chunks = re.split(r"[。；;]", text)
    for sent in chunks:
        if "分别增长" not in sent or category not in sent:
            continue
        head, _, tail = sent.partition("分别增长")
        if category not in head:
            continue
        # 取「分别增长」前所有「…类」出现顺序（含「通讯器材类商品零售额」）
        norm = re.findall(r"([\u4e00-\u9fff]{1,24}类)", head)
        rates = [fnum(x) for x in re.findall(r"([\d.]+)%", tail)]
        for i, cat in enumerate(norm):
            if category in cat and i < len(rates):
                return rates[i]
    return 0.0


def parse_brief(url: str, title: str, html: str) -> dict | None:
    period_info = parse_period(title)
    if not period_info:
        return None
    period, period_label, sort_key = period_info
    text = plain(html)

    retail_total = 0.0
    retail = 0.0
    m_amt = re.search(
        r"全省(?:实现)?社会消费品零售总额([\d.]+)亿元，(?:同比)?(增长|下降)([\d.]+)%",
        text,
    )
    if m_amt:
        retail_total = fnum(m_amt.group(1))
        retail = signed_yoy(m_amt.group(2), m_amt.group(3))
    else:
        retail = one_yoy(
            text,
            r"全省(?:实现)?社会消费品零售总额同比(增长|下降)([\d.]+)%",
            r"社会消费品零售总额同比(增长|下降)([\d.]+)%",
        )
    if retail == 0.0 and retail_total == 0.0:
        return None

    urban = one_yoy(
        text,
        r"城镇消费品零售额(?:[\d.]+亿元，)?(?:同比)?(增长|下降)([\d.]+)%",
    )
    rural = one_yoy(
        text,
        r"乡村消费品零售额(?:[\d.]+亿元，)?(?:同比)?(增长|下降)([\d.]+)%",
    )
    goods = one_yoy(
        text,
        r"限额以上单位商品零售额(?:[\d.]+亿元，)?(?:同比)?(增长|下降)([\d.]+)%",
        r"(?<!餐饮)商品零售额(?:[\d.]+亿元，)?(?:同比)?(增长|下降)([\d.]+)%",
    )
    catering = one_yoy(
        text,
        r"限额以上单位餐饮收入(?:[\d.]+亿元，)?(?:同比)?(增长|下降)([\d.]+)%",
        r"餐饮收入(?:[\d.]+亿元，)?(?:同比)?(增长|下降)([\d.]+)%",
    )
    online = one_yoy(
        text,
        r"通过公共网络实现商品零售同比(增长|下降)([\d.]+)%",
        r"通过公共网络实现商品零售额(增长|下降)([\d.]+)%",
    )
    communications = listed_category_yoy(text, "通讯器材")
    furniture = listed_category_yoy(text, "家具")
    decoration = listed_category_yoy(text, "装潢材料")
    if decoration == 0.0:
        decoration = listed_category_yoy(text, "建筑及装潢")
    if decoration == 0.0:
        decoration = listed_category_yoy(text, "装潢")

    return {
        "region": "广东",
        "period": period,
        "period_label": period_label,
        "publish_date": publish_date(html, text),
        "sort_key": sort_key,
        "retail_total_yi": fmt(retail_total) if retail_total else "",
        "retail_yoy_pct": fmt(retail),
        "urban_yoy_pct": fmt(urban),
        "rural_yoy_pct": fmt(rural),
        "goods_retail_yoy_pct": fmt(goods),
        "catering_yoy_pct": fmt(catering),
        "online_retail_yoy_pct": fmt(online),
        "communications_yoy_pct": fmt(communications),
        "furniture_yoy_pct": fmt(furniture),
        "decoration_yoy_pct": fmt(decoration),
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
        print(f"[list] {len(listed)} retail briefs", flush=True)
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
                f"[ok] {row['period_label']} retail={row['retail_yoy_pct']}% total={row['retail_total_yi'] or '—'}",
                flush=True,
            )
        except Exception as e:
            print(f"fail {url}: {e}", flush=True)
        time.sleep(0.35)

    rows = sorted(merged.values(), key=lambda r: str(r.get("sort_key", "")), reverse=True)
    atomic_write(OUT, rows)
    print(f"[done] {ok} fetched, {len(rows)} rows → {OUT}", flush=True)
    return 0 if ok or rows else 1


if __name__ == "__main__":
    sys.exit(main())

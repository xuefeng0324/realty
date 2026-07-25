#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广东省住建厅「建筑业生产运行简况」。

列表：https://zfcxjst.gd.gov.cn/xxgk/tjxx/
口径：有总承包/专业承包资质建筑业企业总产值；**房屋建筑业产值≠商品房销售/挂牌均价**。

用法：
  python scripts/crawl_gd_construction.py
  python scripts/crawl_gd_construction.py --max 8
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
OUT = ROOT / "static" / "gd_construction.csv"
LIST_URL = "https://zfcxjst.gd.gov.cn/xxgk/tjxx/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

SEED_BRIEFS: list[tuple[str, str]] = [
    ("http://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4891219.html", "【图解数据】2026年一季度广东建筑业生产运行简况"),
    ("http://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4850770.html", "【图解数据】2025年广东建筑业生产运行简况"),
    ("http://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4703829.html", "【图解数据】2025年一季度广东建筑业生产运行简况"),
    ("http://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4673968.html", "【图解数据】2024年广东建筑业生产运行简况"),
]

FIELDS = [
    "region",
    "period",
    "period_label",
    "publish_date",
    "sort_key",
    "total_output_yi",
    "total_output_yoy_pct",
    "housing_output_yi",
    "housing_output_yoy_pct",
    "civil_output_yi",
    "civil_output_yoy_pct",
    "pr_output_yi",
    "pr_output_yoy_pct",
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
    return -v if direction in ("下降", "减少") else v


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
    m = re.search(r"(20\d{2})\s*年\s*广东?建筑业生产运行简况", t)
    if m and "月" not in t and "季度" not in t and "半年" not in t:
        y = int(m.group(1))
        return str(y), f"{y}年", f"{y}-12"
    return None


def abs_url(href: str) -> str:
    href = href.strip()
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http"):
        return href.replace("http://zfcxjst.gd.gov.cn", "https://zfcxjst.gd.gov.cn")
    if href.startswith("/"):
        return "https://zfcxjst.gd.gov.cn" + href
    return href


def list_briefs(max_pages: int = 1) -> list[tuple[str, str]]:
    urls = [LIST_URL]
    for i in range(2, max_pages + 1):
        urls.append(f"https://zfcxjst.gd.gov.cn/xxgk/tjxx/index_{i}.html")
    out: list[tuple[str, str]] = []
    for list_url in urls:
        try:
            html = fetch_text(list_url)
        except Exception as e:
            print(f"skip list {list_url}: {e}", flush=True)
            continue
        for m in re.finditer(
            r'title="([^"]+)"[^>]{0,220}href="([^"]*post_\d+\.html)"',
            html,
            flags=re.I,
        ):
            title = unescape(m.group(1)).strip()
            if "建筑业生产运行简况" not in title:
                continue
            out.append((abs_url(m.group(2)), title))
        for m in re.finditer(
            r'href="([^"]*post_\d+\.html)"[^>]{0,220}title="([^"]+)"',
            html,
            flags=re.I,
        ):
            title = unescape(m.group(2)).strip()
            if "建筑业生产运行简况" not in title:
                continue
            out.append((abs_url(m.group(1)), title))
    seen: set[str] = set()
    uniq: list[tuple[str, str]] = []
    for url, title in out:
        if url in seen:
            continue
        seen.add(url)
        uniq.append((url, title))
    return uniq


def parse_amt_yoy(text: str, *pats: str) -> tuple[float, float]:
    for p in pats:
        m = re.search(p, text)
        if not m:
            continue
        amt = fnum(m.group(1))
        yoy = 0.0
        if m.lastindex and m.lastindex >= 3 and m.group(2) and m.group(3):
            yoy = signed_yoy(m.group(2), m.group(3))
        return amt, yoy
    return 0.0, 0.0


def parse_brief(url: str, title: str, html: str) -> dict | None:
    period_info = parse_period(title)
    if not period_info:
        return None
    period, period_label, sort_key = period_info
    text = plain(html)

    total, total_yoy = parse_amt_yoy(
        text,
        r"完成(?:建筑业)?总产值([\d.,]+)亿元[，,](?:同比|比上年)(下降|增长)([\d.]+)%",
        r"完成建筑业总产值([\d.,]+)亿元[，,](?:同比|比上年)?(下降|增长)?([\d.]*)%?",
        r"完成总产值([\d.,]+)亿元[，,](?:同比|比上年)(下降|增长)([\d.]+)%",
    )
    housing, housing_yoy = parse_amt_yoy(
        text,
        r"房屋建筑业完成产值([\d.,]+)亿元[，,](?:同比|比上年)?(下降|增长)?([\d.]*)%?",
    )
    civil, civil_yoy = parse_amt_yoy(
        text,
        r"土木工程建筑业完成产值([\d.,]+)亿元[，,](?:同比|比上年)?(下降|增长)?([\d.]*)%?",
    )
    pr, pr_yoy = parse_amt_yoy(
        text,
        r"珠三角地区[^。]{0,40}完成建筑业总产值([\d.,]+)亿元[，,](?:同比|比上年)?(下降|增长)?([\d.]*)%?",
        r"珠三角地区[^。]{0,80}完成建筑业总产值([\d.,]+)亿元[，,](?:同比)?(下降|增长)?([\d.]*)%?",
    )

    pub = ""
    pm = re.search(r"(20\d{2}-\d{2}-\d{2})", html)
    if pm:
        pub = pm.group(1)

    if total <= 0 and housing <= 0:
        return None

    return {
        "region": "广东",
        "period": period,
        "period_label": period_label,
        "publish_date": pub,
        "sort_key": sort_key,
        "total_output_yi": fmt(total),
        "total_output_yoy_pct": fmt(total_yoy),
        "housing_output_yi": fmt(housing),
        "housing_output_yoy_pct": fmt(housing_yoy),
        "civil_output_yi": fmt(civil),
        "civil_output_yoy_pct": fmt(civil_yoy),
        "pr_output_yi": fmt(pr),
        "pr_output_yoy_pct": fmt(pr_yoy),
        "title": title,
        "source_org": "广东省住房和城乡建设厅",
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
    ap.add_argument("--list-pages", type=int, default=1)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    briefs = list_briefs(args.list_pages)
    if not briefs:
        briefs = list(SEED_BRIEFS)
        print(f"list empty; fallback seeds n={len(briefs)}", flush=True)
    else:
        seen = {u for u, _ in briefs}
        for url, title in SEED_BRIEFS:
            if url not in seen:
                briefs.append((url, title))
        print(f"found {len(briefs)} construction briefs", flush=True)

    merged = load_existing(args.out)
    n_ok = 0
    for url, title in briefs:
        if n_ok >= args.max:
            break
        try:
            html = fetch_text(url)
            row = parse_brief(url, title, html)
            if not row:
                print(f"skip parse {title}", flush=True)
                continue
            merged[row["period"]] = row
            n_ok += 1
            print(
                f"ok {row['period']} total={row['total_output_yi']}亿 "
                f"housing={row['housing_output_yi']}亿 yoy={row['total_output_yoy_pct']}%",
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

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广东省统计局「固定资产投资运行简况」同比指标。

列表：http://stats.gd.gov.cn/tjkx185/
口径：全省固投名义同比（不含农户）；**无绝对额亿元**；≠房价均价、≠70城指数。

用法：
  python scripts/crawl_gd_fa_investment.py
  python scripts/crawl_gd_fa_investment.py --max 8
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
OUT = ROOT / "static" / "gd_fa_investment.csv"
LIST_URL = "http://stats.gd.gov.cn/tjkx185/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

SEED_BRIEFS: list[tuple[str, str]] = [
    ("http://stats.gd.gov.cn/tjkx185/content/post_4927620.html", "2026年上半年广东固定资产投资运行简况"),
    ("http://stats.gd.gov.cn/tjkx185/content/post_4916180.html", "2026年1—5月份广东固定资产投资运行简况"),
    ("http://stats.gd.gov.cn/tjkx185/content/post_4903562.html", "2026年1—4月份广东固定资产投资运行简况"),
]

FIELDS = [
    "region",
    "period",
    "period_label",
    "publish_date",
    "sort_key",
    "fa_yoy_pct",
    "primary_yoy_pct",
    "secondary_yoy_pct",
    "tertiary_yoy_pct",
    "industry_yoy_pct",
    "manufacturing_yoy_pct",
    "pr_yoy_pct",
    "east_yoy_pct",
    "west_yoy_pct",
    "north_yoy_pct",
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
    m = re.search(r"(20\d{2})\s*年\s*广东?固定资产投资运行简况", t)
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
    try:
        html = fetch_text(LIST_URL)
    except Exception as e:
        print(f"skip list: {e}", flush=True)
        return []
    out: list[tuple[str, str]] = []
    for m in re.finditer(r'href="([^"]*post_\d+\.html)"[^>]*>([^<]{0,120})</a>', html):
        title = unescape(m.group(2)).strip()
        if "固定资产投资运行简况" not in title:
            continue
        href = m.group(1)
        url = href if href.startswith("http") else ("http://stats.gd.gov.cn" + href if href.startswith("/") else href)
        out.append((url, title))
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

    fa = one_yoy(text, r"固定资产投资同比(下降|增长)([\d.]+)%")
    primary = one_yoy(text, r"第一产业投资同比(下降|增长)([\d.]+)%")
    secondary = one_yoy(text, r"第二产业投资(?:同比)?(下降|增长)([\d.]+)%")
    tertiary = one_yoy(text, r"第三产业投资(?:同比)?(下降|增长)([\d.]+)%")
    industry = one_yoy(text, r"工业投资同比(下降|增长)([\d.]+)%")
    manufacturing = one_yoy(text, r"制造业投资(?:同比)?(下降|增长)([\d.]+)%")

    pr = east = west = north = 0.0
    m_reg = re.search(
        r"珠三角[、,，]粤东[、,，]粤西[、,，]粤北地区投资同比分别(下降|增长)([\d.]+)%[、,，]([\d.]+)%[、,，]([\d.]+)%和([\d.]+)%",
        text,
    )
    if m_reg:
        d = m_reg.group(1)
        pr = signed_yoy(d, m_reg.group(2))
        east = signed_yoy(d, m_reg.group(3))
        west = signed_yoy(d, m_reg.group(4))
        north = signed_yoy(d, m_reg.group(5))

    pub = ""
    pm = re.search(r"(20\d{2}-\d{2}-\d{2})", html)
    if pm:
        pub = pm.group(1)

    if fa == 0 and secondary == 0 and industry == 0:
        return None

    return {
        "region": "广东",
        "period": period,
        "period_label": period_label,
        "publish_date": pub,
        "sort_key": sort_key,
        "fa_yoy_pct": fmt(fa),
        "primary_yoy_pct": fmt(primary),
        "secondary_yoy_pct": fmt(secondary),
        "tertiary_yoy_pct": fmt(tertiary),
        "industry_yoy_pct": fmt(industry),
        "manufacturing_yoy_pct": fmt(manufacturing),
        "pr_yoy_pct": fmt(pr),
        "east_yoy_pct": fmt(east),
        "west_yoy_pct": fmt(west),
        "north_yoy_pct": fmt(north),
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
        print(f"found {len(briefs)} FA briefs", flush=True)

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
            print(f"ok {row['period']} fa_yoy={row['fa_yoy_pct']}% industry={row['industry_yoy_pct']}%", flush=True)
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

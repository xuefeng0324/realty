#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广东省住建厅「房地产市场运行简况」全省指标。

列表：http://zfcxjst.gd.gov.cn/xxgk/tjxx/
口径：全省累计新建商品房合同销售/开发投资；**非城市挂牌/网签均价、非70城指数**。

用法：
  python scripts/crawl_gd_real_estate_brief.py
  python scripts/crawl_gd_real_estate_brief.py --max 12
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
OUT = ROOT / "static" / "gd_real_estate_brief.csv"
LIST_URL = "https://zfcxjst.gd.gov.cn/xxgk/tjxx/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
# 列表偶发断连时的种子正文（可被列表抓取覆盖）
SEED_BRIEFS: list[tuple[str, str]] = [
    (
        "http://stats.gd.gov.cn/tjkx185/content/post_4927616.html",
        "2026年上半年广东房地产市场运行简况",
    ),
    (
        "http://stats.gd.gov.cn/tjkx185/content/post_4916181.html",
        "2026年1—5月份广东房地产市场运行简况",
    ),
    (
        "http://stats.gd.gov.cn/tjkx185/content/post_4903569.html",
        "2026年1—4月份广东房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4891221.html",
        "【图解数据】2026年一季度广东房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4872729.html",
        "【图解数据】2026年1—2月份广东房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4850764.html",
        "【图解数据】2025年广东房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4836762.html",
        "【图解数据】2025年1-11月份房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4808108.html",
        "【图解数据】2025年1-10月份房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4792406.html",
        "【图解数据】2025年前三季度广东房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4778686.html",
        "【图解数据】2025年1-8月份房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4763364.html",
        "【图解数据】2025年1-7月份房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4751554.html",
        "【图解数据】2025年上半年广东房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4734616.html",
        "【图解数据】2025年1-5月份房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4716839.html",
        "【图解数据】2025年1-4月份房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4704274.html",
        "【图解数据】2025年一季度房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4688603.html",
        "【图解数据】2025年1-2月份房地产市场运行简况",
    ),
    (
        "https://zfcxjst.gd.gov.cn/xxgk/tjxx/content/post_4673966.html",
        "【图解数据】2024年广东房地产市场运行简况",
    ),
]
STATS_LIST_URL = "http://stats.gd.gov.cn/tjkx185/index.html"

FIELDS = [
    "region",
    "period",
    "period_label",
    "publish_date",
    "sort_key",
    "investment_yi",
    "investment_yoy_pct",
    "residential_investment_yi",
    "sales_area_wan_sqm",
    "sales_area_yoy_pct",
    "residential_sales_area_wan_sqm",
    "sales_amount_yi",
    "sales_amount_yoy_pct",
    "residential_sales_amount_yi",
    "construction_area_wan_sqm",
    "completed_area_wan_sqm",
    "pr_sales_area_wan_sqm",
    "pr_investment_yi",
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
                time.sleep(0.6 * (attempt + 1))
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


def one(text: str, *pats: str) -> float:
    for p in pats:
        m = re.search(p, text)
        if m:
            return fnum(m.group(1))
    return 0.0


def one_yoy(text: str, *pats: str) -> float:
    for p in pats:
        m = re.search(p, text)
        if m:
            return signed_yoy(m.group(2), m.group(3))
    return 0.0


def abs_url(href: str) -> str:
    href = href.strip()
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return "https://zfcxjst.gd.gov.cn" + href
    return href.replace("http://zfcxjst.gd.gov.cn", "https://zfcxjst.gd.gov.cn")


def parse_period(title: str) -> tuple[str, str, str] | None:
    """返回 (period, period_label, sort_key YYYY-MM)。"""
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
    m = re.search(r"(20\d{2})\s*年\s*广东?房地产市场运行简况", t)
    if m and "月" not in t and "季度" not in t and "半年" not in t:
        y = int(m.group(1))
        return str(y), f"{y}年", f"{y}-12"
    return None


def list_briefs(max_pages: int = 1) -> list[tuple[str, str]]:
    urls = [LIST_URL, STATS_LIST_URL]
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
            if "房地产市场运行简况" not in title:
                continue
            href = m.group(2)
            if href.startswith("http"):
                out.append((href, title))
            elif href.startswith("/"):
                base = "http://stats.gd.gov.cn" if "stats.gd.gov.cn" in list_url else "https://zfcxjst.gd.gov.cn"
                out.append((base + href, title))
            else:
                out.append((abs_url(href), title))
        for m in re.finditer(r'href="([^"]*post_\d+\.html)"[^>]*>([^<]{0,120})</a>', html):
            title = unescape(m.group(2)).strip()
            if "房地产市场运行简况" not in title:
                continue
            href = m.group(1)
            if href.startswith("http"):
                out.append((href, title))
            elif href.startswith("/"):
                base = "http://stats.gd.gov.cn" if "stats.gd.gov.cn" in list_url else "https://zfcxjst.gd.gov.cn"
                out.append((base + href, title))
            else:
                out.append((abs_url(href), title))
        for m in re.finditer(
            r'href="([^"]*post_\d+\.html)"[^>]{0,220}title="([^"]+)"',
            html,
            flags=re.I,
        ):
            title = unescape(m.group(2)).strip()
            if "房地产市场运行简况" not in title:
                continue
            out.append((abs_url(m.group(1)) if not m.group(1).startswith("http") else m.group(1), title))
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

    m_inv = re.search(
        r"房地产开发投资([\d.,]+)亿元[，,](?:同比|比上年)?(下降|增长)?([\d.]*)%?",
        text,
    )
    inv = fnum(m_inv.group(1)) if m_inv else 0.0
    inv_yoy = (
        signed_yoy(m_inv.group(2), m_inv.group(3)) if m_inv and m_inv.group(2) and m_inv.group(3) else 0.0
    )

    res_inv = one(text, r"商品住宅投资([\d.,]+)亿元")

    m_area = re.search(
        r"(?:新建)?商品房销售面积([\d.,]+)万平方米[，,](?:同比|比上年)?(下降|增长)?([\d.]*)%?",
        text,
    )
    if not m_area:
        m_area = re.search(
            r"全省商品房销售面积([\d.,]+)万平方米[，,](?:同比|比上年)?(下降|增长)?([\d.]*)%?",
            text,
        )
    sales_area = fnum(m_area.group(1)) if m_area else 0.0
    sales_area_yoy = (
        signed_yoy(m_area.group(2), m_area.group(3)) if m_area and m_area.group(2) and m_area.group(3) else 0.0
    )

    res_area = one(
        text,
        r"其中(?:商品)?住宅销售面积([\d.,]+)万平方米",
        r"住宅销售面积([\d.,]+)万平方米",
    )

    m_amt = re.search(
        r"(?:全省)?(?:新建)?商品房销售额([\d.,]+)亿元[，,](?:同比|比上年)?(下降|增长)?([\d.]*)%?",
        text,
    )
    sales_amt = fnum(m_amt.group(1)) if m_amt else 0.0
    sales_amt_yoy = (
        signed_yoy(m_amt.group(2), m_amt.group(3)) if m_amt and m_amt.group(2) and m_amt.group(3) else 0.0
    )

    res_amt = one(
        text,
        r"其中(?:商品)?住宅销售额([\d.,]+)亿元",
        r"住宅销售额([\d.,]+)亿元",
    )

    construction = one(text, r"房屋施工面积([\d.,]+)万平方米")
    completed = one(text, r"房屋竣工面积([\d.,]+)万平方米")
    pr_sales = one(
        text,
        r"珠三角地区(?:新建)?商品房销售面积([\d.,]+)万平方米",
        r"珠三角地区销售面积([\d.,]+)万平方米",
    )
    pr_inv = one(text, r"珠三角地区房地产开发投资([\d.,]+)亿元")

    pub = ""
    pm = re.search(r"(20\d{2}-\d{2}-\d{2})", html)
    if pm:
        pub = pm.group(1)

    if sales_area <= 0 and sales_amt <= 0 and inv <= 0:
        return None

    source_org = "广东省住房和城乡建设厅"
    if "stats.gd.gov.cn" in url:
        source_org = "广东省统计局"

    return {
        "region": "广东",
        "period": period,
        "period_label": period_label,
        "publish_date": pub,
        "sort_key": sort_key,
        "investment_yi": fmt(inv),
        "investment_yoy_pct": fmt(inv_yoy),
        "residential_investment_yi": fmt(res_inv),
        "sales_area_wan_sqm": fmt(sales_area),
        "sales_area_yoy_pct": fmt(sales_area_yoy),
        "residential_sales_area_wan_sqm": fmt(res_area),
        "sales_amount_yi": fmt(sales_amt),
        "sales_amount_yoy_pct": fmt(sales_amt_yoy),
        "residential_sales_amount_yi": fmt(res_amt),
        "construction_area_wan_sqm": fmt(construction),
        "completed_area_wan_sqm": fmt(completed),
        "pr_sales_area_wan_sqm": fmt(pr_sales),
        "pr_investment_yi": fmt(pr_inv),
        "title": title,
        "source_org": source_org,
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
    ap.add_argument("--max", type=int, default=12)
    ap.add_argument("--list-pages", type=int, default=1)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    briefs = list_briefs(args.list_pages)
    if not briefs:
        briefs = list(SEED_BRIEFS)
        print(f"list empty; fallback seeds n={len(briefs)}", flush=True)
    else:
        # 保证种子期次在列表失败/截断时仍可刷新
        seen = {u for u, _ in briefs}
        for url, title in SEED_BRIEFS:
            if url not in seen:
                briefs.append((url, title))
        print(f"found {len(briefs)} realty briefs", flush=True)
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
                f"ok {row['period']} sales={row['sales_area_wan_sqm']}万㎡ "
                f"amt={row['sales_amount_yi']}亿 inv={row['investment_yi']}亿",
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

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家统计局「国民经济运行」通稿中的货物进出口（海关口径）。

海关总署官网 WAF（412）不可直抓；NBS 月度国民经济通稿附注写明「进出口数据来源于海关总署」。
与 SAFE 国际收支货服月度口径不同（海关全口径人民币值 vs 居民/非居民美元初步数）。

用法：
  python scripts/crawl_nbs_trade.py
  python scripts/crawl_nbs_trade.py --backfill --no-latest

≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城。
"""
from __future__ import annotations

import argparse
import csv
import html
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

INDEX_URL = "https://www.stats.gov.cn/sj/zxfb/"
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_trade.csv"

# 2026-02 … 2026-06（1—2 无单月绝对额，仅累计）
BACKFILL_URLS = [
    "https://www.stats.gov.cn/sj/zxfb/202603/t20260316_1962780.html",  # 1—2
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963330.html",  # 一季度 / 3月
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260518_1963732.html",  # 1—4 / 4月
    "https://www.stats.gov.cn/sj/zxfbhjd/202606/t20260616_1963954.html",  # 5月
    "https://www.stats.gov.cn/sj/zxfb/202607/t20260715_1964121.html",  # 上半年 / 6月
]

FIELDS = [
    "month",
    "publish_date",
    "total_month_yi",
    "total_month_yoy_pct",
    "export_month_yi",
    "export_month_yoy_pct",
    "import_month_yi",
    "import_month_yoy_pct",
    "surplus_month_yi",
    "total_cum_yi",
    "total_cum_yoy_pct",
    "export_cum_yi",
    "export_cum_yoy_pct",
    "import_cum_yi",
    "import_cum_yoy_pct",
    "surplus_cum_yi",
    "source_url",
]


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.href = ""
        self.text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "a":
            self.href = dict(attrs).get("href", "")
            self.text = []

    def handle_data(self, data: str) -> None:
        if self.href:
            self.text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.href:
            self.links.append((self.href, " ".join("".join(self.text).split())))
            self.href = ""
            self.text = []


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "realty-app-data-refresh/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read().decode("utf-8", errors="replace")


def fnum(s: str) -> float | None:
    t = (
        s.replace(",", "")
        .replace(" ", "")
        .replace("…", "")
        .replace("...", "")
        .replace("—", "")
        .replace("–", "")
        .strip()
    )
    if not t or t in {".", "-", "—"}:
        return None
    try:
        return float(t)
    except ValueError:
        return None


def cell_num(tok: str) -> float | None:
    """表单元格：省略号 → None。"""
    raw = tok.strip()
    if raw in {"…", "...", "—", "–", "-", "－", ""}:
        return None
    return fnum(raw)


def _f(v: float | None) -> str:
    if v is None:
        return ""
    return f"{v:g}"


def infer_month(plain: str, url: str) -> str:
    pub = re.search(r"/t(\d{4})(\d{2})\d{2}_", url)
    y = int(pub.group(1)) if pub else 2026

    # 单月叙述优先：「6月份，进出口总额47823亿元」（避免 1—2月份 误匹配 2月份）
    m = re.search(
        r"(?<![0-9—\-至])(\d{1,2})\s*月份[，,]\s*(?:货物)?进出口总额\s*[\d,.]+",
        plain,
    )
    if m:
        return f"{y}-{int(m.group(1)):02d}"

    if re.search(r"上半年", plain) and "进出口" in plain:
        return f"{y}-06"
    if re.search(r"一季度", plain) and "进出口" in plain:
        return f"{y}-03"

    # 1—N 累计通稿（N≥3）
    m = re.search(r"1\s*[—\-至]\s*([3-9]|1[0-2])\s*月份", plain)
    if m:
        return f"{y}-{int(m.group(1)):02d}"

    # 1—2 单独（无单月绝对额）
    if re.search(r"1\s*[—\-至]\s*2\s*月份", plain) or "1—2月份" in plain:
        return f"{y}-02"

    if pub:
        mo = int(pub.group(2))
        if mo == 1:
            return f"{y - 1}-12"
        return f"{y}-{mo - 1:02d}"
    raise RuntimeError(f"无法推断月份: {url}")


def parse_quad(plain: str, label: str) -> tuple[float | None, float | None, float | None, float | None]:
    """表行：标签 当月绝对额 当月同比 累计绝对额 累计同比（省略号保留为 token）。"""
    m = re.search(
        rf"{re.escape(label)}\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)",
        plain,
    )
    if not m:
        return None, None, None, None
    return cell_num(m.group(1)), cell_num(m.group(2)), cell_num(m.group(3)), cell_num(m.group(4))


def parse_prose_month(plain: str) -> dict[str, float | None]:
    out: dict[str, float | None] = {}
    m = re.search(
        r"(?<![0-9—\-至])(\d{1,2})\s*月份[，,]?\s*(?:货物)?进出口总额\s*([\d,.]+)\s*亿元[，,]?\s*同比(?:增长|下降)\s*([\d.]+)\s*%",
        plain,
    )
    if m:
        out["total_month_yi"] = fnum(m.group(2))
        lead = "下降" if "下降" in m.group(0)[m.start(2) :] else "增长"
        # re-check direction near 同比
        dm = re.search(r"同比(增长|下降)\s*([\d.]+)\s*%", m.group(0))
        if dm:
            v = fnum(dm.group(2))
            out["total_month_yoy_pct"] = (-v if dm.group(1) == "下降" and v is not None else v)
    m = re.search(
        r"(\d{1,2})\s*月份[，,].{0,80}?其中[，,]?\s*出口\s*([\d,.]+)\s*亿元[，,]?\s*(?:同比)?(?:增长|下降)\s*([\d.]+)\s*%"
        r"[；;，,]\s*进口\s*([\d,.]+)\s*亿元[，,]?\s*(?:同比)?(?:增长|下降)\s*([\d.]+)\s*%",
        plain,
    )
    if not m:
        m = re.search(
            r"其中[，,]?\s*出口\s*([\d,.]+)\s*亿元[，,]?\s*增长\s*([\d.]+)\s*%[；;，,]\s*进口\s*([\d,.]+)\s*亿元[，,]?\s*增长\s*([\d.]+)\s*%"
            r".{0,40}?(\d{1,2})\s*月份",
            plain,
        )
        if m:
            out["export_month_yi"] = fnum(m.group(1))
            out["export_month_yoy_pct"] = fnum(m.group(2))
            out["import_month_yi"] = fnum(m.group(3))
            out["import_month_yoy_pct"] = fnum(m.group(4))
            return out
    else:
        # signed yoy from local snippets
        chunk = m.group(0)

        def yoys(kind: str, abs_g: int, pct_g: int) -> None:
            out[f"{kind}_month_yi"] = fnum(m.group(abs_g))
            # find direction before pct in chunk
            sub = re.search(rf"{'出口' if kind == 'export' else '进口'}\s*[\d,.]+\s*亿元[，,]?\s*(?:同比)?(增长|下降)\s*([\d.]+)", chunk)
            if sub:
                v = fnum(sub.group(2))
                out[f"{kind}_month_yoy_pct"] = -v if sub.group(1) == "下降" and v is not None else v
            else:
                out[f"{kind}_month_yoy_pct"] = fnum(m.group(pct_g))

        yoys("export", 2, 3)
        yoys("import", 4, 5)
    return out


def parse_release(url: str, body: str) -> dict[str, str]:
    plain = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", body)).split())
    if "进出口总额" not in plain and "货物进出口" not in plain:
        raise RuntimeError(f"页面无进出口段落: {url}")

    month = infer_month(plain, url)
    pub = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)
    publish_date = "-".join(pub.groups()) if pub else ""

    t_m, t_my, t_c, t_cy = parse_quad(plain, "进出口总额（亿元）")
    if t_c is None:
        t_m, t_my, t_c, t_cy = parse_quad(plain, "进出口总额")
    e_m, e_my, e_c, e_cy = parse_quad(plain, "出口额")
    i_m, i_my, i_c, i_cy = parse_quad(plain, "进口额")

    prose = parse_prose_month(plain)
    if t_m is None:
        t_m = prose.get("total_month_yi")
    if t_my is None:
        t_my = prose.get("total_month_yoy_pct")
    if e_m is None:
        e_m = prose.get("export_month_yi")
    if e_my is None:
        e_my = prose.get("export_month_yoy_pct")
    if i_m is None:
        i_m = prose.get("import_month_yi")
    if i_my is None:
        i_my = prose.get("import_month_yoy_pct")

    # 累计散文兜底
    if t_c is None:
        m = re.search(
            r"(?:上半年|一季度|1\s*[—\-至]\s*\d{1,2}\s*月份)[，,]?\s*(?:货物)?进出口总额\s*([\d,.]+)\s*亿元[，,]?\s*同比(?:增长|下降)\s*([\d.]+)\s*%",
            plain,
        )
        if m:
            t_c = fnum(m.group(1))
            dm = re.search(r"同比(增长|下降)\s*([\d.]+)", m.group(0))
            if dm:
                v = fnum(dm.group(2))
                t_cy = -v if dm.group(1) == "下降" and v is not None else v

    if t_c is None and t_m is None:
        raise RuntimeError(f"未能解析进出口绝对额: {url}")

    surplus_m = None if e_m is None or i_m is None else round(e_m - i_m, 2)
    surplus_c = None if e_c is None or i_c is None else round(e_c - i_c, 2)

    # 1—2 等仅累计期：若当月绝对额缺失或被误填成累计，清空当月字段
    if t_m is not None and e_m is None and i_m is None and t_c is not None and t_m == t_c:
        t_m = t_my = None
        surplus_m = None

    return {
        "month": month,
        "publish_date": publish_date,
        "total_month_yi": _f(t_m),
        "total_month_yoy_pct": _f(t_my),
        "export_month_yi": _f(e_m),
        "export_month_yoy_pct": _f(e_my),
        "import_month_yi": _f(i_m),
        "import_month_yoy_pct": _f(i_my),
        "surplus_month_yi": _f(surplus_m),
        "total_cum_yi": _f(t_c),
        "total_cum_yoy_pct": _f(t_cy),
        "export_cum_yi": _f(e_c),
        "export_cum_yoy_pct": _f(e_cy),
        "import_cum_yi": _f(i_c),
        "import_cum_yoy_pct": _f(i_cy),
        "surplus_cum_yi": _f(surplus_c),
        "source_url": url,
    }


def find_release(index_html: str) -> str:
    parser = LinkParser()
    parser.feed(index_html)
    scored: list[tuple[int, str]] = []
    for href, text in parser.links:
        if not re.search(r"t\d+_\d+\.html", href):
            continue
        if any(k in text for k in ("答记者问", "解读", "初步核算")):
            continue
        score = 0
        if "国民经济" in text:
            score += 3
        if any(k in text for k in ("经济运行", "稳中有进", "发展态势", "开局", "合理区间", "向新向优")):
            score += 2
        if re.search(r"\d{1,2}\s*月份", text) or "上半年" in text or "一季度" in text or "1—" in text:
            score += 1
        if score >= 3:
            scored.append((score, urllib.parse.urljoin(INDEX_URL, html.unescape(href))))
    if not scored:
        # 备选首页
        alt = fetch("https://www.stats.gov.cn/sj/")
        parser2 = LinkParser()
        parser2.feed(alt)
        for href, text in parser2.links:
            if "国民经济" in text and re.search(r"t\d+_\d+\.html", href):
                if any(k in text for k in ("答记者问", "解读")):
                    continue
                return urllib.parse.urljoin("https://www.stats.gov.cn/sj/", html.unescape(href))
        raise RuntimeError("未找到国民经济运行通稿")
    scored.sort(key=lambda x: -x[0])
    return scored[0][1]


def load_existing() -> dict[str, dict[str, str]]:
    if not OUTPUT.exists():
        return {}
    with OUTPUT.open(encoding="utf-8", newline="") as f:
        return {row["month"]: row for row in csv.DictReader(f) if row.get("month")}


def write_rows(by_month: dict[str, dict[str, str]]) -> None:
    ordered = sorted(by_month.values(), key=lambda r: str(r.get("month", "")), reverse=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for row in ordered:
            writer.writerow({k: row.get(k, "") for k in FIELDS})


def merge_one(url: str, by_month: dict[str, dict[str, str]]) -> str:
    parsed = parse_release(url, fetch(url))
    month = str(parsed["month"])
    by_month[month] = parsed
    return month


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="")
    ap.add_argument("--backfill", action="store_true")
    ap.add_argument("--no-latest", action="store_true")
    args = ap.parse_args()

    by_month: dict[str, dict[str, str]] = {k: dict(v) for k, v in load_existing().items()}
    touched: list[str] = []

    if args.url:
        touched.append(merge_one(args.url, by_month))
    if args.backfill:
        for url in BACKFILL_URLS:
            try:
                touched.append(merge_one(url, by_month))
                print(f"[ok] {touched[-1]} ← {url}")
            except Exception as e:  # noqa: BLE001
                print(f"[warn] backfill skip {url}: {e}", file=sys.stderr)
    if not args.no_latest and not args.url:
        try:
            latest = find_release(fetch(INDEX_URL))
            touched.append(merge_one(latest, by_month))
            print(f"[ok] latest {touched[-1]} ← {latest}")
        except Exception as e:  # noqa: BLE001
            if not touched and not by_month:
                raise
            print(f"[warn] latest skip: {e}", file=sys.stderr)

    if not by_month:
        raise RuntimeError("无贸易数据可写")
    write_rows(by_month)
    print(f"wrote {OUTPUT} months={len(by_month)} touched={touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

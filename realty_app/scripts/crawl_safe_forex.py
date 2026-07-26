#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从国家外汇管理局抓取「外汇储备规模」月度公告 → CSV。

入口：
  - https://www.safe.gov.cn/ （首页）
  - https://www.safe.gov.cn/safe/whxw/index.html（新闻分页）
  - https://www.safe.gov.cn/safe/whcb/index.html（外汇储备专栏；可选官方储备资产 XLSX 补绝对值）

口径：月末外汇储备规模（亿美元）及环比；**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**。

用法：
  python scripts/crawl_safe_forex.py
  python scripts/crawl_safe_forex.py --max 40 --news-pages 20
"""
from __future__ import annotations

import argparse
import csv
import io
import re
import ssl
import tempfile
import time
import zipfile
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "seed" / "safe_forex.csv"
HOME_URL = "https://www.safe.gov.cn/"
LIST_URL = "https://www.safe.gov.cn/safe/whcb/index.html"
NEWS_URL = "https://www.safe.gov.cn/safe/whxw/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
FIELDS = ["date", "forex_usd_yi", "mom_delta_usd_yi", "mom_pct", "source_url"]
XLSX_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def fetch_bytes(url: str) -> bytes:
    return urlopen(Request(url, headers=UA), context=CTX, timeout=60).read()


def fetch_text(url: str) -> str:
    raw = fetch_bytes(url)
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", "replace")


def abs_url(href: str) -> str:
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return "https://www.safe.gov.cn" + href
    return href


def news_list_urls(pages: int) -> list[str]:
    out = [NEWS_URL]
    for i in range(2, max(2, pages + 1)):
        out.append(f"https://www.safe.gov.cn/safe/whxw/index_{i}.html")
    return out


def list_notices(*htmls: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for html in htmls:
        for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*)</a>', html):
            title = unescape(re.sub(r"\s+", " ", m.group(2))).strip()
            if "外汇储备" not in title:
                continue
            if "规模" not in title and "月末" not in title:
                continue
            # 排除经营访谈等非规模数据稿
            if "经营" in title or "访谈" in title or "人员" in title:
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


def parse_body(html: str, source_url: str) -> dict[str, str] | None:
    text = unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)))
    text = re.sub(r"\s+", " ", text).replace("\ufeff", "")
    # 无障碍/排版会在数字间插空格：「320 0 8 亿美元」→「32008 亿美元」
    text = re.sub(r"(?<=\d)\s+(?=\d)", "", text)

    dm = re.search(r"(20\d{2})\s*年\s*(\d{1,2})\s*月末", text)
    if not dm:
        return None
    y, mo = int(dm.group(1)), int(dm.group(2))
    date = f"{y}-{mo:02d}-01"

    fx = re.search(r"外汇储备规模为\s*([\d.]+)\s*亿美元", text)
    if not fx:
        # 兼容「规模 为 / 规模至」等轻微变体
        fx = re.search(r"外汇储备规模\s*[为至是]?\s*([\d.]+)\s*亿美元", text)
    if not fx:
        return None
    forex = fx.group(1)

    delta = ""
    mom_pct = ""
    dm2 = re.search(r"较\s*\d{1,2}\s*月末(上升|下降)\s*([\d.]+)\s*亿美元", text)
    if dm2:
        sign = 1 if dm2.group(1) == "上升" else -1
        delta = f"{sign * float(dm2.group(2)):g}"
    pm = re.search(r"(升幅|降幅)为\s*([\d.]+)\s*%", text)
    if pm:
        pct = float(pm.group(2))
        if pm.group(1) == "降幅":
            pct = -pct
        mom_pct = f"{pct:g}"

    return {
        "date": date,
        "forex_usd_yi": forex,
        "mom_delta_usd_yi": delta,
        "mom_pct": mom_pct,
        "source_url": source_url,
    }


def _col_row(cell_ref: str) -> tuple[str, int]:
    m = re.match(r"([A-Z]+)(\d+)$", cell_ref)
    if not m:
        return "", 0
    return m.group(1), int(m.group(2))


def parse_official_reserve_xlsx(data: bytes, source_url: str) -> list[dict[str, str]]:
    """官方储备资产表：第 1 行项目=外汇储备，各月「亿美元」列。"""
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
    except Exception:
        return []
    if "xl/sharedStrings.xml" not in z.namelist() or "xl/worksheets/sheet1.xml" not in z.namelist():
        return []
    ss_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    strs: list[str] = []
    for si in ss_root.findall("m:si", XLSX_NS):
        texts = [
            t.text or ""
            for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
        ]
        strs.append("".join(texts).replace("\xa0", " ").strip())

    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    grid: dict[int, dict[str, str]] = {}
    for c in sheet.findall(".//m:c", XLSX_NS):
        ref = c.get("r")
        if not ref:
            continue
        col, row = _col_row(ref)
        v_el = c.find("m:v", XLSX_NS)
        if not col or not row or v_el is None or v_el.text is None:
            continue
        if c.get("t") == "s":
            val = strs[int(v_el.text)]
        else:
            val = v_el.text
        grid.setdefault(row, {})[col] = val

    # row 4: month headers like 2026.01 in B,D,F,...
    month_by_col: dict[str, str] = {}
    for col, val in grid.get(4, {}).items():
        m = re.match(r"(20\d{2})\.(\d{1,2})$", val.strip())
        if m:
            month_by_col[col] = f"{int(m.group(1))}-{int(m.group(2)):02d}-01"

    forex_row = None
    for r, cols in grid.items():
        a = cols.get("A", "")
        if "外汇储备" in a and "Foreign" not in a:
            forex_row = cols
            break
    if not forex_row or not month_by_col:
        return []

    rows: list[dict[str, str]] = []
    for col, date in sorted(month_by_col.items(), key=lambda x: x[1]):
        raw = forex_row.get(col, "").strip()
        if not raw:
            continue
        try:
            fx = float(raw)
        except ValueError:
            continue
        if fx <= 0:
            continue
        rows.append(
            {
                "date": date,
                "forex_usd_yi": f"{fx:g}",
                "mom_delta_usd_yi": "",
                "mom_pct": "",
                "source_url": source_url,
            }
        )
    # fill mom from adjacent months when missing
    rows.sort(key=lambda x: x["date"])
    for i in range(1, len(rows)):
        cur, prev = rows[i], rows[i - 1]
        if cur["mom_delta_usd_yi"]:
            continue
        try:
            c, p = float(cur["forex_usd_yi"]), float(prev["forex_usd_yi"])
        except ValueError:
            continue
        if p == 0:
            continue
        d = c - p
        cur["mom_delta_usd_yi"] = f"{d:g}"
        cur["mom_pct"] = f"{(d / p) * 100:g}"
    return rows


def find_official_xlsx_url(whcb_html: str) -> str | None:
    # 官方储备资产年页 → xlsx
    m = re.search(r'href="(/safe/20\d{2}/\d+/[^"]+\.html)"[^>]*>[^<]*官方储备资产', whcb_html)
    if not m:
        m = re.search(r'href="(/safe/20\d{2}/\d+/[^"]+\.html)"[^>]*>\s*官方储备资产', whcb_html)
    page_url = abs_url(m.group(1)) if m else None
    if not page_url:
        # fallback: known pattern links near 官方
        for href, title in re.findall(r'href="([^"]+)"[^>]*>([^<]*)</a>', whcb_html):
            t = unescape(title)
            if "官方储备资产" in t and href.endswith(".html"):
                page_url = abs_url(href)
                break
    if not page_url:
        return None
    try:
        body = fetch_text(page_url)
    except Exception:
        return None
    for href in re.findall(r'href="([^"]+\.xlsx)"', body, flags=re.I):
        return abs_url(href)
    return None


def load_existing(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def atomic_write(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=str(path.parent), suffix=".tmp"
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def _is_notice_url(url: str) -> bool:
    u = url or ""
    return "/safe/" in u and u.endswith(".html") and "/file/" not in u


def merge_prefer_richer(existing: dict[str, str], fresh: dict[str, str]) -> dict[str, str]:
    """公告正文优先于官方储备 XLSX（环比口径以通稿为准）。"""
    a, b = existing, fresh
    # 若一方是公告、一方是 xlsx，以公告为底
    if _is_notice_url(fresh.get("source_url", "")) and not _is_notice_url(existing.get("source_url", "")):
        a, b = fresh, existing
    elif _is_notice_url(existing.get("source_url", "")) and not _is_notice_url(fresh.get("source_url", "")):
        a, b = existing, fresh
    out = {
        "date": a.get("date") or b.get("date") or "",
        "forex_usd_yi": a.get("forex_usd_yi") or b.get("forex_usd_yi") or "",
        "mom_delta_usd_yi": a.get("mom_delta_usd_yi") or b.get("mom_delta_usd_yi") or "",
        "mom_pct": a.get("mom_pct") or b.get("mom_pct") or "",
        "source_url": a.get("source_url") or b.get("source_url") or "",
    }
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=40)
    ap.add_argument("--news-pages", type=int, default=20)
    ap.add_argument("--sleep", type=float, default=0.35)
    ap.add_argument("--skip-xlsx", action="store_true")
    args = ap.parse_args()

    htmls: list[str] = []
    try:
        htmls.append(fetch_text(HOME_URL))
        print("[list] home ok")
    except Exception as exc:  # noqa: BLE001
        print(f"[list] home ERR {exc}")

    for u in news_list_urls(args.news_pages):
        try:
            htmls.append(fetch_text(u))
            print(f"[list] news {u.split('/')[-1]} ok")
            time.sleep(args.sleep)
        except Exception as exc:  # noqa: BLE001
            print(f"[list] news ERR {u}: {exc}")

    whcb = ""
    try:
        whcb = fetch_text(LIST_URL)
        htmls.append(whcb)
        print("[list] whcb ok")
    except Exception as exc:  # noqa: BLE001
        print(f"[list] whcb ERR {exc}")

    notices = list_notices(*htmls)[: args.max]
    print(f"[list] {len(notices)} notices")

    fresh: list[dict[str, str]] = []
    for i, (url, title) in enumerate(notices, 1):
        try:
            body = fetch_text(url)
            row = parse_body(body, url)
            print(f"  [{i}/{len(notices)}] {title[:40]} → {'ok' if row else 'skip'}")
            if row:
                fresh.append(row)
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}] ERR {type(exc).__name__}: {exc}")
        time.sleep(args.sleep)

    if not args.skip_xlsx and whcb:
        xurl = find_official_xlsx_url(whcb)
        if xurl:
            try:
                xrows = parse_official_reserve_xlsx(fetch_bytes(xurl), xurl)
                print(f"[xlsx] {len(xrows)} months from official reserve assets")
                fresh.extend(xrows)
            except Exception as exc:  # noqa: BLE001
                print(f"[xlsx] ERR {exc}")
        else:
            print("[xlsx] no official reserve xlsx link")

    by_date: dict[str, dict[str, str]] = {}
    for r in load_existing(OUT):
        if r.get("date"):
            by_date[r["date"]] = r
    for r in fresh:
        d = r.get("date") or ""
        if not d:
            continue
        if d in by_date:
            by_date[d] = merge_prefer_richer(by_date[d], r)
        else:
            by_date[d] = r

    rows = sorted(by_date.values(), key=lambda x: x["date"], reverse=True)
    atomic_write(OUT, rows)
    print(f"[done] {len(rows)} → {OUT}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取珠海住建局「保障性安居工程建设进展情况快报表」XLS。

列表：https://zjj.zhuhai.gov.cn/zjj/hysj/sjfb/
口径：累计至报告期末的新开工/基本建成/竣工套数与面积；**非商品房成交、非房价均价**。
依赖：xlrd（CI 与本地需 pip install xlrd；本机亦可使用 scripts/_vendor/xlrd）。

用法：
  python scripts/crawl_zh_affordable_progress.py
  python scripts/crawl_zh_affordable_progress.py --max 8
"""
from __future__ import annotations

import argparse
import csv
import re
import ssl
import sys
import tempfile
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "scripts" / "_vendor"
if VENDOR.is_dir():
    sys.path.insert(0, str(VENDOR))

try:
    import xlrd
except ImportError as exc:  # pragma: no cover
    raise SystemExit("需要 xlrd：pip install xlrd==2.0.1") from exc

OUT = ROOT / "static" / "zh_affordable_progress.csv"
LIST_URL = "https://zjj.zhuhai.gov.cn/zjj/hysj/sjfb/"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
TITLE_RE = re.compile(r"保障性安居工程建设进展情况快报表")

FIELDS = [
    "city",
    "year",
    "month",
    "report_date",
    "plan_invest_wan",
    "started_units",
    "started_area_sqm",
    "basically_completed_units",
    "basically_completed_area_sqm",
    "completed_units",
    "completed_area_sqm",
    "rental_subsidy_households",
    "public_rental_started_units",
    "public_rental_completed_units",
    "sale_type_started_units",
    "sale_type_completed_units",
    "protected_rental_started_units",
    "protected_rental_completed_units",
    "source_org",
    "source_url",
    "attachment_url",
]


def fetch_bytes(url: str, timeout: int = 60) -> bytes:
    req = Request(url, headers=UA)
    with urlopen(req, context=CTX, timeout=timeout) as resp:
        return resp.read()


def fetch_text(url: str) -> str:
    raw = fetch_bytes(url)
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", "replace")


def abs_url(base: str, href: str) -> str:
    href = href.strip()
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        from urllib.parse import urlparse

        p = urlparse(base)
        return f"{p.scheme}://{p.netloc}{href}"
    return base.rsplit("/", 1)[0] + "/" + href


def list_report_pages(max_pages: int = 3) -> list[tuple[str, str]]:
    """Return [(detail_url, title), ...] newest first."""
    out: list[tuple[str, str]] = []
    urls = [LIST_URL, LIST_URL + "index.html"]
    for i in range(2, max_pages + 1):
        urls.append(f"https://zjj.zhuhai.gov.cn/zjj/hysj/sjfb/index_{i}.html")
    for list_url in urls:
        try:
            html = fetch_text(list_url)
        except Exception as e:
            print(f"skip list {list_url}: {e}", flush=True)
            continue
        for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>', html, re.I):
            href = m.group(1)
            title = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", m.group(2)))).strip()
            if not TITLE_RE.search(title):
                continue
            # title may include trailing date
            title = re.sub(r"\s+\d{4}年\d{1,2}月\d{1,2}日\s*$", "", title).strip()
            out.append((abs_url(list_url, href), title))
    # dedupe preserve order
    seen: set[str] = set()
    uniq: list[tuple[str, str]] = []
    for url, title in out:
        if url in seen:
            continue
        seen.add(url)
        uniq.append((url, title))
    return uniq


def find_xls(detail_html: str, detail_url: str) -> str | None:
    for m in re.finditer(r'href="([^"]+\.xls)"', detail_html, re.I):
        return abs_url(detail_url, m.group(1))
    return None


def parse_year_month(title: str, sheet) -> tuple[int, int, str]:
    m = re.search(r"(20\d{2})年(\d{1,2})月", title)
    year = int(m.group(1)) if m else 0
    month = int(m.group(2)) if m else 0
    report_date = ""
    # 填报时间 in row 1
    for r in range(min(4, sheet.nrows)):
        for c in range(min(sheet.ncols, 14)):
            cell = str(sheet.cell_value(r, c))
            mm = re.search(r"填报时间[:：]\s*(20\d{2})年(\d{1,2})月(\d{1,2})日", cell)
            if mm:
                report_date = f"{mm.group(1)}-{int(mm.group(2)):02d}-{int(mm.group(3)):02d}"
                if not year:
                    year = int(mm.group(1))
                if not month:
                    month = int(mm.group(2))
    if not report_date and year and month:
        report_date = f"{year}-{month:02d}-01"
    return year, month, report_date


def _num(v) -> float:
    if v is None or v == "":
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def parse_xls(data: bytes, title: str, source_url: str, attachment_url: str) -> dict | None:
    book = xlrd.open_workbook(file_contents=data)
    sheet = book.sheet_by_index(0)
    year, month, report_date = parse_year_month(title, sheet)
    if year < 2000 or month < 1:
        print(f"WARN cannot parse year/month from {title}", flush=True)
        return None

    total = None
    subsidy = 0.0
    cats: dict[str, tuple[int, int]] = {
        "public_rental": (0, 0),
        "sale_type": (0, 0),
        "protected_rental": (0, 0),
    }
    for r in range(sheet.nrows):
        label = str(sheet.cell_value(r, 0)).strip().replace(" ", "")
        if label.startswith("1-11总计") or label == "1-11总计":
            total = [_num(sheet.cell_value(r, c)) for c in range(1, 14)]
        if "发放租赁补贴" in label:
            subsidy = _num(sheet.cell_value(r, 8)) or _num(sheet.cell_value(r, 1))
        # 分业态：取「小计/大类」行，避开项目明细
        started = int(_num(sheet.cell_value(r, 8)))
        completed = int(_num(sheet.cell_value(r, 12)))
        if "公共租赁住房小计" in label or label.startswith("1、公共租赁住房"):
            cats["public_rental"] = (started, completed)
        elif label.startswith("8、配售型保障性住房") or label == "8、配售型保障性住房":
            cats["sale_type"] = (started, completed)
        elif label.startswith("10、保障性租赁住房") or label == "10、保障性租赁住房":
            cats["protected_rental"] = (started, completed)

    if not total or len(total) < 13:
        print(f"WARN missing 1-11总计 in {attachment_url}", flush=True)
        return None

    # cols: 1 plan_invest, 8 started_units, 9 started_area, 10 basic_units, 11 basic_area, 12 done_units, 13 done_area
    return {
        "city": "珠海",
        "year": str(year),
        "month": str(month),
        "report_date": report_date,
        "plan_invest_wan": f"{total[0]:.2f}".rstrip("0").rstrip("."),
        "started_units": str(int(total[7])),
        "started_area_sqm": f"{total[8]:.2f}".rstrip("0").rstrip("."),
        "basically_completed_units": str(int(total[9])),
        "basically_completed_area_sqm": f"{total[10]:.2f}".rstrip("0").rstrip("."),
        "completed_units": str(int(total[11])),
        "completed_area_sqm": f"{total[12]:.2f}".rstrip("0").rstrip("."),
        "rental_subsidy_households": str(int(subsidy)),
        "public_rental_started_units": str(cats["public_rental"][0]),
        "public_rental_completed_units": str(cats["public_rental"][1]),
        "sale_type_started_units": str(cats["sale_type"][0]),
        "sale_type_completed_units": str(cats["sale_type"][1]),
        "protected_rental_started_units": str(cats["protected_rental"][0]),
        "protected_rental_completed_units": str(cats["protected_rental"][1]),
        "source_org": "珠海市住房和城乡建设局",
        "source_url": source_url,
        "attachment_url": attachment_url,
    }


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
    ap.add_argument("--max", type=int, default=8, help="max monthly reports")
    ap.add_argument("--list-pages", type=int, default=3)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    pages = list_report_pages(args.list_pages)
    print(f"found {len(pages)} report pages", flush=True)
    rows: list[dict] = []
    seen_ym: set[tuple[str, str]] = set()
    for url, title in pages:
        if len(rows) >= args.max:
            break
        try:
            html = fetch_text(url)
            xls = find_xls(html, url)
            if not xls:
                print(f"no xls: {title}", flush=True)
                continue
            data = fetch_bytes(xls)
            row = parse_xls(data, title, url, xls)
            if not row:
                continue
            key = (row["year"], row["month"])
            if key in seen_ym:
                continue
            seen_ym.add(key)
            rows.append(row)
            print(f"ok {row['year']}-{int(row['month']):02d} started={row['started_units']} completed={row['completed_units']}", flush=True)
        except Exception as e:
            print(f"ERR {title}: {e}", flush=True)

    rows.sort(key=lambda r: (int(r["year"]), int(r["month"])), reverse=True)
    if len(rows) < 1:
        print("ERROR: no rows", file=sys.stderr)
        return 2
    atomic_write(args.out, rows)
    print(f"wrote {args.out} n={len(rows)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

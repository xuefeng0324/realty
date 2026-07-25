#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广州市住建局保障性住房「已筹建 / 已竣工」项目清单 XLS 并汇总。

列表：https://zfcj.gz.gov.cn/zjyw/zfbz/zwxx/bzxzfxm/
口径：保障房 / 配售型 / 棚改项目套数汇总；**非商品房成交、非房价均价**。
依赖：xlrd（CI: pip install xlrd==2.0.1；本机可用 scripts/_vendor/xlrd）。

用法：
  python scripts/crawl_gz_affordable_projects.py
  python scripts/crawl_gz_affordable_projects.py --max 12
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

OUT = ROOT / "static" / "gz_affordable_projects.csv"
LIST_URL = "https://zfcj.gz.gov.cn/zjyw/zfbz/zwxx/bzxzfxm/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

FIELDS = [
    "city",
    "year",
    "as_of_month",
    "kind",  # raised | completed
    "category",  # 配售型保障性住房 | 保障性住房 | 棚户区改造
    "project_count",
    "total_units",
    "title",
    "source_org",
    "source_url",
    "attachment_url",
]

KIND_RE = re.compile(r"(已筹建|已竣工)")
YEAR_RE = re.compile(r"(20\d{2})年")
ASOF_RE = re.compile(r"截至\s*(\d{1,2})\s*月底")
SKIP_RE = re.compile(r"任务量完成|筹集建设计划|建设方案|规划建设方案")


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


def abs_url(href: str) -> str:
    href = href.strip()
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return "https://zfcj.gz.gov.cn" + href
    return href


def classify(title: str) -> tuple[str, str] | None:
    if SKIP_RE.search(title):
        return None
    km = KIND_RE.search(title)
    if not km:
        return None
    kind = "raised" if km.group(1) == "已筹建" else "completed"
    if "配售型" in title:
        category = "配售型保障性住房"
    elif "棚户区" in title:
        category = "棚户区改造"
    elif "保障性住房" in title:
        category = "保障性住房"
    else:
        return None
    return kind, category


def list_notices(max_pages: int = 2) -> list[tuple[str, str]]:
    urls = [LIST_URL]
    for i in range(2, max_pages + 1):
        urls.append(f"https://zfcj.gz.gov.cn/zjyw/zfbz/zwxx/bzxzfxm/index_{i}.html")
    out: list[tuple[str, str]] = []
    for list_url in urls:
        try:
            html = fetch_text(list_url)
        except Exception as e:
            print(f"skip list {list_url}: {e}", flush=True)
            continue
        for m in re.finditer(r'href="([^"]+)"[^>]*title="([^"]+)"', html):
            title = unescape(m.group(2)).strip()
            if not classify(title):
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


def find_xls(html: str) -> str | None:
    for m in re.finditer(r'href="([^"]+\.xls)"', html, re.I):
        return abs_url(m.group(1))
    return None


def find_units_col(sheet, header_row: int) -> int | None:
    for c in range(sheet.ncols):
        name = str(sheet.cell_value(header_row, c)).replace("\n", "").strip()
        if name in ("建设套数", "竣工套数"):
            return c
        if "筹建/竣工套数" in name or name == "套数":
            return c
    # merged header: look one row up
    if header_row > 0:
        for c in range(sheet.ncols):
            name = str(sheet.cell_value(header_row - 1, c)).replace("\n", "").strip()
            if name in ("建设套数", "竣工套数"):
                return c
    return None


def find_header_row(sheet) -> int | None:
    for r in range(min(6, sheet.nrows)):
        vals = [str(sheet.cell_value(r, c)) for c in range(sheet.ncols)]
        blob = "".join(vals)
        if any(k in blob for k in ("建设套数", "竣工套数", "筹建/竣工套数")):
            return r
        if "项目名称" in blob and ("序号" in blob or "建设单位" in blob):
            return r
    return None


def summarize_sheet(data: bytes) -> tuple[int, int]:
    book = xlrd.open_workbook(file_contents=data)
    sheet = book.sheet_by_index(0)
    header_row = find_header_row(sheet)
    if header_row is None:
        raise RuntimeError("找不到表头")
    col = find_units_col(sheet, header_row)
    if col is None:
        raise RuntimeError("找不到套数列")
    total = 0.0
    n = 0
    start = header_row + 1
    # skip sub-header row for 计划户型
    if start < sheet.nrows:
        sub = "".join(str(sheet.cell_value(start, c)) for c in range(min(8, sheet.ncols)))
        if any(k in sub for k in ("单间", "一房", "两房", "三房")):
            start += 1
    for r in range(start, sheet.nrows):
        v = sheet.cell_value(r, col)
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        if fv <= 0:
            continue
        # skip insane totals rows
        label0 = str(sheet.cell_value(r, 0))
        if "合计" in label0 or "总计" in label0:
            continue
        total += fv
        n += 1
    return n, int(round(total))


def parse_meta(title: str) -> tuple[int, int]:
    ym = YEAR_RE.search(title)
    year = int(ym.group(1)) if ym else 0
    am = ASOF_RE.search(title)
    month = int(am.group(1)) if am else 12
    return year, month


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
    ap.add_argument("--max", type=int, default=16)
    ap.add_argument("--list-pages", type=int, default=2)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    notices = list_notices(args.list_pages)
    print(f"found {len(notices)} notices", flush=True)
    rows: list[dict] = []
    best: dict[tuple[str, str, str], dict] = {}  # (year,kind,category) -> newest as_of

    for url, title in notices[: args.max * 2]:
        meta = classify(title)
        if not meta:
            continue
        kind, category = meta
        year, month = parse_meta(title)
        if year < 2000:
            print(f"skip no year: {title}", flush=True)
            continue
        try:
            html = fetch_text(url)
            xls = find_xls(html)
            if not xls:
                print(f"no xls: {title}", flush=True)
                continue
            data = fetch_bytes(xls)
            n, units = summarize_sheet(data)
            if n < 1 or units < 1:
                print(f"empty sheet: {title}", flush=True)
                continue
            row = {
                "city": "广州",
                "year": str(year),
                "as_of_month": str(month),
                "kind": kind,
                "category": category,
                "project_count": str(n),
                "total_units": str(units),
                "title": title,
                "source_org": "广州市住房和城乡建设局",
                "source_url": url,
                "attachment_url": xls,
            }
            key = (str(year), kind, category)
            prev = best.get(key)
            if prev is None or int(row["as_of_month"]) >= int(prev["as_of_month"]):
                best[key] = row
            print(f"ok {year}-{month:02d} {kind}/{category} n={n} units={units}", flush=True)
            if len(best) >= args.max:
                # keep scanning a bit for newer as_of of same keys
                pass
        except Exception as e:
            print(f"ERR {title}: {e}", flush=True)

    rows = list(best.values())
    rows.sort(
        key=lambda r: (int(r["year"]), int(r["as_of_month"]), r["kind"], r["category"]),
        reverse=True,
    )
    if len(rows) < 1:
        print("ERROR: no rows", file=sys.stderr)
        return 2
    atomic_write(args.out, rows)
    print(f"wrote {args.out} n={len(rows)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广州市住建局保障房「年度项目建设计划任务量完成」XLS 中的目标与完成。

列表：https://zfcj.gz.gov.cn/zjyw/zfbz/zwxx/bzxzfxm/
口径：报表标题/表头中的年度目标套数 + 合计/分区实际套数；**非商品房成交、非房价**。
与已筹建清单互补：本表提供「目标 vs 完成」。

用法：
  python scripts/crawl_gz_affordable_targets.py
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

OUT = ROOT / "static" / "gz_affordable_targets.csv"
LIST_URL = "https://zfcj.gz.gov.cn/zjyw/zfbz/zwxx/bzxzfxm/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

FIELDS = [
    "city",
    "year",
    "as_of_month",
    "metric",  # raised | completed
    "category",
    "target_units",
    "actual_units",
    "actual_area_wan_sqm",
    "title",
    "source_org",
    "source_url",
    "attachment_url",
]

YEAR_RE = re.compile(r"(20\d{2})年")
ASOF_RE = re.compile(r"截至\s*(\d{1,2})\s*月底")
RAISE_TARGET_RE = re.compile(r"新筹集建设[^\d]{0,20}(\d+)\s*套")
COMPLETE_TARGET_RE = re.compile(r"竣工[^\d]{0,30}(\d+)\s*套")
BASIC_TARGET_RE = re.compile(r"基本建[成]?[^\d]{0,20}(\d+)\s*套")


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


def list_task_notices(max_pages: int = 2) -> list[tuple[str, str]]:
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
            if "任务量完成" not in title:
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


def _num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def category_from_blob(blob: str) -> str:
    if "配售型" in blob:
        return "配售型保障性住房"
    if "安居工程" in blob:
        return "保障性安居工程"
    return "保障性住房"


def parse_task_xls(data: bytes, title: str, source_url: str, attachment_url: str) -> list[dict]:
    book = xlrd.open_workbook(file_contents=data)
    sheet = book.sheet_by_index(0)
    ym = YEAR_RE.search(title)
    year = int(ym.group(1)) if ym else 0
    am = ASOF_RE.search(title)
    month = int(am.group(1)) if am else 12
    if year < 2000:
        return []

    blob_parts: list[str] = [title]
    for r in range(sheet.nrows):
        for c in range(min(2, sheet.ncols)):  # 首列常含年度目标句
            blob_parts.append(str(sheet.cell_value(r, c)))
    blob = "\n".join(blob_parts)
    category = category_from_blob(blob)
    raise_target = 0
    m = RAISE_TARGET_RE.search(re.sub(r"\s+", "", blob))
    if m:
        raise_target = int(m.group(1))
    complete_target = 0
    m = COMPLETE_TARGET_RE.search(re.sub(r"\s+", "", blob))
    if not m:
        m = BASIC_TARGET_RE.search(re.sub(r"\s+", "", blob))
    if m:
        complete_target = int(m.group(1))

    header_row = None
    unit_col = None
    area_col = None
    for r in range(min(5, sheet.nrows)):
        for c in range(sheet.ncols):
            name = str(sheet.cell_value(r, c)).replace("\n", "")
            if "筹建/竣工套数" in name or "实际开工" in name:
                header_row = r
                unit_col = c
            if "万平方米" in name:
                area_col = c
        if unit_col is not None:
            break

    total_units = 0
    total_area = 0.0
    raise_units = 0
    raise_area = 0.0
    complete_units = 0
    complete_area = 0.0
    section = "raised"  # raised until 竣工/基本建成清单

    for r in range(sheet.nrows):
        label0 = str(sheet.cell_value(r, 0)).replace("\n", "").strip()
        if "竣工项目清单" in label0 or "基本建成项目清单" in label0:
            section = "completed"
        if "合计" in label0 or "总计" in label0 or "新开工合计" in label0:
            if unit_col is None:
                continue
            v = int(_num(sheet.cell_value(r, unit_col)))
            a = _num(sheet.cell_value(r, area_col)) if area_col is not None else 0.0
            if "新开工" in label0 or section == "raised":
                if v > 0:
                    raise_units = v
                    raise_area = a
            if "合计" in label0 and "新开工" not in label0:
                total_units = v
                total_area = a
            continue
        if unit_col is None or header_row is None or r <= header_row:
            continue
        v = _num(sheet.cell_value(r, unit_col))
        # 分区标题行偶发把目标写在首列，但仍可能有本行套数（勿因「清单/任务」跳过）
        if not (1 <= v <= 50000):
            continue
        a = _num(sheet.cell_value(r, area_col)) if area_col is not None else 0.0
        if section == "raised":
            raise_units += int(v)
            raise_area += a
        else:
            complete_units += int(v)
            complete_area += a
    # Dec-style single list with 合计 → treat as raised actual
    if total_units > 0 and raise_units <= 0:
        raise_units = total_units
        raise_area = total_area

    rows: list[dict] = []
    base = {
        "city": "广州",
        "year": str(year),
        "as_of_month": str(month),
        "category": category,
        "title": title,
        "source_org": "广州市住房和城乡建设局",
        "source_url": source_url,
        "attachment_url": attachment_url,
    }
    if raise_target > 0 or raise_units > 0:
        rows.append(
            {
                **base,
                "metric": "raised",
                "target_units": str(raise_target),
                "actual_units": str(raise_units),
                "actual_area_wan_sqm": f"{raise_area:.3f}".rstrip("0").rstrip(".") if raise_area else "0",
            }
        )
    if complete_target > 0 or complete_units > 0:
        rows.append(
            {
                **base,
                "metric": "completed",
                "target_units": str(complete_target),
                "actual_units": str(complete_units),
                "actual_area_wan_sqm": f"{complete_area:.3f}".rstrip("0").rstrip(".") if complete_area else "0",
            }
        )
    return rows


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
    ap.add_argument("--list-pages", type=int, default=2)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    notices = list_task_notices(args.list_pages)
    print(f"found {len(notices)} task notices", flush=True)
    best: dict[tuple[str, str, str], dict] = {}  # year,metric,category -> newest as_of

    for url, title in notices:
        try:
            html = fetch_text(url)
            xls = find_xls(html)
            if not xls:
                print(f"no xls: {title}", flush=True)
                continue
            data = fetch_bytes(xls)
            for row in parse_task_xls(data, title, url, xls):
                key = (row["year"], row["metric"], row["category"])
                prev = best.get(key)
                if prev is None or int(row["as_of_month"]) >= int(prev["as_of_month"]):
                    best[key] = row
                print(
                    f"ok {row['year']}-{int(row['as_of_month']):02d} {row['metric']} "
                    f"target={row['target_units']} actual={row['actual_units']}",
                    flush=True,
                )
        except Exception as e:
            print(f"ERR {title}: {e}", flush=True)

    rows = list(best.values())
    if args.max > 0:
        rows = rows[: args.max]
    rows.sort(key=lambda r: (int(r["year"]), int(r["as_of_month"]), r["metric"]), reverse=True)
    if len(rows) < 1:
        print("ERROR: no rows", file=sys.stderr)
        return 2
    atomic_write(args.out, rows)
    print(f"wrote {args.out} n={len(rows)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

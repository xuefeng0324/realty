#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取深圳市住建局保障性住房 / 公共住房「建设筹集 / 基本建成」项目表。

列表：https://zjj.sz.gov.cn/ztfw/zfbz/xmxx2017/
口径：项目表套数合计；**非商品房成交、非房价均价**。
附件多为 PDF（pypdf 提取文本）；部分年份为 xlsx。

用法：
  python scripts/crawl_sz_affordable_projects.py
  python scripts/crawl_sz_affordable_projects.py --max 8
"""
from __future__ import annotations

import argparse
import csv
import io
import re
import ssl
import sys
import tempfile
import types
import zipfile
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "scripts" / "_vendor"
if VENDOR.is_dir():
    sys.path.insert(0, str(VENDOR))


def _ensure_pil_stub() -> None:
    """pypdf 6 顶层 import PIL；无 PIL 或本机 PIL 损坏时注入 stub。"""
    try:
        import PIL  # noqa: F401

        getattr(PIL, "__version__")
        return
    except Exception:
        pass
    pil = types.ModuleType("PIL")
    pil.__version__ = "0.0.0"
    img = types.ModuleType("PIL.Image")

    class Image:  # noqa: N801
        pass

    img.Image = Image
    sys.modules["PIL"] = pil
    sys.modules["PIL.Image"] = img


_ensure_pil_stub()
try:
    from pypdf import PdfReader
except ImportError as exc:  # pragma: no cover
    raise SystemExit("需要 pypdf：pip install pypdf") from exc

OUT = ROOT / "static" / "sz_affordable_projects.csv"
LIST_URL = "https://zjj.sz.gov.cn/ztfw/zfbz/xmxx2017/"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

FIELDS = [
    "city",
    "year",
    "kind",  # raised | completed
    "category",
    "project_count",
    "total_units",
    "title",
    "source_org",
    "source_url",
]

YEAR_RE = re.compile(r"(20\d{2})年")
# 套数后紧跟建设筹集方式关键词
UNIT_RE = re.compile(
    r"(?<![\d./])(\d{1,5})\s+"
    r"(建设|筹集|国有企事业|其他产权|公共设施|城市更新|产业园区|货币补贴|招拍挂|新供应|已完成|盘活|利用闲置)"
)


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
        return "https://zjj.sz.gov.cn" + href
    return href


def classify(title: str) -> tuple[str, str] | None:
    if "季度" in title:
        return None  # 年报优先，跳过季度碎片
    if "基本建成" in title or "竣工" in title:
        kind = "completed"
    elif "筹集" in title or "建设筹集" in title:
        kind = "raised"
    else:
        return None
    if "保障性住房" in title:
        category = "保障性住房"
    elif "公共住房" in title:
        category = "公共住房"
    elif "安居工程" in title:
        category = "安居工程"
    else:
        category = "保障性住房"
    return kind, category


def list_attachments() -> list[tuple[str, str]]:
    html = fetch_text(LIST_URL)
    out: list[tuple[str, str]] = []
    for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>', html, re.I):
        href = m.group(1)
        title = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", m.group(2)))).strip()
        if not title or not classify(title):
            continue
        url = abs_url(href)
        if not re.search(r"\.(pdf|xlsx?)$", url, re.I):
            continue
        out.append((url, title))
    seen: set[str] = set()
    uniq: list[tuple[str, str]] = []
    for url, title in out:
        if url in seen:
            continue
        seen.add(url)
        uniq.append((url, title))
    return uniq


def pdf_text(data: bytes) -> str:
    rdr = PdfReader(io.BytesIO(data))
    return "\n".join((p.extract_text() or "") for p in rdr.pages)


def load_xlsx_rows(data: bytes) -> dict[int, dict[str, str]]:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.findall("m:si", NS):
                texts = [t.text or "" for t in si.findall(".//m:t", NS)]
                shared.append("".join(texts))
        sheet_name = next(n for n in zf.namelist() if n.startswith("xl/worksheets/sheet"))
        root = ET.fromstring(zf.read(sheet_name))
        rows: dict[int, dict[str, str]] = {}
        for c in root.findall(".//m:c", NS):
            ref = c.get("r")
            if not ref:
                continue
            m = re.fullmatch(r"([A-Z]+)(\d+)", ref)
            if not m:
                continue
            col, row = m.group(1), int(m.group(2))
            v = c.find("m:v", NS)
            if v is None or v.text is None:
                val = ""
            elif c.get("t") == "s":
                val = shared[int(v.text)]
            else:
                val = v.text
            rows.setdefault(row, {})[col] = val
        return rows


def summarize_pdf(data: bytes) -> tuple[int, int]:
    text = pdf_text(data)
    hits = UNIT_RE.findall(text)
    units = [int(n) for n, _ in hits if 1 <= int(n) <= 20000]
    if len(units) < 3:
        raise RuntimeError(f"PDF 套数命中过少: {len(units)}")
    return len(units), sum(units)


def summarize_xlsx(data: bytes) -> tuple[int, int]:
    rows = load_xlsx_rows(data)
    # find header col with 套
    header_row = None
    unit_col = None
    for r, cols in rows.items():
        for col, val in cols.items():
            if "套" in str(val) and ("建设" in str(val) or "筹集" in str(val) or "建成" in str(val) or "竣工" in str(val) or val.strip() == "套数"):
                header_row = r
                unit_col = col
                break
            if str(val).strip() in ("实际建设/筹集套数", "实际基本建成/竣工总套数", "套数"):
                header_row = r
                unit_col = col
                break
        if unit_col:
            break
    if not unit_col:
        # fallback: scan all numeric cells in last numeric-looking column
        raise RuntimeError("xlsx 找不到套数列")
    total = 0
    n = 0
    for r, cols in rows.items():
        if header_row is not None and r <= header_row:
            continue
        raw = str(cols.get(unit_col, "")).strip()
        try:
            v = float(raw)
        except ValueError:
            continue
        if v < 1 or v > 20000:
            continue
        total += int(v)
        n += 1
    if n < 1:
        raise RuntimeError("xlsx 无有效套数")
    return n, total


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

    items = list_attachments()
    print(f"found {len(items)} attachments", flush=True)
    best: dict[tuple[str, str, str], dict] = {}

    for url, title in items:
        meta = classify(title)
        if not meta:
            continue
        kind, category = meta
        ym = YEAR_RE.search(title)
        if not ym:
            continue
        year = ym.group(1)
        key = (year, kind, category)
        if key in best:
            continue
        if len(best) >= args.max:
            break
        try:
            data = fetch_bytes(url)
            if url.lower().endswith(".pdf"):
                n, units = summarize_pdf(data)
            else:
                n, units = summarize_xlsx(data)
            row = {
                "city": "深圳",
                "year": year,
                "kind": kind,
                "category": category,
                "project_count": str(n),
                "total_units": str(units),
                "title": title,
                "source_org": "深圳市住房和建设局",
                "source_url": url,
            }
            best[key] = row
            print(f"ok {year} {kind}/{category} n={n} units={units}", flush=True)
        except Exception as e:
            print(f"ERR {title}: {e}", flush=True)

    rows = list(best.values())
    rows.sort(key=lambda r: (int(r["year"]), r["kind"], r["category"]), reverse=True)
    if len(rows) < 1:
        print("ERROR: no rows", file=sys.stderr)
        return 2
    atomic_write(args.out, rows)
    print(f"wrote {args.out} n={len(rows)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

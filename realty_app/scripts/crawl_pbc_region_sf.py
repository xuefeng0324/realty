#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从央行抓取「地区社会融资规模增量统计表」XLSX → 广东行 CSV。

列表：http://www.pbc.gov.cn/diaochatongjisi/116219/116225/index.html
口径：省级社融增量（亿元）；**≠ 房价、≠ 挂牌、≠ 网签**。仅入库广东（本产品三城所在省）。

用法：
  python scripts/crawl_pbc_region_sf.py
  python scripts/crawl_pbc_region_sf.py --max 8
"""
from __future__ import annotations

import argparse
import csv
import re
import ssl
import tempfile
import time
import xml.etree.ElementTree as ET
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "seed" / "pbc_region_sf.csv"
LIST_URL = "http://www.pbc.gov.cn/diaochatongjisi/116219/116225/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
FIELDS = [
    "period",
    "label",
    "region",
    "sf_flow_yi",
    "rmb_loan_yi",
    "corp_bond_yi",
    "gov_bond_yi",
    "equity_yi",
    "source_url",
    "xlsx_url",
]
TARGET = "广东"


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
        return "http://www.pbc.gov.cn" + href
    return href


def period_from_title(title: str) -> tuple[str, str] | None:
    m = re.search(r"(20\d{2})年(\d{1,2})月", title)
    if m:
        y, mo = int(m.group(1)), int(m.group(2))
        return f"{y}-{mo:02d}", f"{y}年{mo}月"
    m = re.search(r"(20\d{2})年上半年", title)
    if m:
        y = int(m.group(1))
        return f"{y}-06", f"{y}年上半年"
    m = re.search(r"(20\d{2})年一季度", title)
    if m:
        y = int(m.group(1))
        return f"{y}-03", f"{y}年一季度"
    m = re.search(r"(20\d{2})年前三季度", title)
    if m:
        y = int(m.group(1))
        return f"{y}-09", f"{y}年前三季度"
    m = re.search(r"(20\d{2})年地区社会融资", title)
    if m and "月" not in title and "季" not in title and "半年" not in title:
        y = int(m.group(1))
        return f"{y}-12", f"{y}年全年"
    return None


def list_pages(html: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*地区社会融资[^<]*)</a>', html):
        title = unescape(m.group(2)).strip()
        out.append((abs_url(m.group(1)), title))
    seen: set[str] = set()
    uniq: list[tuple[str, str]] = []
    for url, title in out:
        if url in seen:
            continue
        seen.add(url)
        uniq.append((url, title))
    return uniq


def find_xlsx(html: str) -> str | None:
    for m in re.finditer(r'href="([^"]+\.xlsx)"', html, flags=re.I):
        return abs_url(m.group(1))
    # 附件文案旁链接
    m = re.search(r'href="([^"]+)"[^>]*>[^<]*\.xlsx', html, flags=re.I)
    if m:
        return abs_url(m.group(1))
    return None


def _col_row(ref: str) -> tuple[int, int]:
    m = re.match(r"([A-Z]+)(\d+)", ref or "")
    if not m:
        return 1, 1
    col_i = 0
    for ch in m.group(1):
        col_i = col_i * 26 + (ord(ch) - 64)
    return col_i, int(m.group(2))


def read_xlsx_rows(data: bytes) -> list[list[str]]:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(data)
        path = Path(tmp.name)
    try:
        with ZipFile(path) as z:
            shared: list[str] = []
            if "xl/sharedStrings.xml" in z.namelist():
                root = ET.fromstring(z.read("xl/sharedStrings.xml"))
                for si in root.findall("m:si", NS):
                    texts = [t.text or "" for t in si.findall(".//m:t", NS)]
                    shared.append("".join(texts))
            # sheet1 = 当期；sheet2 常为历史样例表，跳过
            sheet_name = "xl/worksheets/sheet1.xml"
            if sheet_name not in z.namelist():
                sheets = sorted(n for n in z.namelist() if n.startswith("xl/worksheets/sheet"))
                if not sheets:
                    return []
                sheet_name = sheets[0]
            root = ET.fromstring(z.read(sheet_name))
            grid: dict[tuple[int, int], str] = {}
            max_r = max_c = 0
            for c in root.findall(".//m:c", NS):
                col_i, row = _col_row(c.attrib.get("r", ""))
                t = c.attrib.get("t")
                v = c.find("m:v", NS)
                if v is None or v.text is None:
                    val = ""
                elif t == "s":
                    idx = int(v.text)
                    val = shared[idx] if 0 <= idx < len(shared) else ""
                else:
                    val = v.text
                grid[(row, col_i)] = val
                max_r = max(max_r, row)
                max_c = max(max_c, col_i)
            return [[grid.get((r, c), "") for c in range(1, max_c + 1)] for r in range(1, max_r + 1)]
    finally:
        path.unlink(missing_ok=True)


def _fnum(s: str) -> str:
    s = (s or "").strip().replace(",", "")
    if not s:
        return ""
    try:
        return f"{float(s):g}"
    except ValueError:
        return ""


def extract_guangdong(rows: list[list[str]]) -> dict[str, str] | None:
    # 定位表头：含「人民币贷款」的行
    header_i = -1
    for i, r in enumerate(rows[:20]):
        joined = "".join(r)
        if "人民币贷款" in joined and ("社会融资" in joined or i > 0):
            header_i = i
            break
    # 列索引：第 0 列地区名；第 1 列总量；其后按常见顺序
    # 新表：总量, 人民币贷款, 外币, 委托, 信托, 承兑, 企业债, 政府债, 股票
    for r in rows:
        name = (r[0] if r else "").strip()
        if not name.startswith(TARGET):
            continue
        # 跳过空数据行
        if len(r) < 3:
            continue
        total = _fnum(r[1] if len(r) > 1 else "")
        if not total:
            continue
        # 政府债列：若表头含政府债券则约在 index 8，否则空
        has_gov = any("政府债券" in "".join(rows[j]) for j in range(max(0, header_i), header_i + 3) if header_i >= 0)
        if has_gov and len(r) >= 9:
            corp, gov, equity = _fnum(r[7]), _fnum(r[8]), _fnum(r[9]) if len(r) > 9 else ""
        else:
            corp = _fnum(r[7]) if len(r) > 7 else ""
            gov = ""
            equity = _fnum(r[8]) if len(r) > 8 else ""
        return {
            "region": TARGET,
            "sf_flow_yi": total,
            "rmb_loan_yi": _fnum(r[2]) if len(r) > 2 else "",
            "corp_bond_yi": corp,
            "gov_bond_yi": gov,
            "equity_yi": equity,
        }
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=8)
    ap.add_argument("--sleep", type=float, default=0.4)
    args = ap.parse_args()

    list_html = fetch_text(LIST_URL)
    pages = list_pages(list_html)[: args.max]
    print(f"[list] {len(pages)} region SF pages")
    if not pages:
        return 1

    fresh: list[dict[str, str]] = []
    for i, (url, title) in enumerate(pages, 1):
        per = period_from_title(title)
        if not per:
            print(f"  [{i}] skip title {title[:40]}")
            continue
        period, label = per
        try:
            html = fetch_text(url)
            xurl = find_xlsx(html)
            if not xurl:
                print(f"  [{i}] no xlsx {title[:36]}")
                continue
            rows = read_xlsx_rows(fetch_bytes(xurl))
            gd = extract_guangdong(rows)
            print(f"  [{i}/{len(pages)}] {title[:36]} → {'ok' if gd else 'miss'}")
            if not gd:
                continue
            fresh.append(
                {
                    "period": period,
                    "label": label,
                    **gd,
                    "source_url": url,
                    "xlsx_url": xurl,
                }
            )
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}] ERR {type(exc).__name__}: {exc}")
        time.sleep(args.sleep)

    by_period = {r["period"]: r for r in load_existing(OUT)}
    for r in fresh:
        by_period[r["period"]] = r
    rows = sorted(by_period.values(), key=lambda x: x["period"], reverse=True)
    atomic_write(OUT, rows)
    print(f"[done] {len(rows)} → {OUT}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())

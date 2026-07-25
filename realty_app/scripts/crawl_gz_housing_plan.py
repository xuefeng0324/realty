#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取广州市住建局《住房发展年度计划》公文附件指标。

列表：https://zfcj.gz.gov.cn/zwgk/xxgkml/qt/ghjh/
口径：计划批准预售面积 / 商品住宅用地 / 保障性住房筹建 —— **非成交、非可售库存、非成交均价**。
附件可能是旧版 .doc（OLE）或实为 ZIP 的 .docx（扩展名仍为 .doc）。

用法：
  python scripts/crawl_gz_housing_plan.py
"""
from __future__ import annotations

import argparse
import csv
import re
import ssl
import sys
import tempfile
import zipfile
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "gz_housing_plan.csv"
LIST_URL = "https://zfcj.gz.gov.cn/zwgk/xxgkml/qt/ghjh/"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()

FIELDS = [
    "city",
    "year",
    "publish_date",
    "approved_presale_area_wan_sqm",
    "approved_presale_units_wan",
    "residential_land_ha",
    "affordable_units_wan",
    "source_org",
    "source_url",
    "attachment_url",
]


def fetch_bytes(url: str, timeout: int = 60) -> bytes:
    req = Request(url, headers=UA)
    with urlopen(req, context=CTX, timeout=timeout) as resp:
        return resp.read()


def fetch_text(url: str) -> str:
    return fetch_bytes(url).decode("utf-8", "replace")


def abs_url(href: str) -> str:
    href = href.strip()
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return "https://zfcj.gz.gov.cn" + href
    return href


def list_plan_notices(html: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for m in re.finditer(
        r'href="([^"]+)"[^>]*title="([^"]*住房发展年度计划[^"]*)"',
        html,
    ):
        out.append((abs_url(m.group(1)), unescape(m.group(2)).strip()))
    # fallback: anchor text
    if not out:
        for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*住房发展年度计划[^<]*)', html):
            out.append((abs_url(m.group(1)), unescape(m.group(2)).strip()))
    return out


def extract_year(title: str, body: str) -> int | None:
    m = re.search(r"(20\d{2})年住房发展年度计划", title) or re.search(
        r"(20\d{2})年住房发展年度计划", body
    )
    return int(m.group(1)) if m else None


def docx_text(data: bytes) -> str:
    with zipfile.ZipFile(__import__("io").BytesIO(data)) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    parts = [
        (n.text or "")
        for n in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t")
    ]
    return "".join(parts)


def ole_doc_text(data: bytes) -> str:
    # Best-effort: UTF-16LE runs inside OLE WordDocument stream
    return data.decode("utf-16le", "ignore")


def attachment_text(data: bytes) -> str:
    if data[:2] == b"PK":
        return docx_text(data)
    return ole_doc_text(data)


def parse_metrics(body: str) -> dict[str, float]:
    area = None
    units = None
    land = None
    affordable = None

    m = re.search(r"批准预售商品住[房宅]建筑面积([\d.]+)万平方米", body)
    if m:
        area = float(m.group(1))
    m = re.search(r"房源约([\d.]+)万套", body)
    if m:
        units = float(m.group(1))
    m = re.search(r"供应商品住宅用地([\d.]+)公顷", body)
    if m:
        land = float(m.group(1))
    # 2026: 筹集建设保障性住房3万套；2025 有分项，取「保障性住房」合计若有
    m = re.search(r"筹集建设保障性住房([\d.]+)万套", body)
    if m:
        affordable = float(m.group(1))
    else:
        # 2025 正文未必有「合计万套」，允许空
        affordable = None

    if area is None and land is None:
        raise RuntimeError("未解析到批准预售面积或住宅用地指标")

    return {
        "approved_presale_area_wan_sqm": area or 0.0,
        "approved_presale_units_wan": units or 0.0,
        "residential_land_ha": land or 0.0,
        "affordable_units_wan": affordable or 0.0,
    }


def parse_notice(url: str, title: str) -> dict | None:
    html = fetch_text(url)
    body_hint = re.sub(r"<[^>]+>", " ", html)
    year = extract_year(title, body_hint)
    if not year:
        return None

    pub = ""
    pm = re.search(r'name="PubDate"\s+content="([0-9]{4}-[0-9]{2}-[0-9]{2})', html)
    if not pm:
        pm = re.search(r"发布时间：(?:<[^>]+>)*\s*([0-9]{4}-[0-9]{2}-[0-9]{2})", html)
    if pm:
        pub = pm.group(1)

    att = None
    for m in re.finditer(r'href="([^"]+\.(?:doc|docx))"', html, re.I):
        att = abs_url(m.group(1))
        break
    if not att:
        raise RuntimeError(f"未找到附件: {url}")

    data = fetch_bytes(att)
    text = attachment_text(data)
    metrics = parse_metrics(text)
    return {
        "city": "广州",
        "year": year,
        "publish_date": pub,
        **metrics,
        "source_org": "广州市住房和城乡建设局",
        "source_url": url.replace("http://", "https://"),
        "attachment_url": att.replace("http://", "https://"),
    }


def write_csv(rows: list[dict], path: Path) -> None:
    rows = sorted(rows, key=lambda r: int(r["year"]), reverse=True)
    seen: set[int] = set()
    uniq: list[dict] = []
    for r in rows:
        y = int(r["year"])
        if y in seen:
            continue
        seen.add(y)
        uniq.append(r)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=str(path.parent)
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        for r in uniq:
            w.writerow({k: r.get(k, "") for k in FIELDS})
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--max", type=int, default=6)
    args = ap.parse_args()

    html = fetch_text(LIST_URL)
    notices = list_plan_notices(html)
    if not notices:
        print("列表未找到住房发展年度计划", file=sys.stderr)
        return 1

    rows: list[dict] = []
    for url, title in notices[: args.max]:
        try:
            row = parse_notice(url, title)
            if row:
                rows.append(row)
                print(
                    f"OK {row['year']} area={row['approved_presale_area_wan_sqm']} "
                    f"land={row['residential_land_ha']} affordable={row['affordable_units_wan']}"
                )
        except Exception as e:
            print(f"ERR {title}: {e}", file=sys.stderr)

    if not rows:
        print("无有效行", file=sys.stderr)
        return 2

    write_csv(rows, args.out)
    print(f"wrote {len(rows)} -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

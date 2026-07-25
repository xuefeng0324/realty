"""抓取珠海市教育局「基础教育学校数」官方 XLSX → education_overview.csv。

来源：https://www.zhuhai.gov.cn/xw/ztjj/zhszdlyxxgkzl/ywjyxxgk/sj/
口径：基础教育（幼儿园/小学/初中/高中/特殊教育/专门）；不含高等教育与中职列。
在校生/民办未在该表公布 → 对应字段为 0（UI 降级，不伪造）。
专门学校不计入 special_count（special=特殊教育学校列）。
"""

from __future__ import annotations

import argparse
import csv
import html
import io
import re
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "static" / "education_overview.csv"
INDEX_URL = "https://www.zhuhai.gov.cn/xw/ztjj/zhszdlyxxgkzl/ywjyxxgk/sj/"
SOURCE_HOSTS = {"www.zhuhai.gov.cn"}
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
FIELDS = [
    "city",
    "period",
    "publish_date",
    "total_schools",
    "total_students_10k",
    "kindergarten_count",
    "compulsory_count",
    "primary_count",
    "junior_high_count",
    "senior_high_count",
    "vocational_count",
    "special_count",
    "private_count",
    "source_org",
    "source_url",
]


def fetch_bytes(url: str) -> bytes:
    last_error: Exception | None = None
    for attempt in range(3):
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; realty-app-data-refresh/1.0)",
                "Accept-Encoding": "identity",
                "Connection": "close",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read()
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(attempt + 1)
    raise RuntimeError(f"官方资源请求失败：{url}：{last_error}") from last_error


def fetch_text(url: str) -> str:
    return fetch_bytes(url).decode("utf-8", errors="replace")


def discover_latest() -> tuple[str, str, str]:
    """返回 (period_year, xlsx_url, publish_date)。"""
    body = fetch_text(INDEX_URL)
    candidates: list[tuple[int, str, str]] = []
    for m in re.finditer(
        r'href="([^"]+\.xlsx)"[^>]*>\s*([^<]*基础教育学校数[^<]*)',
        body,
        re.I,
    ):
        href, title = m.group(1), html.unescape(m.group(2)).strip()
        year_m = re.search(r"(20\d{2})", title)
        if not year_m:
            continue
        url = urllib.parse.urljoin(INDEX_URL, href)
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in SOURCE_HOSTS:
            continue
        window = body[max(0, m.start() - 400) : m.start()]
        date_m = re.search(r"(20\d{2}-\d{2}-\d{2})", window)
        candidates.append((int(year_m.group(1)), url, date_m.group(1) if date_m else ""))

    if not candidates:
        candidates.append(
            (2024, "https://www.zhuhai.gov.cn/attachment/0/406/406911/3901462.xlsx", "2025-06-16")
        )

    period_i, url, publish = max(candidates, key=lambda x: x[0])
    return str(period_i), url, publish or "2025-06-16"


def _col_row(ref: str) -> tuple[str, int]:
    m = re.fullmatch(r"([A-Z]+)(\d+)", ref)
    if not m:
        raise RuntimeError(f"无效单元格引用：{ref}")
    return m.group(1), int(m.group(2))


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
            col, row = _col_row(ref)
            v = c.find("m:v", NS)
            if v is None or v.text is None:
                val = ""
            elif c.get("t") == "s":
                val = shared[int(v.text)]
            else:
                val = v.text
            rows.setdefault(row, {})[col] = val
        return rows


def _cell_int(rows: dict[int, dict[str, str]], row: int, col: str, label: str) -> int:
    raw = str(rows.get(row, {}).get(col, "")).strip()
    try:
        return int(float(raw or "0"))
    except ValueError as exc:
        raise RuntimeError(f"珠海学校数非数字：{label}={raw}") from exc


def parse_school_count_xlsx(
    data: bytes, period: str, publish_date: str, source_url: str
) -> dict[str, str | int | float]:
    rows = load_xlsx_rows(data)
    header_row = None
    for r, cols in rows.items():
        vals = "".join(cols.values())
        if "幼儿园" in vals and "普通小学" in vals:
            header_row = r
            break
    if header_row is None:
        raise RuntimeError("珠海学校数表缺少表头")

    header = rows[header_row]
    col_map: dict[str, str] = {}
    for col, name in header.items():
        name = str(name).strip()
        if name == "幼儿园":
            col_map["kindergarten"] = col
        elif name == "普通小学":
            col_map["primary"] = col
        elif "初中" in name:
            col_map["junior"] = col
        elif "高中" in name:
            col_map["senior"] = col
        elif "特殊教育" in name:
            col_map["special"] = col
        elif "专门" in name:
            col_map["specialized"] = col
        elif name == "合计":
            col_map["total"] = col

    for key in ("kindergarten", "primary", "junior", "senior", "special", "total"):
        if key not in col_map:
            raise RuntimeError(f"珠海学校数表缺少列：{key}")

    total_row = None
    for r, cols in rows.items():
        if r <= header_row:
            continue
        ordered = [cols[c] for c in sorted(cols, key=lambda x: (len(x), x))]
        if ordered and str(ordered[0]).strip() in {"总计", "合计"}:
            total_row = r
            break
    if total_row is None:
        raise RuntimeError("珠海学校数表缺少总计行")

    kindergarten = _cell_int(rows, total_row, col_map["kindergarten"], "幼儿园")
    primary = _cell_int(rows, total_row, col_map["primary"], "普通小学")
    junior = _cell_int(rows, total_row, col_map["junior"], "普通初中")
    senior = _cell_int(rows, total_row, col_map["senior"], "普通高中")
    special = _cell_int(rows, total_row, col_map["special"], "特殊教育")
    total = _cell_int(rows, total_row, col_map["total"], "合计")
    specialized = (
        _cell_int(rows, total_row, col_map["specialized"], "专门学校") if "specialized" in col_map else 0
    )
    if total != kindergarten + primary + junior + senior + special + specialized:
        raise RuntimeError(
            f"总计校验失败：{total} != {kindergarten}+{primary}+{junior}+{senior}+{special}+{specialized}"
        )

    return {
        "city": "珠海",
        "period": period,
        "publish_date": publish_date,
        "total_schools": total,
        "total_students_10k": 0,
        "kindergarten_count": kindergarten,
        "compulsory_count": primary + junior,
        "primary_count": primary,
        "junior_high_count": junior,
        "senior_high_count": senior,
        "vocational_count": 0,
        "special_count": special,
        "private_count": 0,
        "source_org": "珠海市教育局",
        "source_url": source_url.split("?")[0],
    }


def write_row(row: dict[str, str | int | float], output: Path) -> None:
    existing: list[dict[str, str]] = []
    if output.exists():
        with output.open(encoding="utf-8-sig", newline="") as handle:
            existing = [item for item in csv.DictReader(handle) if item.get("city") != "珠海"]
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=output.parent, suffix=".tmp"
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(existing)
        writer.writerow(row)
        temp_path = Path(handle.name)
    temp_path.replace(output)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", help="直接指定学校数 XLSX URL")
    parser.add_argument("--period", default="", help="学年起点年，如 2024")
    parser.add_argument("--publish-date", default="", help="发布日期 YYYY-MM-DD")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    if args.url:
        url = args.url
        period = args.period or "2024"
        publish = args.publish_date or "2025-06-16"
    else:
        period, url, publish = discover_latest()
        if args.period:
            period = args.period
        if args.publish_date:
            publish = args.publish_date
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in SOURCE_HOSTS:
        raise RuntimeError("珠海教育来源域名无效")
    row = parse_school_count_xlsx(fetch_bytes(url), period, publish, url)
    write_row(row, args.output)
    print(f"[done] 珠海 {row['period']} 教育概览 → {args.output} ({url})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

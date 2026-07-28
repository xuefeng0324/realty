"""抓取广州住建局商品房可售、未售与当日签约数据（住宅 / 商业 / 办公 / 车位）。"""

from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "gz_new_house_inventory.csv"
BASE = "https://zfcj.gz.gov.cn/ysqgk/Api/WebApi"
ENDPOINTS = {
    "available": f"{BASE}/mrxjspfksxx.ashx",
    "unsold": f"{BASE}/mrxjspfwsxx.ashx",
    "signed": f"{BASE}/mrxjspfqyxx.ashx",
}
SOURCE = "https://zfcj.gz.gov.cn/zfcj/tjxx/spfxstjxx"

# 用途键 → API 字段前缀
USES = (
    ("residential", "zhuZai"),
    ("commercial", "shangYe"),
    ("office", "banGong"),
    ("parking", "cheWei"),
)

OUT_FIELDS = [
    "date",
    "district",
    "available_units",
    "available_area_sqm",
    "unsold_units",
    "unsold_area_sqm",
    "signed_units",
    "signed_area_sqm",
    "available_commercial_units",
    "available_commercial_area_sqm",
    "unsold_commercial_units",
    "unsold_commercial_area_sqm",
    "signed_commercial_units",
    "signed_commercial_area_sqm",
    "available_office_units",
    "available_office_area_sqm",
    "unsold_office_units",
    "unsold_office_area_sqm",
    "signed_office_units",
    "signed_office_area_sqm",
    "available_parking_units",
    "available_parking_area_sqm",
    "unsold_parking_units",
    "unsold_parking_area_sqm",
    "signed_parking_units",
    "signed_parking_area_sqm",
    "source_url",
]

# 旧 CSV 仅住宅列时的兼容字段顺序
LEGACY_FIELDS = [
    "date",
    "district",
    "available_units",
    "available_area_sqm",
    "unsold_units",
    "unsold_area_sqm",
    "signed_units",
    "signed_area_sqm",
    "source_url",
]


def clean_text(value: object) -> str:
    text = str(value or "").strip()
    try:
        return text.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def fetch(endpoint: str) -> list[dict]:
    request = Request(endpoint, headers={"Referer": SOURCE, "User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        body = json.loads(response.read().decode("utf-8"))
    rows = body.get("data") or []
    if not rows:
        raise RuntimeError(f"接口未返回数据：{endpoint}")
    return rows


def units_area(row: dict, prefix: str) -> tuple[int, float]:
    units = int(row.get(f"{prefix}TaoShu") or 0)
    area = float(row.get(f"{prefix}Area") or 0)
    if units < 0 or area < 0:
        raise RuntimeError(f"{prefix} 出现负数：{units}, {area}")
    return units, area


def blank_extra() -> dict[str, float | int]:
    out: dict[str, float | int] = {}
    for use, _ in USES:
        if use == "residential":
            continue
        for kind in ("available", "unsold", "signed"):
            out[f"{kind}_{use}_units"] = 0
            out[f"{kind}_{use}_area_sqm"] = 0.0
    return out


def row_from_legacy(raw: dict[str, str]) -> list[str | float | int]:
    extra = blank_extra()
    values: list[str | float | int] = [
        raw.get("date", ""),
        raw.get("district", ""),
        raw.get("available_units", 0),
        raw.get("available_area_sqm", 0),
        raw.get("unsold_units", 0),
        raw.get("unsold_area_sqm", 0),
        raw.get("signed_units", 0),
        raw.get("signed_area_sqm", 0),
    ]
    for use, _ in USES:
        if use == "residential":
            continue
        for kind in ("available", "unsold", "signed"):
            u_key = f"{kind}_{use}_units"
            a_key = f"{kind}_{use}_area_sqm"
            values.append(raw.get(u_key, extra[u_key]))
            values.append(raw.get(a_key, extra[a_key]))
    values.append(raw.get("source_url", SOURCE))
    return values


def main() -> int:
    datasets = {key: fetch(url) for key, url in ENDPOINTS.items()}
    by_kind = {
        key: {clean_text(row.get("sectionName")): row for row in rows}
        for key, rows in datasets.items()
    }
    districts = sorted(set().union(*(rows.keys() for rows in by_kind.values())))
    if len(districts) != 11:
        raise RuntimeError(f"广州行政区数量异常：期望 11，实际 {len(districts)}：{districts}")
    if any(set(rows) != set(districts) for rows in by_kind.values()):
        raise RuntimeError("可售、未售、签约三个接口的行政区集合不一致")
    first = datasets["available"][0]
    day = datetime.strptime(str(first["createTime"]).split()[0], "%Y/%m/%d").strftime("%Y-%m-%d")
    dates = {
        datetime.strptime(str(row["createTime"]).split()[0], "%Y/%m/%d").strftime("%Y-%m-%d")
        for rows in datasets.values()
        for row in rows
    }
    if dates != {day}:
        raise RuntimeError(f"三个接口日期不一致：{sorted(dates)}")

    fresh_rows: list[list[float | int | str]] = []
    for district in districts:
        values: list[float | int | str] = [day, district]
        # 住宅（兼容旧列名）
        for kind in ("available", "unsold", "signed"):
            row = by_kind[kind].get(district, {})
            units, area = units_area(row, "zhuZai")
            values.extend([units, area])
        # 商业 / 办公 / 车位
        for use, prefix in USES:
            if use == "residential":
                continue
            for kind in ("available", "unsold", "signed"):
                row = by_kind[kind].get(district, {})
                units, area = units_area(row, prefix)
                values.extend([units, area])
        values.append(SOURCE)
        fresh_rows.append(values)

    merged: dict[tuple[str, str], list[str | float | int]] = {}
    if OUT.exists():
        with OUT.open(encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)
            for row in reader:
                key = (str(row.get("date", "")), str(row.get("district", "")))
                if not all(key):
                    continue
                merged[key] = row_from_legacy(row)

    for row in fresh_rows:
        merged[(str(row[0]), str(row[1]))] = row

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(OUT_FIELDS)
        for row in sorted(merged.values(), key=lambda item: (str(item[0]), str(item[1]))):
            writer.writerow(row)

    # 最新日全市合计（住宅 / 商业 / 办公 / 车位 · 可售）
    city_av = {use: 0 for use, _ in USES}
    for row in fresh_rows:
        # row layout: date, district, res avail/area, unsold..., signed..., then commercial×3×2, office×3×2, parking×3×2, url
        city_av["residential"] += int(row[2])
        # commercial available units index: after 8 residential fields (2+6) → index 8
        city_av["commercial"] += int(row[8])
        city_av["office"] += int(row[14])
        city_av["parking"] += int(row[20])

    print(
        f"[done] 最新 {len(districts)} 区，累计 {len(merged)} 行，{day} → {OUT}；"
        f"可售 住宅={city_av['residential']} 商业={city_av['commercial']} "
        f"办公={city_av['office']} 车位={city_av['parking']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

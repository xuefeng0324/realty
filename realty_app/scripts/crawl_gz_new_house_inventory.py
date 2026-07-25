"""抓取广州住建局商品住宅可售、未售与当日签约数据。"""

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
        for rows in datasets.values() for row in rows
    }
    if dates != {day}:
        raise RuntimeError(f"三个接口日期不一致：{sorted(dates)}")

    fresh_rows: list[list[float | int | str]] = []
    for district in districts:
        values: list[float | int | str] = [day, district]
        for kind in ("available", "unsold", "signed"):
            row = by_kind[kind].get(district, {})
            units = int(row.get("zhuZaiTaoShu") or 0)
            area = float(row.get("zhuZaiArea") or 0)
            if units < 0 or area < 0:
                raise RuntimeError(f"{district} {kind} 出现负数：{units}, {area}")
            values.extend([units, area])
        fresh_rows.append([*values, SOURCE])

    merged: dict[tuple[str, str], list[str | float | int]] = {}
    if OUT.exists():
        with OUT.open(encoding="utf-8-sig", newline="") as file:
            for row in csv.DictReader(file):
                key = (str(row.get("date", "")), str(row.get("district", "")))
                if all(key):
                    merged[key] = [row.get(field, "") for field in (
                        "date", "district", "available_units", "available_area_sqm",
                        "unsold_units", "unsold_area_sqm", "signed_units", "signed_area_sqm", "source_url"
                    )]
    for row in fresh_rows:
        merged[(str(row[0]), str(row[1]))] = row

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow([
            "date", "district", "available_units", "available_area_sqm",
            "unsold_units", "unsold_area_sqm", "signed_units", "signed_area_sqm", "source_url"
        ])
        for row in sorted(merged.values(), key=lambda item: (str(item[0]), str(item[1]))):
            writer.writerow(row)

    print(f"[done] 最新 {len(districts)} 区，累计 {len(merged)} 行，{day} → {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

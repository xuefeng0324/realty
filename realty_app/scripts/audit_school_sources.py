#!/usr/bin/env python3
"""审计政府开放平台中的学校数据集元数据，不下载或混入未经核验的学校明细。"""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "static" / "school_source_audit.json"
ENDPOINT = "https://opendata.sz.gov.cn/data/catalog/selectDataCatalogByResId"
DETAIL_BASE = "https://opendata.sz.gov.cn/data/dataSet/toDataDetails/"
TODAY = date.today()

CANDIDATES = [
    {"res_id": "29200/03700831", "expected": "公办中小学"},
    {"res_id": "29200/03700756", "expected": "中小学办学情况"},
    {"res_id": "29200/04003918", "expected": "中小学学校信息"},
    {"res_id": "29200/03803658", "expected": "民办中小学"},
]


def fetch_metadata(res_id: str) -> dict:
    body = urlencode({"resId": res_id}).encode("utf-8")
    req = Request(ENDPOINT, data=body, headers={"User-Agent": "realty-app-school-source-audit/1.0"})
    with urlopen(req, timeout=20) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        return json.loads(response.read().decode("utf-8"))


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def audit(candidate: dict) -> dict:
    meta = fetch_metadata(candidate["res_id"])
    title = str(meta.get("resTitle") or "")
    abstract = str(meta.get("resAbstract") or "")
    updated = parse_date(meta.get("updateDate"))
    issues: list[str] = []
    if candidate["expected"] not in title:
        issues.append("title_keyword_mismatch")
    if "中小学" in title and ("托育" in abstract or "托育园" in abstract):
        issues.append("title_abstract_mismatch")
    if updated is None:
        issues.append("invalid_update_date")
    elif (TODAY - updated).days > 730:
        issues.append("stale_over_730_days")
    if str(meta.get("openLevelName") or "") != "无条件开放":
        issues.append("not_unconditionally_open")
    record_total = int(meta.get("recordTotal") or 0)
    if record_total <= 0:
        issues.append("empty_dataset")
    return {
        "res_id": meta.get("resId") or candidate["res_id"],
        "title": title,
        "publisher": meta.get("officeName"),
        "updated_at": meta.get("updateDate"),
        "record_total": record_total,
        "formats": str(meta.get("sourceSuffix") or "").split(","),
        "open_level": meta.get("openLevelName"),
        "detail_url": DETAIL_BASE + candidate["res_id"].replace("/", "_"),
        "abstract": abstract,
        "issues": issues,
        "eligible_for_import": len(issues) == 0,
    }


def main() -> None:
    datasets = [audit(candidate) for candidate in CANDIDATES]
    payload = {
        "audited_at": TODAY.isoformat(),
        "source_platform": "深圳市政府数据开放平台",
        "source_domain": "opendata.sz.gov.cn",
        "policy": "仅元数据审计通过不能自动导入；仍需核验字段定义与逐行内容。",
        "datasets": datasets,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT}: {len(datasets)} datasets, {sum(d['eligible_for_import'] for d in datasets)} eligible")


if __name__ == "__main__":
    main()

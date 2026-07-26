"""Fetch official national real-estate releases from stats.gov.cn.

Modes:
  python scripts/crawl_nbs_real_estate.py              # latest from index + merge
  python scripts/crawl_nbs_real_estate.py --url URL     # one release + merge
  python scripts/crawl_nbs_real_estate.py --backfill    # known 2026 archive URLs + merge

Always merges by `period` (does not wipe history). Official source only.
"""

from __future__ import annotations

import argparse
import csv
import html
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

INDEX_URL = "https://www.stats.gov.cn/sj/"
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_real_estate.csv"

# 2026 年已发布累计期（1—N），用于回填；后续可继续追加
BACKFILL_URLS_2026 = [
    "https://www.stats.gov.cn/sj/zxfb/202603/t20260316_1962785.html",  # 1—2
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963327.html",  # 1—3
    "https://www.stats.gov.cn/sj/zxfb/202605/t20260518_1963729.html",  # 1—4
    "https://www.stats.gov.cn/sj/zxfb/202606/t20260616_1963950.html",  # 1—5
    "https://www.stats.gov.cn/sj/zxfb/202607/t20260715_1964126.html",  # 1—6
]

FIELDS = [
    "period",
    "publish_date",
    "investment_cny_100m",
    "investment_yoy_pct",
    "residential_investment_cny_100m",
    "residential_investment_yoy_pct",
    "construction_area_10k_sqm",
    "construction_area_yoy_pct",
    "residential_construction_area_10k_sqm",
    "residential_construction_area_yoy_pct",
    "new_starts_area_10k_sqm",
    "new_starts_area_yoy_pct",
    "residential_new_starts_area_10k_sqm",
    "residential_new_starts_area_yoy_pct",
    "completed_area_10k_sqm",
    "completed_area_yoy_pct",
    "residential_completed_area_10k_sqm",
    "residential_completed_area_yoy_pct",
    "sales_area_10k_sqm",
    "sales_area_yoy_pct",
    "residential_sales_area_10k_sqm",
    "residential_sales_area_yoy_pct",
    "sales_amount_cny_100m",
    "sales_amount_yoy_pct",
    "residential_sales_amount_cny_100m",
    "residential_sales_amount_yoy_pct",
    "inventory_area_10k_sqm",
    "inventory_area_yoy_pct",
    "residential_inventory_area_10k_sqm",
    "residential_inventory_area_yoy_pct",
    "funds_cny_100m",
    "funds_yoy_pct",
    "domestic_loan_funds_cny_100m",
    "domestic_loan_funds_yoy_pct",
    "deposit_funds_cny_100m",
    "deposit_funds_yoy_pct",
    "mortgage_funds_cny_100m",
    "mortgage_funds_yoy_pct",
    "self_raised_funds_cny_100m",
    "self_raised_funds_yoy_pct",
    "source_url",
]


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_cell = False
        self.in_row = False
        self.cell: list[str] = []
        self.row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "tr":
            self.in_row = True
            self.row = []
        elif self.in_row and tag in {"td", "th"}:
            self.in_cell = True
            self.cell = []

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self.in_cell:
            self.row.append(" ".join("".join(self.cell).split()))
            self.in_cell = False
        elif tag == "tr" and self.in_row:
            if self.row:
                self.rows.append(self.row)
            self.in_row = False


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.href = ""
        self.text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "a":
            self.href = dict(attrs).get("href", "")
            self.text = []

    def handle_data(self, data: str) -> None:
        if self.href:
            self.text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.href:
            self.links.append((self.href, " ".join("".join(self.text).split())))
            self.href = ""
            self.text = []


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "realty-app-data-refresh/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read().decode("utf-8", errors="replace")


def find_release(index_html: str) -> str:
    parser = LinkParser()
    parser.feed(index_html)
    for href, text in parser.links:
        if "全国房地产市场基本情况" in text and re.search(r"t\d+_\d+\.html", href):
            return urllib.parse.urljoin(INDEX_URL, html.unescape(href))
    raise RuntimeError("未在国家统计局数据首页找到房地产市场基本情况发布页")


def parse_release(url: str, body: str) -> dict[str, str | float]:
    plain_text = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", body)).split())
    title_match = re.search(
        r"(\d{4})年\s*1\s*[—－-]\s*(\d+)\s*月份全国房地产市场基本情况", plain_text
    )
    publish_match = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)
    if not title_match or not publish_match:
        raise RuntimeError(f"国家统计局发布页缺少期间或发布日期: {url}")

    parser = TableParser()
    parser.feed(body)
    parent_wanted = {
        "房地产开发投资（亿元）": ("investment_cny_100m", "investment_yoy_pct"),
        "房屋施工面积（万平方米）": ("construction_area_10k_sqm", "construction_area_yoy_pct"),
        "房屋新开工面积（万平方米）": ("new_starts_area_10k_sqm", "new_starts_area_yoy_pct"),
        "房屋竣工面积（万平方米）": ("completed_area_10k_sqm", "completed_area_yoy_pct"),
        "新建商品房销售面积（万平方米）": ("sales_area_10k_sqm", "sales_area_yoy_pct"),
        "新建商品房销售额（亿元）": ("sales_amount_cny_100m", "sales_amount_yoy_pct"),
        "商品房待售面积（万平方米）": ("inventory_area_10k_sqm", "inventory_area_yoy_pct"),
        "房地产开发企业本年到位资金（亿元）": ("funds_cny_100m", "funds_yoy_pct"),
    }
    residential_under = {
        "房地产开发投资（亿元）": (
            "residential_investment_cny_100m",
            "residential_investment_yoy_pct",
        ),
        "房屋施工面积（万平方米）": (
            "residential_construction_area_10k_sqm",
            "residential_construction_area_yoy_pct",
        ),
        "房屋新开工面积（万平方米）": (
            "residential_new_starts_area_10k_sqm",
            "residential_new_starts_area_yoy_pct",
        ),
        "房屋竣工面积（万平方米）": (
            "residential_completed_area_10k_sqm",
            "residential_completed_area_yoy_pct",
        ),
        "新建商品房销售面积（万平方米）": (
            "residential_sales_area_10k_sqm",
            "residential_sales_area_yoy_pct",
        ),
        "新建商品房销售额（亿元）": (
            "residential_sales_amount_cny_100m",
            "residential_sales_amount_yoy_pct",
        ),
        "商品房待售面积（万平方米）": (
            "residential_inventory_area_10k_sqm",
            "residential_inventory_area_yoy_pct",
        ),
    }
    result: dict[str, str | float] = {
        "period": f"{title_match.group(1)}-01_to_{title_match.group(1)}-{int(title_match.group(2)):02d}",
        "publish_date": "-".join(publish_match.groups()),
        "source_url": url,
    }
    current_parent = ""
    for row in parser.rows:
        if len(row) < 3:
            continue
        label = row[0].replace(" ", "")
        if row[0] in parent_wanted:
            value_key, yoy_key = parent_wanted[row[0]]
            result[value_key] = float(row[1].replace(",", ""))
            result[yoy_key] = float(row[2].replace(",", ""))
            current_parent = row[0]
            continue
        if label in {"其中：住宅", "其中:住宅"} and current_parent in residential_under:
            value_key, yoy_key = residential_under[current_parent]
            if value_key not in result:
                result[value_key] = float(row[1].replace(",", ""))
                result[yoy_key] = float(row[2].replace(",", ""))
            continue
        if label in {"其中：国内贷款", "其中:国内贷款", "国内贷款"}:
            result["domestic_loan_funds_cny_100m"] = float(row[1].replace(",", ""))
            result["domestic_loan_funds_yoy_pct"] = float(row[2].replace(",", ""))
            continue
        if label == "定金及预收款":
            result["deposit_funds_cny_100m"] = float(row[1].replace(",", ""))
            result["deposit_funds_yoy_pct"] = float(row[2].replace(",", ""))
            continue
        if label == "个人按揭贷款":
            result["mortgage_funds_cny_100m"] = float(row[1].replace(",", ""))
            result["mortgage_funds_yoy_pct"] = float(row[2].replace(",", ""))
            continue
        if label == "自筹资金":
            result["self_raised_funds_cny_100m"] = float(row[1].replace(",", ""))
            result["self_raised_funds_yoy_pct"] = float(row[2].replace(",", ""))
            continue
        if row[0] not in parent_wanted and not label.startswith("其中"):
            # 办公楼/商业等打断「其中：住宅」上下文
            if current_parent and label not in {"办公楼", "商业营业用房"}:
                current_parent = ""

    required = [key for pair in parent_wanted.values() for key in pair]
    required += [key for pair in residential_under.values() for key in pair]
    required += [
        "domestic_loan_funds_cny_100m",
        "domestic_loan_funds_yoy_pct",
        "deposit_funds_cny_100m",
        "deposit_funds_yoy_pct",
        "mortgage_funds_cny_100m",
        "mortgage_funds_yoy_pct",
        "self_raised_funds_cny_100m",
        "self_raised_funds_yoy_pct",
    ]
    missing = [key for key in required if key not in result]
    if missing:
        raise RuntimeError(f"国家统计局表格缺少字段：{', '.join(missing)} @ {url}")
    return result


def load_existing(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists() or path.stat().st_size == 0:
        return {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    out: dict[str, dict[str, str]] = {}
    for row in rows:
        period = (row.get("period") or "").strip()
        if period:
            out[period] = {k: (row.get(k) or "") for k in FIELDS}
    return out


def write_merged(path: Path, by_period: dict[str, dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = sorted(
        by_period.values(),
        key=lambda r: r.get("publish_date") or "",
        reverse=True,
    )
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for row in ordered:
            writer.writerow({k: row.get(k, "") for k in FIELDS})


def upsert(row: dict[str, str | float], store: dict[str, dict[str, str]]) -> None:
    period = str(row["period"])
    store[period] = {k: str(row.get(k, "")) for k in FIELDS}


def main() -> int:
    ap = argparse.ArgumentParser(description="国家统计局全国房地产市场基本情况 → CSV")
    ap.add_argument("--url", action="append", default=[], help="指定发布页（可多次）")
    ap.add_argument("--backfill", action="store_true", help="回填 2026 已知归档页")
    ap.add_argument("--no-latest", action="store_true", help="不从首页探测最新一期")
    ap.add_argument("--out", type=Path, default=OUTPUT)
    args = ap.parse_args()

    urls: list[str] = list(args.url)
    if args.backfill:
        urls.extend(BACKFILL_URLS_2026)
    if not args.no_latest and not urls:
        urls.append(find_release(fetch(INDEX_URL)))
    elif not args.no_latest and urls:
        # backfill/url 模式仍尝试刷新最新
        try:
            urls.append(find_release(fetch(INDEX_URL)))
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] 首页最新探测失败: {exc}", file=sys.stderr)

    # 去重保序
    seen: set[str] = set()
    uniq_urls: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            uniq_urls.append(u)

    store = load_existing(args.out)
    for url in uniq_urls:
        print(f"[fetch] {url}")
        row = parse_release(url, fetch(url))
        upsert(row, store)
        print(f"[ok] {row['period']} publish={row['publish_date']}")

    write_merged(args.out, store)
    print(f"[done] {args.out} periods={len(store)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

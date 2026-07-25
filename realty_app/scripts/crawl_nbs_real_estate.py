"""Fetch the latest official national real-estate release from stats.gov.cn."""

from __future__ import annotations

import csv
import html
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

INDEX_URL = "https://www.stats.gov.cn/sj/"
OUTPUT = Path(__file__).resolve().parents[1] / "static" / "nbs_real_estate.csv"


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_cell = False
        self.in_row = False
        self.cell = []
        self.row = []
        self.rows = []

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
        self.text = []
        self.links = []

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
    with urllib.request.urlopen(request, timeout=30) as response:
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
    title_match = re.search(r"(\d{4})年\s*1\s*[—－-]\s*(\d+)\s*月份全国房地产市场基本情况", plain_text)
    publish_match = re.search(r"/t(\d{4})(\d{2})(\d{2})_", url)
    if not title_match or not publish_match:
        raise RuntimeError("国家统计局发布页缺少期间或发布日期")

    parser = TableParser()
    parser.feed(body)
    wanted = {
        "房地产开发投资（亿元）": ("investment_cny_100m", "investment_yoy_pct"),
        "新建商品房销售面积（万平方米）": ("sales_area_10k_sqm", "sales_area_yoy_pct"),
        "新建商品房销售额（亿元）": ("sales_amount_cny_100m", "sales_amount_yoy_pct"),
        "商品房待售面积（万平方米）": ("inventory_area_10k_sqm", "inventory_area_yoy_pct"),
        "房地产开发企业本年到位资金（亿元）": ("funds_cny_100m", "funds_yoy_pct"),
    }
    result: dict[str, str | float] = {
        "period": f"{title_match.group(1)}-01_to_{title_match.group(1)}-{int(title_match.group(2)):02d}",
        "publish_date": "-".join(publish_match.groups()),
        "source_url": url,
    }
    for row in parser.rows:
        if len(row) >= 3 and row[0] in wanted:
            value_key, yoy_key = wanted[row[0]]
            result[value_key] = float(row[1])
            result[yoy_key] = float(row[2])
    missing = [key for pair in wanted.values() for key in pair if key not in result]
    if missing:
        raise RuntimeError(f"国家统计局表格缺少字段：{', '.join(missing)}")
    return result


def main() -> None:
    release_url = find_release(fetch(INDEX_URL))
    row = parse_release(release_url, fetch(release_url))
    fields = [
        "period", "publish_date", "investment_cny_100m", "investment_yoy_pct",
        "sales_area_10k_sqm", "sales_area_yoy_pct", "sales_amount_cny_100m",
        "sales_amount_yoy_pct", "inventory_area_10k_sqm", "inventory_area_yoy_pct",
        "funds_cny_100m", "funds_yoy_pct", "source_url",
    ]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerow(row)
    print(f"updated {OUTPUT}: {row['period']} from {release_url}")


if __name__ == "__main__":
    main()

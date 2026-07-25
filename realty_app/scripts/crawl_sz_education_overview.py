"""发现并抓取深圳市教育局「教育事业发展基本情况」→ education_overview.csv。

口径：深圳官方只公布「普通中小学」合计，不拆小学/初中/高中；
写入 compulsory_count=普通中小学，primary/junior/senior=0（UI 降级展示「中小学」）。
不伪造分项。珠海仍无结构化表，不写入。
"""

from __future__ import annotations

import argparse
import csv
import html
import re
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "static" / "education_overview.csv"
INDEX_URL = "https://szeb.sz.gov.cn/home/xxgk/flzy/tjsj/index.html"
SOURCE_HOSTS = {"szeb.sz.gov.cn"}
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


def fetch(url: str) -> str:
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
                return response.read().decode("utf-8", errors="replace")
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(attempt + 1)
    raise RuntimeError(f"官方页面请求失败：{url}：{last_error}") from last_error


def plain(value: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def discover_latest() -> tuple[str, str]:
    """返回 (year, url)。"""
    body = fetch(INDEX_URL)
    candidates: list[tuple[int, str]] = []
    for href, title in re.findall(r'href="([^"]+)"[^>]*>([^<]*教育事业发展基本情况[^<]*)', body):
        title_clean = html.unescape(re.sub(r"<[^>]+>", "", title)).strip()
        m = re.search(r"(\d{4})年深圳教育事业发展基本情况", title_clean)
        if not m:
            continue
        url = urllib.parse.urljoin(INDEX_URL, href)
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in SOURCE_HOSTS:
            continue
        candidates.append((int(m.group(1)), url))
    if not candidates:
        raise RuntimeError("深圳教育局统计页未找到教育事业发展基本情况链接")
    year, url = max(candidates)
    return str(year), url


def required(pattern: str, text: str, label: str, cast=float):
    match = re.search(pattern, text)
    if not match:
        raise RuntimeError(f"深圳教育概况缺少字段：{label}")
    for g in match.groups():
        if g is not None:
            return cast(g)
    return cast(match.group(1))


def parse_release(url: str, body: str, period_hint: str | None = None) -> dict[str, str | int | float]:
    parsed_url = urllib.parse.urlparse(url)
    if parsed_url.scheme != "https" or parsed_url.hostname not in SOURCE_HOSTS:
        raise RuntimeError("深圳教育概况来源域名无效")

    text = plain(body)
    title_year = re.search(r"(\d{4})年深圳教育事业发展基本情况", text)
    if title_year:
        year = title_year.group(1)
    elif period_hint:
        year = period_hint
    else:
        lead = re.search(r"(20\d{2})年，全市各级各类学校", text)
        if not lead:
            raise RuntimeError("深圳教育概况缺少年份")
        year = lead.group(1)

    publish_date: str | None = None
    date_match = re.search(
        r'(?:发布日期|成文日期)[：:\s]*(\d{4}-\d{2}-\d{2})|'
        r'<meta[^>]+(?:PubDate|publishdate|ArticleDate)[^>]+content="(\d{4}-\d{2}-\d{2})',
        body,
        re.I,
    )
    if date_match:
        publish_date = date_match.group(1) or date_match.group(2)
    if not publish_date:
        for pat in (
            r"成文日期：</td>\s*<td[^>]*>\s*(\d{4}-\d{2}-\d{2})",
            r"发布日期：</td>\s*<td[^>]*>\s*(\d{4}-\d{2}-\d{2})",
            r"时间\s*:\s*(\d{4}-\d{2}-\d{2})",
        ):
            m = re.search(pat, body, re.I)
            if m:
                publish_date = m.group(1)
                break
    if not publish_date:
        raise RuntimeError("深圳教育概况缺少发布日期")

    row: dict[str, str | int | float] = {
        "city": "深圳",
        "period": year,
        "publish_date": publish_date,
        "total_schools": required(
            r"全市各级各类学校\(含幼儿园\)(\d+)所|各级各类学校\(含幼儿园\)(\d+)所",
            text,
            "学校总数",
            int,
        ),
        "total_students_10k": required(r"在校学生总数(\d+(?:\.\d+)?)万人", text, "在校生", float),
        "kindergarten_count": required(r"幼儿园(\d+)所", text, "幼儿园", int),
        "compulsory_count": required(r"普通中小学(\d+)所", text, "普通中小学", int),
        "primary_count": 0,
        "junior_high_count": 0,
        "senior_high_count": 0,
        "vocational_count": required(r"中等职业学校（含技工学校）(\d+)所", text, "中职", int),
        "special_count": required(r"特殊教育学校(\d+)所", text, "特殊教育", int),
        "private_count": required(r"民办学校（园）(\d+)所", text, "民办", int),
        "source_org": "深圳市教育局",
        "source_url": url.split("?")[0],
    }
    if int(row["total_schools"]) < max(
        int(row["kindergarten_count"]),
        int(row["compulsory_count"]),
        int(row["private_count"]),
    ):
        raise RuntimeError("学校总数小于分项数量")
    return row


def write_row(row: dict[str, str | int | float], output: Path) -> None:
    existing: list[dict[str, str]] = []
    if output.exists():
        with output.open(encoding="utf-8-sig", newline="") as handle:
            existing = [item for item in csv.DictReader(handle) if item.get("city") != "深圳"]
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
    parser.add_argument("--url", help="跳过发现，直接核验指定官方 URL")
    parser.add_argument("--period", help="已知年份（配合 --url）")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    if args.url:
        url = args.url
        period_hint = args.period
    else:
        period_hint, url = discover_latest()
    row = parse_release(url, fetch(url), period_hint)
    write_row(row, args.output)
    print(f"[done] 深圳 {row['period']} 教育概览 → {args.output} ({url})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

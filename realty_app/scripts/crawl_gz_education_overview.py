"""发现并抓取广州市教育局最新教育事业发展统计公报。"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "static" / "education_overview.csv"
SEARCH_URL = "https://search.gd.gov.cn/api/search/all"
SOURCE_HOST = "jyj.gz.gov.cn"
FIELDS = [
    "city", "period", "publish_date", "total_schools", "total_students_10k",
    "kindergarten_count", "compulsory_count", "primary_count", "junior_high_count",
    "senior_high_count", "vocational_count", "special_count", "private_count",
    "source_org", "source_url",
]


def fetch(url: str, data: bytes | None = None) -> str:
    last_error: Exception | None = None
    for attempt in range(3):
        request = urllib.request.Request(
            url,
            data=data,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; realty-app-data-refresh/1.0)",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept-Encoding": "identity",
                "Connection": "close",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read().decode("utf-8", errors="replace")
        except Exception as error:  # 网络瞬断允许有限重试，解析错误不在这里吞掉
            last_error = error
            if attempt < 2:
                time.sleep(attempt + 1)
    raise RuntimeError(f"官方页面请求失败：{url}：{last_error}") from last_error


def plain(value: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def discover_latest() -> str:
    candidates: list[tuple[int, int, str]] = []
    for page in range(1, 21):
        body = urllib.parse.urlencode({
            "site_id": "200016",
            "service_area": "200",
            "gdbsDivision": "440100",
            "gdbsOrgNum": "007482620",
            "keywords": "教育事业发展统计公报",
            "range": "site",
            "position": "title",
            "page": str(page),
            "sort": "time",
        }).encode("utf-8")
        payload = json.loads(fetch(SEARCH_URL, body))
        items = payload.get("data", {}).get("news", {}).get("list", [])
        for item in items:
            title = html.unescape(re.sub(r"<[^>]+>", "", str(item.get("title", "")))).strip()
            match = re.fullmatch(r"(\d{4})年广州市教育事业发展统计公报", title)
            url = str(item.get("url", ""))
            parsed = urllib.parse.urlparse(url)
            if match and parsed.scheme == "https" and parsed.hostname == SOURCE_HOST:
                canonical = int("/gk/sjtj/content/" in parsed.path)
                candidates.append((int(match.group(1)), canonical, url))
        if candidates or not items:
            break
    if not candidates:
        raise RuntimeError("广东政府搜索未返回广州教育事业发展统计公报")
    return max(candidates)[2]


def required(pattern: str, text: str, label: str, cast=float):
    match = re.search(pattern, text)
    if not match:
        raise RuntimeError(f"广州教育公报缺少字段：{label}")
    return cast(match.group(1))


def parse_release(url: str, body: str) -> dict[str, str | int | float]:
    parsed_url = urllib.parse.urlparse(url)
    if parsed_url.scheme != "https" or parsed_url.hostname != SOURCE_HOST:
        raise RuntimeError("广州教育公报来源域名无效")
    title_match = re.search(r'<meta\s+name="ArticleTitle"\s+content="([^"]+)"', body, re.I)
    date_match = re.search(r'<meta\s+name="PubDate"\s+content="(\d{4}-\d{2}-\d{2})', body, re.I)
    source_match = re.search(r'<meta\s+name="ContentSource"\s+content="([^"]+)"', body, re.I)
    if not title_match or not date_match or not source_match:
        raise RuntimeError("广州教育公报缺少标题、发布日期或发布机构元数据")
    title = html.unescape(title_match.group(1)).strip()
    year_match = re.fullmatch(r"(\d{4})年广州市教育事业发展统计公报", title)
    if not year_match or source_match.group(1).strip() != "广州市教育局":
        raise RuntimeError("广州教育公报标题或发布机构不符合预期")

    text = plain(body)
    row: dict[str, str | int | float] = {
        "city": "广州",
        "period": year_match.group(1),
        "publish_date": date_match.group(1),
        "total_schools": required(r"共有各级各类学校(\d+)所", text, "学校总数", int),
        "total_students_10k": required(r"在校生数(\d+(?:\.\d+)?)万人", text, "在校生", float),
        "kindergarten_count": required(r"共有幼儿园(\d+)所", text, "幼儿园", int),
        "compulsory_count": required(r"共有义务教育阶段学校(\d+)所", text, "义务教育", int),
        "primary_count": required(r"共有小学(\d+)所", text, "小学", int),
        "junior_high_count": required(r"共有初中(\d+)所", text, "初中", int),
        "senior_high_count": required(r"共有普通高中(\d+)所", text, "普通高中", int),
        "vocational_count": required(r"共有中等职业教育学校(\d+)所", text, "中职", int),
        "special_count": required(r"共有特殊教育学校(\d+)所", text, "特殊教育", int),
        "private_count": required(r"共有民办学校（含幼儿园）(\d+)所", text, "民办学校", int),
        "source_org": "广州市教育局",
        "source_url": url,
    }
    if row["primary_count"] + row["junior_high_count"] != row["compulsory_count"]:
        raise RuntimeError("小学与初中数量之和不等于义务教育学校数")
    if int(row["total_schools"]) < max(int(row[key]) for key in (
        "kindergarten_count", "compulsory_count", "private_count"
    )):
        raise RuntimeError("学校总数小于分项数量")
    return row


def write_row(row: dict[str, str | int | float], output: Path) -> None:
    existing: list[dict[str, str]] = []
    if output.exists():
        with output.open(encoding="utf-8-sig", newline="") as handle:
            existing = [item for item in csv.DictReader(handle) if item.get("city") != "广州"]
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
    parser.add_argument("--url", help="跳过搜索，直接核验指定官方公报URL")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    url = args.url or discover_latest()
    row = parse_release(url, fetch(url))
    write_row(row, args.output)
    print(f"[done] 广州 {row['period']} 教育概览 → {args.output} ({url})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

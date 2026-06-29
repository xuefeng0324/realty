"""
国家统计局 70 城价格指数爬虫
============================

两种模式：
  1. download  - 直接下载第三方整理好的 CSV 并做字段精简
                 （源: https://github.com/hugohe3/70cityprice ）
  2. crawl     - 从 stats.gov.cn 抓取当月发布的 HTML 页面，解析成 CSV
  3. convert   - 把宽表（hugohe3/70cityprice 原始）转成应用使用的窄表格式
                 （用于：本地已有 CSV、网络受限时手动转换）

输出（窄表格式）字段，列分隔符逗号：
  date         YYYY/MM/DD     数据日期（每月 1 号）
  city         北京/上海/...   城市名
  fixed_base   同比/环比       指数类型
  new_idx      float string   新建商品住宅指数（空字符串视为空）
  second_idx   float string   二手住宅指数（空字符串视为空）

App 端只关心同比 / 环比两类索引。

使用方式：
  # 默认：下载并转换
  python scripts/crawl_stats_70.py download

  # 已有原始宽表，只做转换
  python scripts/crawl_stats_70.py convert \\
      --src /path/to/70cityprice.csv \\
      --out realty_app/static/stats_70.csv

  # 从国家统计局爬当月增量
  python scripts/crawl_stats_70.py crawl \\
      --url "https://www.stats.gov.cn/sj/zxfb/202601/t20260115_xxxxxxx.html" \\
      --out realty_app/static/stats_70.csv

依赖：pip install requests beautifulsoup4 lxml
"""
from __future__ import annotations

import argparse
import csv
import io
import sys
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    # 脚本在某些模式下不需要这两个依赖（如 convert）
    requests = None
    BeautifulSoup = None

# ---------------- 通用字段映射 ----------------

# 第三方数据 (hugohe3/70cityprice) 的列名
HUGO_FIELDS = [
    "DATE", "ADCODE", "CITY", "FixedBase",
    "HouseIDX", "ResidentIDX",
    "CommodityHouseIDX", "SecondHandIDX",
    "ResidentBelow90IDX", "CommonResidentBelow90IDX",
    "CommodityBelow90IDX", "Commodity144IDX", "CommodityAbove144IDX",
    "SecondHandBelow90IDX", "SecondHand144IDX", "SecondHandAbove144IDX",
]

# 我们最终用的窄表（扁平化）
OUT_FIELDS = ["date", "city", "fixed_base", "new_idx", "second_idx"]

HUGO_CSV_URL = (
    "https://raw.githubusercontent.com/hugohe3/70cityprice/main/70cityprice.csv"
)


# ---------- 通用：宽表 -> 窄表 ----------
def wide_to_narrow(rows_in: list[list[str]], header: list[str]) -> list[dict]:
    """从宽表 csv.Reader 转成窄表行 dict 列表。"""
    if header != HUGO_FIELDS:
        # 模糊定位
        try:
            idx_date = header.index("DATE")
            idx_city = header.index("CITY")
            idx_base = header.index("FixedBase")
            idx_new = header.index("CommodityHouseIDX")
            idx_2nd = header.index("SecondHandIDX")
        except ValueError:
            print(
                f"识别不了列名。期望 {HUGO_FIELDS[:4]} ...",
                file=sys.stderr,
            )
            return []
    else:
        idx_date, idx_city, idx_base = 0, 2, 3
        idx_new = HUGO_FIELDS.index("CommodityHouseIDX")
        idx_2nd = HUGO_FIELDS.index("SecondHandIDX")

    out = []
    for raw in rows_in[1:]:
        if len(raw) <= idx_2nd:
            continue
        fixed = raw[idx_base].strip()
        if fixed not in ("同比", "环比"):
            continue
        out.append(
            {
                "date": raw[idx_date].strip(),
                "city": raw[idx_city].strip(),
                "fixed_base": fixed,
                "new_idx": (raw[idx_new].strip() if idx_new < len(raw) else ""),
                "second_idx": (raw[idx_2nd].strip() if idx_2nd < len(raw) else ""),
            }
        )
    return out


def write_narrow_csv(rows: list[dict], out_path: Path, append: bool = False) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = out_path.exists() and out_path.stat().st_size > 0
    mode = "a" if (append and file_exists) else "w"
    with open(out_path, mode, encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=OUT_FIELDS)
        if mode == "w":
            writer.writeheader()
        for r in rows:
            writer.writerow(r)


# ---------- mode 1: download ----------
def cmd_download(args: argparse.Namespace) -> int:
    if requests is None:
        print("需要 requests 库：pip install requests", file=sys.stderr)
        return 1
    out_path = Path(args.out)
    print(f"[download] GET {HUGO_CSV_URL}")
    r = requests.get(HUGO_CSV_URL, timeout=60)
    r.raise_for_status()
    raw = r.content
    # 去掉 UTF-8 BOM
    if raw.startswith(b"\xef\xbb\xbf"):
        text = raw[3:].decode("utf-8")
    else:
        text = raw.decode("utf-8")
    print(f"[download] 收到 {len(text)} 字节")

    rows_in = list(csv.reader(io.StringIO(text)))
    rows_out = wide_to_narrow(rows_in, rows_in[0])
    write_narrow_csv(rows_out, out_path)
    print(f"[download] 完成：{len(rows_out)} 行 → {out_path}")
    return 0


# ---------- mode 2: crawl (官网) ----------
def parse_stb_table(soup_table, year_month: str) -> list[dict]:
    """统计局 table 的 cell 顺序通常是：城市 / 环比 / 同比 / 年度平均；
    有些行左右双列拼为 8 列。"""
    rows = []
    trs = soup_table.find_all("tr")
    for tr in trs:
        tds = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if not tds:
            continue
        if all(
            t in ("城市", "环比", "同比", "上月=100", "上年同月=100", "")
            for t in tds if t
        ):
            continue
        if len(tds) >= 4 and tds[0]:
            rows.append(
                {"date": year_month, "city": tds[0], "mom": tds[1], "yoy": tds[2]}
            )
        if len(tds) >= 8 and tds[4]:
            rows.append(
                {"date": year_month, "city": tds[4], "mom": tds[5], "yoy": tds[6]}
            )
    return rows


def cmd_crawl(args: argparse.Namespace) -> int:
    if requests is None or BeautifulSoup is None:
        print("需要 requests + beautifulsoup4", file=sys.stderr)
        return 1
    import re

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[crawl] GET {args.url}")
    r = requests.get(
        args.url,
        timeout=30,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    r.raise_for_status()

    soup = BeautifulSoup(r.content, "lxml")
    title = soup.find("h1") or soup.find("h2")
    title_text = title.get_text(strip=True) if title else ""
    m = re.search(r"(\d{4})年(\d{1,2})月", title_text) or re.search(r"(\d{4})年(\d{1,2})月", args.url)
    if not m:
        print(f"无法从标题/URL 推断月份：{title_text}  /  {args.url}", file=sys.stderr)
        return 1
    year, month = m.group(1), m.group(2).zfill(2)
    year_month = f"{year}/{month}/1"

    tables = soup.find_all("table")
    print(f"[crawl] 发现 {len(tables)} 个 table")

    all_rows = []
    for tbl in tables:
        text = tbl.get_text()
        if "70" not in text and "城市" not in text:
            continue
        all_rows.extend(parse_stb_table(tbl, year_month))

    seen = set()
    dedup = []
    for r in all_rows:
        k = (r["date"], r["city"])
        if k in seen:
            continue
        seen.add(k)
        dedup.append(r)

    rows_out = []
    for r in dedup:
        rows_out.append(
            {"date": r["date"], "city": r["city"], "fixed_base": "环比", "new_idx": r["mom"], "second_idx": ""}
        )
        rows_out.append(
            {"date": r["date"], "city": r["city"], "fixed_base": "同比", "new_idx": r["yoy"], "second_idx": ""}
        )

    write_narrow_csv(rows_out, out_path, append=True)
    print(f"[crawl] 完成：{len(rows_out)} 行 ({year_month}) → {out_path}")
    return 0


# ---------- mode 3: convert (本地已有宽表时) ----------
def cmd_convert(args: argparse.Namespace) -> int:
    src = Path(args.src)
    out = Path(args.out)
    print(f"[convert] 读 {src}")
    text = src.read_text(encoding="utf-8-sig")
    rows_in = list(csv.reader(io.StringIO(text)))
    rows_out = wide_to_narrow(rows_in, rows_in[0])
    write_narrow_csv(rows_out, out)
    print(f"[convert] 完成：{len(rows_out)} 行 → {out}")
    return 0


# ---------- main ----------
def main() -> int:
    parser = argparse.ArgumentParser(description="70 城房价指数爬虫 / 转换器")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("download", help="下载第三方整理版 CSV 并转窄表")
    p1.add_argument("--out", default="realty_app/static/stats_70.csv")
    p1.set_defaults(func=cmd_download)

    p2 = sub.add_parser("crawl", help="从国家统计局 html 页面抓当月增量")
    p2.add_argument("--url", required=True)
    p2.add_argument("--out", default="realty_app/static/stats_70.csv")
    p2.set_defaults(func=cmd_crawl)

    p3 = sub.add_parser("convert", help="本地已有宽表时直接转窄表")
    p3.add_argument("--src", required=True, help="输入宽表 CSV（hugohe3 格式）")
    p3.add_argument("--out", default="realty_app/static/stats_70.csv")
    p3.set_defaults(func=cmd_convert)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())

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
import tempfile
from collections import defaultdict
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


def validate_complete_snapshot(rows: list[dict]) -> tuple[int, int]:
    """校验整表结构，避免把部分下载或截断历史原子替换成“成功”。"""
    if not rows:
        raise ValueError("没有可写入的数据行")

    coverage: dict[tuple[int, int], dict[str, set[str]]] = defaultdict(
        lambda: {"同比": set(), "环比": set()}
    )
    seen: set[tuple[tuple[int, int], str, str]] = set()
    for index, row in enumerate(rows, start=2):
        month = month_key(str(row.get("date") or ""))
        city = str(row.get("city") or "").strip()
        fixed_base = str(row.get("fixed_base") or "").strip()
        if month is None or not city or fixed_base not in ("同比", "环比"):
            raise ValueError(f"第 {index} 行 date/city/fixed_base 非法")
        for field in ("new_idx", "second_idx"):
            value = str(row.get(field) or "").strip()
            try:
                float(value)
            except ValueError as exc:
                raise ValueError(f"第 {index} 行 {field} 不是数值") from exc
        key = (month, city, fixed_base)
        if key in seen:
            raise ValueError(f"第 {index} 行出现重复城市与口径：{city}/{fixed_base}")
        seen.add(key)
        coverage[month][fixed_base].add(city)

    for month, bases in coverage.items():
        yoy = bases["同比"]
        mom = bases["环比"]
        if len(yoy) != 70 or len(mom) != 70 or yoy != mom:
            raise ValueError(
                f"{month[0]}/{month[1]} 城市覆盖不完整：同比 {len(yoy)}，环比 {len(mom)}"
            )
    return max(coverage)


def write_narrow_csv(rows: list[dict], out_path: Path, append: bool = False) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = out_path.exists() and out_path.stat().st_size > 0
    if append and file_exists:
        with open(out_path, "a", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=OUT_FIELDS)
            for r in rows:
                writer.writerow(r)
        return

    # download/convert 会整表替换；先写同目录临时文件再 replace，避免网络成功后
    # 在写盘中途把 last-good CSV 截断。
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8-sig",
            newline="",
            delete=False,
            dir=str(out_path.parent),
            suffix=".tmp",
        ) as f:
            tmp_path = Path(f.name)
            writer = csv.DictWriter(f, fieldnames=OUT_FIELDS)
            writer.writeheader()
            for r in rows:
                writer.writerow(r)
        with tmp_path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            if reader.fieldnames != OUT_FIELDS:
                raise ValueError(f"临时文件表头非法：{reader.fieldnames}")
            validate_complete_snapshot(list(reader))
        tmp_path.replace(out_path)
    except Exception:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)
        raise


def month_key(value: str) -> tuple[int, int] | None:
    parts = value.strip().replace("-", "/").split("/")
    if len(parts) < 2:
        return None
    try:
        year, month = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if month < 1 or month > 12:
        return None
    return year, month


def latest_month(rows: list[dict]) -> tuple[int, int] | None:
    months = [month_key(str(row.get("date") or "")) for row in rows]
    valid = [month for month in months if month is not None]
    return max(valid) if valid else None


def existing_snapshot_stats(path: Path) -> tuple[tuple[int, int] | None, int]:
    if not path.exists() or path.stat().st_size == 0:
        return None, 0
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
        return latest_month(rows), len(rows)


# ---------- mode 1: download ----------
def cmd_download(args: argparse.Namespace) -> int:
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[download] GET {HUGO_CSV_URL}")
    if requests is not None:
        r = requests.get(HUGO_CSV_URL, timeout=60)
        r.raise_for_status()
        raw = r.content
    else:
        import urllib.request

        print("[download] requests 不可用，改用 urllib", file=sys.stderr)
        req = urllib.request.Request(
            HUGO_CSV_URL, headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
    # 去掉 UTF-8 BOM
    if raw.startswith(b"\xef\xbb\xbf"):
        text = raw[3:].decode("utf-8")
    else:
        text = raw.decode("utf-8")
    print(f"[download] 收到 {len(text)} 字节")

    rows_in = list(csv.reader(io.StringIO(text)))
    if not rows_in:
        print("[download] 上游 CSV 为空，保留现有文件", file=sys.stderr)
        return 2
    rows_out = wide_to_narrow(rows_in, rows_in[0])
    try:
        candidate_latest = validate_complete_snapshot(rows_out)
    except ValueError as exc:
        print(f"[download] 结构校验失败：{exc}，保留现有文件", file=sys.stderr)
        return 2
    try:
        current_latest, current_count = existing_snapshot_stats(out_path)
    except (OSError, csv.Error) as exc:
        print(f"[download] 现有 CSV 无法读取：{exc}", file=sys.stderr)
        return 2
    if current_latest is not None and candidate_latest < current_latest:
        print(
            f"[download] 上游最新月 {candidate_latest} 早于现有 {current_latest}，拒绝回退",
            file=sys.stderr,
        )
        return 2
    if current_count and len(rows_out) < current_count:
        print(
            f"[download] 上游仅 {len(rows_out)} 行，少于现有 {current_count} 行，拒绝截断历史",
            file=sys.stderr,
        )
        return 2
    write_narrow_csv(rows_out, out_path)
    print(
        f"[download] 完成：{len(rows_out)} 行，最新 {candidate_latest[0]}/{candidate_latest[1]} "
        f"→ {out_path}"
    )
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
    if not rows_in:
        print("[convert] 输入 CSV 为空，保留现有文件", file=sys.stderr)
        return 2
    rows_out = wide_to_narrow(rows_in, rows_in[0])
    try:
        candidate_latest = validate_complete_snapshot(rows_out)
    except ValueError as exc:
        print(f"[convert] 结构校验失败：{exc}，保留现有文件", file=sys.stderr)
        return 2
    try:
        current_latest, current_count = existing_snapshot_stats(out)
    except (OSError, csv.Error) as exc:
        print(f"[convert] 现有 CSV 无法读取：{exc}", file=sys.stderr)
        return 2
    if current_latest is not None and candidate_latest < current_latest:
        print(
            f"[convert] 输入最新月 {candidate_latest} 早于现有 {current_latest}，拒绝回退",
            file=sys.stderr,
        )
        return 2
    if current_count and len(rows_out) < current_count:
        print(
            f"[convert] 输入仅 {len(rows_out)} 行，少于现有 {current_count} 行，拒绝截断历史",
            file=sys.stderr,
        )
        return 2
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

"""
append_recent_stats70.py
========================
一次性脚本：把 hugohe3/70cityprice 中现有 stats_70.csv 缺失的月份追加进去。

背景：
  crawl_stats_70.py 的 cmd_download 走整表 replace，并 validate_complete_snapshot
  校验每个月必须严格 70 城。hugohe3 仓库历史覆盖到 2006 年，但 70 城名单在不同
  年代有变化（早期少 5-10 城），所以整表 replace 一直失败，cron 跑了 100 天都
  没把 2026/7 等新月份加进来。

策略：
  1. 拉 hugohe3 宽表 → 解析成窄表
  2. 读现有 stats_70.csv 的 date 列，找出最大月份
  3. 从宽表窄表里筛出比最大月份更新的所有行
  4. 与现有 last-month 的城市集合对齐（仅保留交集，避免把不一致的城市混入）
  5. append 模式追加新月份行
  6. 再跑 check_stats70_freshness 验证

v1.122.8 一次性使用，长期应该让 cmd_download 改成「增量 replace 最近 N 个月」。
"""
from __future__ import annotations

import argparse
import csv
import io
import sys
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

HUGO_CSV_URL = (
    "https://raw.githubusercontent.com/hugohe3/70cityprice/main/70cityprice.csv"
)
OUT_FIELDS = ["date", "city", "fixed_base", "new_idx", "second_idx"]
HUGO_FIELDS = [
    "DATE", "ADCODE", "CITY", "FixedBase",
    "HouseIDX", "ResidentIDX",
    "CommodityHouseIDX", "SecondHandIDX",
    "ResidentBelow90IDX", "CommonResidentBelow90IDX",
    "CommodityBelow90IDX", "Commodity144IDX", "CommodityAbove144IDX",
    "SecondHandBelow90IDX", "SecondHand144IDX", "SecondHandAbove144IDX",
]


def force_utf8() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except Exception:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


def download_hugo() -> str:
    req = urllib.request.Request(HUGO_CSV_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read()
    text = raw.decode("utf-8-sig")
    print(f"[download] 收到 {len(text)} 字节", file=sys.stderr)
    return text


def wide_to_narrow(text: str) -> list[dict]:
    rows_in = list(csv.reader(io.StringIO(text)))
    if not rows_in:
        return []
    header = rows_in[0]
    # 与 crawl_stats_70.py 一致的列定位
    try:
        idx_date = header.index("DATE")
        idx_city = header.index("CITY")
        idx_base = header.index("FixedBase")
        idx_new = header.index("CommodityHouseIDX")
        idx_2nd = header.index("SecondHandIDX")
    except ValueError:
        print("[convert] 表头无法识别", file=sys.stderr)
        return []

    out: list[dict] = []
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


def month_key(v: str) -> tuple[int, int] | None:
    parts = v.strip().replace("-", "/").split("/")
    if len(parts) < 2:
        return None
    try:
        y, m = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if m < 1 or m > 12:
        return None
    return y, m


def main() -> int:
    force_utf8()
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path, required=True, help="目标 stats_70.csv")
    ap.add_argument("--src", type=Path, default=None,
                    help="可选：本地宽表路径；不传则在线拉 hugohe3")
    ap.add_argument("--dry-run", action="store_true", help="只打印，不写文件")
    args = ap.parse_args()

    if not args.csv.exists():
        print(f"[fail] {args.csv} 不存在", file=sys.stderr)
        return 2

    # 1) 拿宽表
    if args.src:
        text = args.src.read_text(encoding="utf-8-sig")
        print(f"[input] 读 {args.src}", file=sys.stderr)
    else:
        text = download_hugo()

    # 2) 转窄表
    new_rows = wide_to_narrow(text)
    if not new_rows:
        print("[fail] 宽表解析为空", file=sys.stderr)
        return 2
    print(f"[convert] 新宽表 → {len(new_rows)} 行窄表", file=sys.stderr)

    # 3) 读现有 csv
    with args.csv.open(encoding="utf-8-sig", newline="") as f:
        existing = list(csv.DictReader(f))
    if not existing:
        print("[fail] 现有 csv 为空", file=sys.stderr)
        return 2

    # 4) 现有最大月份 + 城市集合（以最后一个月为准）
    last_month_existing = max(month_key(r["date"]) for r in existing if month_key(r["date"]))
    cities_last = sorted({r["city"] for r in existing if month_key(r["date"]) == last_month_existing})
    print(f"[existing] 当前最大月={last_month_existing}, 城市数={len(cities_last)}", file=sys.stderr)

    # 5) 从新表里筛出大于 last_month 的行，并裁剪城市到 last 集合（避免混入历史新增/退出城）
    keep_cities = set(cities_last)
    added: list[dict] = []
    skipped_city: set[str] = set()
    # v1.122.28 修：之前 by_month[mk][city] 最里层 key 用 date_str，导致
    # hugohe3 CSV 行顺序按 fixed_base 排（定基比 / 同比 / 环比），最后一个
    # fixed_base（环比）覆盖前面所有 → 7 月只剩 70 行环比，0 行同比，被
    # 完整性闸门拒绝追加。修法：内层 key 改成 (date, fixed_base) 复合。
    by_month: dict[tuple[int, int], dict[str, dict[tuple[str, str], dict]]] = defaultdict(dict)
    for r in new_rows:
        mk = month_key(r["date"])
        if mk is None or mk <= last_month_existing:
            continue
        if r["city"] not in keep_cities:
            skipped_city.add(r["city"])
            continue
        inner_key = (r["date"], r["fixed_base"])
        bucket = by_month.setdefault(mk, {}).setdefault(r["city"], {})
        if inner_key in bucket:
            continue
        bucket[inner_key] = r

    for mk in sorted(by_month):
        for city in sorted(by_month[mk]):
            for inner_key in sorted(by_month[mk][city]):
                added.append(by_month[mk][city][inner_key])

    if not added:
        print("[info] 无新月份可追加", file=sys.stderr)
        return 0

    # 完整性闸门：每个新月份必须同时有 70 个同比 + 70 个环比
    by_month_check: dict[tuple[int, int], dict[str, set[str]]] = defaultdict(
        lambda: {"同比": set(), "环比": set()}
    )
    for r in added:
        mk = month_key(r["date"])
        if mk is None:
            continue
        if r["fixed_base"] in ("同比", "环比"):
            by_month_check[mk][r["fixed_base"]].add(r["city"])

    complete_months: list[tuple[int, int]] = []
    for mk, bases in by_month_check.items():
        yoy = bases["同比"]
        mom = bases["环比"]
        if len(yoy) == 70 and len(mom) == 70 and yoy == mom:
            complete_months.append(mk)
        else:
            print(f"[skip] {mk[0]}/{mk[1]} 不完整：同比 {len(yoy)}/环比 {len(mom)} "
                  f"城市集合相等={yoy == mom}（上游 hugohe3 还没补完）", file=sys.stderr)

    if not complete_months:
        print("[done] 无完整月份可追加；上游 hugohe3 还在更新", file=sys.stderr)
        return 0

    complete_set = set(complete_months)
    added = [r for r in added if month_key(r["date"]) in complete_set]
    print(f"[plan] 将追加 {len(added)} 行，新月份: "
          f"{sorted({(month_key(r['date']), r['fixed_base']) for r in added})[:6]}...",
          file=sys.stderr)
    if skipped_city:
        print(f"[info] 跳过 {len(skipped_city)} 个不在 last 月份的城市: "
              f"{sorted(skipped_city)}", file=sys.stderr)

    if args.dry_run:
        print("[dry-run] 不写文件", file=sys.stderr)
        return 0

    # 6) 追加写回（用 append 模式 + BOM，匹配原文件）
    import tempfile
    tmp = args.csv.with_suffix(args.csv.suffix + ".tmp")
    # 读全部 + 追加 + 原子替换
    with args.csv.open(encoding="utf-8-sig", newline="") as f:
        existing_text = f.read()
    # 去掉末尾 BOM 之外的尾部换行，再统一用 \r\n 写
    lines = existing_text.splitlines()
    # 保证 \n 结尾
    body = "\r\n".join(lines)
    new_lines = [",".join([r["date"], r["city"], r["fixed_base"],
                           r["new_idx"], r["second_idx"]]) for r in added]
    appended = body + ("\r\n" if not body.endswith("\r\n") else "") + "\r\n".join(new_lines) + "\r\n"

    # 写临时 + 原子替换
    tmp.write_text(appended, encoding="utf-8-sig", newline="")
    tmp.replace(args.csv)
    print(f"[done] {args.csv} 已更新，新行 {len(added)}", file=sys.stderr)

    # 7) 简单回放：最新月份 + 城市数
    with args.csv.open(encoding="utf-8-sig", newline="") as f:
        updated = list(csv.DictReader(f))
    new_max = max(month_key(r["date"]) for r in updated if month_key(r["date"]))
    new_cities = sorted({r["city"] for r in updated if month_key(r["date"]) == new_max})
    print(f"[verify] 新最大月={new_max}, 城市数={len(new_cities)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
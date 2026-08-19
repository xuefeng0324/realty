"""
check_stats70_freshness.py
==========================
检查 static/stats_70.csv 最新月份是否跟上统计局发布节奏。
规则与 src/local/stats70Freshness.ts 一致（publishDay=18）。

用法：
  python scripts/check_stats70_freshness.py
  python scripts/check_stats70_freshness.py --csv static/stats_70.csv --publish-day 18
  python scripts/check_stats70_freshness.py --csv static/stats_70.csv --deadline-day 20

退出码：0 新鲜 / 2 落后或无数据 / 1 参数错误
"""
from __future__ import annotations

import argparse
import csv
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

REPO = Path(__file__).resolve().parents[1]
DEFAULT_CSV = REPO / "static" / "stats_70.csv"


def parse_ym(value: str) -> tuple[int, int] | None:
    parts = value.strip().replace("-", "/").split("/")
    if len(parts) < 2:
        return None
    try:
        y, m = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if m < 1 or m > 12:
        return None
    return y, m


def expected_month(today: date, publish_day: int = 18) -> tuple[int, int]:
    y, m, d = today.year, today.month, today.day
    back = 1 if d >= publish_day else 2
    em = m - back
    ey = y
    while em <= 0:
        em += 12
        ey -= 1
    return ey, em


def month_before(today: date, months: int = 1) -> tuple[int, int]:
    """返回 today 之前第 N 个月，处理跨年。"""
    total = today.year * 12 + (today.month - 1) - months
    return total // 12, total % 12 + 1


def max_month(csv_path: Path) -> tuple[int, int] | None:
    best: tuple[int, int] | None = None
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            ym = parse_ym(row.get("date") or "")
            if ym is None:
                continue
            if best is None or ym > best:
                best = ym
    return best


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    ap.add_argument("--publish-day", type=int, default=18)
    ap.add_argument(
        "--deadline-day",
        type=int,
        default=None,
        help=(
            "上月数据的最终截止日；截止日前缺上月但仍有上上月时仅 warning，"
            "截止日及以后仍缺则失败。不传时保持 publish-day 的严格旧行为"
        ),
    )
    ap.add_argument(
        "--today",
        default=None,
        help="YYYY-MM-DD 覆盖今天（测试用）",
    )
    args = ap.parse_args()
    if not 1 <= args.publish_day <= 31:
        ap.error("--publish-day 必须在 1..31")
    if args.deadline_day is not None and not 1 <= args.deadline_day <= 31:
        ap.error("--deadline-day 必须在 1..31")
    if not args.csv.exists():
        print(f"[fail] CSV 不存在: {args.csv}", file=sys.stderr)
        return 2
    if args.today:
        y, m, d = map(int, args.today.split("-"))
        today = date(y, m, d)
    else:
        today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    try:
        got = max_month(args.csv)
    except (OSError, csv.Error) as exc:
        print(f"[fail] CSV 读取失败: {exc}", file=sys.stderr)
        return 2

    if args.deadline_day is not None:
        target = month_before(today, 1)
        minimum = month_before(today, 2)
        print(
            f"[check] today={today.isoformat()} target={target[0]}/{target[1]}/1 "
            f"minimum={minimum[0]}/{minimum[1]}/1 got={got} "
            f"deadline_day={args.deadline_day}"
        )
        if got is None:
            print("[fail] 无有效 date", file=sys.stderr)
            return 2
        if got >= target:
            print("[ok] stats_70 已包含上月数据")
            return 0
        if got < minimum:
            print(
                f"[fail] 严重落后：有 {got[0]}/{got[1]}，最低应有 "
                f"{minimum[0]}/{minimum[1]}",
                file=sys.stderr,
            )
            return 2
        if today.day < args.deadline_day:
            message = (
                f"stats_70 尚无 {target[0]}/{target[1]}，当前为 {got[0]}/{got[1]}；"
                f"{args.deadline_day} 日前按上游发布窗口仅告警"
            )
            print(f"::warning title=70 城数据待发布::{message}")
            print(f"[warn] {message}")
            return 0
        print(
            f"[fail] 已到截止日仍落后：有 {got[0]}/{got[1]}，期望 ≥ "
            f"{target[0]}/{target[1]}",
            file=sys.stderr,
        )
        return 2

    exp = expected_month(today, args.publish_day)
    print(f"[check] today={today.isoformat()} expected={exp[0]}/{exp[1]}/1 got={got}")
    if got is None:
        print("[fail] 无有效 date", file=sys.stderr)
        return 2
    if got >= exp:
        print("[ok] stats_70 新鲜度达标")
        return 0
    print(
        f"[fail] 落后：有 {got[0]}/{got[1]}，期望 ≥ {exp[0]}/{exp[1]}",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

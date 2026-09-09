"""
check_csv_freshness.py
======================
扫描 realty_app/static/ 下所有 CSV，对每个文件找到「最新一条记录的日期/年月」，
按陈旧天数分级（OK / WARN / STALE），并打印 markdown 摘要 + 退出码。

解决两个老痛点：
  1. check_stats70_freshness.py 用 zoneinfo('Asia/Shanghai')，Windows 默认 Python
     缺 tzdata 就崩；这里只用 datetime.date.today()，可在任何环境跑。
  2. 仓库里 41 个 CSV 各有各的爬取脚本，但只在某个 cron 报红时才会去翻——绝大多数
     陈旧是静默的。本脚本提供一个统一视图，把陈旧超过 60 天的主动报出来。

用法：
  python scripts/check_csv_freshness.py [--static-dir static] [--stale-days 60] [--warn-days 30]
  python scripts/check_csv_freshness.py --json      # 输出 JSON 给 CI 用

退出码：
  0  所有 CSV 都 OK
  1  至少一个 WARN（陈旧 > warn-days）
  2  至少一个 STALE（陈旧 > stale-days）或读不出日期

设计原则：
  - 只依赖 stdlib（csv / datetime / os / json / argparse）
  - 不引入 pandas / zoneinfo / requests 等重依赖，保持 0 额外 install
  - 列顺序 = 文件名按字母，方便人眼扫；分级标记用 emoji 而非颜色，无障碍友好
  - 在 Windows GBK console 下也能直接 print（emoji / 中文走 UTF-8 stdout）

v1.122.7 新增。详见 docs/FRESHNESS_CHECK.md。
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Iterable

# Windows GBK console 输出 emoji/中文会崩；强制把 stdout / stderr 切到 UTF-8。
# Linux / CI runner 默认就是 UTF-8，reconfigure 不影响。
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
    # 极端情况下 reconfigure 不可用，用 io.TextIOWrapper 包一层
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parents[1]
DEFAULT_STATIC = REPO / "static"

# 字段优先级：扫 CSV 表头，命中以下任一字段视为「日期字段」。
# 注意：很多 CSV 用 publish_date（发布日期）而 stats_70.csv 用 date（统计期）。
DATE_FIELD_CANDIDATES = (
    "date",
    "publish_date",
    "as_of_date",
    "effective_date",
    "year",
    "period",
    "month",
    "quarter",
    "time",
    "updated_at",
    "as_of",
)


def parse_value(v: str) -> date | None:
    """把 CSV 里的字符串解析成 date；解析失败返回 None。

    支持：
      - YYYY-MM-DD
      - YYYY/MM/DD
      - YYYY-MM
      - YYYY/MM
      - YYYY 年 Q 季（quarter 用）
      - 整数年（如 2025）
    """
    if not v:
        return None
    s = str(v).strip()
    if not s:
        return None
    # YYYY-MM-DD 或 YYYY/MM/DD
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            pass
    # YYYY-MM 或 YYYY/MM
    for fmt in ("%Y-%m", "%Y/%m"):
        try:
            return datetime.strptime(s[:7] + "-01", "%Y-%m-%d").date()
        except ValueError:
            pass
    # YYYY-Qx（如 2025-Q1）
    if len(s) >= 7 and s[4:6] in ("-Q", "/Q"):
        try:
            q = int(s[6])
            if 1 <= q <= 4:
                return date(int(s[:4]), (q - 1) * 3 + 1, 1)
        except ValueError:
            pass
    # 纯年（4 位整数）
    if s.isdigit() and len(s) == 4:
        try:
            return date(int(s), 1, 1)
        except ValueError:
            pass
    return None


def detect_date_field(headers: list[str]) -> str | None:
    """从表头里挑出第一个候选日期字段。"""
    for cand in DATE_FIELD_CANDIDATES:
        if cand in headers:
            return cand
    return None


def latest_date(csv_path: Path) -> tuple[date | None, str | None]:
    """返回 (最新日期, 命中的日期字段)。CSV 读不出时返回 (None, None)。"""
    try:
        with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []
            field = detect_date_field(list(headers))
            if field is None:
                return None, None
            best: date | None = None
            for row in reader:
                d = parse_value(row.get(field) or "")
                if d is None:
                    continue
                if best is None or d > best:
                    best = d
            return best, field
    except (OSError, csv.Error, UnicodeDecodeError):
        # 文件读不出 / 不是 UTF-8 / CSV 损坏
        return None, None


def grade(stale_days: int | None, warn_days: int, hard_stale_days: int) -> tuple[str, str]:
    """返回 (等级, emoji)。等级：OK / WARN / STALE / UNKNOWN。"""
    if stale_days is None:
        return "UNKNOWN", "❔"
    if stale_days >= hard_stale_days:
        return "STALE", "❗"
    if stale_days >= warn_days:
        return "WARN", "⚠️"
    return "OK", "✅"


def iter_csvs(static_dir: Path) -> Iterable[Path]:
    for p in sorted(static_dir.glob("*.csv")):
        if not p.is_file():
            continue
        yield p


def main() -> int:
    ap = argparse.ArgumentParser(description="扫描 realty_app/static/*.csv 陈旧度")
    ap.add_argument("--static-dir", type=Path, default=DEFAULT_STATIC)
    ap.add_argument(
        "--stale-days",
        type=int,
        default=60,
        help="陈旧天数超过此值记为 STALE（默认 60）",
    )
    ap.add_argument(
        "--warn-days",
        type=int,
        default=30,
        help="陈旧天数超过此值记为 WARN（默认 30）",
    )
    ap.add_argument("--json", action="store_true", help="输出 JSON 给 CI")
    ap.add_argument(
        "--only-stale",
        action="store_true",
        help="只打印 WARN/STALE/UNKNOWN，OK 静默（CI 邮件用）",
    )
    ap.add_argument(
        "--today",
        default=None,
        help="YYYY-MM-DD 覆盖今天（测试用）",
    )
    args = ap.parse_args()

    if not args.static_dir.exists():
        print(f"[fail] 目录不存在: {args.static_dir}", file=sys.stderr)
        return 2

    if args.today:
        y, m, d = map(int, args.today.split("-"))
        today = date(y, m, d)
    else:
        today = date.today()

    rows = []
    worst = 0  # 0=ok, 1=warn, 2=stale
    for csv_path in iter_csvs(args.static_dir):
        latest, field = latest_date(csv_path)
        if latest is None:
            rows.append(
                {
                    "file": csv_path.name,
                    "field": field,
                    "latest": None,
                    "stale_days": None,
                    "grade": "UNKNOWN",
                }
            )
            worst = max(worst, 2)
            continue
        sd = (today - latest).days
        g, _ = grade(sd, args.warn_days, args.stale_days)
        rows.append(
            {
                "file": csv_path.name,
                "field": field,
                "latest": latest.isoformat(),
                "stale_days": sd,
                "grade": g,
            }
        )
        if g == "STALE":
            worst = max(worst, 2)
        elif g == "WARN":
            worst = max(worst, 1)

    if args.json:
        print(json.dumps({"today": today.isoformat(), "rows": rows}, ensure_ascii=False, indent=2))
    else:
        # markdown 表格输出
        print(f"# CSV 新鲜度快照 ({today.isoformat()})")
        print(f"warn ≥ {args.warn_days} 天 / hard ≥ {args.stale_days} 天")
        print()
        print("| 等级 | 文件 | 字段 | 最新 | 陈旧天数 |")
        print("|------|------|------|------|----------|")
        for r in rows:
            if args.only_stale and r["grade"] == "OK":
                continue
            _, emoji = grade(r["stale_days"], args.warn_days, args.stale_days)
            latest = r["latest"] or "-"
            sd = r["stale_days"] if r["stale_days"] is not None else "-"
            print(
                f"| {emoji} {r['grade']:<7} | `{r['file']}` | "
                f"`{r['field'] or '-'}` | {latest} | {sd} |"
            )
        if args.only_stale:
            ok = sum(1 for r in rows if r["grade"] == "OK")
            print()
            print(f"_其余 {ok} 个 CSV 状态 OK 已隐藏_")

    return worst


if __name__ == "__main__":
    raise SystemExit(main())
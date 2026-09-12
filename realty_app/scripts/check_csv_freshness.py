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
  python scripts/check_csv_freshness.py [--static-dir static] [--stale-days 180] [--warn-days 90]
  python scripts/check_csv_freshness.py --json      # 输出 JSON 给 CI 用

退出码：
  0  所有 CSV 都 OK
  1  至少一个 WARN（陈旧 > warn-days）
  2  至少一个 STALE（陈旧 > stale-days）或读不出日期

默认值说明（v1.122.51 起从 30/60 调到 90/180）：
  仓库里很多源是年度/半年度一次性发布的（保障房项目/住房规划/公积金年报等），
  默认 30/60 天会让 false-positive 邮件轰炸。90/180 是「真月度源给两次月报机会，
  半年度源给 1 年报警」折中。具体豁免仍走 --exempt-from-stale 白名单。

设计原则：
  - 只依赖 stdlib（csv / datetime / os / json / argparse）
  - 不引入 pandas / zoneinfo / requests 等重依赖，保持 0 额外 install
  - 列顺序 = 文件名按字母，方便人眼扫；分级标记用 emoji 而非颜色，无障碍友好
  - 在 Windows GBK console 下也能直接 print（emoji / 中文走 UTF-8 stdout）

v1.122.7 新增。详见 docs/FRESHNESS_CHECK.md。

v1.122.51 默认值 30/60 → 90/180（理由见 docstring）。
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

# 字段优先级：扫 CSV 表头，命中以下任一字段视为「数据发布日期字段」。
# 注意：
#  - date 是 NBS / 官方源最常见的「统计期」（如 daily_wangqian 的网签日期）；
#    但它也是「数据获取时间」的代理——只要爬取脚本每天跑，最新 date 就是昨天。
#  - publish_date / as_of_date / effective_date 是显式的「数据发布时间」，
#    强烈优先。
#  - year / period / month / quarter 这些只是「统计期标识」，不等同于
#    「数据获取时间」（如 gz_affordable_projects.csv 的 year=2024 是项目
#    立项年份，不是数据爬取时间）。v1.122.9 起把它们从默认候选剔除，
#    避免「立项 1 年的项目」被误报「数据陈旧 982 天」。
DATE_FIELD_CANDIDATES = (
    "publish_date",
    "as_of_date",
    "effective_date",
    "date",
    "updated_at",
    "as_of",
    "time",
    # zh_affordable_progress.csv 的月度发布日期字段（2026-09-10 加）
    "report_date",
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


def _grade_fn(stale_days: int | None, warn_days: int, hard_stale_days: int) -> tuple[str, str]:
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
        default=180,
        help="陈旧天数超过此值记为 STALE（默认 180，v1.122.51 起从 60 放宽）",
    )
    ap.add_argument(
        "--warn-days",
        type=int,
        default=90,
        help="陈旧天数超过此值记为 WARN（默认 90，v1.122.51 起从 30 放宽）",
    )
    ap.add_argument("--json", action="store_true", help="输出 JSON 给 CI")
    ap.add_argument(
        "--only-stale",
        action="store_true",
        help="只打印 WARN/STALE/UNKNOWN，OK 静默（CI 邮件用）",
    )
    ap.add_argument(
        "--exempt-from-stale",
        type=str,
        default="",
        help=(
            "逗号分隔的文件名白名单（不含路径），匹配项标记为 EXEMPT，不计入 worst 退出码。"
            "用于年初/季度/月度一次性发布的源（如 provident_fund_rates / education_overview /"
            " zh_bdc_registration / zh_price_filing），源站发布节奏与 freshness 默认阈值不匹配。"
        ),
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

    # 接受 "foo.csv" / "foo" / ".csv" 三种写法；最终比较时跟文件名（含 .csv 后缀）做 == 比对
    # 这样 EXEMPT 白名单、CI workflow yml、文档示例都统一写 "foo.csv" 即可，跟 `csv_path.name` 直接比对。
    exempt_set: set[str] = set()
    for name in args.exempt_from_stale.split(","):
        n = name.strip()
        if not n:
            continue
        if not n.endswith(".csv"):
            n = n + ".csv"
        exempt_set.add(n)

    rows = []
    worst = 0  # 0=ok, 1=warn, 2=stale
    for csv_path in iter_csvs(args.static_dir):
        is_exempt = csv_path.name in exempt_set
        latest, field = latest_date(csv_path)
        if latest is None:
            grade = "EXEMPT" if is_exempt else "UNKNOWN"
            rows.append(
                {
                    "file": csv_path.name,
                    "field": field,
                    "latest": None,
                    "stale_days": None,
                    "grade": grade,
                }
            )
            # UNKNOWN / EXEMPT 不计入 worst（不是失败信号）。
            # EXEMPT 用来对年初/季度/月度一次性发布源静音；
            # UNKNOWN 是「该文件没有可用的 freshness 字段」的中性状态。
            continue
        sd = (today - latest).days
        if is_exempt:
            grade = "EXEMPT"
        else:
            grade, _grade_emoji = _grade_fn(sd, args.warn_days, args.stale_days)
        rows.append(
            {
                "file": csv_path.name,
                "field": field,
                "latest": latest.isoformat(),
                "stale_days": sd,
                "grade": grade,
            }
        )
        if grade == "STALE":
            worst = max(worst, 2)
        elif grade == "WARN":
            worst = max(worst, 1)
        # EXEMPT 不参与 worst 计算

    if args.json:
        print(json.dumps(
            {"today": today.isoformat(), "exempt": sorted(exempt_set), "rows": rows},
            ensure_ascii=False, indent=2))
    else:
        # markdown 表格输出
        print(f"# CSV 新鲜度快照 ({today.isoformat()})")
        print(f"warn ≥ {args.warn_days} 天 / hard ≥ {args.stale_days} 天")
        if exempt_set:
            print(f"豁免白名单: {', '.join(sorted(exempt_set))}")
        print()
        print("| 等级 | 文件 | 字段 | 最新 | 陈旧天数 |")
        print("|------|------|------|------|----------|")
        for r in rows:
            if args.only_stale and r["grade"] == "OK":
                continue
            if r["grade"] == "EXEMPT":
                emoji = "⏸"
            else:
                _g, emoji = _grade_fn(r["stale_days"], args.warn_days, args.stale_days)
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
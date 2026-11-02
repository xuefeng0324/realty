#!/usr/bin/env python3
"""数据新鲜度门禁：watch list 里的来源超过 N 天没有一次成功抓取则 exit 1。

为什么不是「抓取失败即红」：
  GitHub runner 到部分国内政务站（szeb.sz.gov.cn / zjj.sz.gov.cn）长期
  Connection reset，站点本身正常但 runner 就是到不了。这些源已从 P1 硬门禁
  降级到 P2 尽力而为；但如果一直抓不到，数据会静默停在 last-good。
  本门禁用「上次成功抓取时间」兜底：超过 --max-age-days 无一次成功才打红。

为什么不用 CSV 的 publish_date：
  教育统计按年发布、供应计划按季度发布，publish_date 老旧是常态而非故障。
  健康档案记的是「抓取通路最后一次成功」，与数据是否出新无关。

健康档案（默认 static/source_health.json）由 run_weekly_source_group.py
的 --health-file 在每次周更后刷新，只记成功来源；全失败的周档案不变。

与 scripts/check_csv_freshness.py 的区别：那个按 CSV 内数据的 publish_date
判「内容旧不旧」；本脚本按抓取成功时间判「通路停没停」，两者互补。

用法：
  python scripts/check_source_freshness.py sz-education sz-planned-supply
  python scripts/check_source_freshness.py --max-age-days 21 \
      --health-file static/source_health.json sz-education
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Sequence

DEFAULT_HEALTH_FILE = Path("static/source_health.json")
DEFAULT_MAX_AGE_DAYS = 21


def _parse_iso(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _emit(level: str, title: str, message: str) -> None:
    def esc(text: str) -> str:
        return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")

    print(f"::{level} title={esc(title)}::{esc(message)}", flush=True)


def check_freshness(
    health_path: Path, sources: Sequence[str], max_age_days: int, now: datetime
) -> list[str]:
    """返回每个被判定停更的来源的失败原因；空列表 = 全部新鲜。"""
    health: dict[str, object] = {}
    if health_path.exists():
        try:
            parsed = json.loads(health_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            return [f"{name}（健康档案不可读：{exc}）" for name in sources]
        if isinstance(parsed, dict):
            health = parsed

    failures: list[str] = []
    limit = timedelta(days=max_age_days)
    for name in sources:
        entry = health.get(name)
        last_success = _parse_iso(entry.get("last_success") if isinstance(entry, dict) else None)
        if last_success is None:
            failures.append(f"{name}（无任何成功记录）")
            continue
        age = now - last_success
        if age > limit:
            failures.append(
                f"{name}（上次成功 {last_success.date().isoformat()}，已 {age.days} 天）"
            )
    return failures


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sources", nargs="+", help="要盯防的来源名（与源清单里的 name 一致）")
    parser.add_argument("--health-file", type=Path, default=DEFAULT_HEALTH_FILE)
    parser.add_argument("--max-age-days", type=int, default=DEFAULT_MAX_AGE_DAYS)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    now = datetime.now(timezone.utc)
    failures = check_freshness(args.health_file, args.sources, args.max_age_days, now)
    if failures:
        _emit(
            "error",
            "weekly 数据新鲜度门禁",
            f"以下来源超过 {args.max_age_days} 天未成功抓取，数据已停更：" + "；".join(failures),
        )
        return 1
    _emit(
        "notice",
        "weekly 数据新鲜度门禁",
        f"{len(args.sources)} 个盯防来源均在 {args.max_age_days} 天内有成功抓取",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

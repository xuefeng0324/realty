#!/usr/bin/env python3
"""Run one weekly source group with per-source evidence and explicit failure policy.

P0 stays as independent hard-failure GitHub Actions steps.  The ``p0`` policy in
this module exists so contract tests can exercise the same fail-fast semantics
with injected fake commands; the weekly workflow invokes only ``p1`` and ``p2``.

Exit codes:
  0: every source succeeded, or only P2 source commands failed
  1: a P0/P1 source command failed
  2: the runner/configuration/spawn orchestration failed
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import re
import shlex
import shutil
import subprocess
import sys
import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence


EXIT_SOURCE_FAILURE = 1
EXIT_ORCHESTRATION_FAILURE = 2
STATUS_SPAWN_FAILURE = 125
# 124 = 单个来源超时被杀。与 GNU timeout 的约定一致，归入「来源失败」而不是编排失败。
STATUS_TIMEOUT = 124
DEFAULT_SOURCE_TIMEOUT_SECONDS = 420
# 第一遍失败后到重试之间的等待，避免立刻重锤同一个源站。
RETRY_FAILED_SOURCE_DELAY_SECONDS = 2
SOURCE_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


@dataclass(frozen=True)
class SourceSpec:
    name: str
    command: tuple[str, ...]


@dataclass(frozen=True)
class SourceResult:
    name: str
    exit_code: int
    orchestration_error: bool = False


@dataclass(frozen=True)
class GroupPolicy:
    fail_fast: bool
    source_failure_is_fatal: bool
    annotation_level: str
    summary_title: str
    retry_failed: bool = False


POLICIES: dict[str, GroupPolicy] = {
    "p0": GroupPolicy(
        fail_fast=True,
        source_failure_is_fatal=True,
        annotation_level="error",
        summary_title="P0 硬门禁模拟",
    ),
    "p1": GroupPolicy(
        fail_fast=False,
        source_failure_is_fatal=True,
        annotation_level="error",
        summary_title="P1 必需官方周更",
        # GitHub runner 访问国内政务站偶发 Connection reset，重试一次可避免整周变红。
        retry_failed=True,
    ),
    "p2": GroupPolicy(
        fail_fast=False,
        source_failure_is_fatal=False,
        annotation_level="warning",
        summary_title="P2 尽力刷新宏观来源",
        retry_failed=True,
    ),
}


def _python_command(script: str, *args: str) -> tuple[str, ...]:
    return (sys.executable, f"scripts/{script}", *args)


DEFAULT_SOURCE_GROUPS: dict[str, tuple[SourceSpec, ...]] = {
    # 2026-11-03 调整：
    # - sz-education / sz-planned-supply / sz-affordable-projects 降级到 P2。
    #   GitHub runner 到 szeb.sz.gov.cn / zjj.sz.gov.cn 系统性 Connection reset
    #   （本地可通、runner 两轮重试均不通），留在 P1 只会周周红；
    #   停更风险改由 check_source_freshness.py 的「N 天未成功才红」门禁兜底。
    # - zh-price-filing 停更：珠海「商品房价格备案公示」栏目 2026-07 起 404
    #   （官网导航仍挂链接但目标页不存在，本地与 runner 均复现），
    #   CSV 保留 last-good；源站恢复或迁移完成后再加回。
    "p1": (
        SourceSpec("gz-education", _python_command("crawl_gz_education_overview.py")),
        SourceSpec("zh-education", _python_command("crawl_zh_education_overview.py")),
        SourceSpec("gz-housing-plan", _python_command("crawl_gz_housing_plan.py")),
        SourceSpec("gz-affordable-projects", _python_command("crawl_gz_affordable_projects.py", "--max", "12")),
        SourceSpec("gz-affordable-targets", _python_command("crawl_gz_affordable_targets.py", "--max", "12")),
        SourceSpec(
            "gz-land-deals",
            _python_command("crawl_gz_land_deals.py", "--pages", "12", "--max-detail", "120"),
        ),
        SourceSpec(
            "sz-land-deals",
            _python_command("crawl_sz_land_deals.py", "--pages", "4", "--page-size", "50"),
        ),
        SourceSpec("zh-affordable-progress", _python_command("crawl_zh_affordable_progress.py", "--max", "8")),
        SourceSpec("sz-provident-annual", _python_command("crawl_sz_provident_annual.py", "--max", "6")),
        SourceSpec("gz-provident-annual", _python_command("crawl_gz_provident_annual.py")),
        SourceSpec("zh-provident-dynamics", _python_command("crawl_zh_provident_dynamics.py")),
        SourceSpec("gd-provident-annual", _python_command("crawl_gd_provident_annual.py")),
        SourceSpec("gd-real-estate-brief", _python_command("crawl_gd_real_estate_brief.py", "--max", "12")),
        SourceSpec("gd-fa-investment", _python_command("crawl_gd_fa_investment.py", "--max", "8")),
        SourceSpec("gd-construction", _python_command("crawl_gd_construction.py", "--max", "8")),
        SourceSpec("gd-economy", _python_command("crawl_gd_economy.py", "--max", "12")),
        SourceSpec("gd-industrial", _python_command("crawl_gd_industrial.py", "--max", "12")),
        SourceSpec("gd-retail", _python_command("crawl_gd_retail.py", "--max", "12")),
        SourceSpec("gd-services", _python_command("crawl_gd_services.py", "--max", "12")),
    ),
    # 2026-11-03 停更：mlf。央行 MLF 栏目已改版为「招标公告」，
    # 公告里只有招标量/期限，没有中标利率，拿不到 mlf_1y_pct（实测 46 个
    # 「中期借贷便利」标题全是招标公告，0 个「开展情况」结果公告）。
    # CSV 保留 last-good；栏目恢复发布结果公告后再加回。
    "p2": (
        SourceSpec("omo-rr", _python_command("crawl_omo_rr.py", "--max", "36")),
        SourceSpec(
            "chinabond-yield",
            _python_command("crawl_chinabond_yield.py", "--backfill-days", "21"),
        ),
        SourceSpec("shibor", _python_command("crawl_shibor.py", "--backfill-days", "21")),
        SourceSpec("repo-fixing", _python_command("crawl_repo_fixing.py", "--backfill-days", "21")),
        SourceSpec("pbc-fin-stats", _python_command("crawl_pbc_fin_stats.py", "--max", "18")),
        SourceSpec("pbc-region-sf", _python_command("crawl_pbc_region_sf.py", "--max", "8")),
        SourceSpec(
            "safe-forex",
            _python_command("crawl_safe_forex.py", "--max", "50", "--news-pages", "30"),
        ),
        SourceSpec(
            "safe-settle",
            _python_command("crawl_safe_settle.py", "--max", "30", "--news-pages", "16"),
        ),
        SourceSpec(
            "safe-fx-market",
            _python_command("crawl_safe_fx_market.py", "--max", "30", "--news-pages", "20"),
        ),
        SourceSpec("safe-usd-mid", _python_command("crawl_safe_usd_mid.py", "--months", "6")),
        SourceSpec("safe-ora", _python_command("crawl_safe_ora.py")),
        SourceSpec(
            "safe-bop-trade",
            _python_command("crawl_safe_bop_trade.py", "--max", "24", "--news-pages", "16"),
        ),
        SourceSpec(
            "safe-iip",
            _python_command("crawl_safe_iip.py", "--max", "24", "--news-pages", "30"),
        ),
        SourceSpec(
            "safe-bop",
            _python_command("crawl_safe_bop.py", "--max", "20", "--news-pages", "36"),
        ),
        # 原 P1 官方周更源：runner 到 sz.gov.cn 各站长期 Connection reset（2026-11 观察）。
        # 降级为尽力而为；连续 21 天无一次成功会被 check_source_freshness.py 门禁打红。
        SourceSpec("sz-education", _python_command("crawl_sz_education_overview.py")),
        SourceSpec("sz-planned-supply", _python_command("crawl_sz_planned_supply.py", "--max", "12")),
        SourceSpec("sz-affordable-projects", _python_command("crawl_sz_affordable_projects.py", "--max", "8")),
    ),
}


class OrchestrationError(RuntimeError):
    """Configuration or runner failure, distinct from a child exit code."""


def _validate_sources(raw_sources: Sequence[SourceSpec]) -> tuple[SourceSpec, ...]:
    if not raw_sources:
        raise OrchestrationError("source manifest must contain at least one source")

    seen: set[str] = set()
    validated: list[SourceSpec] = []
    for source in raw_sources:
        if not SOURCE_NAME_RE.fullmatch(source.name):
            raise OrchestrationError(f"invalid source name: {source.name!r}")
        if source.name in seen:
            raise OrchestrationError(f"duplicate source name: {source.name}")
        if not source.command or any(not isinstance(arg, str) or not arg for arg in source.command):
            raise OrchestrationError(f"source {source.name} has an invalid command")
        seen.add(source.name)
        validated.append(source)
    return tuple(validated)


def _load_manifest(path: Path) -> tuple[SourceSpec, ...]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise OrchestrationError(f"cannot read manifest {path}: {exc}") from exc
    if not isinstance(payload, list):
        raise OrchestrationError("manifest root must be a JSON array")

    sources: list[SourceSpec] = []
    for index, item in enumerate(payload):
        if not isinstance(item, dict):
            raise OrchestrationError(f"manifest item {index} must be an object")
        name = item.get("name")
        command = item.get("command")
        if not isinstance(name, str) or not isinstance(command, list):
            raise OrchestrationError(f"manifest item {index} requires name and command")
        if any(not isinstance(arg, str) for arg in command):
            raise OrchestrationError(f"manifest item {index} command must contain strings")
        sources.append(SourceSpec(name=name, command=tuple(command)))
    return _validate_sources(sources)


def _escape_annotation(value: str) -> str:
    return value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def _emit_annotation(level: str, title: str, message: str) -> None:
    print(f"::{level} title={_escape_annotation(title)}::{_escape_annotation(message)}", flush=True)


def _source_timeout_seconds() -> int:
    """单个来源的墙钟上限，默认 420s；可用 WEEKLY_SOURCE_TIMEOUT_SECONDS 覆盖。

    没有上限时，某个源站 socket 卡住会让 orchestrator 永久阻塞：P2 曾经卡了
    20+ 小时，占住 concurrency 组，导致后续周更全部排队不跑。
    """
    raw = os.environ.get("WEEKLY_SOURCE_TIMEOUT_SECONDS", "")
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_SOURCE_TIMEOUT_SECONDS
    return max(1, value)


def _command_preflight_error(command: Sequence[str]) -> str | None:
    executable = command[0]
    executable_path = Path(executable)
    path_like = executable_path.is_absolute() or "/" in executable or "\\" in executable
    if path_like:
        if not executable_path.is_file():
            return f"executable not found: {executable}"
    elif shutil.which(executable) is None:
        return f"executable not found on PATH: {executable}"

    if len(command) > 1 and command[1].lower().endswith(".py"):
        script_path = Path(command[1])
        if not script_path.is_file():
            return f"python entry script not found: {command[1]}"
    return None


def _append_summary(path: Path, title: str, results: Sequence[SourceResult]) -> None:
    with path.open("a", encoding="utf-8", newline="\n") as summary:
        summary.write(f"### {title}\n")
        summary.write("| 来源 | exit | 状态 |\n")
        summary.write("|---|---:|---|\n")
        for result in results:
            if result.orchestration_error:
                state = "编排失败"
            elif result.exit_code == 0:
                state = "成功"
            elif result.exit_code == STATUS_TIMEOUT:
                state = "超时"
            else:
                state = "来源失败"
            summary.write(f"| {result.name} | {result.exit_code} | {state} |\n")
        summary.write("\n")


def _execute_source(
    group: str,
    source: SourceSpec,
    log_dir: Path,
    policy: GroupPolicy,
    log_suffix: str = "",
) -> SourceResult:
    """执行单个来源，带墙钟超时；日志、annotation 都在这里落盘。"""
    log_path = log_dir / f"{group}-{source.name}{log_suffix}.log"
    print(f"===== {group.upper()} {source.name}{log_suffix} =====", flush=True)
    with log_path.open("w", encoding="utf-8", newline="\n") as log:
        log.write(f"$ {shlex.join(source.command)}\n")
        log.flush()
        tail: deque[str] = deque(maxlen=12)
        preflight_error = _command_preflight_error(source.command)
        if preflight_error is not None:
            log.write(f"[orchestration-error] {preflight_error}\n")
            _emit_annotation(
                "error",
                f"{group.upper()} 周更编排失败",
                f"{source.name} 无法启动：{preflight_error}",
            )
            return SourceResult(source.name, STATUS_SPAWN_FAILURE, True)

        try:
            process = subprocess.Popen(
                source.command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )
        except OSError as exc:
            detail = f"{type(exc).__name__}: {exc}"
            log.write(f"[orchestration-error] {detail}\n")
            _emit_annotation(
                "error",
                f"{group.upper()} 周更编排失败",
                f"{source.name} 无法启动：{detail}",
            )
            return SourceResult(source.name, STATUS_SPAWN_FAILURE, True)

        assert process.stdout is not None
        # 先绑定 stdout：线程启动有延迟，若循环已进入下一个来源，
        # 闭包里再读 process.stdout 会串到新进程的管道上。
        stdout_stream = process.stdout
        timeout_s = _source_timeout_seconds()
        stream: queue.Queue[str | None] = queue.Queue()

        def _pump_stdout() -> None:
            try:
                for raw_line in stdout_stream:
                    stream.put(raw_line)
            finally:
                stream.put(None)

        threading.Thread(target=_pump_stdout, daemon=True).start()
        deadline = time.monotonic() + timeout_s
        timed_out = False
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                timed_out = True
                process.kill()
                break
            try:
                line = stream.get(timeout=min(remaining, 1.0))
            except queue.Empty:
                continue
            if line is None:
                break
            log.write(line)
            log.flush()
            print(line, end="", flush=True)
            tail.append(line.rstrip())
        exit_code = process.wait()

        if timed_out:
            detail = f"超时 {timeout_s}s 未结束，已 kill"
            log.write(f"[orchestration-error] {detail}\n")
            log.flush()
            print(f"[timeout] {detail}", flush=True)
            _emit_annotation(
                policy.annotation_level,
                f"{group.upper()} 周更来源超时",
                f"{source.name} {detail}",
            )
            return SourceResult(source.name, STATUS_TIMEOUT)

        if exit_code != 0:
            suffix = "已保留 last-good 并继续其它来源" if not policy.fail_fast else "硬门禁立即停止"
            _emit_annotation(
                policy.annotation_level,
                f"{group.upper()} 周更来源失败",
                f"{source.name} exit={exit_code}；{suffix}",
            )
            # 失败日志末尾同步成 annotation：公开仓库无需登录也能在
            # Actions 页面直接看到失败原因（下载 artifact / logs 需要权限）。
            if tail:
                _emit_annotation(
                    policy.annotation_level,
                    f"{group.upper()} 周更来源失败 · {source.name} 尾部日志",
                    " | ".join(tail)[-2000:],
                )
        return SourceResult(source.name, exit_code)


def _update_health_file(path: Path, group: str, results: Sequence[SourceResult]) -> None:
    """把本周成功来源的 last_success 时间戳写进健康档案（JSON）。

    档案是 check_source_freshness.py 的输入：这些源本身按季度/年度发布，
    publish_date 不能反映「抓取通路是否还活着」，所以以「上次成功抓取」为准。
    只记成功：全失败的周档案不变，避免产生没有信息量的空提交。
    """
    try:
        raw = path.read_text(encoding="utf-8") if path.exists() else ""
    except OSError as exc:
        raise OrchestrationError(f"cannot read health file {path}: {exc}") from exc
    health: dict[str, object] = {}
    if raw.strip():
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise OrchestrationError(f"cannot parse health file {path}: {exc}") from exc
        if isinstance(parsed, dict):
            health = parsed
    succeeded = [
        item for item in results if not item.orchestration_error and item.exit_code == 0
    ]
    if not succeeded:
        return
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for item in succeeded:
        health[item.name] = {"last_success": now, "group": group}
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(health, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        raise OrchestrationError(f"cannot write health file {path}: {exc}") from exc


def run_group(
    group: str,
    sources: Sequence[SourceSpec],
    log_dir: Path,
    status_file: Path,
    summary_file: Path,
    health_file: Path | None = None,
) -> int:
    policy = POLICIES[group]
    sources = _validate_sources(sources)
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
        status_file.parent.mkdir(parents=True, exist_ok=True)
        summary_file.parent.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise OrchestrationError(f"cannot prepare output paths: {exc}") from exc

    results: list[SourceResult] = []

    try:
        status_handle = status_file.open("w", encoding="utf-8", newline="\n")
    except OSError as exc:
        raise OrchestrationError(f"cannot open status file {status_file}: {exc}") from exc

    with status_handle:
        for source in sources:
            try:
                result = _execute_source(group, source, log_dir, policy)
            except OSError as exc:
                raise OrchestrationError(f"cannot write source log for {source.name}: {exc}") from exc
            results.append(result)
            status_handle.write(f"{result.name}\t{result.exit_code}\n")
            status_handle.flush()
            if policy.fail_fast and (result.orchestration_error or result.exit_code != 0):
                break

        # 网络抖动（如 GitHub runner 访问国内政务站 Connection reset）不是数据问题：
        # P1/P2 首轮失败的来源在整组跑完后再补一次，成功即恢复绿色。
        if policy.retry_failed:
            retryable = [
                item
                for item in results
                if not item.orchestration_error and item.exit_code not in (0, STATUS_TIMEOUT)
            ]
            if retryable:
                _emit_annotation(
                    "notice",
                    f"{group.upper()} 周更重试",
                    "首轮失败，整组跑完后重试一次：" + ", ".join(item.name for item in retryable),
                )
                specs = {item.name: item for item in sources}
                for previous in retryable:
                    time.sleep(RETRY_FAILED_SOURCE_DELAY_SECONDS)
                    try:
                        recovered = _execute_source(
                            group, specs[previous.name], log_dir, policy, "-retry"
                        )
                    except OSError as exc:
                        raise OrchestrationError(
                            f"cannot write retry log for {previous.name}: {exc}"
                        ) from exc
                    results[results.index(previous)] = recovered
                    if recovered.exit_code == 0:
                        _emit_annotation(
                            "notice",
                            f"{group.upper()} 周更重试成功",
                            f"{previous.name} 第二次通过，首轮失败视为网络抖动",
                        )
                status_handle.seek(0)
                status_handle.truncate()
                for result in results:
                    status_handle.write(f"{result.name}\t{result.exit_code}\n")
                status_handle.flush()

    orchestration_failed = any(item.orchestration_error for item in results)
    source_failed = any(not item.orchestration_error and item.exit_code != 0 for item in results)

    # 健康档案记录的是「重试后的最终结论」，所以放在 retry pass 之后。
    if health_file is not None:
        _update_health_file(health_file, group, results)

    try:
        _append_summary(summary_file, policy.summary_title, results)
    except OSError as exc:
        raise OrchestrationError(f"cannot append job summary {summary_file}: {exc}") from exc

    if orchestration_failed:
        return EXIT_ORCHESTRATION_FAILURE
    if source_failed and policy.source_failure_is_fatal:
        return EXIT_SOURCE_FAILURE
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--group", choices=tuple(POLICIES), required=True)
    parser.add_argument(
        "--manifest",
        type=Path,
        help="JSON source list for tests/probes; production P1/P2 use built-in lists",
    )
    parser.add_argument("--log-dir", type=Path, default=Path("weekly-logs"))
    parser.add_argument("--status-file", type=Path)
    parser.add_argument("--summary-file", type=Path)
    parser.add_argument(
        "--health-file",
        type=Path,
        help="可选：把本周成功来源的 last_success 写入该 JSON（新鲜度门禁的输入）",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    group = str(args.group)
    try:
        if args.manifest is not None:
            sources = _load_manifest(args.manifest)
        else:
            sources = DEFAULT_SOURCE_GROUPS.get(group)
            if sources is None:
                raise OrchestrationError(f"group {group} requires --manifest")

        status_file = args.status_file or args.log_dir / f"{group}-status.tsv"
        summary_file = args.summary_file
        if summary_file is None:
            summary_env = os.environ.get("GITHUB_STEP_SUMMARY")
            if not summary_env:
                raise OrchestrationError("--summary-file or GITHUB_STEP_SUMMARY is required")
            summary_file = Path(summary_env)
        return run_group(
            group, sources, args.log_dir, status_file, summary_file, args.health_file
        )
    except OrchestrationError as exc:
        _emit_annotation("error", "weekly source-group 编排失败", str(exc))
        return EXIT_ORCHESTRATION_FAILURE
    except Exception as exc:  # defensive: an unexpected runner bug must never look optional
        _emit_annotation(
            "error",
            "weekly source-group 编排失败",
            f"unexpected {type(exc).__name__}: {exc}",
        )
        return EXIT_ORCHESTRATION_FAILURE


if __name__ == "__main__":
    raise SystemExit(main())

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
import re
import shlex
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence


EXIT_SOURCE_FAILURE = 1
EXIT_ORCHESTRATION_FAILURE = 2
STATUS_SPAWN_FAILURE = 125
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
    ),
    "p2": GroupPolicy(
        fail_fast=False,
        source_failure_is_fatal=False,
        annotation_level="warning",
        summary_title="P2 尽力刷新宏观来源",
    ),
}


def _python_command(script: str, *args: str) -> tuple[str, ...]:
    return (sys.executable, f"scripts/{script}", *args)


DEFAULT_SOURCE_GROUPS: dict[str, tuple[SourceSpec, ...]] = {
    "p1": (
        SourceSpec("gz-education", _python_command("crawl_gz_education_overview.py")),
        SourceSpec("sz-education", _python_command("crawl_sz_education_overview.py")),
        SourceSpec("zh-education", _python_command("crawl_zh_education_overview.py")),
        SourceSpec("sz-planned-supply", _python_command("crawl_sz_planned_supply.py", "--max", "12")),
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
        SourceSpec("sz-affordable-projects", _python_command("crawl_sz_affordable_projects.py", "--max", "8")),
        SourceSpec("zh-affordable-progress", _python_command("crawl_zh_affordable_progress.py", "--max", "8")),
        SourceSpec("zh-price-filing", _python_command("crawl_zh_price_filing.py", "--max-pages", "8")),
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
    "p2": (
        SourceSpec("mlf", _python_command("crawl_mlf_history.py", "--max", "24")),
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
            else:
                state = "来源失败"
            summary.write(f"| {result.name} | {result.exit_code} | {state} |\n")
        summary.write("\n")


def run_group(
    group: str,
    sources: Sequence[SourceSpec],
    log_dir: Path,
    status_file: Path,
    summary_file: Path,
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
    source_failed = False
    orchestration_failed = False

    try:
        status_handle = status_file.open("w", encoding="utf-8", newline="\n")
    except OSError as exc:
        raise OrchestrationError(f"cannot open status file {status_file}: {exc}") from exc

    with status_handle:
        for source in sources:
            log_path = log_dir / f"{group}-{source.name}.log"
            print(f"===== {group.upper()} {source.name} =====", flush=True)
            result: SourceResult
            try:
                with log_path.open("w", encoding="utf-8", newline="\n") as log:
                    log.write(f"$ {shlex.join(source.command)}\n")
                    log.flush()
                    preflight_error = _command_preflight_error(source.command)
                    if preflight_error is not None:
                        detail = preflight_error
                        log.write(f"[orchestration-error] {detail}\n")
                        result = SourceResult(source.name, STATUS_SPAWN_FAILURE, True)
                        orchestration_failed = True
                        _emit_annotation(
                            "error",
                            f"{group.upper()} 周更编排失败",
                            f"{source.name} 无法启动：{detail}",
                        )
                    else:
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
                            result = SourceResult(source.name, STATUS_SPAWN_FAILURE, True)
                            orchestration_failed = True
                            _emit_annotation(
                                "error",
                                f"{group.upper()} 周更编排失败",
                                f"{source.name} 无法启动：{detail}",
                            )
                        else:
                            assert process.stdout is not None
                            for line in process.stdout:
                                log.write(line)
                                log.flush()
                                print(line, end="", flush=True)
                            exit_code = process.wait()
                            result = SourceResult(source.name, exit_code)
            except OSError as exc:
                raise OrchestrationError(f"cannot write source log {log_path}: {exc}") from exc

            results.append(result)
            status_handle.write(f"{result.name}\t{result.exit_code}\n")
            status_handle.flush()

            if result.orchestration_error:
                if policy.fail_fast:
                    break
                continue
            if result.exit_code != 0:
                source_failed = True
                suffix = "已保留 last-good 并继续其它来源" if not policy.fail_fast else "硬门禁立即停止"
                _emit_annotation(
                    policy.annotation_level,
                    f"{group.upper()} 周更来源失败",
                    f"{result.name} exit={result.exit_code}；{suffix}",
                )
                if policy.fail_fast:
                    break

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
        return run_group(group, sources, args.log_dir, status_file, summary_file)
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

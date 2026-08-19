import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const APP_ROOT = process.cwd();
const REPO_ROOT = resolve(APP_ROOT, "..");
const PYTHON = process.env.PYTHON || "python";
const WEEKLY_GROUP_RUNNER = resolve(APP_ROOT, "scripts/run_weekly_source_group.py");

function readRepo(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf8");
}

interface FakeSource {
  name: string;
  command: string[];
}

function withTempDir<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "realty-weekly-runner-"));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeFakeCommand(dir: string): string {
  const script = join(dir, "fake_source.py");
  writeFileSync(
    script,
    [
      "from pathlib import Path",
      "import sys",
      "name, trace_path, exit_code = sys.argv[1:4]",
      "with Path(trace_path).open('a', encoding='utf-8') as trace:",
      "    trace.write(name + '\\n')",
      "print('stdout:' + name)",
      "print('stderr:' + name, file=sys.stderr)",
      "raise SystemExit(int(exit_code))",
      ""
    ].join("\n"),
    "utf8"
  );
  return script;
}

function runFakeGroup(dir: string, group: "p0" | "p1" | "p2", sources: FakeSource[]) {
  const manifest = join(dir, `${group}-manifest.json`);
  const logDir = join(dir, "logs");
  const statusFile = join(dir, `${group}-status.tsv`);
  const summaryFile = join(dir, "job-summary.md");
  writeFileSync(manifest, JSON.stringify(sources), "utf8");
  const result = spawnSync(
    PYTHON,
    [
      WEEKLY_GROUP_RUNNER,
      "--group",
      group,
      "--manifest",
      manifest,
      "--log-dir",
      logDir,
      "--status-file",
      statusFile,
      "--summary-file",
      summaryFile
    ],
    {
      cwd: APP_ROOT,
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }
    }
  );
  return { result, logDir, statusFile, summaryFile };
}

describe("CI workflow contracts", () => {
  it("daily workflow uses the default merge contract", () => {
    const workflow = readRepo(".github/workflows/crawl-daily-wangqian.yml");
    const script = readFileSync(resolve(APP_ROOT, "scripts/crawl_daily_wangqian.py"), "utf8");

    expect(workflow).toContain("crawl_daily_wangqian.py fetch 2>&1");
    expect(workflow).not.toMatch(/crawl_daily_wangqian\.py fetch --merge/);
    expect(script).toContain("def build_parser()");
    expect(script).toContain('"--no-merge"');
    expect(script).toContain('"--merge"');
    expect(script).toContain("help=argparse.SUPPRESS");
    expect(script).toContain("no_merge=False");
  });

  it("daily parser keeps default/legacy merge and only --no-merge disables it", () => {
    const probe = [
      "from scripts.crawl_daily_wangqian import build_parser",
      "p = build_parser()",
      "print(p.parse_args(['fetch']).no_merge)",
      "print(p.parse_args(['fetch', '--merge']).no_merge)",
      "print(p.parse_args(['fetch', '--no-merge']).no_merge)",
    ].join("\n");
    const result = spawnSync(PYTHON, ["-c", probe], {
      cwd: APP_ROOT,
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim().split(/\r?\n/)).toEqual(["False", "False", "True"]);
  });

  it("monthly workflow continues other sources and enforces stats70 at the end", () => {
    const workflow = readRepo(".github/workflows/crawl-monthly-stats70.yml");
    const statsStep = workflow.indexOf("id: stats70");
    const sourcesStep = workflow.indexOf("id: monthly_sources");
    const commitStep = workflow.indexOf("- name: 有变更则提交");
    const gateStep = workflow.indexOf("- name: 70 城最终质量门禁");

    expect(workflow).toContain("--deadline-day 20");
    expect(workflow).toMatch(/id: stats70[\s\S]*?continue-on-error: true/);
    expect(workflow).toContain("STATS70_OUTCOME: ${{ steps.stats70.outcome }}");
    expect(workflow).toContain("crawl-monthly-logs");
    expect(statsStep).toBeGreaterThan(0);
    expect(sourcesStep).toBeGreaterThan(statsStep);
    expect(commitStep).toBeGreaterThan(sourcesStep);
    expect(gateStep).toBeGreaterThan(commitStep);
  });

  it("weekly keeps P0 hard gates and delegates P1/P2 to the source-group runner", () => {
    const workflow = readRepo(".github/workflows/crawl-weekly.yml");
    const runner = readFileSync(WEEKLY_GROUP_RUNNER, "utf8");
    const p0Crawl = workflow.indexOf("id: p0_crawl");
    const p0Validate = workflow.indexOf("id: p0_validate");
    const p0Rebuild = workflow.indexOf("id: p0_rebuild");
    const p0Commit = workflow.indexOf("id: p0_commit");
    const p1 = workflow.indexOf("id: p1_required");
    const p2 = workflow.indexOf("id: p2_optional");
    const supplement = workflow.indexOf("id: supplementary_commit");
    const gate = workflow.indexOf("- name: P0/P1 最终质量门禁");

    expect(workflow).not.toContain("|| true");
    expect(workflow).toContain("weekly-logs/p0-anjuke.log");
    expect(workflow).toContain("weekly-logs/p1-status.tsv");
    expect(workflow).toContain("weekly-logs/p2-status.tsv");
    expect(workflow.match(/python scripts\/run_weekly_source_group\.py/g)).toHaveLength(2);
    expect(workflow).toMatch(/id: p1_required[\s\S]*?--group p1[\s\S]*?p1-status\.tsv/);
    expect(workflow).toMatch(/id: p2_optional[\s\S]*?--group p2[\s\S]*?p2-status\.tsv/);
    expect(workflow).not.toContain("run_required()");
    expect(workflow).not.toContain("run_optional()");
    expect(workflow).not.toContain("${PIPESTATUS[0]}");
    expect(workflow.match(/continue-on-error: true/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(workflow.match(/\$GITHUB_STEP_SUMMARY/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(workflow).toContain("name: crawl-weekly-logs");
    expect(workflow).toMatch(/- name: 上传 weekly 分源日志[\s\S]*?if: always\(\)/);
    expect(workflow).toMatch(/- name: P0\/P1 最终质量门禁[\s\S]*?if: always\(\)/);
    expect(workflow).toContain("P1_REQUIRED: ${{ steps.p1_required.outcome }}");
    expect(workflow).toContain("P2_OPTIONAL: ${{ steps.p2_optional.outcome }}");
    expect(workflow).toContain('if [ "$outcome" != "success" ]');
    expect(workflow).toContain('if [ "$P2_OPTIONAL" = "failure" ]');
    expect(runner).toContain("subprocess.Popen");
    expect(runner).toContain("STATUS_SPAWN_FAILURE = 125");
    expect(runner).toContain("source_failure_is_fatal=False");
    expect(runner).toContain("source_failure_is_fatal=True");
    expect(runner).toContain("已保留 last-good 并继续其它来源");

    for (const id of ["p0_crawl", "p0_validate", "p0_rebuild", "p0_commit"]) {
      const start = workflow.indexOf(`id: ${id}`);
      const end = workflow.indexOf("\n      - name:", start);
      const block = workflow.slice(start, end < 0 ? workflow.length : end);
      expect(start, id).toBeGreaterThan(0);
      expect(block, id).not.toContain("continue-on-error");
    }

    expect(p0Crawl).toBeGreaterThan(0);
    expect(p0Validate).toBeGreaterThan(p0Crawl);
    expect(p0Rebuild).toBeGreaterThan(p0Validate);
    expect(p0Commit).toBeGreaterThan(0);
    expect(p0Commit).toBeGreaterThan(p0Rebuild);
    expect(p1).toBeGreaterThan(p0Commit);
    expect(p2).toBeGreaterThan(p1);
    expect(supplement).toBeGreaterThan(p2);
    expect(gate).toBeGreaterThan(supplement);
  });

  it("weekly runner keeps the complete P1/P2 source inventory without executing crawlers", () => {
    const probe = [
      "import json",
      "from scripts.run_weekly_source_group import DEFAULT_SOURCE_GROUPS",
      "print(json.dumps({k: [s.name for s in v] for k, v in DEFAULT_SOURCE_GROUPS.items()}))"
    ].join("\n");
    const result = spawnSync(PYTHON, ["-c", probe], {
      cwd: APP_ROOT,
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }
    });

    expect(result.status, result.stderr).toBe(0);
    const inventory = JSON.parse(result.stdout.trim()) as Record<string, string[]>;
    expect(inventory.p1).toEqual([
      "gz-education",
      "sz-education",
      "zh-education",
      "sz-planned-supply",
      "gz-housing-plan",
      "gz-affordable-projects",
      "gz-affordable-targets",
      "gz-land-deals",
      "sz-land-deals",
      "sz-affordable-projects",
      "zh-affordable-progress",
      "zh-price-filing",
      "sz-provident-annual",
      "gz-provident-annual",
      "zh-provident-dynamics",
      "gd-provident-annual",
      "gd-real-estate-brief",
      "gd-fa-investment",
      "gd-construction",
      "gd-economy",
      "gd-industrial",
      "gd-retail",
      "gd-services"
    ]);
    expect(inventory.p2).toEqual([
      "mlf",
      "omo-rr",
      "chinabond-yield",
      "shibor",
      "repo-fixing",
      "pbc-fin-stats",
      "pbc-region-sf",
      "safe-forex",
      "safe-settle",
      "safe-fx-market",
      "safe-usd-mid",
      "safe-ora",
      "safe-bop-trade",
      "safe-iip",
      "safe-bop"
    ]);
  });

  it("P0 fake command failure is fail-fast and returns non-zero", () => {
    withTempDir((dir) => {
      const fake = writeFakeCommand(dir);
      const trace = join(dir, "trace.txt");
      const sources: FakeSource[] = [
        { name: "hard-fail", command: [PYTHON, fake, "hard-fail", trace, "7"] },
        { name: "must-not-run", command: [PYTHON, fake, "must-not-run", trace, "0"] }
      ];
      const { result, logDir, statusFile, summaryFile } = runFakeGroup(dir, "p0", sources);

      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(1);
      expect(readFileSync(trace, "utf8").trim().split(/\r?\n/)).toEqual(["hard-fail"]);
      expect(readFileSync(statusFile, "utf8")).toBe("hard-fail\t7\n");
      expect(readFileSync(summaryFile, "utf8")).toContain("| hard-fail | 7 | 来源失败 |");
      expect(result.stdout).toContain("::error title=P0 周更来源失败::");
      expect(existsSync(join(logDir, "p0-hard-fail.log"))).toBe(true);
      expect(existsSync(join(logDir, "p0-must-not-run.log"))).toBe(false);
    });
  });

  it("P1 runs every fake source, keeps evidence, then exits 1", () => {
    withTempDir((dir) => {
      const fake = writeFakeCommand(dir);
      const trace = join(dir, "trace.txt");
      const sources: FakeSource[] = [
        { name: "required-ok", command: [PYTHON, fake, "required-ok", trace, "0"] },
        { name: "required-fail", command: [PYTHON, fake, "required-fail", trace, "7"] },
        { name: "required-after", command: [PYTHON, fake, "required-after", trace, "0"] }
      ];
      const { result, logDir, statusFile, summaryFile } = runFakeGroup(dir, "p1", sources);

      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(1);
      expect(readFileSync(trace, "utf8").trim().split(/\r?\n/)).toEqual([
        "required-ok",
        "required-fail",
        "required-after"
      ]);
      expect(readFileSync(statusFile, "utf8")).toBe(
        "required-ok\t0\nrequired-fail\t7\nrequired-after\t0\n"
      );
      expect(result.stdout).toContain("::error title=P1 周更来源失败::");
      expect(result.stdout).toContain("required-fail exit=7");
      expect(readFileSync(join(logDir, "p1-required-fail.log"), "utf8")).toContain(
        "stderr:required-fail"
      );
      expect(readFileSync(summaryFile, "utf8")).toContain(
        "| required-fail | 7 | 来源失败 |"
      );
    });
  });

  it("P2 runs every fake source, warns on failure, and exits 0", () => {
    withTempDir((dir) => {
      const fake = writeFakeCommand(dir);
      const trace = join(dir, "trace.txt");
      const sources: FakeSource[] = [
        { name: "optional-fail", command: [PYTHON, fake, "optional-fail", trace, "9"] },
        { name: "optional-after", command: [PYTHON, fake, "optional-after", trace, "0"] }
      ];
      const { result, logDir, statusFile, summaryFile } = runFakeGroup(dir, "p2", sources);

      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(trace, "utf8").trim().split(/\r?\n/)).toEqual([
        "optional-fail",
        "optional-after"
      ]);
      expect(readFileSync(statusFile, "utf8")).toBe(
        "optional-fail\t9\noptional-after\t0\n"
      );
      expect(result.stdout).toContain("::warning title=P2 周更来源失败::");
      expect(result.stdout).toContain("optional-fail exit=9");
      expect(readFileSync(join(logDir, "p2-optional-fail.log"), "utf8")).toContain(
        "stdout:optional-fail"
      );
      expect(readFileSync(summaryFile, "utf8")).toContain(
        "| optional-fail | 9 | 来源失败 |"
      );
    });
  });

  it("P2 orchestration failure stays non-zero while later fake sources still run", () => {
    withTempDir((dir) => {
      const fake = writeFakeCommand(dir);
      const trace = join(dir, "trace.txt");
      const missingScript = join(dir, "missing-weekly-source.py");
      const sources: FakeSource[] = [
        { name: "before-spawn-error", command: [PYTHON, fake, "before-spawn-error", trace, "0"] },
        { name: "spawn-error", command: [PYTHON, missingScript] },
        { name: "after-spawn-error", command: [PYTHON, fake, "after-spawn-error", trace, "0"] }
      ];
      const { result, logDir, statusFile, summaryFile } = runFakeGroup(dir, "p2", sources);

      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(2);
      expect(readFileSync(trace, "utf8").trim().split(/\r?\n/)).toEqual([
        "before-spawn-error",
        "after-spawn-error"
      ]);
      expect(readFileSync(statusFile, "utf8")).toBe(
        "before-spawn-error\t0\nspawn-error\t125\nafter-spawn-error\t0\n"
      );
      expect(result.stdout).toContain("::error title=P2 周更编排失败::");
      expect(readFileSync(join(logDir, "p2-spawn-error.log"), "utf8")).toContain(
        "[orchestration-error]"
      );
      expect(readFileSync(summaryFile, "utf8")).toContain(
        "| spawn-error | 125 | 编排失败 |"
      );
    });
  });

  it("weekly overwrite writers use temporary files and atomic replace", () => {
    for (const name of ["crawl_anjuke.py", "crawl_zh_price_filing.py"]) {
      const script = readFileSync(resolve(APP_ROOT, "scripts", name), "utf8");
      expect(script, name).toContain("NamedTemporaryFile");
      expect(script, name).toContain(".replace(out_path)");
      expect(script, name).toContain("missing_ok=True");
    }
  });
});

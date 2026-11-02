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

function writeSleepingCommand(dir: string): string {
  const script = join(dir, "sleeping_source.py");
  writeFileSync(
    script,
    [
      "from pathlib import Path",
      "import sys",
      "import time",
      "name, trace_path, sleep_seconds = sys.argv[1:4]",
      "with Path(trace_path).open('a', encoding='utf-8') as trace:",
      "    trace.write(name + '\\n')",
      "print('stdout:' + name, flush=True)",
      "time.sleep(float(sleep_seconds))",
      "print('stdout:' + name + ':end', flush=True)",
      ""
    ].join("\n"),
    "utf8"
  );
  return script;
}

function writeFlakyCommand(dir: string): string {
  const script = join(dir, "flaky_source.py");
  writeFileSync(
    script,
    [
      "from pathlib import Path",
      "import sys",
      "name, trace_path, marker_path, first_exit = sys.argv[1:5]",
      "with Path(trace_path).open('a', encoding='utf-8') as trace:",
      "    trace.write(name + '\\n')",
      "marker = Path(marker_path)",
      "if marker.exists():",
      "    marker.unlink()",
      "    print('stdout:' + name + ':recovered')",
      "    raise SystemExit(0)",
      "marker.write_text('first-run', encoding='utf-8')",
      "print('stdout:' + name + ':first-failure')",
      "print('stderr:' + name, file=sys.stderr)",
      "raise SystemExit(int(first_exit))",
      ""
    ].join("\n"),
    "utf8"
  );
  return script;
}

function runFakeGroup(
  dir: string,
  group: "p0" | "p1" | "p2",
  sources: FakeSource[],
  extraEnv: Record<string, string> = {},
  extraArgs: string[] = []
) {
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
      summaryFile,
      ...extraArgs
    ],
    {
      cwd: APP_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        ...extraEnv
      }
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

    // 降级来源的新鲜度门禁：P1/P2 写健康档案，独立 step 判定，最终门禁汇总
    const freshness = workflow.indexOf("id: freshness_gate");
    expect(freshness).toBeGreaterThan(supplement);
    expect(gate).toBeGreaterThan(freshness);
    expect(workflow).toContain("check_source_freshness.py");
    expect(workflow).toContain("--max-age-days 21");
    expect(workflow).toContain("sz-education sz-planned-supply sz-affordable-projects");
    expect(workflow).toContain("FRESHNESS: ${{ steps.freshness_gate.outcome }}");
    expect(workflow).toContain('"freshness:$FRESHNESS"');
    // P1 写、P2 写、freshness gate 读，共 3 处
    expect(workflow.match(/--health-file static\/source_health\.json/g)).toHaveLength(3);
    expect(workflow).toContain("static/source_health.json");
    expect(runner).toContain("--health-file");
    expect(runner).toContain("_update_health_file");
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
      "zh-education",
      "gz-housing-plan",
      "gz-affordable-projects",
      "gz-affordable-targets",
      "gz-land-deals",
      "sz-land-deals",
      "zh-affordable-progress",
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
      // 2026-11-03 停更：mlf（央行 MLF 栏目改版为招标公告，无中标利率）
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
      "safe-bop",
      // 2026-11-03 起从 P1 降级：runner 到 sz.gov.cn 系统性不可达
      "sz-education",
      "sz-planned-supply",
      "sz-affordable-projects"
    ]);
    // zh-price-filing 不在任何组：珠海价格备案栏目 2026-07 起 404，已停更
    expect(inventory.p1).not.toContain("zh-price-filing");
    expect(inventory.p2).not.toContain("zh-price-filing");
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
        "required-after",
        // 首轮失败的 required-fail 会在整组跑完后重试一次
        "required-fail"
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
        "optional-after",
        // 首轮失败的 optional-fail 会重试一次，失败结论保持不变
        "optional-fail"
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

  it("P2 kills a hung source on timeout and keeps running later sources", () => {
    withTempDir((dir) => {
      const fake = writeFakeCommand(dir);
      const sleeper = writeSleepingCommand(dir);
      const trace = join(dir, "trace.txt");
      const sources: FakeSource[] = [
        { name: "slow-source", command: [PYTHON, sleeper, "slow-source", trace, "5"] },
        { name: "after-timeout", command: [PYTHON, fake, "after-timeout", trace, "0"] }
      ];
      const { result, logDir, statusFile, summaryFile } = runFakeGroup(dir, "p2", sources, {
        WEEKLY_SOURCE_TIMEOUT_SECONDS: "1"
      });

      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(trace, "utf8").trim().split(/\r?\n/)).toEqual([
        "slow-source",
        "after-timeout"
      ]);
      expect(readFileSync(statusFile, "utf8")).toBe("slow-source\t124\nafter-timeout\t0\n");
      expect(result.stdout).toContain("::warning title=P2 周更来源超时::");
      expect(result.stdout).toContain("slow-source 超时 1s 未结束，已 kill");
      expect(result.stdout).not.toContain("::warning title=P2 周更来源失败::");
      expect(readFileSync(join(logDir, "p2-slow-source.log"), "utf8")).toContain(
        "[orchestration-error] 超时 1s 未结束，已 kill"
      );
      expect(readFileSync(join(logDir, "p2-after-timeout.log"), "utf8")).toContain(
        "stdout:after-timeout"
      );
      expect(readFileSync(summaryFile, "utf8")).toContain("| slow-source | 124 | 超时 |");
    });
  });

  it("P1 retries a failed source once and turns green when it recovers", () => {
    withTempDir((dir) => {
      const flaky = writeFlakyCommand(dir);
      const trace = join(dir, "trace.txt");
      const marker = join(dir, "flaky-marker.txt");
      const sources: FakeSource[] = [
        {
          name: "flaky-required",
          command: [PYTHON, flaky, "flaky-required", trace, marker, "7"]
        }
      ];
      const { result, logDir, statusFile, summaryFile } = runFakeGroup(dir, "p1", sources);

      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(trace, "utf8").trim().split(/\r?\n/)).toEqual([
        "flaky-required",
        "flaky-required"
      ]);
      expect(readFileSync(statusFile, "utf8")).toBe("flaky-required\t0\n");
      expect(result.stdout).toContain("::notice title=P1 周更重试::");
      expect(result.stdout).toContain("::notice title=P1 周更重试成功::");
      expect(
        readFileSync(join(logDir, "p1-flaky-required-retry.log"), "utf8")
      ).toContain("stdout:flaky-required:recovered");
      expect(readFileSync(summaryFile, "utf8")).toContain(
        "| flaky-required | 0 | 成功 |"
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

  it("runner --health-file 只记录最终成功的来源", () => {
    withTempDir((dir) => {
      const fake = writeFakeCommand(dir);
      const trace = join(dir, "trace.txt");
      const healthFile = join(dir, "health.json");
      const sources: FakeSource[] = [
        { name: "optional-ok", command: [PYTHON, fake, "optional-ok", trace, "0"] },
        { name: "optional-fail", command: [PYTHON, fake, "optional-fail", trace, "7"] }
      ];
      const { result } = runFakeGroup(dir, "p2", sources, {}, ["--health-file", healthFile]);

      expect(result.status, result.stderr).toBe(0); // P2 来源失败不致命
      const health = JSON.parse(readFileSync(healthFile, "utf8")) as Record<
        string,
        { last_success?: string; group?: string }
      >;
      expect(Object.keys(health)).toEqual(["optional-ok"]);
      expect(health["optional-ok"]!.group).toBe("p2");
      expect(Number.isNaN(Date.parse(health["optional-ok"]!.last_success!))).toBe(false);
    });
  });

  it("runner --health-file 全组失败时不写档案（避免空提交）", () => {
    withTempDir((dir) => {
      const fake = writeFakeCommand(dir);
      const trace = join(dir, "trace.txt");
      const healthFile = join(dir, "health.json");
      const sources: FakeSource[] = [
        { name: "optional-fail", command: [PYTHON, fake, "optional-fail", trace, "7"] }
      ];
      const { result } = runFakeGroup(dir, "p2", sources, {}, ["--health-file", healthFile]);

      expect(result.status, result.stderr).toBe(0);
      expect(existsSync(healthFile)).toBe(false);
    });
  });

  it("check_source_freshness 对新鲜/过期/无记录/坏档案的判定", () => {
    const script = resolve(APP_ROOT, "scripts/check_source_freshness.py");
    const run = (healthFile: string, sources: string[]) =>
      spawnSync(
        PYTHON,
        [script, "--health-file", healthFile, "--max-age-days", "21", ...sources],
        {
          cwd: APP_ROOT,
          encoding: "utf8",
          env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }
        }
      );

    withTempDir((dir) => {
      const healthFile = join(dir, "health.json");
      const fresh = new Date(Date.now() - 2 * 86400_000).toISOString();
      const stale = new Date(Date.now() - 30 * 86400_000).toISOString();
      writeFileSync(
        healthFile,
        JSON.stringify({
          "fresh-source": { last_success: fresh, group: "p2" },
          "stale-source": { last_success: stale, group: "p2" }
        }),
        "utf8"
      );

      const ok = run(healthFile, ["fresh-source"]);
      expect(ok.status, ok.stderr).toBe(0);
      expect(ok.stdout).toContain("::notice title=weekly 数据新鲜度门禁::");

      const old = run(healthFile, ["stale-source"]);
      expect(old.status, old.stderr).toBe(1);
      expect(old.stdout).toContain("::error title=weekly 数据新鲜度门禁::");
      expect(old.stdout).toContain("已 30 天");

      const missing = run(healthFile, ["never-crawled"]);
      expect(missing.status, missing.stderr).toBe(1);
      expect(missing.stdout).toContain("无任何成功记录");

      const noFile = run(join(dir, "absent.json"), ["fresh-source"]);
      expect(noFile.status, noFile.stderr).toBe(1);

      const badFile = join(dir, "bad.json");
      writeFileSync(badFile, "{not json", "utf8");
      const bad = run(badFile, ["fresh-source"]);
      expect(bad.status, bad.stderr).toBe(1);
      expect(bad.stdout).toContain("健康档案不可读");
    });
  });

  it("仓库内 source_health.json 覆盖三个降级 sz 来源（结构检查，不随时间腐坏）", () => {
    const health = JSON.parse(
      readFileSync(resolve(APP_ROOT, "static/source_health.json"), "utf8")
    ) as Record<string, { last_success?: string }>;
    for (const name of ["sz-education", "sz-planned-supply", "sz-affordable-projects"]) {
      expect(health[name], name).toBeDefined();
      expect(Number.isNaN(Date.parse(health[name]!.last_success!)), name).toBe(false);
    }
  });
});

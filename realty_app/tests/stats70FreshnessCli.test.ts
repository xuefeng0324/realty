import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const APP_ROOT = process.cwd();
const PYTHON = process.env.PYTHON || "python";
const CHECKER = resolve(APP_ROOT, "scripts/check_stats70_freshness.py");
const CRAWLER = resolve(APP_ROOT, "scripts/crawl_stats_70.py");
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "realty-stats70-"));
  tempDirs.push(dir);
  return dir;
}

function writeNarrowCsv(path: string, month?: string): void {
  const rows = ["date,city,fixed_base,new_idx,second_idx"];
  if (month) rows.push(`${month},广州,同比,99.1,95.2`);
  writeFileSync(path, `${rows.join("\n")}\n`, "utf8");
}

const HUGO_FIELDS = [
  "DATE", "ADCODE", "CITY", "FixedBase", "HouseIDX", "ResidentIDX",
  "CommodityHouseIDX", "SecondHandIDX", "ResidentBelow90IDX",
  "CommonResidentBelow90IDX", "CommodityBelow90IDX", "Commodity144IDX",
  "CommodityAbove144IDX", "SecondHandBelow90IDX", "SecondHand144IDX",
  "SecondHandAbove144IDX"
];

function writeWideCsv(path: string, month: string, cityCount: number): void {
  const rows = [HUGO_FIELDS.join(",")];
  for (let index = 0; index < cityCount; index += 1) {
    for (const fixedBase of ["同比", "环比"]) {
      const row = Array.from({ length: HUGO_FIELDS.length }, () => "100");
      row[0] = month;
      row[1] = String(440000 + index);
      row[2] = `测试城${index + 1}`;
      row[3] = fixedBase;
      rows.push(row.join(","));
    }
  }
  writeFileSync(path, `${rows.join("\n")}\n`, "utf8");
}

function runChecker(csv: string, today: string, deadline = true) {
  const args = [CHECKER, "--csv", csv, "--today", today];
  if (deadline) args.push("--deadline-day", "20");
  return spawnSync(PYTHON, args, {
    cwd: APP_ROOT,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("stats70 freshness CLI deadline policy", () => {
  it.each(["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19"])(
    "%s: having June while waiting for July is warning + exit 0",
    (today) => {
      const csv = join(makeTempDir(), "stats_70.csv");
      writeNarrowCsv(csv, "2026/6/1");
      const result = runChecker(csv, today);

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("::warning title=70 城数据待发布::");
    },
  );

  it("fails on the 20th when the previous month is still absent", () => {
    const csv = join(makeTempDir(), "stats_70.csv");
    writeNarrowCsv(csv, "2026/6/1");
    const result = runChecker(csv, "2026-08-20");

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("已到截止日仍落后");
  });

  it("passes on any scheduled day once the previous month exists", () => {
    const csv = join(makeTempDir(), "stats_70.csv");
    writeNarrowCsv(csv, "2026/7/1");
    const result = runChecker(csv, "2026-08-20");

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("已包含上月数据");
  });

  it("handles the January deadline window across the year boundary", () => {
    const csv = join(makeTempDir(), "stats_70.csv");
    writeNarrowCsv(csv, "2025/11/1");

    const waiting = runChecker(csv, "2026-01-16");
    expect(waiting.status, waiting.stderr).toBe(0);
    expect(waiting.stdout).toContain("target=2025/12/1");
    expect(waiting.stdout).toContain("minimum=2025/11/1");

    const overdue = runChecker(csv, "2026-01-20");
    expect(overdue.status).toBe(2);
    expect(overdue.stderr).toContain("已到截止日仍落后");
  });

  it("never grants grace to missing, invalid, or two-months-stale data", () => {
    const dir = makeTempDir();
    const missing = join(dir, "missing.csv");
    const invalid = join(dir, "invalid.csv");
    const stale = join(dir, "stale.csv");
    writeNarrowCsv(invalid);
    writeNarrowCsv(stale, "2026/5/1");

    expect(runChecker(missing, "2026-08-16").status).toBe(2);
    expect(runChecker(invalid, "2026-08-16").status).toBe(2);
    expect(runChecker(stale, "2026-08-16").status).toBe(2);
  });

  it("keeps the old strict publish-day behavior when deadline is omitted", () => {
    const csv = join(makeTempDir(), "stats_70.csv");
    writeNarrowCsv(csv, "2026/6/1");
    const result = runChecker(csv, "2026-08-18", false);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("落后");
  });
});

describe("stats70 conversion last-good protection", () => {
  it("does not replace an existing output when the source is empty", () => {
    const dir = makeTempDir();
    const src = join(dir, "empty.csv");
    const out = join(dir, "stats_70.csv");
    writeFileSync(src, "", "utf8");
    writeNarrowCsv(out, "2026/6/1");
    const before = readFileSync(out, "utf8");

    const result = spawnSync(
      PYTHON,
      [CRAWLER, "convert", "--src", src, "--out", out],
      {
        cwd: APP_ROOT,
        encoding: "utf8",
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      },
    );

    expect(result.status).toBe(2);
    expect(readFileSync(out, "utf8")).toBe(before);
  });

  it("rejects a partially downloaded city matrix before atomic replace", () => {
    const dir = makeTempDir();
    const src = join(dir, "partial.csv");
    const out = join(dir, "stats_70.csv");
    writeWideCsv(src, "2026/7/1", 1);
    writeNarrowCsv(out, "2026/6/1");
    const before = readFileSync(out, "utf8");

    const result = spawnSync(PYTHON, [CRAWLER, "convert", "--src", src, "--out", out], {
      cwd: APP_ROOT,
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("结构校验失败");
    expect(readFileSync(out, "utf8")).toBe(before);
  });

  it("rejects a structurally complete snapshot whose latest month regresses", () => {
    const dir = makeTempDir();
    const src = join(dir, "older.csv");
    const out = join(dir, "stats_70.csv");
    writeWideCsv(src, "2026/5/1", 70);
    writeNarrowCsv(out, "2026/6/1");
    const before = readFileSync(out, "utf8");

    const result = spawnSync(PYTHON, [CRAWLER, "convert", "--src", src, "--out", out], {
      cwd: APP_ROOT,
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("拒绝回退");
    expect(readFileSync(out, "utf8")).toBe(before);
  });
});

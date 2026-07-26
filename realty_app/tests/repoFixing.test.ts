import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestRepoFixing,
  getRepoFixingHistory,
  loadRepoFixingFromCSV
} from "../src/local/repoFixing";

describe("repo fixing FR/FDR (chinamoney)", () => {
  it("加载回购定盘样本", () => {
    const rows = getRepoFixingHistory();
    expect(rows.length).toBeGreaterThanOrEqual(15);
    const latest = getLatestRepoFixing();
    expect(latest).not.toBeNull();
    expect(latest!.fr007).toBeGreaterThan(0.5);
    expect(latest!.fdr007).toBeGreaterThan(0.5);
    expect(latest!.sourceUrl).toMatch(/chinamoney\.com\.cn/);
  });

  it("2026-07-24 对齐官网最新 JSON", () => {
    const row = getRepoFixingHistory().find((r) => r.date === "2026-07-24");
    expect(row).toBeTruthy();
    expect(row!.fr001).toBe(1.4);
    expect(row!.fr007).toBe(1.41);
    expect(row!.fr014).toBe(1.43);
    expect(row!.fdr001).toBe(1.38);
    expect(row!.fdr007).toBe(1.4);
    expect(row!.fdr014).toBe(1.38);
    expect(row!.source).toBe("latest_json");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_repo_fixing.py"), "utf8");
    expect(script).toContain("FrrHis");
    expect(script).toContain("fdr.json");
    expect(script).toContain("≠");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-repo-fixing");
    expect(dash).toContain("getLatestRepoFixing");
  });

  it("CSV 解析拒绝非 chinamoney.com.cn", () => {
    const rows = loadRepoFixingFromCSV(
      [
        "date,fr001,fr007,fr014,fdr001,fdr007,fdr014,source,source_url",
        "2099-01-01,1,1,1,1,1,1,evil,https://evil.example/x",
        "2099-01-02,1.1,1.2,1.3,1.05,1.15,1.25,latest_json,https://www.chinamoney.com.cn/x"
      ].join("\n")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe("2099-01-02");
    expect(rows[0]!.fr007).toBe(1.2);
  });
});

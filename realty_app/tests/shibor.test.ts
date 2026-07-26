import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getLatestShibor, getShiborHistory, loadShiborFromCSV } from "../src/local/shibor";

describe("shibor (chinamoney)", () => {
  it("加载 Shibor 样本", () => {
    const rows = getShiborHistory();
    expect(rows.length).toBeGreaterThanOrEqual(15);
    const latest = getLatestShibor();
    expect(latest).not.toBeNull();
    expect(latest!.on).toBeGreaterThan(0.5);
    expect(latest!.on).toBeLessThan(10);
    expect(latest!.sourceUrl).toMatch(/chinamoney\.com\.cn/);
  });

  it("2026-07-24 对齐官网最新 JSON", () => {
    const row = getShiborHistory().find((r) => r.date === "2026-07-24");
    expect(row).toBeTruthy();
    expect(row!.on).toBe(1.3812);
    expect(row!.w1).toBe(1.4);
    expect(row!.m3).toBe(1.428);
    expect(row!.y1).toBe(1.4791);
    expect(row!.source).toBe("latest_json");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_shibor.py"), "utf8");
    expect(script).toContain("ShiborHis");
    expect(script).toContain("shibor.json");
    expect(script).toContain("≠");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-rates/macro-rates.vue"), "utf8");
    expect(dash).toContain("data-shibor");
    expect(dash).toContain("getLatestShibor");
  });

  it("CSV 解析拒绝非 chinamoney.com.cn", () => {
    const rows = loadShiborFromCSV(
      [
        "date,on,w1,w2,m1,m3,m6,m9,y1,source,source_url",
        "2099-01-01,1,1,1,1,1,1,1,1,evil,https://evil.example/x",
        "2099-01-02,1.2,1.3,1.3,1.4,1.5,1.5,1.6,1.7,latest_json,https://www.chinamoney.com.cn/x"
      ].join("\n")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe("2099-01-02");
    expect(rows[0]!.on).toBe(1.2);
  });
});

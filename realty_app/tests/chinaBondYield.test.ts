import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getChinaBondYieldHistory,
  getLatestChinaBondYield,
  loadChinaBondYieldFromCSV
} from "../src/local/chinaBondYield";

describe("china bond yield (chinabond)", () => {
  it("加载国债收益率样本", () => {
    const rows = getChinaBondYieldHistory();
    expect(rows.length).toBeGreaterThanOrEqual(20);
    const latest = getLatestChinaBondYield();
    expect(latest).not.toBeNull();
    expect(latest!.y10y).toBeGreaterThan(0.5);
    expect(latest!.y10y).toBeLessThan(6);
    expect(latest!.sourceUrl).toMatch(/chinabond\.com\.cn/);
  });

  it("2026-07-24 对齐监管展示表 HTML", () => {
    const row = getChinaBondYieldHistory().find((r) => r.date === "2026-07-24");
    expect(row).toBeTruthy();
    expect(row!.y3m).toBe(1.0986);
    expect(row!.y1y).toBe(1.1389);
    expect(row!.y10y).toBe(1.7282);
    expect(row!.y30y).toBe(2.187);
    expect(row!.spread10y1y).toBeCloseTo(0.5893, 4);
    expect(row!.source).toBe("cbrc_html");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_chinabond_yield.py"), "utf8");
    expect(script).toContain("中债国债收益率曲线");
    expect(script).toContain("showCbrc");
    expect(script).toContain("≠");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-chinabond-yield");
    expect(dash).toContain("getLatestChinaBondYield");
  });

  it("CSV 解析拒绝非 chinabond.com.cn", () => {
    const rows = loadChinaBondYieldFromCSV(
      [
        "date,y3m,y6m,y1y,y3y,y5y,y7y,y10y,y30y,spread_10y_1y,source,source_url",
        "2099-01-01,1,1,1,1,1,1,1.5,2,0.5,evil,https://evil.example/x",
        "2099-01-02,1,1,1.1,1.2,1.3,1.4,1.6,2.1,0.5,api,https://yield.chinabond.com.cn/x"
      ].join("\n")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe("2099-01-02");
    expect(rows[0]!.y10y).toBe(1.6);
  });
});

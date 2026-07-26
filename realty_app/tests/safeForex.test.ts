import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestSafeForex,
  getSafeForex,
  getSafeForexDeltaVsPrev,
  loadSafeForexFromCSV
} from "../src/local/safeForex";

describe("safe forex", () => {
  it("加载外管局外储样本", () => {
    const rows = getSafeForex();
    expect(rows.length).toBeGreaterThanOrEqual(6);
    const latest = getLatestSafeForex();
    expect(latest).not.toBeNull();
    expect(latest!.forexUsdYi).toBeGreaterThan(20000);
    expect(latest!.sourceUrl).toMatch(/safe\.gov\.cn/);
  });

  it("相邻期环比可算", () => {
    const delta = getSafeForexDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.deltaUsdYi).toBe("number");
    expect(typeof delta!.deltaPct).toBe("number");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_safe_forex.py"), "utf8");
    expect(script).toContain("外汇储备");
    expect(script).toContain("forex_usd_yi");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-safe-forex");
    expect(dash).toContain("getLatestSafeForex");
  });

  it("CSV 解析", () => {
    const rows = loadSafeForexFromCSV(
      [
        "date,forex_usd_yi,mom_delta_usd_yi,mom_pct,source_url",
        "2099-01-01,30000,100,0.3,https://www.safe.gov.cn/a",
        "2099-02-01,30100,100,0.33,https://www.safe.gov.cn/b"
      ].join("\n")
    );
    expect(rows[0]!.date).toBe("2099-02-01");
    expect(rows[0]!.forexUsdYi).toBe(30100);
  });
});

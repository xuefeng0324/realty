import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestSafeSettle,
  getSafeSettle,
  getSafeSettleDeltaVsPrev,
  loadSafeSettleFromCSV
} from "../src/local/safeSettle";

describe("safe settle", () => {
  it("加载银行结售汇样本", () => {
    const rows = getSafeSettle();
    expect(rows.length).toBeGreaterThanOrEqual(12);
    const latest = getLatestSafeSettle();
    expect(latest).not.toBeNull();
    expect(latest!.settleUsdYi).toBeGreaterThan(0);
    expect(latest!.sellUsdYi).toBeGreaterThan(0);
    expect(latest!.surplusUsdYi).toBe(latest!.settleUsdYi - latest!.sellUsdYi);
    expect(latest!.sourceUrl).toMatch(/safe\.gov\.cn/);
  });

  it("相邻期顺差差可算", () => {
    const delta = getSafeSettleDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.surplusDeltaUsdYi).toBe("number");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_safe_settle.py"), "utf8");
    expect(script).toContain("结售汇");
    expect(script).toContain("settle_usd_yi");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-safe-settle");
    expect(dash).toContain("getLatestSafeSettle");
  });

  it("CSV 解析", () => {
    const rows = loadSafeSettleFromCSV(
      [
        "date,settle_usd_yi,sell_usd_yi,surplus_usd_yi,source_url",
        "2099-01-01,2000,1500,500,https://www.safe.gov.cn/a",
        "2099-02-01,2100,1600,,https://www.safe.gov.cn/b"
      ].join("\n")
    );
    expect(rows[0]!.date).toBe("2099-02-01");
    expect(rows[0]!.surplusUsdYi).toBe(500);
  });
});

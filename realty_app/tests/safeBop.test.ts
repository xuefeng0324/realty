import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestSafeBop,
  getSafeBop,
  getSafeBopDeltaVsPrev,
  loadSafeBopFromCSV
} from "../src/local/safeBop";

describe("safe balance of payments quarterly", () => {
  it("加载国际收支平衡表样本", () => {
    const rows = getSafeBop();
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const latest = getLatestSafeBop();
    expect(latest).not.toBeNull();
    expect(Math.abs(latest!.currentAccountUsdYi)).toBeGreaterThan(100);
    expect(Math.abs(latest!.goodsSurplusUsdYi)).toBeGreaterThan(100);
    expect(latest!.sourceUrl).toMatch(/safe\.gov\.cn/);
  });

  it("2026-03 对齐官网正式数", () => {
    const q1 = getSafeBop().find((r) => r.date.startsWith("2026-03"));
    expect(q1).toBeTruthy();
    expect(q1!.isPreliminary).toBe(false);
    expect(q1!.currentAccountUsdYi).toBe(1843);
    expect(q1!.goodsSurplusUsdYi).toBe(2475);
    expect(q1!.servicesSurplusUsdYi).toBe(-596);
    expect(q1!.primaryIncomeUsdYi).toBe(-74);
    expect(q1!.secondaryIncomeUsdYi).toBe(38);
    expect(q1!.capitalFinancialUsdYi).toBe(-1881);
  });

  it("经常账户环比可算", () => {
    const delta = getSafeBopDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.currentAccountDelta).toBe("number");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_safe_bop.py"), "utf8");
    expect(script).toContain("国际收支平衡表");
    expect(script).toContain("current_account_usd_yi");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-fx/macro-fx.vue"), "utf8");
    expect(dash).toContain("data-safe-bop");
    expect(dash).toContain("getLatestSafeBop");
  });

  it("CSV 解析与正式优先字段", () => {
    const rows = loadSafeBopFromCSV(
      [
        "date,current_account_usd_yi,goods_surplus_usd_yi,services_surplus_usd_yi,primary_income_usd_yi,secondary_income_usd_yi,capital_financial_usd_yi,is_preliminary,source_url",
        "2099-03-01,1000,2000,-500,-100,50,-900,0,https://www.safe.gov.cn/a",
        "2099-06-01,1100,2100,-400,-80,40,-1000,1,https://www.safe.gov.cn/b"
      ].join("\n")
    );
    expect(rows[0]!.date).toBe("2099-06-01");
    expect(rows[0]!.isPreliminary).toBe(true);
    expect(rows[1]!.currentAccountUsdYi).toBe(1000);
  });
});

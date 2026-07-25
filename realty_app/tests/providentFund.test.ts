import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getLatestProvidentFundRate, loadProvidentFundRatesFromCSV, monthlyPayment } from "../src/local/providentFund";

describe("住房公积金贷款利率", () => {
  it("解析中国政府网发布的现行四档利率", () => {
    const csv = readFileSync(resolve(process.cwd(), "static/provident_fund_rates.csv"), "utf8");
    expect(loadProvidentFundRatesFromCSV(csv)).toHaveLength(1);
    const latest = getLatestProvidentFundRate();
    expect(latest).toMatchObject({
      effectiveDate: "2025-05-08",
      first5yOrLess: 2.1,
      firstOver5y: 2.6,
      second5yOrLess: 2.525,
      secondOver5y: 3.075
    });
    expect(latest?.sourceUrl).toContain("www.gov.cn");
  });

  it("等额本息月供计算结果合理", () => {
    expect(Math.round(monthlyPayment(1_000_000, 2.6, 30))).toBe(4003);
    expect(monthlyPayment(0, 2.6, 30)).toBe(0);
  });
});

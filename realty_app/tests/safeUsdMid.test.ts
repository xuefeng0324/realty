import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestSafeUsdMid,
  getSafeUsdMid,
  getSafeUsdMidDeltaVsPrev,
  getSafeFxMidDelta,
  getSafeUsdMidMonthAverage,
  loadSafeUsdMidFromCSV
} from "../src/local/safeUsdMid";

describe("safe usd mid", () => {
  it("加载美元中间价样本", () => {
    const rows = getSafeUsdMid();
    expect(rows.length).toBeGreaterThanOrEqual(20);
    const latest = getLatestSafeUsdMid();
    expect(latest).not.toBeNull();
    expect(latest!.usdCny).toBeGreaterThan(5);
    expect(latest!.usdCny).toBeLessThan(10);
    expect(Math.abs(latest!.usdPer100 / 100 - latest!.usdCny)).toBeLessThan(0.0002);
    expect(latest!.sourceUrl).toMatch(/safe\.gov\.cn|RMBQuery/);
  });

  it("扩样含欧元/港元中间价", () => {
    const latest = getLatestSafeUsdMid();
    expect(latest).not.toBeNull();
    expect(latest!.eurPer100).toBeGreaterThan(500);
    expect(latest!.eurPer100).toBeLessThan(1200);
    expect(latest!.hkdPer100).toBeGreaterThan(50);
    expect(latest!.hkdPer100).toBeLessThan(150);
    expect(latest!.jpyPer100).toBeGreaterThan(1);
    expect(latest!.jpyPer100).toBeLessThan(20);
    const withEur = getSafeUsdMid().filter((r) => r.eurPer100 > 0);
    expect(withEur.length).toBeGreaterThanOrEqual(20);
  });

  it("相邻日变动与月均", () => {
    const delta = getSafeUsdMidDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.delta).toBe("number");
    const eur = getSafeFxMidDelta("eurPer100");
    expect(eur).not.toBeNull();
    const avg = getSafeUsdMidMonthAverage();
    expect(avg).not.toBeNull();
    expect(avg!.count).toBeGreaterThan(0);
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_safe_usd_mid.py"), "utf8");
    expect(script).toContain("RMBQuery.do");
    expect(script).toContain("usd_cny");
    expect(script).toContain("eur_per100");
    expect(script).toContain("hkd_per100");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-fx/macro-fx.vue"), "utf8");
    expect(dash).toContain("data-safe-usd-mid");
    expect(dash).toContain("getLatestSafeUsdMid");
    expect(dash).toContain("eurPer100");
    expect(dash).toContain("hkdPer100");
  });

  it("CSV 解析", () => {
    const rows = loadSafeUsdMidFromCSV(
      [
        "date,usd_cny,usd_per100,eur_per100,jpy_per100,hkd_per100,gbp_per100,source_url",
        "2099-01-01,6.8000,680,780,4.2,86.5,900,https://www.safe.gov.cn/a",
        "2099-01-02,6.8100,681,781,4.3,86.6,901,https://www.safe.gov.cn/b"
      ].join("\n")
    );
    expect(rows[0]!.date).toBe("2099-01-02");
    expect(rows[0]!.usdCny).toBe(6.81);
    expect(rows[0]!.eurPer100).toBe(781);
    expect(rows[0]!.hkdPer100).toBe(86.6);
  });
});

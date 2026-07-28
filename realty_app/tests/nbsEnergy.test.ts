import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsEnergy,
  getNbsEnergyRows,
  loadNbsEnergyFromCSV,
  shortNbsEnergyMonthLabel
} from "../src/local/nbsEnergy";

describe("nbs energy production", () => {
  it("加载能源生产样本", () => {
    const rows = getNbsEnergyRows();
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const latest = getLatestNbsEnergy();
    expect(latest).not.toBeNull();
    expect(latest!.month).toBe("2026-06");
    expect(latest!.coalYiT).toBe(3.8);
    expect(latest!.coalYoyPct).toBe(-9.7);
    expect(latest!.oilWanT).toBe(1812);
    expect(latest!.oilYoyPct).toBe(-0.5);
    expect(latest!.gasYiM3).toBe(214);
    expect(latest!.gasYoyPct).toBe(1.1);
    expect(latest!.powerYiKwh).toBe(8276);
    expect(latest!.powerYoyPct).toBe(2);
    expect(latest!.sourceUrl).toMatch(/stats\.gov\.cn/);
    expect(shortNbsEnergyMonthLabel("2026-06")).toBe("6月");
  });

  it("单月稿跳过累计句且兼容持平", () => {
    const mar = getNbsEnergyRows().find((r) => r.month === "2026-03");
    expect(mar).toBeTruthy();
    expect(mar!.coalYiT).toBe(4.4);
    expect(mar!.coalYoyPct).toBe(0);
    expect(mar!.powerYoyPct).toBe(1.4);
  });

  it("爬虫与宏观产业页门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_energy.py"), "utf8");
    expect(script).toContain("能源生产情况");
    expect(script).toContain("allow_cum_lead");
    expect(script).toContain("持平");
    expect(script).toContain("≠");
    const page = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(page).toContain("data-nbs-energy");
    expect(page).toContain("getLatestNbsEnergy");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsEnergyFromCSV(
      [
        "month,publish_date,coal_yi_t,coal_yoy_pct,oil_wan_t,oil_yoy_pct,gas_yi_m3,gas_yoy_pct,power_yi_kwh,power_yoy_pct,source_url",
        "2099-01,2099-02-01,1,1,1,1,1,1,1,1,https://evil.example/x",
        "2099-02,2099-03-01,2,-1,3,0.5,4,1,5,2,https://www.stats.gov.cn/a"
      ].join("\n")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.month).toBe("2099-02");
    expect(rows[0]!.coalYoyPct).toBe(-1);
  });
});

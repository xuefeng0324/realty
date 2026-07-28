import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsUnemployment,
  getNbsUnemploymentRows,
  loadNbsUnemploymentFromCSV,
  shortNbsUnemploymentMonthLabel
} from "../src/local/nbsUnemployment";
import { getNbsGdpRows } from "../src/local/nbsGdp";

describe("nbs unemployment", () => {
  it("加载城镇调查失业率与大城市/工时分项", () => {
    const latest = getLatestNbsUnemployment();
    expect(latest).not.toBeNull();
    expect(latest!.month).toBe("2026-05");
    expect(latest!.urbanRatePct).toBe(5.1);
    expect(latest!.urbanAvgYtdPct).toBe(5.2);
    expect(latest!.big31RatePct).toBe(5.1);
    expect(latest!.localHukouRatePct).toBe(5.2);
    expect(latest!.migrantRatePct).toBe(4.9);
    expect(latest!.migrantAgriRatePct).toBe(4.9);
    expect(latest!.weeklyHours).toBe(48.2);
    expect(getNbsUnemploymentRows().length).toBeGreaterThanOrEqual(5);
    expect(shortNbsUnemploymentMonthLabel("2026-05")).toBe("26/05");
  });

  it("爬虫与宏观产业页门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_unemployment.py"), "utf8");
    expect(script).toContain("城镇调查失业率为");
    expect(script).toContain("国民经济运行");
    expect(script).toContain("≠");
    const page = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(page).toContain("data-nbs-unemployment");
    expect(page).toContain("getLatestNbsUnemployment");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsUnemploymentFromCSV(
      [
        "month,publish_date,urban_rate_pct,urban_avg_ytd_pct,big31_rate_pct,local_hukou_rate_pct,migrant_rate_pct,migrant_agri_rate_pct,weekly_hours,source_url",
        "2099-01,2099-01-01,1,1,1,1,1,1,1,https://evil.example/x"
      ].join("\n")
    );
    expect(rows).toEqual([]);
  });
});

describe("nbs gdp 9M backfill", () => {
  it("含 2025 前三季度", () => {
    const row = getNbsGdpRows().find((r) => r.period === "2025-9M");
    expect(row).toBeTruthy();
    expect(row!.gdpYiYuan).toBe(1015036);
    expect(row!.gdpYoyPct).toBe(5.2);
    expect(row!.constructionYoyPct).toBe(-0.5);
    expect(row!.realEstateYoyPct).toBe(0.6);
    expect(row!.quarterGdpYoyPct).toBe(4.8);
  });
});

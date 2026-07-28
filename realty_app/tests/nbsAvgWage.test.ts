import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsAvgWage,
  getNbsAvgWageRows,
  loadNbsAvgWageFromCSV,
  nbsAvgWageHasHousingIndustry
} from "../src/local/nbsAvgWage";

describe("nbs avg wage", () => {
  it("加载城镇单位年平均工资与房地产/建筑业分项", () => {
    const latest = getLatestNbsAvgWage();
    expect(latest).not.toBeNull();
    expect(latest!.year).toBe("2025");
    expect(latest!.nonprivYuan).toBe(129441);
    expect(latest!.nonprivNominalYoyPct).toBe(4.3);
    expect(latest!.nonprivRealYoyPct).toBe(4.2);
    expect(latest!.privYuan).toBe(71590);
    expect(latest!.privNominalYoyPct).toBe(3);
    expect(latest!.privRealYoyPct).toBe(2.9);
    expect(latest!.reNonprivYuan).toBe(89679);
    expect(latest!.reNonprivYoyPct).toBe(-2.4);
    expect(latest!.constructionNonprivYuan).toBe(92036);
    expect(latest!.constructionNonprivYoyPct).toBe(2.8);
    expect(latest!.rePrivYuan).toBe(53338);
    expect(latest!.rePrivYoyPct).toBe(-4.7);
    expect(nbsAvgWageHasHousingIndustry(latest!)).toBe(true);
    expect(getNbsAvgWageRows().length).toBeGreaterThanOrEqual(2);

    const y2024 = getNbsAvgWageRows().find((r) => r.year === "2024");
    expect(y2024).toBeTruthy();
    expect(y2024!.nonprivYuan).toBe(124110);
    expect(y2024!.nonprivNominalYoyPct).toBe(2.8);
    expect(y2024!.nonprivRealYoyPct).toBe(2.6);
  });

  it("爬虫与宏观产业页门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_avg_wage.py"), "utf8");
    expect(script).toContain("城镇单位就业人员年平均工资情况");
    expect(script).toContain("房地产业");
    expect(script).toContain("按可比口径");
    expect(script).toContain("≠");
    const page = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(page).toContain("data-nbs-avg-wage");
    expect(page).toContain("data-nbs-avg-wage-housing");
    expect(page).toContain("getLatestNbsAvgWage");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsAvgWageFromCSV(
      [
        "year,publish_date,nonpriv_yuan,nonpriv_nominal_yoy_pct,nonpriv_real_yoy_pct,priv_yuan,priv_nominal_yoy_pct,priv_real_yoy_pct,re_nonpriv_yuan,re_nonpriv_yoy_pct,construction_nonpriv_yuan,construction_nonpriv_yoy_pct,re_priv_yuan,re_priv_yoy_pct,source_url",
        "2099,2099-01-01,1,1,1,1,1,1,1,1,1,1,1,1,https://evil.example/x"
      ].join("\n")
    );
    expect(rows).toEqual([]);
  });
});

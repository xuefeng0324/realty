import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  gdServicesHasHousingRelated,
  getGdServicesTrend,
  getLatestGdServices,
  loadGdServicesFromCSV
} from "../src/local/gdServices";

describe("gd services", () => {
  it("加载广东规上服务业简况（营收与住房弱相关分项）", () => {
    const latest = getLatestGdServices();
    expect(latest).not.toBeNull();
    expect(latest!.period).toBe("2026_01_05");
    expect(latest!.revenueYoyPct).toBe(7.3);
    expect(latest!.leasingYoyPct).toBe(11.1);
    expect(latest!.itYoyPct).toBe(7.7);
    expect(latest!.sourceUrl).toMatch(/stats\.gd\.gov\.cn/);
    expect(getGdServicesTrend(3).length).toBeGreaterThanOrEqual(3);
    expect(gdServicesHasHousingRelated(latest!)).toBe(true);

    const full2025 = getGdServicesTrend(12).find((r) => r.period === "2025");
    expect(full2025).toBeTruthy();
    expect(full2025!.revenueYoyPct).toBe(6.6);
    expect(full2025!.realEstateSvcYoyPct).toBe(0.3);
    expect(full2025!.leasingYoyPct).toBe(7.8);

    const m111 = getGdServicesTrend(12).find((r) => r.period === "2025_01_11");
    expect(m111).toBeTruthy();
    expect(m111!.revenueYoyPct).toBe(6.7);
    expect(m111!.realEstateSvcYoyPct).toBe(2.3);
  });

  it("爬虫与宏观区域页门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_services.py"), "utf8");
    expect(script).toContain("规模以上服务业运行简况");
    expect(script).toContain("real_estate_svc_yoy_pct");
    expect(script).toContain("leasing_yoy_pct");
    expect(script).toContain("营业收入[^。]{0,40}?同比");
    const page = readFileSync(resolve(process.cwd(), "src/pages/macro-region/macro-region.vue"), "utf8");
    expect(page).toContain("data-gd-services");
    expect(page).toContain("data-gd-services-housing");
    expect(page).toContain("getLatestGdServices");
  });

  it("CSV 解析含租赁/房地产服务", () => {
    const rows = loadGdServicesFromCSV(
      [
        "region,period,period_label,publish_date,sort_key,revenue_yoy_pct,transport_yoy_pct,it_yoy_pct,real_estate_svc_yoy_pct,leasing_yoy_pct,science_yoy_pct,environment_yoy_pct,resident_svc_yoy_pct,education_yoy_pct,health_yoy_pct,culture_yoy_pct,title,source_org,source_url",
        "广东,2099_H1,2099年上半年,2099-07-01,2099-06,1.1,2,3,0.4,5,6,7,8,9,10,11,测试,广东省统计局,https://stats.gd.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.revenueYoyPct).toBe(1.1);
    expect(rows[0]!.realEstateSvcYoyPct).toBe(0.4);
    expect(rows[0]!.leasingYoyPct).toBe(5);
    expect(gdServicesHasHousingRelated(rows[0]!)).toBe(true);
  });
});

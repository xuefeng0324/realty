import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsGdp,
  getNbsGdpRows,
  loadNbsGdpFromCSV,
  shortNbsGdpPeriodLabel
} from "../src/local/nbsGdp";

/**
 * v1.122.54 修：统计局「国内生产总值初步核算」是**累计**口径，期次只有 4 种：
 * Q1（一季度）/ H1（上半年）/ 9M（前三季度）/ 全年。
 * 爬虫 crawl_nbs_gdp.detect_period 与加载器 nbsGdp.periodSortKey 产出的
 * 也正是这 4 种（HEAD 的 CSV 里本来就有 2025-9M 行）。
 *
 * 旧断言把「最新一期」写死成半年报：正则 /^20\d{2}(-Q[1-4]|-H[12])?$/ 匹配不到
 * -9M，数值区间 50-90 万亿也只对 H1 成立。一旦月更 cron 抓到前三季度，
 * CI 就会红 —— 这是「天天报错」的隐藏地雷之一。
 * 现在改成按期次类型取对应量级的合理区间，断言依然有牙齿。
 */
const GDP_BUCKETS = {
  Q1: { gdp: [250_000, 450_000], construction: [10_000, 20_000], realEstate: [15_000, 30_000] },
  H1: { gdp: [500_000, 900_000], construction: [30_000, 45_000], realEstate: [30_000, 50_000] },
  "9M": { gdp: [900_000, 1_200_000], construction: [45_000, 65_000], realEstate: [50_000, 70_000] },
  FY: { gdp: [1_000_000, 1_500_000], construction: [70_000, 100_000], realEstate: [70_000, 100_000] }
} as const;

function gdpBucketOf(period: string): keyof typeof GDP_BUCKETS {
  if (period.endsWith("-Q1")) return "Q1";
  if (period.endsWith("-H1")) return "H1";
  if (period.endsWith("-9M")) return "9M";
  return "FY";
}

describe("nbs gdp", () => {
  it("加载季度 GDP 与建筑业/房地产业增加值", () => {
    const latest = getLatestNbsGdp();
    expect(latest).not.toBeNull();
    // v1.122.54 修：period 词表对齐爬虫实际产出的 4 种累计口径（Q1/H1/9M/全年）
    expect(latest!.period).toMatch(/^20\d{2}(-(Q1|H1|9M))?$/);
    // 数值按期次量级取区间（Q1 25-45 万亿 / H1 50-90 万亿 / 前三季 90-120 万亿 /
    // 全年 100-150 万亿；建筑业与房地产业增加值随累计期次同比例放大），YoY ±10%
    const bucket = GDP_BUCKETS[gdpBucketOf(latest!.period)];
    expect(latest!.gdpYiYuan).toBeGreaterThan(bucket.gdp[0]);
    expect(latest!.gdpYiYuan).toBeLessThan(bucket.gdp[1]);
    expect(latest!.gdpYoyPct).toBeGreaterThan(-5);
    expect(latest!.gdpYoyPct).toBeLessThan(10);
    expect(latest!.constructionYiYuan).toBeGreaterThan(bucket.construction[0]);
    expect(latest!.constructionYiYuan).toBeLessThan(bucket.construction[1]);
    expect(latest!.constructionYoyPct).toBeGreaterThan(-15);
    expect(latest!.constructionYoyPct).toBeLessThan(10);
    expect(latest!.realEstateYiYuan).toBeGreaterThan(bucket.realEstate[0]);
    expect(latest!.realEstateYiYuan).toBeLessThan(bucket.realEstate[1]);
    expect(latest!.realEstateYoyPct).toBeGreaterThan(-15);
    expect(latest!.realEstateYoyPct).toBeLessThan(10);
    // 季度 GDP 字段：H1/H2 有，年度可能为 null
    if (latest!.quarterGdpYiYuan !== null) {
      expect(latest!.quarterGdpYiYuan).toBeGreaterThan(200_000);
      expect(latest!.quarterGdpYiYuan).toBeLessThan(500_000);
    }
    expect(latest!.quarterGdpYoyPct).toBeGreaterThan(-5);
    expect(latest!.quarterGdpYoyPct).toBeLessThan(10);
    expect(getNbsGdpRows().length).toBeGreaterThanOrEqual(3);

    const q1 = getNbsGdpRows().find((r) => r.period === "2026-Q1");
    expect(q1).toBeTruthy();
    expect(q1!.gdpYiYuan).toBeGreaterThan(250_000);
    expect(q1!.gdpYiYuan).toBeLessThan(450_000);
    expect(q1!.gdpYoyPct).toBeGreaterThan(-5);
    expect(q1!.gdpYoyPct).toBeLessThan(10);
    expect(q1!.constructionYoyPct).toBeGreaterThan(-15);
    expect(q1!.constructionYoyPct).toBeLessThan(10);
    expect(q1!.realEstateYoyPct).toBeGreaterThan(-15);
    expect(q1!.realEstateYoyPct).toBeLessThan(10);
    expect(q1!.quarterGdpYiYuan).toBeNull();

    const fy = getNbsGdpRows().find((r) => r.period === "2025");
    expect(fy).toBeTruthy();
    expect(fy!.gdpYiYuan).toBeGreaterThan(1_000_000);
    expect(fy!.gdpYiYuan).toBeLessThan(1_500_000);
    expect(fy!.gdpYoyPct).toBeGreaterThan(-5);
    expect(fy!.gdpYoyPct).toBeLessThan(10);
    expect(fy!.constructionYoyPct).toBeGreaterThan(-15);
    expect(fy!.constructionYoyPct).toBeLessThan(10);
    expect(fy!.realEstateYoyPct).toBeGreaterThan(-15);
    expect(fy!.realEstateYoyPct).toBeLessThan(10);
    expect(fy!.quarterGdpYoyPct).toBeGreaterThan(-5);
    expect(fy!.quarterGdpYoyPct).toBeLessThan(10);
    // shortNbsGdpPeriodLabel 验证格式（不验证具体值）
    expect(shortNbsGdpPeriodLabel(latest!.period)).toMatch(/^\d{2}(H[12]|Q[1-4]|前三季|全年)$/);
  });

  it("爬虫与宏观产业页门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_gdp.py"), "utf8");
    expect(script).toContain("国内生产总值初步核算");
    expect(script).toContain("房地产业");
    expect(script).toContain("建筑业");
    expect(script).toContain("≠");
    const page = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(page).toContain("data-nbs-gdp");
    expect(page).toContain("data-nbs-gdp-housing");
    expect(page).toContain("getLatestNbsGdp");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsGdpFromCSV(
      [
        "period,label,publish_date,gdp_yi_yuan,gdp_yoy_pct,primary_yi_yuan,primary_yoy_pct,secondary_yi_yuan,secondary_yoy_pct,tertiary_yi_yuan,tertiary_yoy_pct,industry_yi_yuan,industry_yoy_pct,construction_yi_yuan,construction_yoy_pct,real_estate_yi_yuan,real_estate_yoy_pct,quarter_gdp_yi_yuan,quarter_gdp_yoy_pct,source_url",
        "2099,x,2099-01-01,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,https://evil.example/x"
      ].join("\n")
    );
    expect(rows).toEqual([]);
  });
});

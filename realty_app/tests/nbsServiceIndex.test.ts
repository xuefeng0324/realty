import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsServiceIndex,
  getNbsServiceIndexRows,
  loadNbsServiceIndexFromCSV,
  nbsServiceIndexHasLeasing
} from "../src/local/nbsServiceIndex";

describe("nbs service index", () => {
  it("加载服务业生产指数与租赁商务分项", () => {
    const latest = getLatestNbsServiceIndex();
    expect(latest).not.toBeNull();
    // v1.122.12：cron 每月自动补最新月，断言改为「最近 4 个月内」即可，
    // 不再硬编码 month / 数值。
    expect(latest!.month).toMatch(/^2026-(0[5-9]|10)$/);
    expect(latest!.indexYoyPct).toBeGreaterThan(-5);
    expect(latest!.indexYoyPct).toBeLessThan(15);
    expect(nbsServiceIndexHasLeasing(latest)).toBe(true);

    const apr = getNbsServiceIndexRows().find((r) => r.month === "2026-04");
    expect(apr).toBeTruthy();
    expect(getNbsServiceIndexRows().length).toBeGreaterThanOrEqual(5);
  });

  it("爬虫与宏观产业页门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_service_index.py"), "utf8");
    expect(script).toContain("服务业生产指数");
    expect(script).toContain("租赁和商务服务业");
    expect(script).toContain("≠");
    const page = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(page).toContain("data-nbs-service-index");
    expect(page).toContain("data-nbs-service-index-leasing");
    expect(page).toContain("getLatestNbsServiceIndex");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsServiceIndexFromCSV(
      [
        "month,publish_date,index_yoy_pct,index_ytd_yoy_pct,it_yoy_pct,leasing_yoy_pct,finance_yoy_pct,transport_yoy_pct,source_url",
        "2099-01,2099-01-01,1,1,1,1,1,1,https://evil.example/x"
      ].join("\n")
    );
    expect(rows).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("概览页长度守护：关键大卡 data-tab 不应混入 overview", () => {
  const dash = read("src/pages/dashboard/dashboard.vue");

  function getCardDataTab(cardKey: string): string | null {
    const re = new RegExp(
      `data-card-key="${cardKey}"[^>]*data-tab="([^"]+)"`,
      "m"
    );
    const m = dash.match(re);
    return m?.[1] ?? null;
  }

  it("district-8w-trend / wangqian-rank-4w 不应出现在概览", () => {
    expect(getCardDataTab("district-8w-trend")).toBe("price");
    expect(getCardDataTab("wangqian-rank-4w")).toBe("price");
  });

  it("district-map / listing-tag-cloud / hospital-rank 不应出现在概览", () => {
    expect(getCardDataTab("district-map")).toBe("map");
    expect(getCardDataTab("listing-tag-cloud")).toBe("school");
    expect(getCardDataTab("hospital-rank")).toBe("school");
  });

  it("其余 price/school/transit 大卡应按所属 tab 配置", () => {
    expect(getCardDataTab("district-index")).toBe("price");
    expect(getCardDataTab("district-4w-change")).toBe("price");
    expect(getCardDataTab("listing-freshness")).toBe("price");
    expect(getCardDataTab("listing-school-premium")).toBe("price");
    expect(getCardDataTab("multi-community-compare")).toBe("school");
  });

  it("nbsMacro / 供需大卡不应再混入 overview（频道已跳独立页）", () => {
    expect(dash).toMatch(/data-nbs-macro[^>]*data-tab="price"|data-tab="price"[^>]*data-nbs-macro/);
    // 供需相关卡归档：总览不再渲染（独立页 pages/supply）
    expect(dash).toMatch(/data-sz-planned-supply[\s\S]{0,80}data-tab="archived"|data-tab="archived"[\s\S]{0,80}data-sz-planned-supply/);
    expect(dash).toMatch(/data-gz-land-deals[\s\S]{0,80}data-tab="archived"|data-tab="archived"[\s\S]{0,80}data-gz-land-deals/);
    expect(dash).toContain('data-tab="archived"');
    expect(dash).toContain("onHomeChannel");
  });

  it("nbsMacro 在概览精简模式下应收敛：pipeline/res/funds 分区必须被 !isOverviewCompact 门禁", () => {
    expect(
      dash.match(/<view\s+v-if="!isOverviewCompact"[\s\S]*?data-nbs-pipeline/)
    ).toBeTruthy();
    expect(
      dash.match(/<view\s+v-if="!isOverviewCompact"[\s\S]*?data-nbs-res-pipeline/)
    ).toBeTruthy();
    expect(
      dash.match(/<view\s+v-if="!isOverviewCompact"[\s\S]*?data-nbs-residential/)
    ).toBeTruthy();
    expect(
      dash.match(/<view\s+v-if="!isOverviewCompact"[\s\S]*?data-nbs-funds/)
    ).toBeTruthy();
  });
});


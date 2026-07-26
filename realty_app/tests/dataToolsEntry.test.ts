import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("v1.121.138 数据工具独立页（21 张派生卡已迁出 dashboard）", () => {
  const dashSrc = readFileSync(
    resolve(__dirname, "../src/pages/dashboard/dashboard.vue"),
    "utf8"
  );
  const toolsSrc = readFileSync(
    resolve(__dirname, "../src/pages/data-tools/data-tools.vue"),
    "utf8"
  );
  const pagesJson = readFileSync(
    resolve(__dirname, "../src/pages.json"),
    "utf8"
  );

  it("pages.json 注册 data-tools 路由", () => {
    expect(pagesJson).toContain("pages/data-tools/data-tools");
    expect(pagesJson).toContain("数据工具");
  });

  it("dashboard.vue 含「数据工具」独立页入口卡（设置入口）", () => {
    expect(dashSrc).toContain("data-data-tools-entry");
    expect(dashSrc).toContain("goDataTools");
    expect(dashSrc).toContain("/pages/data-tools/data-tools");
  });

  // v1.121.138：21 张派生卡已从 dashboard 真删，HTML 中不应再出现
  // 这些派生卡标识符（顶部 7 张 + 中间段 14 张）。
  it("dashboard.vue 已删除顶部 7 张派生卡（stats70-drift / metro-walk / district-trend / school / edu / admin 等）", () => {
    // 折叠块入口标记已不存在（用全词匹配避开 `openYearExpected` 等子串误命中）
    expect(dashSrc).not.toMatch(/\bdata-derived-block\b/);
    expect(dashSrc).not.toMatch(/\bdata-derived-toggle\b/);
    expect(dashSrc).not.toMatch(/\bderivedExpanded\b/);
    expect(dashSrc).not.toMatch(/\btoggleDerivedCards\b/);
    // 顶部 7 张派生卡的 data 属性已不存在
    expect(dashSrc).not.toMatch(/data-stats70-drift\b/);
    expect(dashSrc).not.toMatch(/data-metro-walk\b/);
    expect(dashSrc).not.toMatch(/data-school-indicator\b/);
    expect(dashSrc).not.toMatch(/data-school-dimension\b/);
    expect(dashSrc).not.toMatch(/data-edu-overview\b/);
    expect(dashSrc).not.toMatch(/data-admin-district\b/);
    expect(dashSrc).not.toMatch(/data-district-trend\b/);
  });

  it("dashboard.vue 已删除中间段 7 张派生卡（v0.35 通勤步行 + v0.36 地铁规划受益 + v1.121.14 规划地铁 + v1.121.18 挂牌结构 + v0.38 区情画像 + v0.39 特征溢价 + v1.121.14 挂牌标签 + v0.40 标签组合 = 实际 7 张明确派生卡）", () => {
    // 中间段折叠块已不存在
    expect(dashSrc).not.toMatch(/data-derived-midblock\b/);
    // 8 张中间段明确派生卡的标识符已不存在
    expect(dashSrc).not.toMatch(/class="card-title">[^<]*地铁步行通勤 Top/);  // v0.35.0 通勤步行
    expect(dashSrc).not.toMatch(/class="card-title">[^<]*地铁规划受益 Top/);  // v0.36.0 地铁规划受益
    expect(dashSrc).not.toMatch(/class="card-title">[^<]*规划地铁线路概览/);  // v1.121.14 规划地铁
    expect(dashSrc).not.toMatch(/class="card-title">[^<]*挂牌结构占比/);  // v1.121.18 挂牌结构 (card-title 限定)
    expect(dashSrc).not.toMatch(/class="card-title">[^<]*区情画像/);      // v0.38.0 区情画像 (card-title 限定)
    expect(dashSrc).not.toMatch(/class="card-title">[^<]*特征画像溢价/);  // v0.39.0 特征画像溢价 (card-title 限定)
    expect(dashSrc).not.toMatch(/class="card-title">[^<]*挂牌标签热度/);  // v1.121.14 挂牌标签热度 (card-title 限定)
    expect(dashSrc).not.toMatch(/class="card-title">[^<]*标签组合热度/);  // v0.40.0 标签组合热度 (card-title 限定)
  });

  it("data-tools.vue 含 header + 行政区划卡 + 70 城提示卡", () => {
    expect(toolsSrc).toContain("data-data-tools-header");
    expect(toolsSrc).toContain("data-dt-admin-district");
    expect(toolsSrc).toContain("data-dt-stats70-drift");
    expect(toolsSrc).toContain("data-dt-notice");
  });

  it("data-tools.vue 引用 adminDistrictRanking 模块", () => {
    expect(toolsSrc).toContain("adminDistrictRanking");
    expect(toolsSrc).toContain("summarizeAdminDistrictByCity");
  });

  // v1.121.139 Batch 1：stats70-drift + metro-walk 两张派生卡已真正迁移到 data-tools.vue
  it("data-tools.vue Batch 1：70 城 12 月同比趋势派生卡已迁移（HTML + computed）", () => {
    expect(toolsSrc).toContain("data-dt-stats70-drift");
    expect(toolsSrc).toContain("全国 70 城 · 近 12 月同比趋势");  // card-title
    expect(toolsSrc).toContain("driftDistribution");              // computed
    expect(toolsSrc).toContain("driftTop");
    expect(toolsSrc).toContain("driftLatestLabel");
    expect(toolsSrc).toContain("fmtPct");
    expect(toolsSrc).toContain("goStats70");
    expect(toolsSrc).toMatch(/from\s+["']\.\.\/\.\.\/local\/stats70["']/);
  });

  it("data-tools.vue Batch 1：地铁步行可达性概览派生卡已迁移（HTML + computed）", () => {
    expect(toolsSrc).toContain("data-dt-metro-walk");
    expect(toolsSrc).toContain("🚶 地铁步行可达性");
    expect(toolsSrc).toContain("metroWalkSummary");
    expect(toolsSrc).toContain("metroWalkTop");
    expect(toolsSrc).toContain("metroWalkCityTop");
    expect(toolsSrc).toMatch(/from\s+["']\.\.\/\.\.\/local\/metro["']/);
  });

  // v1.121.140 Batch 2: district_trend + edu_overview 两张派生卡
  it("data-tools.vue Batch 2：分区近 12 周均价变动排行派生卡已迁移（HTML + computed）", () => {
    expect(toolsSrc).toContain("data-dt-district-trend");
    expect(toolsSrc).toContain("分区近 12 周均价变动");
    expect(toolsSrc).toContain("district12wChange");
    expect(toolsSrc).toContain("districtChangeDistribution");
    expect(toolsSrc).toContain("districtMomentumRank");
    expect(toolsSrc).toContain("districtDriftTotalWeeks");
    expect(toolsSrc).toContain("formatUnitPrice");
    expect(toolsSrc).toMatch(/from\s+["']\.\.\/\.\.\/local\/districtDrift["']/);
  });

  it("data-tools.vue Batch 2：教育事业概览派生卡已迁移（HTML + computed）", () => {
    expect(toolsSrc).toContain("data-dt-edu-overview");
    expect(toolsSrc).toContain("教育事业");
    expect(toolsSrc).toContain("eduOverview");
    expect(toolsSrc).toContain("eduHasPrimaryJuniorSplit");
    expect(toolsSrc).toContain("formatEducationPeriodLabel");
    expect(toolsSrc).toContain("goSchool");
    expect(toolsSrc).toMatch(/from\s+["']\.\.\/\.\.\/local\/educationOverview["']/);
  });

  // v1.121.141 Batch 3：commute_walk + plan_benefit 两张派生卡
  it("data-tools.vue Batch 3：地铁步行通勤 Top 派生卡已迁移（HTML + computed）", () => {
    expect(toolsSrc).toContain("data-dt-commute-walk");
    expect(toolsSrc).toContain("地铁步行通勤 Top");
    expect(toolsSrc).toContain("metroWalk");
    expect(toolsSrc).toContain("metroWalkCityTopByCity");
    expect(toolsSrc).toContain("mwBandClass");
    expect(toolsSrc).toContain("goCommunity");
    expect(toolsSrc).toMatch(/from\s+["']\.\.\/\.\.\/local\/queries["']/);
  });

  it("data-tools.vue Batch 3：地铁规划受益 Top 派生卡已迁移（HTML + computed）", () => {
    expect(toolsSrc).toContain("data-dt-plan-benefit");
    expect(toolsSrc).toContain("地铁规划受益 Top");
    expect(toolsSrc).toContain("metroBenefit");
    expect(toolsSrc).toContain("mbBandClass");
  });

  // v1.121.142 Batch 4：listing_structure + listing_tags + school_indicator + school_dimension 4 张派生卡
  it("data-tools.vue Batch 4：挂牌结构占比派生卡已迁移（HTML + computed）", () => {
    expect(toolsSrc).toContain("data-dt-listing-structure");
    expect(toolsSrc).toContain("挂牌结构");
    expect(toolsSrc).toContain("layoutBedroomShare");
    expect(toolsSrc).toContain("layoutOrientShare");
    expect(toolsSrc).toContain("layoutThreeBedCrossCity");
    expect(toolsSrc).toContain("layoutDecorateCrossCity");
    expect(toolsSrc).toContain("bedroomAreaCrossCityPrice");
    expect(toolsSrc).toContain("layoutTwoBedShareCross");
    expect(toolsSrc).toContain("layoutMedianPriceTop");
    expect(toolsSrc).toContain("layoutBucket");
    expect(toolsSrc).toMatch(/from\s+["']\.\.\/\.\.\/local\/distributionRanking["']/);
  });

  it("data-tools.vue Batch 4：挂牌标签热度派生卡已迁移（HTML + computed）", () => {
    expect(toolsSrc).toContain("data-dt-listing-tags");
    expect(toolsSrc).toContain("挂牌标签");
    expect(toolsSrc).toContain("listingTagCitySummary");
    expect(toolsSrc).toContain("listingTagSignature");
    expect(toolsSrc).toContain("listingTagPenetrationTop");
    expect(toolsSrc).toContain("listingKeywordsCity");
    expect(toolsSrc).toContain("listingKeywordTongtouCross");
    expect(toolsSrc).toMatch(/from\s+["']\.\.\/\.\.\/local\/listingTagsComparison["']/);
  });

  it("data-tools.vue Batch 4：学校指标各维度 Top 5 派生卡已迁移（HTML + computed）", () => {
    expect(toolsSrc).toContain("data-dt-school-indicator");
    expect(toolsSrc).toContain("学校指标");
    expect(toolsSrc).toContain("schoolIndicatorSummary");
    expect(toolsSrc).toContain("schoolTopLevel");
    expect(toolsSrc).toContain("schoolTopGroup");
    expect(toolsSrc).toContain("schoolTopBalance");
    expect(toolsSrc).toContain("schoolTrendRising");
    expect(toolsSrc).toContain("schoolTrendDeclining");
    expect(toolsSrc).toMatch(/from\s+["']\.\.\/\.\.\/local\/schoolIndicatorRanking["']/);
  });

  it("data-tools.vue Batch 4：重点学校维度派生卡已迁移（HTML + computed）", () => {
    expect(toolsSrc).toContain("data-dt-school-dimension");
    expect(toolsSrc).toContain("重点学校维度");
    expect(toolsSrc).toContain("dimCitySummaryLocal");
    expect(toolsSrc).toContain("dimCityReady");
    expect(toolsSrc).toContain("dimTopLevelCity");
    expect(toolsSrc).toContain("dimTopGroupCity");
    expect(toolsSrc).toContain("dimTopBalanceCity");
    expect(toolsSrc).toContain("dimPolymathCity");
    expect(toolsSrc).toMatch(/from\s+["']\.\.\/\.\.\/local\/schoolDimensionRanking["']/);
  });

  it("data-tools.vue Batch 5：4 张派生卡已迁 (feature_premium / tag_combination / district_meta / metro_plan)", () => {
    expect(toolsSrc).toContain("data-dt-feature-premium");
    expect(toolsSrc).toContain("data-dt-tag-combination");
    expect(toolsSrc).toContain("data-dt-district-meta");
    expect(toolsSrc).toContain("data-dt-metro-plan");
    expect(toolsSrc).toContain("getFeaturePremiumRanking");
    expect(toolsSrc).toContain("getTagCombinationRanking");
    expect(toolsSrc).toContain("getDistrictMetaRanking");
    expect(toolsSrc).toContain("summarizeMetroPlanningByCity");
    expect(toolsSrc).toContain("reloadFeaturePremium");
    expect(toolsSrc).toContain("reloadTagCombination");
    expect(toolsSrc).toContain("reloadDistrictMeta");
    // placeholder 已移除
    expect(toolsSrc).not.toContain("Batch 4：特征画像溢价");
    expect(toolsSrc).not.toContain("Batch 4：标签组合热度");
    expect(toolsSrc).not.toContain("Batch 4: 区情画像");
  });
});
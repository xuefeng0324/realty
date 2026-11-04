import { existsSync, readFileSync } from "node:fs";
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

  it("data-tools.vue 首页卡片管理 + 设置入口（首屏不再堆按钮）", () => {
    expect(toolsSrc).toContain("data-dt-card-manager");
    expect(toolsSrc).toContain("首页卡片管理");
    expect(toolsSrc).toContain("DASHBOARD_CARDS");
    expect(toolsSrc).toContain("HIDDEN_CARDS_KEY");
    expect(toolsSrc).toContain("toggleDashboardCard");
    expect(toolsSrc).toContain("resetDashboardCards");
    expect(toolsSrc).toContain("loadHiddenCards");
    expect(toolsSrc).toContain("saveHiddenCards");
    const cardKeyMatches = toolsSrc.match(/key:\s+"[a-z][a-z0-9-]+"/g) || [];
    expect(cardKeyMatches.length).toBeGreaterThanOrEqual(8);
    expect(toolsSrc).toContain(".dt-card-row");
    expect(toolsSrc).toContain(".dt-card-toggle");
    // 总览首屏不再放个人化按钮；设置页承接
    expect(dashSrc).not.toContain("data-dash-personalize");
    expect(dashSrc).toContain("isCardHidden");
    const settingsSrc = readFileSync(
      resolve(__dirname, "../src/pages/settings/settings.vue"),
      "utf8"
    );
    expect(settingsSrc).toContain("data-settings-home-ia");
    expect(settingsSrc).toContain("data-settings-go-data-tools");
    const vIfMatches = dashSrc.match(/v-if="!isCardHidden\('[a-z][a-z0-9-]+'\)/g) || [];
    // v1.123.20：listing-tag-cloud / district-index / district-4w-change 死 DOM 删除，13 → 10
    expect(vIfMatches.length).toBeGreaterThanOrEqual(10);
    const cardKeyAttrMatches = dashSrc.match(/data-card-key="[a-z][a-z0-9-]+"/g) || [];
    expect(cardKeyAttrMatches.length).toBeGreaterThanOrEqual(10);
  });

  it("进阶卡 hot 配置保留；入口在设置/频道（不在总览占位）", () => {
    // v1.123.21：dashboard 内 ADVANCED_CARDS（含 hot 标记）为从未接入模板的死代码，已删除；
    // 进阶分析实际承接页是 trend-analysis（入口在设置/频道）
    const dashSrc4 = readFileSync(
      resolve(__dirname, "../src/pages/dashboard/dashboard.vue"),
      "utf8"
    );
    expect(dashSrc4).not.toContain("data-dash-advanced-section");
    const settingsSrc = readFileSync(
      resolve(__dirname, "../src/pages/settings/settings.vue"),
      "utf8"
    );
    expect(settingsSrc).toContain("data-settings-go-trend");
    expect(settingsSrc).toContain("goTrendAnalysis");
  });

  it("v1.121.151 Batch 12：trend-analysis 响应城市切换", () => {
    const taSrc2 = readFileSync(
      resolve(__dirname, "../src/pages/trend-analysis/trend-analysis.vue"),
      "utf8"
    );
    // 1. watch 监听 app.cityId
    expect(taSrc2).toMatch(/watch\(\s*\(\)\s*=>\s*app\.cityId/);
    expect(taSrc2).toMatch(/watch\([\s\S]{0,200}app\.cityId/);
    // 2. cityId.value 更新 + reload
    expect(taSrc2).toMatch(/cityId\.value = newId/);
    expect(taSrc2).toMatch(/reloadAll\(newId\)/);
  });

  it("首页指南已迁出首屏（避免占位 + 白闪）；util 仍可测", () => {
    const dashSrc3 = readFileSync(
      resolve(__dirname, "../src/pages/dashboard/dashboard.vue"),
      "utf8"
    );
    expect(dashSrc3).not.toContain("data-dash-guide");
    expect(dashSrc3).not.toContain("🏠 首页使用指南");
    const settingsSrc = readFileSync(
      resolve(__dirname, "../src/pages/settings/settings.vue"),
      "utf8"
    );
    expect(settingsSrc).toContain("data-settings-home-ia");
  });

  it("v1.121.149 Batch 10：4 张可视化卡已迁到 trend-analysis.vue", () => {
    const taSrc = readFileSync(
      resolve(__dirname, "../src/pages/trend-analysis/trend-analysis.vue"),
      "utf8"
    );
    const composableSrc = readFileSync(
      resolve(__dirname, "../src/composables/useTrendVisualization.ts"),
      "utf8"
    );
    const dashSrc2 = readFileSync(
      resolve(__dirname, "../src/pages/dashboard/dashboard.vue"),
      "utf8"
    );
    // 1. trend-analysis.vue 存在 4 张卡
    expect(taSrc).toMatch(/户型 × 面积 分布/);
    expect(taSrc).toMatch(/朝向 × 楼层 溢价/);
    expect(taSrc).toMatch(/装修 × 楼龄 溢价/);
    expect(taSrc).toMatch(/总价 × 单价 散点/);
    // 2. composable 存在
    expect(composableSrc).toMatch(/useTrendVisualization/);
    expect(composableSrc).toMatch(/reloadBedroomArea/);
    expect(composableSrc).toMatch(/reloadOrientationFloor/);
    expect(composableSrc).toMatch(/reloadDecorateAge/);
    expect(composableSrc).toMatch(/reloadScatter/);
    // 3. dashboard.vue 不再包含这 4 张卡 HTML
    expect(dashSrc2).not.toMatch(/v0\.42\.0 trend-22 户型 × 面积 联合热图/);
    expect(dashSrc2).not.toMatch(/v0\.43\.0 trend-23 朝向 × 楼层 溢价矩阵/);
    expect(dashSrc2).not.toMatch(/v0\.44\.0 trend-24 装修 × 楼龄 溢价矩阵/);
    expect(dashSrc2).not.toMatch(/v0\.45\.0 trend-25 社区 总价 × 单价 双轴散点/);
    // 4. pages.json 注册
    const pagesJsonObj = JSON.parse(
      readFileSync(resolve(__dirname, "../src/pages.json"), "utf8")
    );
    const trendPath = pagesJsonObj.pages.some(
      (p: any) => p.path === "pages/trend-analysis/trend-analysis"
    );
    expect(trendPath).toBe(true);
  });

  it("精简模式在设置页；总览禁折叠/禁堆进阶区", () => {
    expect(dashSrc).toContain("featuredMode");
    expect(dashSrc).toContain("FEATURED_MODE_KEY");
    expect(dashSrc).toContain("loadUiState");
    expect(dashSrc).toContain("goDataTools");
    expect(dashSrc).toContain("goTrendAnalysis");
    expect(dashSrc).not.toContain("data-dash-mode-toggle");
    expect(dashSrc).not.toContain("data-dash-advanced-section");
    expect(dashSrc).not.toContain("data-dash-advanced-expand");
    expect(dashSrc).not.toContain("overview-toggle-all");
    expect(dashSrc).toMatch(/isOverviewGroupCollapsed[\s\S]*?return false/);
    // v1.123.6：旧专业 Tab 机制（activeTab/dash-tabs）已删除，工作台不再有 v-if 门禁，
    // 与遗留长卡一样由 v122 壳层 CSS 统一隐藏；
    // v1.123.7：遗留长卡/数据工具页的 data-tab 死属性与孤儿 filterWorkbenchExpanded 已剥离；
    // v1.123.8：工作台死 DOM 已删除（城市选择由壳层 data-home-city/pickCity 接管）
    expect(dashSrc).not.toMatch(/activeTab|data-dash-tab|id="dash-tabs"|\sdata-tab="/);
    expect(dashSrc).not.toContain("filterWorkbenchExpanded");
    expect(toolsSrc).not.toMatch(/\sdata-tab="/);
    expect(dashSrc).not.toMatch(/data-home-workbench|toggleCityScoped|pickMetric/);
    // v1.123.9：topnav 周期条 + 本周速览条 + 小区周榜卡死 DOM 已删除
    expect(dashSrc).not.toMatch(/topnav-period|stepPeriod|currentPeriodIdx|week-bound-strip|week-ranking-card|rankingTotal|getCommunityRanking/);
    // v1.123.10：旧 home-entry-card（与 v122 壳重复的城市/搜索/频道/金刚）死 DOM 已删除
    expect(dashSrc).not.toMatch(/home-entry-card|home-loc-search|home-city-chip|home-search-modes|home-mode-chip|home-channel-chip|home-king-tile|home-king-icon|home-king-label|home-entry-hint/);
    expect(dashSrc).not.toMatch(/onHomeChannel|onHomeKingkong|HOME_CHANNELS|HOME_KINGKONG|data-home-channels/);
    expect(dashSrc).not.toMatch(/\.home-search\b|\.home-search-input|\.home-search-btn/);
    // v1.123.11：homeEntry.ts 库级死定义已删除（v1.123.10 起无任何 UI/脚本消费者）
    const homeEntrySrc = readFileSync(
      resolve(__dirname, "../src/local/homeEntry.ts"),
      "utf8"
    );
    expect(homeEntrySrc).not.toMatch(/export (const|function|type|interface)\s+(HOME_CHANNELS|HOME_KINGKONG|homeKingkongCount|HomeChannel\b|HomeChannelKey|HomeChannelAction|HomeKingkongItem|HomeKingkongAction|HomeEntryTone)/);
    expect(homeEntrySrc).toContain("HOME_SEARCH_MODES");
    expect(homeEntrySrc).toContain("resolveHomeSearch");
    // v1.123.13：医疗资源榜死 DOM 已删除（库 hospitalRanking 与单测保留，hospitalGeoAnalysis 已于 v1.123.16 死库瘦身删除；
    // listing-detail/community「周边医院」卡不受影响；hospitalCityName 今日要点卡仍消费故保留，菜市场卡已于 v1.123.23 删除）
    expect(dashSrc).not.toMatch(/hospital-rank|hospitalCitySummary|hospitalGeoSummary|hospitalDisplayName/);
    expect(dashSrc).not.toMatch(/hospitalRanking|hospitalGeoAnalysis/);
    expect(dashSrc).not.toMatch(/hosp-geo|hosp-top|hosp-dist|hosp-kpi|hosp-summary|hosp-lv/);
    expect(toolsSrc).not.toContain('"hospital-rank"');
    // v1.123.14：学区溢价榜死 DOM 已删除（孤儿 e2e smoke_school_premium 一并删除；
    // 库 schoolPremiumRanking 保留，data-tools 学区评分卡不受影响；queries.getSchoolPremiumRank 已于 v1.123.16 死库瘦身删除）
    expect(dashSrc).not.toMatch(/school-premium-rank|schoolPremiumOverview|getSchoolPremiumRank|schoolPremiumDistrictTop/);
    expect(dashSrc).not.toMatch(/function (formatPremium|premiumClass|medalText|medalClass)\(/);
    expect(dashSrc).not.toMatch(/\.sp-row|\.sp-rank|\.sp-premium|\.sp-mid|\.sp-district|\.sp-pos|\.sp-neg/);
    expect(toolsSrc).not.toContain('"school-premium-rank"');
    // v1.123.15：listing 学区溢价榜死 DOM 已删除（孤儿 e2e smoke_listing_premium 一并删除；
    // 库 listingSchoolPremiumRanking/queries.getTopListingsBySchoolPremium 已于 v1.123.16 死库瘦身删除；
    // mapDistrictStats 仍消费 store.getListingSchoolPremiumByCity；spMedalClass 因区涨幅榜/商业热度榜仍消费而保留）
    expect(dashSrc).not.toMatch(/listing-school-premium|listingPremiumOverview|lpScoreClass/);
    expect(dashSrc).not.toMatch(/lspCitySummary|lspDistrictTop|lspCommunityTop|lspCommunityByVolume|\blspDist\b/);
    expect(dashSrc).not.toMatch(/lsp-(kpi|summary|dist|bucket|rank|dname|meta|pct)/);
    expect(dashSrc).not.toMatch(/listingSchoolPremiumRanking|getTopListingsBySchoolPremium|ListingSchoolPremiumOverview/);
    expect(dashSrc).not.toMatch(/CitySchoolPremiumSummary|PremiumBucket|DistrictPremiumSummary|CommunityPremiumAggregate/);
    expect(dashSrc).not.toMatch(/高学区评分房源/);
    expect(dashSrc).toMatch(/getListingSchoolPremiumByCity/);
    expect(toolsSrc).not.toContain('"listing-school-premium"');
    // v1.123.16：死库瘦身——listingSchoolPremiumRanking / hospitalGeoAnalysis 整库删除（无 UI 消费者），
    // queries.getTopListingsBySchoolPremium / queries.getSchoolPremiumRank 无消费者包装同步删除；
    // store 数据面与 schoolPremiumRanking.ts（data-tools 学区评分卡在消费）保留
    const queriesSrc = readFileSync(
      resolve(__dirname, "../src/local/queries.ts"),
      "utf8"
    );
    expect(queriesSrc).not.toMatch(/getTopListingsBySchoolPremium|ListingSchoolPremiumOverview|ListingSchoolPremiumItem/);
    expect(queriesSrc).not.toMatch(/export async function getSchoolPremiumRank|SchoolPremiumOverview|SchoolPremiumItem/);
    expect(
      existsSync(resolve(__dirname, "../src/local/listingSchoolPremiumRanking.ts"))
    ).toBe(false);
    expect(
      existsSync(resolve(__dirname, "../src/local/hospitalGeoAnalysis.ts"))
    ).toBe(false);
    // v1.123.17：hospitalRanking 整库删除（8 派生函数 + 9 孤儿单测，无 UI 消费者；
    // listing-detail/community「周边医院」卡走 http getCommunityHospitals，不经此库；
    // store 数据面 snapshot.hospitals 不受影响）
    expect(
      existsSync(resolve(__dirname, "../src/local/hospitalRanking.ts"))
    ).toBe(false);
    expect(queriesSrc).not.toMatch(/hospitalRanking|levelRank|CityHospitalSummary|CityDistrictHospitalSummary|CrossCityHospitalEntry/);
    // v1.123.18：商业热度榜死 DOM + communityCommercialRanking 死库整删（v1.122 起被壳层
    // CSS 永久隐藏；卡 135 行 + 5 computed + commercialScoreClass + ref/loadAll + ADVANCED_CARDS
    // 条目 + .dens-* CSS；库 5 函数只被死 computed 消费；queries.getCommercialRanking 无消费者
    // 包装同步删；孤儿 e2e smoke_commercial.mjs 与 6 用例孤儿单测一并删；buildIntegrity 两条
    // v0.19.0 死断言移除；adversarialRankingProbe 摘 density 探针；poiCommercialRanking 保留）
    expect(dashSrc).not.toMatch(/commercial-heat|商业热度|commercialResp|commercialDistrictTop|commercialScoreClass/);
    expect(dashSrc).not.toMatch(/commercialDensityCity|commercialNearestRestaurant|commercialScoreTop|commercialCitySummary/);
    expect(dashSrc).not.toMatch(/communityCommercialRanking|dens-grid/);
    expect(
      existsSync(resolve(__dirname, "../src/local/communityCommercialRanking.ts"))
    ).toBe(false);
    expect(
      existsSync(resolve(__dirname, "../tests/e2e/smoke_commercial.mjs"))
    ).toBe(false);
    expect(queriesSrc).not.toMatch(/getCommercialRanking|CommercialRankingItem|CommercialRankingResponse/);
    // v1.123.19：通勤时长榜 + 小区综合评分榜死 DOM 整删（v1.122 起被壳层 CSS 永久隐藏；
    // commuteRanking ref/getCommuteRanking 当时因 heroSlides 轮播保留（v1.123.24 已随 hero 一并删）；
    // communityScoreRanking 死库 5 函数 + queries.getCommunityScoreRank 无消费者包装同步删；
    // 孤儿 e2e smoke_commute / smoke_community_score / smoke_community_score_weight 与
    // 7 用例孤儿单测 communityScoreRanking.test.ts 一并删；buildIntegrity v0.34.0 describe 移除；
    // commute.csv/community_score.csv 数据面与 commuteRanking 库（adversarialRankingProbe 在测）保留）
    expect(dashSrc).not.toMatch(/commute-rank|community-score-rank|overview-transit|overview-community/);
    expect(dashSrc).not.toMatch(/commuteSplit|commuteSpeedTop|commuteFastestTop|commuteCitySummaries|commuteMinutesClass/);
    expect(dashSrc).not.toMatch(/overviewTransitSummary|overviewCommunitySummary|\bcommunityScore\b/);
    expect(dashSrc).not.toMatch(/csWeights|csPresets|csPresetActive|applyCsPreset|onCsWeightChange|csWeightSum|reloadCommunityScore/);
    expect(dashSrc).not.toMatch(/csTotalClass|csMedalClass|csMedalText/);
    expect(dashSrc).not.toMatch(/getCommunityScoreRank|CommunityScoreResponse|communityScoreRanking/);
    expect(dashSrc).not.toMatch(/getCommuteByCityFastestSlowestCompare|getCommuteSpeedLeaderboard|getCommuteFastestTopN|summarizeCommuteByCity/);
    expect(dashSrc).not.toMatch(/commute-badge|cs-medal|cs-total|cs-slider|cs-preset|cs-row/);
    expect(toolsSrc).not.toContain('"commute-rank"');
    expect(toolsSrc).not.toContain('"community-score-rank"');
    expect(toolsSrc).not.toContain('"community-score-weights"');
    expect(queriesSrc).not.toMatch(/getCommunityScoreRank|CommunityScoreItem|CommunityScoreResponse/);
    expect(
      existsSync(resolve(__dirname, "../src/local/communityScoreRanking.ts"))
    ).toBe(false);
    expect(
      existsSync(resolve(__dirname, "../tests/communityScoreRanking.test.ts"))
    ).toBe(false);
    expect(
      existsSync(resolve(__dirname, "../tests/e2e/smoke_commute.mjs"))
    ).toBe(false);
    expect(
      existsSync(resolve(__dirname, "../tests/e2e/smoke_community_score.mjs"))
    ).toBe(false);
    expect(
      existsSync(resolve(__dirname, "../tests/e2e/smoke_community_score_weight.mjs"))
    ).toBe(false);
    const settingsSrc = readFileSync(
      resolve(__dirname, "../src/pages/settings/settings.vue"),
      "utf8"
    );
    expect(settingsSrc).toContain("data-settings-featured-toggle");
    expect(settingsSrc).toContain("toggleFeaturedMode");
    // v1.123.21：进阶分析区块死代码删除——ADVANCED_CARDS/advancedCardCount/toggleFeaturedMode(仪表盘本地)/
    // expandAdvancedCards/advancedExpanded/ADVANCED_EXPANDED_KEY 从未接入模板（真实精简/完整开关在
    // settings.vue），dashboard.vue 不再保留；featuredMode/loadUiState/FEATURED_MODE_KEY 保留（壳层精简模式仍生效）
    expect(dashSrc).not.toMatch(/ADVANCED_CARDS|advancedCardCount|expandAdvancedCards|advancedExpanded|ADVANCED_EXPANDED_KEY/);
    expect(dashSrc).not.toMatch(/function toggleFeaturedMode/);
    // v1.123.21：首页卡片管理列表修复——macro-lpr 条目 key 与卡面 data-card-key="macro-lpr-card"
    // 失配导致开关失效（bug），已修正；同时删除 7 个无对应卡面的死条目（district-wangqian-rank /
    // poi-commercial / school-top-filter-sort / bedroom-area-heatmap / orientation-floor-matrix /
    // decorate-age-matrix / community-scatter），DASHBOARD_CARDS 18→11 与卡面 data-card-key 一一对应
    expect(toolsSrc).not.toContain('"district-wangqian-rank"');
    expect(toolsSrc).not.toContain('"poi-commercial"');
    expect(toolsSrc).not.toContain('"school-top-filter-sort"');
    expect(toolsSrc).not.toContain('"bedroom-area-heatmap"');
    expect(toolsSrc).not.toContain('"orientation-floor-matrix"');
    expect(toolsSrc).not.toContain('"decorate-age-matrix"');
    expect(toolsSrc).not.toContain('"community-scatter"');
    expect(toolsSrc).not.toContain('"macro-lpr"');
    expect(toolsSrc).toContain('"macro-lpr-card"');
    const dashCardKeys = Array.from(dashSrc.matchAll(/data-card-key="([^"]+)"/g))
      .map((m) => m[1])
      .sort();
    const cardsBlockMatch = toolsSrc.match(/const DASHBOARD_CARDS[^{]*\[([\s\S]*?)\];/);
    const managedKeys = Array.from(cardsBlockMatch![1].matchAll(/key: "([^"]+)"/g))
      .map((m) => m[1])
      .sort();
    expect(managedKeys).toEqual(dashCardKeys);
    expect(managedKeys.length).toBe(11);
    // v1.123.20：户型分布 + 房源标签云 + 区房价指数 + 区涨幅榜 4 张死 DOM 卡整删
    // （v1.122 起被壳层 CSS 永久隐藏；layout-distribution 卡从未接入 isCardHidden 隐藏协议，
    // 卡片管理里对应条目为无效 bug 条目，随卡一并删除）；
    // queries.getLayoutDistribution/getListingTagCloud/getDistrictIndex/getDistrictChangeRank
    // 无消费者包装与 8 个导出类型同步删；孤儿 e2e smoke_layout/smoke_tagcloud/
    // smoke_district_index/smoke_district_change 一并删；buildIntegrity v0.30.0 describe 移除；
    // store 数据面 getLayoutDistributionsByCity/getListingTagsByCity/getDistrictIndicesByCity
    // 与 layout_distribution.csv/listing_tags.csv/district_index.csv 保留（adversarialRankingProbe 在测）
    expect(dashSrc).not.toMatch(/layoutDistribution|layoutDims|formatShare|ld-row|ld-bucket|ld-bar|ld-pct|ld-dim-title/);
    expect(dashSrc).not.toMatch(/tagCloud|tagSizeClass|onPickTag|tag-cloud|tag-chip|tag-size-/);
    expect(dashSrc).not.toMatch(/districtIndex|diIndexClass|diChangeClass|sparkPoints|toggleDistrictIndexExpand|di-row|di-spark/);
    expect(dashSrc).not.toMatch(/districtChange|spMedalClass|sp-medal-mini|dc-row|dc-4w|medal-gold|medal-silver|medal-bronze|medal-flat-mini/);
    expect(dashSrc).not.toMatch(/distributionCitySummaries|summarizeDistributionByCity|CityDistributionSummary/);
    expect(dashSrc).not.toMatch(/getLayoutDistribution|getListingTagCloud|getDistrictIndex|getDistrictChangeRank/);
    expect(dashSrc).not.toMatch(/LayoutDistributionResponse|TagCloudResponse|DistrictIndexResponse|DistrictChangeResponse/);
    expect(toolsSrc).not.toContain('"layout-distribution"');
    expect(toolsSrc).not.toContain('"listing-tag-cloud"');
    expect(toolsSrc).not.toContain('"district-index"');
    expect(toolsSrc).not.toContain('"district-4w-change"');
    expect(queriesSrc).not.toMatch(/getLayoutDistribution|LayoutDistributionResponse|LayoutBucket|LAYOUT_DIMENSION_ORDER/);
    expect(queriesSrc).not.toMatch(/getListingTagCloud|TagCloudResponse|TagCloudItem/);
    expect(queriesSrc).not.toMatch(/getDistrictIndex\(|DistrictIndexResponse|DistrictIndexItem/);
    expect(queriesSrc).not.toMatch(/getDistrictChangeRank|DistrictChangeResponse|DistrictChangeItem/);
    expect(existsSync(resolve(__dirname, "../tests/e2e/smoke_layout.mjs"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../tests/e2e/smoke_tagcloud.mjs"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../tests/e2e/smoke_district_index.mjs"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../tests/e2e/smoke_district_change.mjs"))).toBe(false);
    // v1.123.22：周边商业 POI 死 DOM 卡整删（v1.122 起被壳层 CSS 永久隐藏；模板 195 行 +
    // 15 个 commercial* computed 与 categoryLabel + poiCommercialRanking 导入块 +
    // .pc-summary/.pc-kpi/.pc-kpi-val/.pc-kpi-label/.pc-score 独有 CSS 一并删；
    // 库 poiCommercialRanking 保留——adversarialRankingProbe/cityOfMismatchHunt/
    // poiCommercialRanking.test 在测；store 数据面 poi_commercial.csv 保留；
    // hospitalCityName 不受影响；菜市场可达卡/pc-row/pc-dist 已于 v1.123.23 删除）
    expect(dashSrc).not.toMatch(/周边商业|commercialReady|commercialCityPois|commercialCatCount|commercialAvgDist/);
    expect(dashSrc).not.toMatch(/commercialWalkTop|commercialBankNear|commercialRestaurantNear|commercialConvenienceNear|commercialSevenElevenNear/);
    expect(dashSrc).not.toMatch(/commercialBankCoverage|poiCommercialCitySummaries|commercialNearestAcross|commercialCategoryTopSample|commercialCategoryStats|categoryLabel/);
    expect(dashSrc).not.toMatch(/poiCommercialRanking|pc-summary|pc-kpi|pc-score/);
    // v1.123.23：菜市场可达死 DOM 卡整删（v1.122 起被壳层 CSS 永久隐藏；模板 82 行 +
    // 6 个 market* computed + poiMarketRanking 导入块 + .pc-row/.pc-rank/.pc-dist/
    // .pc-mid/.pc-name/.pc-meta 全家 CSS 一并删；库 poiMarketRanking 保留——
    // poiMarketRanking.test 在测；store 数据面 poi_market.csv 保留（life_convenience 在消费）；
    // communityIdsInCity 因 lifeMarketNearTop 仍消费而保留；hospitalCityName 因今日要点卡保留）
    expect(dashSrc).not.toMatch(/菜市场可达|marketNearTop|marketFarTop|marketDeriveNear|marketNearestDetail|marketCategoryStats|marketSummariesInCity/);
    expect(dashSrc).not.toMatch(/summarizePoiMarketByCommunity|getPoiMarketByCategoryRanking|getPoiMarketNearestByCommunity|getPoiMarketDistanceLeaderboard/);
    expect(dashSrc).not.toMatch(/poiMarketRanking|CommunityPoiMarketSummary|MarketCategoryStat|NearestMarketEntry/);
    expect(dashSrc).not.toMatch(/\.pc-row|\.pc-rank|\.pc-dist|\.pc-mid|\.pc-name|\.pc-meta/);
    expect(dashSrc).toMatch(/communityIdsInCity/); // lifeMarketNearTop 仍消费
    // （hospitalCityName 正向断言已于 v1.123.25 随今日要点卡一并删除而翻转）
    expect(existsSync(resolve(__dirname, "../src/local/poiMarketRanking.ts"))).toBe(true);
    // v1.123.24：hero 死 DOM 轮播整删（v0.55.0 接入、v1.122 起被壳层 CSS 永久隐藏；
    // 模板 38 行 swiper 轮播 + HeroSlide 类型 + heroIdx/heroSlides computed + onHeroChange；
    // 连带 commuteRanking ref 与 loadAll getCommuteRanking 调用、medianTotalPrice computed
    // 失去唯一消费者一并删；buildIntegrity「v0.55.0 hero-1」3 条 hero 断言移除（金刚区断言保留）；
    // queries.getCommuteRanking/CommuteRankingResponse 保留——buildIntegrity 在测；
    // commuteRanking.ts 库保留——commuteRanking.test/adversarialRankingProbe 在测；
    // medianUnitPrice/listingMedianUnitPriceLabel 保留——壳层指标与今日要点卡仍消费）
    expect(dashSrc).not.toMatch(/hero-section|hero-carousel|hero-scroll|hero-slide|hero-dots|hero-dot/);
    expect(dashSrc).not.toMatch(/heroSlides|heroIdx|onHeroChange|HeroSlide/);
    expect(dashSrc).not.toMatch(/commuteRanking|getCommuteRanking|CommuteRankingResponse/);
    expect(dashSrc).not.toMatch(/\bmedianTotalPrice\b/);
    expect(dashSrc).toMatch(/medianUnitPrice/); // 壳层指标仍消费
    expect(queriesSrc).toMatch(/getCommuteRanking/); // 库包装保留（buildIntegrity 在测）
    expect(existsSync(resolve(__dirname, "../src/local/commuteRanking.ts"))).toBe(true);
    // v1.123.25：「今日要点」壳下隐藏死 DOM 卡整删（v1.122 起被壳层 CSS 永久隐藏；
    // 模板 13 行 + todayHighlights computed + hospitalCityName（dashboard 内唯一消费者即本卡标题）
    // + listingMedianUnitPriceLabel import（失去唯一消费者）+ .today-grid/.today-cell/.today-label/
    // .today-value/.today-sub CSS 与 @media 内 .today-grid 一并删；
    // medianUnitPrice 保留——壳层 homeMedianUnitPriceLabel 仍消费；formatIndex/deltaLabel/trendClass
    // 保留——stats70 卡与壳层仍消费；priceSemantics.ts 库 v1.123.30 已退役，见下方门禁）
    expect(dashSrc).not.toMatch(/today-highlights-card|today-grid|today-cell|today-label|today-value|today-sub/);
    expect(dashSrc).not.toMatch(/\btodayHighlights\b/);
    expect(dashSrc).not.toMatch(/hospitalCityName/);
    expect(dashSrc).not.toMatch(/listingMedianUnitPriceLabel/);
    // v1.123.26：runtime 卡 + 数据覆盖卡 + 天气快照卡三张壳下隐藏死 DOM 整删
    // （v1.122 起被壳层 CSS 永久隐藏；runtime 卡 5 行 + loadRuntime 函数与 Promise.all 调用 +
    // RuntimeMetaResponse import；数据覆盖卡 11 行——coverage ref/loadCoverage/getCoverage 保留，
    // region-compare 卡「仅显示有挂牌房源的区」提示仍消费；天气卡 57 行 + weatherResp ref +
    // loadAll getWeather 段 + weatherEmoji/aqiChipClass/weatherFreshLabel + .weather-*/.forecast-*/
    // .aqi-* CSS 119 行；buildIntegrity「dashboard.vue 加天气卡」断言移除；
    // queries.getRuntimeMeta/getCoverage/getWeather 与 store.getWeatherByCity 保留——
    // apiWrappers/buildIntegrity 在测；daysAgoFromToday 保留——wangqianDaysAgo 仍消费）
    expect(dashSrc).not.toMatch(/\bruntime\b|RuntimeMetaResponse|getRuntimeMeta|loadRuntime/);
    expect(dashSrc).not.toMatch(/数据覆盖/);
    expect(dashSrc).not.toMatch(/weatherResp|weatherEmoji|weatherFreshLabel|aqiChipClass|天气快照/);
    expect(dashSrc).not.toMatch(/weather-live|weather-forecast|forecast-grid|forecast-day|aqi-chip/);
    expect(dashSrc).not.toMatch(/\bgetWeather\b|\bWeatherResponse\b/);
    expect(dashSrc).toMatch(/coverage/); // region-compare 卡仍消费
    expect(queriesSrc).toMatch(/getRuntimeMeta|getCoverage|getWeather/); // 包装保留（测试在测）
    // v1.123.27：第三批死 DOM 清理 + 遗留锚点系统退役——9 张城市数据卡（珠海不动产登记季报/
    // 珠海价格备案/深圳计划入市/广州住房发展计划/广州保障房/广州土地/深圳土地/深圳保障房/
    // 珠海安居进度）模板 583 行 + 10 个库 import 块 + computed 区块 115 行整删；
    // 卡均处于「挂载 id 全隐藏 + 无 scroll 路由」的死路径（resolveHomeSearch 无 scroll 产出），
    // jumpHomeAnchor/resolveHomeScrollAnchor/homeScrollAvailability/supplyEntryOwner/landEntryOwner
    // 锚点链与 homeEntry.ts 的 scroll variant/HomeScrollAvailability/HomeScrollResolve 同步退役；
    // formatLandPrice/formatLandArea 失去唯一消费者一并删。
    // 保留件：gzInventory 库存卡（formatInvDelta/invDeltaClass 仍消费）、网签卡 currentWangqian 链、
    // 数据工具入口卡；库文件与库级单测全部保留（supply.vue/wangqian.vue 在消费）。
    expect(dashSrc).not.toMatch(/data-zh-bdc-registration|data-zh-price-filing|data-sz-planned-supply/);
    expect(dashSrc).not.toMatch(/data-gz-housing-plan|data-gz-affordable-projects|data-gz-land-deals/);
    expect(dashSrc).not.toMatch(/data-sz-land-deals|data-sz-affordable-projects|data-zh-affordable-progress/);
    expect(dashSrc).not.toMatch(/\bjumpHomeAnchor\b|\bresolveHomeScrollAnchor\b|\bhomeScrollAvailability\b/);
    expect(dashSrc).not.toMatch(/\bhomeSupplyEntryOwner\b|\bhomeLandEntryOwner\b|\bentry-zh-bdc-registration\b/);
    expect(homeEntrySrc).not.toMatch(/export (function|type|const|interface)\s+(resolveHomeScrollAnchor|HomeScrollAvailability|HomeScrollResolve|homeSupplyEntryOwner|homeLandEntryOwner)/);
    expect(homeEntrySrc).not.toMatch(/\{ kind: "scroll"; anchor: string \}/);
    expect(dashSrc).toMatch(/data-gz-inventory-detail/); // 库存卡保留
    expect(dashSrc).toMatch(/data-data-tools-entry/); // 数据工具入口保留
    expect(dashSrc).toMatch(/goWangqian|onWangqianCardClick/); // 网签卡链保留
    // v1.123.30：src/local/priceSemantics.ts 死库退役——8 个导出（priceAxisLabel 三轴标签 /
    // 4 个短标签 / auditListingPriceCopy / priceAxesDisclaimer）在 src/ 零 import，
    // 仅被 localCsvPriceRepo/priceSemantics 单测消费；库文件删除，三轴文案门禁保留在
    // tests/priceSemantics.test.ts（地图模式名 / 壳层「数据口径透明」行 / 验收文档对照）。
    expect(existsSync(resolve(__dirname, "../src/local/priceSemantics.ts"))).toBe(false);
    expect(queriesSrc).not.toMatch(/priceSemantics/);
    expect(dashSrc).not.toMatch(/priceSemantics|priceAxesDisclaimer|auditListingPriceCopy/);
  });

  it("dashboard.vue v1.121.147 Batch 8：每张核心卡右上角 ✕ 隐藏按钮", () => {
    // 1. CSS 类
    expect(dashSrc).toContain(".card-hide-btn");
    // 2. 至少 10 张卡有 data-dash-card-hide 属性（v1.123.20 删 3 张死 DOM 卡后 13 → 10）
    const hideMatches = dashSrc.match(/data-dash-card-hide="[a-z][a-z0-9-]+"/g) || [];
    expect(hideMatches.length).toBeGreaterThanOrEqual(10);
    // 3. 点击处理
    expect(dashSrc).toContain("toggleCardHidden");
  });

  // v1.123.28：scoped 样式段死类清理——36 个类在模板全文零引用（均为 v1.121.x 迁走卡的遗留
  // 样式：home-personalize / home-guide 新手引导 / advanced-* 高级设置 / overview-toolbar +
  // overview-mode-toggle / form-row + form-label + picker-value + picker-caret / community-row +
  // community-rank + community-main / wangqian-down / sp-up + community-sp-price / wq-area /
  // tc-bar / scatter-row + scatter-pt），共 273 行；同时剥除 overview-wangqian 静态 id
  // （锚点系统 v1.123.27 已退役后的残留）并归一 14 行 lone LF。
  // 保留类：card-hide-btn / tap-row / community-name / wq-fresh / overview-card-summary 等仍在模板消费。
  it("dashboard.vue v1.123.28：scoped 样式无死类，模板消费类保留", () => {
    const deadCss = [
      "home-personalize-row", "home-personalize-btn", "home-guide-card", "home-guide-title",
      "home-guide-close", "home-guide-list", "home-guide-row", "home-guide-step",
      "home-guide-content", "home-guide-name", "advanced-section", "advanced-list",
      "advanced-row", "advanced-info", "advanced-name", "advanced-hot-tag", "advanced-toggle",
      "advanced-actions", "advanced-expand-btn", "overview-toolbar", "overview-mode-toggle",
      "form-row", "form-label", "picker-value", "picker-caret", "community-row",
      "community-rank", "community-main", "community-name", "wangqian-down", "sp-up",
      "community-sp-price", "wq-area", "tc-bar", "scatter-row", "scatter-pt"
    ];
    for (const cls of deadCss) {
      expect(dashSrc, `死类残留: ${cls}`).not.toMatch(new RegExp(`\\.${cls}\\b`));
    }
    expect(dashSrc).not.toMatch(/id="overview-wangqian"/);
    // 模板仍在消费的类不许被误删
    for (const cls of [".card-hide-btn", ".tap-row", ".wq-fresh", ".overview-card-summary"]) {
      expect(dashSrc).toContain(cls);
    }
    // lone LF 归一：全文件均为 CRLF（末尾行由 split 产生空串，故 lone LF 计数应为 0）
    const loneLf = (dashSrc.match(/(?<!\r)\n/g) || []).length;
    expect(loneLf).toBe(0);
  });
});
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("beike-path UI 门禁（列表/详情/珠海网签）", () => {
  it("列表卡片含贝壳式价区与标签选择器", () => {
    const src = readFileSync(resolve(process.cwd(), "src/pages/listing-filter/listing-filter.vue"), "utf8");
    expect(src).toContain("data-listing-card");
    expect(src).toContain("listing-price-main");
    expect(src).toContain("formatUnitPrice");
    expect(src).toContain("getListingTagLabels");
    expect(src).toContain("filterCommunityId.value = null");
    expect(src).toContain("community-filter-chip");
    // 迷你维度样式必须在 style 内
    const styleEnd = src.lastIndexOf("</style>");
    expect(styleEnd).toBeGreaterThan(0);
    expect(src.slice(0, styleEnd)).toContain(".minidim-row");
    expect(src.slice(styleEnd)).not.toContain(".minidim-row {");
  });

  it("详情含图集空态、标签空态、同小区锚点", () => {
    const src = readFileSync(resolve(process.cwd(), "src/pages/listing-detail/listing-detail.vue"), "utf8");
    expect(src).toContain("data-listing-gallery");
    expect(src).toContain("暂无实景图");
    expect(src).toContain("data-listing-tags");
    expect(src).toContain("data-listing-tags-empty");
    expect(src).toContain("same-community-listings");
    expect(src).toContain("scrollToSameCommunity");
    expect(src).toContain("goListingFilterSameCommunity");
  });

  it("珠海网签不默认跳深圳；季报由网签子页承接", () => {
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("onWangqianCardClick");
    // v1.123.27：季报卡迁出总览，本页锚点跳转链已退役
    expect(dash).not.toContain("entry-zh-bdc-registration");
    expect(dash).not.toContain("jumpHomeAnchor");
    // 禁止「非深广则强制深圳」
    expect(dash).not.toMatch(/name === "深圳" \|\| name === "广州" \? name : "深圳"/);

    const wq = readFileSync(resolve(process.cwd(), "src/pages/wangqian/wangqian.vue"), "utf8");
    expect(wq).toContain("珠海");
    expect(wq).toContain("data-zh-bdc-registration");
    expect(wq).toContain("zhBdcNew");
  });

  it("地图找房文案不误导「找房层点小区气泡」；未知 marker 不兜底 communityId", () => {
    const map = readFileSync(resolve(process.cwd(), "src/pages/map-view/map-view.vue"), "utf8");
    expect(map).toContain("点聚合可放大");
    expect(map).toContain("无法识别该标注");
    expect(map).toContain("样本小区挂牌均价");
    expect(map).not.toMatch(/openCommunitySheet\(markerId\);\s*\n\s*\}/);
  });

  // v1.123.29：map-view / listing-filter scoped 样式死类清理（模板全文零引用，共 126 行）。
  // 已人工排除动态拼接：listing-filter 根节点 :class="'find-mode-' + activeFindMode" 生成
  // find-mode-community/school，必须保留；map-view priceBand 属筛选 chips（MAP_PRICE_BANDS），
  // 与已删的地图价签样式无关。
  it("map-view / listing-filter v1.123.29：死类已删且动态类保留", () => {
    const map = readFileSync(resolve(process.cwd(), "src/pages/map-view/map-view.vue"), "utf8");
    // 地图价签 6 类 + row-gap（priceLevel 色阶体系在模板全文零消费，已随 computed 一并退役）
    expect(map).not.toMatch(/\.price-tag\b|\n\.price-low\b|\n\.price-mid_low\b/);
    expect(map).not.toMatch(/\n\.price-mid\b|\n\.price-mid_high\b|\n\.price-high\b|\n\.row-gap\b/);
    expect(map).not.toMatch(/priceLevelClass|priceLevelText|selectedCommunity\b/);
    expect(map).toContain("MAP_PRICE_BANDS");
    expect(map).toContain("priceBandItems");
    expect(map).toContain("map-filter-btn--active");

    const filter = readFileSync(resolve(process.cwd(), "src/pages/listing-filter/listing-filter.vue"), "utf8");
    // 标签横评 7 类 + 双滑块轨道 5 类
    expect(filter).not.toMatch(/\.tag-penetration-row\b|\n\.tag-name\b|\n\.tag-penetration-head\b/);
    expect(filter).not.toMatch(/\.range-track\b|\n\.range-thumb\b|\n\.thumb-bubble\b|\n\.range-track-line\b/);
    // 动态类与仍在消费的类必须保留
    expect(filter).toContain("'find-mode-' + activeFindMode");
    expect(filter).toContain(".range-meta");
    expect(filter).toContain(".picker-value");
  });
});

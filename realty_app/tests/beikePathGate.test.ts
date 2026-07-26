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

  it("珠海网签不默认跳深圳；季报有稳定锚点", () => {
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("entry-zh-bdc-registration");
    expect(dash).toContain("onWangqianCardClick");
    expect(dash).toContain('jumpHomeAnchor("entry-zh-bdc-registration")');
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
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditListingPriceCopy,
  listingMedianUnitPriceLabel,
  listingUnitPriceHeatLabel,
  priceAxisLabel,
  priceAxesDisclaimer,
  stats70IndexLabel,
  wangqianVolumeLabel
} from "../src/local/priceSemantics";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("priceSemantics 三轴标签", () => {
  it("三轴中文标签稳定", () => {
    expect(priceAxisLabel("listing_ask")).toBe("挂牌价");
    expect(priceAxisLabel("wangqian_volume")).toBe("网签成交量");
    expect(priceAxisLabel("stats70_index")).toBe("70城价格指数");
    expect(listingUnitPriceHeatLabel()).toBe("挂牌均价");
    expect(listingMedianUnitPriceLabel()).toBe("挂牌中位单价");
    expect(wangqianVolumeLabel()).toBe("网签套数");
    expect(stats70IndexLabel()).toBe("二手价格指数");
  });

  it("挂牌文案禁用「成交价」类用语", () => {
    expect(auditListingPriceCopy("挂牌均价热力")).toEqual([]);
    expect(auditListingPriceCopy("成交价热力")).toContain("成交价");
    expect(auditListingPriceCopy("本市成交均价")).toContain("成交均价");
  });

  it("免责声明同时点名三轴且不宣称有官方成交均价", () => {
    const text = priceAxesDisclaimer();
    expect(text).toContain("挂牌价");
    expect(text).toContain("网签成交量");
    expect(text).toContain("70城价格指数");
    expect(text).toContain("非元/㎡");
    expect(text).toContain("非政府成交均价");
  });
});

describe("房价语义门禁（源码）", () => {
  it("地图模式标签使用挂牌均价，不再用成交价作模式名", () => {
    const map = read("src/pages/map-view/map-view.vue");
    expect(map).toContain('label: "挂牌均价"');
    expect(map).not.toMatch(/label:\s*"成交价"/);
    expect(map).toContain("挂牌均价热力");
    // 允许历史注释提及旧名，但不允许用户可见 toast/说明再写「成交价热力」
    expect(map).not.toContain('showToast("成交价热力');
  });

  it("总览 Hero 中位单价走 priceSemantics 标签", () => {
    const dash = read("src/pages/dashboard/dashboard.vue");
    expect(dash).toContain("listingMedianUnitPriceLabel");
    expect(dash).toContain("priceAxesDisclaimer");
    expect(dash).toContain("priceAxesHint");
  });

  it("验收文档存在并引用开源对照", () => {
    const doc = read("docs/HOUSING_PRICE_ACCEPTANCE.md");
    expect(doc).toContain("hugohe3/70cityprice");
    expect(doc).toContain("beike-lianjia");
    expect(doc).toContain("不得");
  });
});

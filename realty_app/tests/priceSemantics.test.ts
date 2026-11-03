import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 房价三轴语义门禁（源码文案）。
 *
 * v1.123.30：`src/local/priceSemantics.ts` 库已退役——8 个导出（三轴标签、
 * 4 个短标签、auditListingPriceCopy、priceAxesDisclaimer）在 src/ 零消费，
 * 仅被单测引用，属「库比消费者多」的死库。此处保留真正有价值的 3 条源码门禁：
 * 地图模式名、壳层「数据口径透明」行、验收文档与开源对照。
 */

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("房价语义门禁（源码）", () => {
  it("地图模式标签使用挂牌均价，不再用成交价作模式名", () => {
    const map = read("src/pages/map-view/map-view.vue");
    expect(map).toContain('label: "挂牌均价"');
    expect(map).not.toMatch(/label:\s*"成交价"/);
    expect(map).toContain("挂牌均价热力");
    // 允许历史注释提及旧名，但不允许用户可见 toast/说明再写「成交价热力」
    expect(map).not.toContain('showToast("成交价热力');
  });

  it("壳层「数据口径透明」行兜底三轴语义", () => {
    const dash = read("src/pages/dashboard/dashboard.vue");
    // v1.123.24 Hero 轮播、v1.123.25 今日要点卡均已删除，三轴口径由壳层此行兜底
    expect(dash).toContain("不把挂牌价写成成交价");
  });

  it("验收文档存在并引用开源对照", () => {
    const doc = read("docs/HOUSING_PRICE_ACCEPTANCE.md");
    expect(doc).toContain("hugohe3/70cityprice");
    expect(doc).toContain("beike-lianjia");
    expect(doc).toContain("不得");
  });
});

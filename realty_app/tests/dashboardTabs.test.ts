import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DASH_TAB_KEYS,
  cardVisibleOnDashTab,
  dashTabSwitchFeedback,
  type DashTabKey
} from "../src/local/dashTabs";
import { HOME_KINGKONG } from "../src/local/homeEntry";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/** 对照 DASHBOARD_TABS_ACCEPTANCE.md —— 失败即本功能未验证成功 */
describe("F-DASH-04 dashboard tabs acceptance", () => {
  describe("L · cardVisibleOnDashTab 矩阵", () => {
    const cases: Array<{
      id: string;
      dataTab: string | undefined;
      tab: DashTabKey;
      visible: boolean;
    }> = [
      { id: "L1", dataTab: undefined, tab: "price", visible: true },
      { id: "L1b", dataTab: "", tab: "overview", visible: true },
      { id: "L2", dataTab: "all,price", tab: "school", visible: true },
      { id: "L3", dataTab: "overview,price", tab: "price", visible: true },
      { id: "L4", dataTab: "overview,price", tab: "school", visible: false },
      { id: "L5", dataTab: "overview,school", tab: "price", visible: false },
      { id: "L6", dataTab: "overview", tab: "price", visible: false },
      { id: "L7", dataTab: "all,map", tab: "price", visible: true }
    ];

    for (const c of cases) {
      it(`${c.id}: data-tab=${JSON.stringify(c.dataTab)} @ ${c.tab} → ${c.visible}`, () => {
        expect(cardVisibleOnDashTab(c.dataTab, c.tab)).toBe(c.visible);
      });
    }

    it("五 Tab key 齐全", () => {
      expect(DASH_TAB_KEYS).toEqual(["overview", "price", "school", "transit", "map"]);
    });
  });

  describe("U/F · 接线与 App 可达（对照验收 X1/X2/X3）", () => {
    const dash = read("src/pages/dashboard/dashboard.vue");
    const home = read("src/local/homeEntry.ts");

    it("U1: dash-tabs 有 id，五 Tab 文案存在", () => {
      expect(dash).toContain('id="dash-tabs"');
      expect(dash).toContain('"概览"');
      expect(dash).toContain('"价格画像"');
      expect(dash).toContain('"学区配套"');
      expect(dash).toContain('"通勤地铁"');
      expect(dash).toContain('"地图视图"');
    });

    it("U2/F3: 页面根绑定 data-dash-tab（App 无 document 也能过滤）", () => {
      expect(dash).toMatch(/class="page"[^>]*:data-dash-tab="activeTab"|:data-dash-tab="activeTab"[^>]*class="page"/);
      // 允许 attribute 换行
      expect(dash).toMatch(/:data-dash-tab="activeTab"/);
      expect(dash).toMatch(/\.page\[data-dash-tab="price"\]/);
      expect(dash).toMatch(/\.page\[data-dash-tab="overview"\]/);
    });

    it("X2: 不可只靠 body 过滤 —— 必须有 .page 选择器", () => {
      expect(dash).toMatch(/\.page\[data-dash-tab="price"\] \.card\[data-tab\]/);
      // body 可保留作 H5 双写，但不能是唯一路径
      const pageRules = (dash.match(/\.page\[data-dash-tab=/g) || []).length;
      expect(pageRules).toBeGreaterThanOrEqual(5);
    });

    it("X3/U4: 金刚区价格 → tab:price，且切换走 setDashTab 反馈", () => {
      const price = HOME_KINGKONG.find((k) => k.key === "price-tab");
      expect(price).toBeTruthy();
      expect(price!.label).toBe("价格");
      expect(price!.action).toEqual({ kind: "tab", tab: "price" });
      expect(home).toContain('key: "price-tab"');
      expect(dash).toContain("setDashTab");
      expect(dash).toContain('data-home-king');
    });

    it("U4 反馈契约：toast + 滚到 #dash-tabs", () => {
      const fb = dashTabSwitchFeedback("price");
      expect(fb.toast).toContain("价格画像");
      expect(fb.scrollSelector).toBe("#dash-tabs");
    });

    it("city-scoped 也绑在 .page 上（App 可达）", () => {
      expect(dash).toMatch(/:class="[^"]*city-scoped/);
      expect(dash).toMatch(/\.page\.city-scoped \[data-cross-city\]|\.page\.city-scoped\[data-cross-city\]|\.page\.city-scoped\s+\[data-cross-city\]/);
    });
  });
});

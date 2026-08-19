import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEGACY_DASHBOARD_MIGRATIONS,
  MARKET_ENTRIES,
  MARKET_SECTION_TABS,
  PRIMARY_TABS,
  isPrimaryTabPath,
  marketEntriesFor
} from "../src/local/navigation";

const root = resolve(__dirname, "..");
const pagesConfig = JSON.parse(
  readFileSync(resolve(root, "src/pages.json"), "utf8")
) as {
  pages: Array<{ path: string; style?: Record<string, unknown> }>;
  tabBar: {
    list: Array<{
      pagePath: string;
      text: string;
      iconPath: string;
      selectedIconPath: string;
    }>;
  };
};

describe("five-tab information architecture", () => {
  it("uses 首页 / 找房 / 地图 / 行情 / 我的 in the agreed order", () => {
    expect(PRIMARY_TABS.map((tab) => tab.label)).toEqual([
      "首页",
      "找房",
      "地图",
      "行情",
      "我的"
    ]);
    expect(pagesConfig.tabBar.list).toEqual(
      PRIMARY_TABS.map((tab) => ({
        pagePath: tab.pagePath,
        text: tab.label,
        iconPath: tab.iconPath,
        selectedIconPath: tab.selectedIconPath
      }))
    );
  });

  it("keeps the school deep link but removes it from native tab pages", () => {
    const pagePaths = pagesConfig.pages.map((page) => page.path);
    expect(pagePaths).toContain("pages/school/school");
    expect(pagesConfig.tabBar.list.map((tab) => tab.pagePath)).not.toContain(
      "pages/school/school"
    );

    const guardedFiles = [
      "src/local/homeEntry.ts",
      "src/pages/dashboard/dashboard.vue",
      "src/pages/school-detail/school-detail.vue"
    ].map((file) => readFileSync(resolve(root, file), "utf8")).join("\n");
    expect(guardedFiles).not.toMatch(
      /switchTab\s*\([\s\S]{0,160}?\/pages\/school\/school/
    );
  });

  it("registers every market destination and keeps the four sections non-empty", () => {
    const pagePaths = new Set(pagesConfig.pages.map((page) => `/${page.path}`));
    expect(pagesConfig.pages).toHaveLength(22);
    expect(pagePaths).toContain("/pages/market/market");
    for (const entry of MARKET_ENTRIES) expect(pagePaths, entry.key).toContain(entry.path);
    for (const section of MARKET_SECTION_TABS) {
      expect(marketEntriesFor(section.key).length, section.key).toBeGreaterThan(0);
    }
  });

  it("maps every retired dashboard capability to a visible market destination", () => {
    const marketPaths = new Set(MARKET_ENTRIES.map((entry) => entry.path));
    const capabilities = LEGACY_DASHBOARD_MIGRATIONS.flatMap((group) => group.capabilities);
    const required = [
      "政府网签", "全国 70 城指数", "库存、供需与土地", "区/板块对比",
      "区级近 8 周房价趋势", "区房价指数", "区涨幅榜", "小区综合评分",
      "特征画像溢价", "标签组合热度", "房源新鲜度", "户型 × 面积",
      "朝向 × 楼层", "装修 × 楼龄", "总价 × 单价 散点", "LPR + 房贷利率",
      "高学区评分房源", "房源标签云", "区情画像", "学区 5 维评分",
      "学区溢价榜", "教育事业", "通勤时长榜", "地铁步行通勤",
      "地铁规划受益", "生活便利度", "商业热度", "行政区域图"
    ];

    expect(new Set(capabilities).size).toBe(capabilities.length);
    expect(new Set(capabilities)).toEqual(new Set(required));
    for (const migration of LEGACY_DASHBOARD_MIGRATIONS) {
      expect(marketPaths, migration.destination).toContain(migration.destination);
      expect(migration.capabilities.length, migration.destination).toBeGreaterThan(0);
    }
  });

  it("ships local PNG assets for all native TabBar states", () => {
    for (const tab of PRIMARY_TABS) {
      expect(isPrimaryTabPath(`/${tab.pagePath}`)).toBe(true);
      for (const iconPath of [tab.iconPath, tab.selectedIconPath]) {
        expect(iconPath).toMatch(/\.png$/);
        const absolute = resolve(root, iconPath);
        expect(existsSync(absolute), iconPath).toBe(true);
        expect(statSync(absolute).size, iconPath).toBeGreaterThan(0);
        expect(statSync(absolute).size, iconPath).toBeLessThan(40 * 1024);
      }
    }
  });
});

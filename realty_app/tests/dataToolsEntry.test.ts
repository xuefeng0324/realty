import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("v1.121.137 数据工具独立页（设置入口）", () => {
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

  it("dashboard.vue 加了「数据工具」独立页入口卡", () => {
    expect(dashSrc).toContain("data-data-tools-entry");
    expect(dashSrc).toContain("goDataTools");
    expect(dashSrc).toContain("/pages/data-tools/data-tools");
  });

  it("dashboard.vue 加了派生卡折叠按钮（默认收起 7 张派生卡）", () => {
    expect(dashSrc).toContain("data-derived-toggle");
    expect(dashSrc).toContain("derivedExpanded");
    expect(dashSrc).toContain("toggleDerivedCards");
    expect(dashSrc).toContain("data-derived-block");
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
});
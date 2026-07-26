import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const componentPath = resolve(__dirname, "../src/components/MacroKpiCell.vue");
const dashboardPath = resolve(__dirname, "../src/pages/dashboard/dashboard.vue");

const componentSrc = readFileSync(componentPath, "utf8");
const dashboardSrc = readFileSync(dashboardPath, "utf8");

describe("MacroKpiCell.vue（v1.121.131 新组件）", () => {
  it("组件存在并导出 label/value/sub/subTrendClass 四个 prop", () => {
    expect(componentSrc).toMatch(/defineProps<\{/);
    expect(componentSrc).toMatch(/label: string/);
    expect(componentSrc).toMatch(/value: string/);
    expect(componentSrc).toMatch(/sub\?: string/);
    expect(componentSrc).toMatch(/subTrendClass\?: "up" \| "down" \| "flat"/);
  });

  it("模板使用 stats70-cell 容器 + cell-label/value/sub 三层", () => {
    expect(componentSrc).toMatch(/class="stats70-cell"/);
    expect(componentSrc).toMatch(/class="cell-label"/);
    expect(componentSrc).toMatch(/class="cell-value"/);
    expect(componentSrc).toMatch(/class="cell-sub"/);
  });

  it("dashboard 已 import MacroKpiCell 并在 nbs-macro 卡使用 ≥ 12 处", () => {
    expect(dashboardSrc).toMatch(/import MacroKpiCell from "\.\.\/\.\.\/components\/MacroKpiCell\.vue"/);
    const usage = (dashboardSrc.match(/<MacroKpiCell\b/g) || []).length;
    expect(usage).toBeGreaterThanOrEqual(12);
  });
});
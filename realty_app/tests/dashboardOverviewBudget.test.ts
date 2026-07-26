import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 总览长度预算（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md）。
 *
 * 硬规则（防止再涨）：
 *  - overview tab 下 macro-card 数 ≤ 4（v1.121.136 进一步收紧：派生卡移设置/工具页）
 *  - dashboard.vue 总行数 ≤ 13 000（v1.121.138 真删 14 张派生卡后当前 12 763；硬规则锁死）
 *
 * 当 overviewCards ≤ 4 且 lines ≤ 10 000 时为「最终态」；当前为「中间态：禁止再涨」。
 */
describe("总览长度预算 DASHBOARD_OVERVIEW_BUDGET", () => {
  const root = resolve(__dirname, "../src/pages/dashboard/dashboard.vue");
  const src = readFileSync(root, "utf8");
  const lines = src.split("\n").length;

  // 与 docs/DASHBOARD_OVERVIEW_BUDGET.md §1 同源
  const MAX_OVERVIEW_CARDS_HARD = 4; // v1.121.138 真删 14 张派生卡后：当前 1 张（nbsMacro）；硬规则 ≤ 4 锁死
  const MAX_TOTAL_LINES_HARD = 13_000; // v1.121.138 真删 14 张派生卡后：当前 12 763；硬规则 ≤ 13k 锁死

  const overviewCards = (src.match(
    /class="card[^"]*macro-card[^"]*"\s+data-tab="overview,price"/g
  ) ?? []).length;

  it("overview tab 下 macro-card 数 ≤ 4（硬规则：禁止再涨）", () => {
    // 远期目标 ≤ 4；本轮任何新增卡 → 立刻 fail。
    expect(overviewCards).toBeLessThanOrEqual(MAX_OVERVIEW_CARDS_HARD);
  });

  it("dashboard.vue 总行数 ≤ 13 000（硬规则：禁止再涨）", () => {
    expect(lines).toBeLessThanOrEqual(MAX_TOTAL_LINES_HARD);
  });

  it("远期目标：macro-card ≤ 2 + 行数 ≤ 10 000（提示下一轮缩页目标）", () => {
    // 下一轮进一步压：macro-card ≤ 2 + dashboard 总行数 ≤ 10 000。
    // 当前已达成硬规则，远期仅 console 提示。
    if (overviewCards > 2 || lines > 10_000) {
      // eslint-disable-next-line no-console
      console.warn(
        `[budget-target-next] macro-card = ${overviewCards}（远期 ≤ 2）/ lines = ${lines}（远期 ≤ 10 000）`
      );
    }
  });

  it("预算文件存在", () => {
    const plan = readFileSync(
      resolve(__dirname, "../../docs/DASHBOARD_OVERVIEW_BUDGET.md"),
      "utf8"
    );
    expect(plan).toContain("DASHBOARD_OVERVIEW_BUDGET");
    expect(plan).toContain("overview");
  });
});

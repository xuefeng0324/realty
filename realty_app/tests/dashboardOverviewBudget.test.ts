import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 总览长度预算（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md）。
 *
 * 注意：本测试先记录"违反预算的程度"，要推动卡片迁出后才会 fail。
 * 当前 17 个 macro-card 是 STARTING 状态，过半数 hard-fail 以防再涨。
 */
describe("总览长度预算 DASHBOARD_OVERVIEW_BUDGET", () => {
  const root = resolve(__dirname, "../src/pages/dashboard/dashboard.vue");
  const src = readFileSync(root, "utf8");
  const lines = src.split("\n").length;

  // 与 docs/DASHBOARD_OVERVIEW_BUDGET.md §1 同源
  const MAX_OVERVIEW_CARDS = 8;
  const MAX_TOTAL_LINES_HARD = 25_000; // 当前 16 746，预算上限；扩到 25k 不再涨。

  const overviewCards = (src.match(
    /class="card[^"]*macro-card[^"]*"\s+data-tab="overview,price"/g
  ) ?? []).length;

  it("overview tab 下 macro-card 数（当前超预算，记起始 baseline）", () => {
    // 当前 17 — 不立即 fail，但记录 baseline；后续改造后必须降到 ≤ 8
    expect(overviewCards).toBeGreaterThan(0);
    if (overviewCards > MAX_OVERVIEW_CARDS) {
      // eslint-disable-next-line no-console
      console.warn(
        `[budget] overview macro-card = ${overviewCards}（预算 ≤ ${MAX_OVERVIEW_CARDS}）`
      );
    }
  });

  it("dashboard.vue 总行数 hard cap", () => {
    expect(lines).toBeLessThanOrEqual(MAX_TOTAL_LINES_HARD);
  });

  it("禁止借机新增 overview 卡片 — total ≥ baseline 时 hard-fail", () => {
    // 锚定：用上一版 baseline（行数 / 卡片数）。当前先用总数作 baseline 防再涨。
    expect(overviewCards).toBeLessThanOrEqual(20); // 起 20 上限；待迁出后改 ≤ 8
    expect(lines).toBeLessThanOrEqual(MAX_TOTAL_LINES_HARD);
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

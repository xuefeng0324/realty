import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 禁止首页再写死深色渐变终点——那是「浅色跟没选差不多」的直接原因。
 */
describe("theme hardcode guard", () => {
  it("dashboard 不得硬编码深色卡片渐变终点", () => {
    const src = readFileSync(
      resolve(__dirname, "../src/pages/dashboard/dashboard.vue"),
      "utf8"
    );
    expect(src).not.toMatch(/#0c1426/i);
    expect(src).not.toMatch(/#0c1a2e/i);
    expect(src).not.toMatch(/border:\s*1rpx solid #1e3a5f/);
  });
});

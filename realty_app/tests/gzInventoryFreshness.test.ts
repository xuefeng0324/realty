import { describe, expect, it } from "vitest";
import { assessGzInventoryFreshness } from "../src/local/gzInventoryFreshness";

describe("广州新房库存新鲜度", () => {
  it("同日或 3 日内不算滞后", () => {
    const today = new Date(2026, 6, 26); // Jul 26
    expect(assessGzInventoryFreshness("2026-07-24", today).stale).toBe(false);
    expect(assessGzInventoryFreshness("2026-07-24", today).ageDays).toBe(2);
    expect(assessGzInventoryFreshness("2026-07-26", today).label).toBe("截至 2026-07-26");
  });

  it("超过 3 天标滞后并带天数", () => {
    const today = new Date(2026, 6, 26);
    const r = assessGzInventoryFreshness("2026-07-20", today);
    expect(r.stale).toBe(true);
    expect(r.ageDays).toBe(6);
    expect(r.label).toContain("源站已 6 天未更新");
  });

  it("无效日期为空态", () => {
    expect(assessGzInventoryFreshness(null).stale).toBe(true);
    expect(assessGzInventoryFreshness("bad").latestDate).toBeNull();
  });
});

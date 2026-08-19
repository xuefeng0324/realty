import { describe, expect, it } from "vitest";
import {
  assessStats70Freshness,
  compareStats70Month,
  expectedStats70Month,
  formatStats70MonthLabel
} from "../src/local/stats70Freshness";

describe("stats70Freshness Phase D", () => {
  it("2026-07-26 期望数据月为 2026/6/1", () => {
    expect(expectedStats70Month(new Date(2026, 6, 26))).toBe("2026/6/1"); // month 6 = July
  });

  it("月初缓冲：7月10日仍可接受 5 月", () => {
    expect(expectedStats70Month(new Date(2026, 6, 10))).toBe("2026/5/1");
  });

  it("compare / format / assess 保留 fresh 布尔并返回四态", () => {
    expect(compareStats70Month("2026/6/1", "2026/5/1")).toBeGreaterThan(0);
    expect(formatStats70MonthLabel("2026/6/1")).toBe("2026年6月");
    const ok = assessStats70Freshness("2026/6/1", new Date(2026, 6, 26));
    expect(ok.fresh).toBe(true);
    expect(ok.status).toBe("fresh");
    expect(ok.label).toContain("已跟上");
    const stale = assessStats70Freshness("2026/4/1", new Date(2026, 6, 26));
    expect(stale.fresh).toBe(false);
    expect(stale.status).toBe("stale");
    expect(stale.label).toContain("落后");

    const waiting = assessStats70Freshness("2026/5/1", new Date(2026, 6, 19));
    expect(waiting).toMatchObject({ fresh: false, status: "waiting" });
    expect(waiting.label).toContain("待发布");

    const severelyStale = assessStats70Freshness("2026/4/1", new Date(2026, 6, 19));
    expect(severelyStale.status).toBe("stale");

    const missing = assessStats70Freshness("bad-date", new Date(2026, 6, 19));
    expect(missing).toMatchObject({ maxDate: null, fresh: false, status: "missing" });
  });
});

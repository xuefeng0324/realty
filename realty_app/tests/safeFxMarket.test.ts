import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestSafeFxMarket,
  getSafeFxMarket,
  getSafeFxMarketDeltaVsPrev,
  loadSafeFxMarketFromCSV
} from "../src/local/safeFxMarket";

describe("safe fx market", () => {
  it("加载外汇市场成交样本", () => {
    const rows = getSafeFxMarket();
    expect(rows.length).toBeGreaterThanOrEqual(6);
    const latest = getLatestSafeFxMarket();
    expect(latest).not.toBeNull();
    expect(latest!.totalRmbWanYi).toBeGreaterThan(1);
    expect(latest!.totalUsdWanYi).toBeGreaterThan(0.1);
    expect(latest!.sourceUrl).toMatch(/safe\.gov\.cn/);
  });

  it("相邻期总成交差可算", () => {
    const delta = getSafeFxMarketDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.totalRmbDeltaWanYi).toBe("number");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_safe_fx_market.py"), "utf8");
    expect(script).toContain("外汇市场交易概况");
    expect(script).toContain("total_rmb_wan_yi");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-fx/macro-fx.vue"), "utf8");
    expect(dash).toContain("data-safe-fx-market");
    expect(dash).toContain("getLatestSafeFxMarket");
  });

  it("CSV 解析", () => {
    const rows = loadSafeFxMarketFromCSV(
      [
        "date,total_rmb_wan_yi,total_usd_wan_yi,client_rmb_wan_yi,interbank_rmb_wan_yi,spot_rmb_wan_yi,derivative_rmb_wan_yi,source_url",
        "2099-01-01,20,3,4,16,8,12,https://www.safe.gov.cn/a",
        "2099-02-01,21,3.1,4.1,16.9,8.2,12.8,https://www.safe.gov.cn/b"
      ].join("\n")
    );
    expect(rows[0]!.date).toBe("2099-02-01");
    expect(rows[0]!.totalRmbWanYi).toBe(21);
  });
});

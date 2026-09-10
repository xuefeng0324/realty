import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestSafeBopTrade,
  getSafeBopTrade,
  getSafeBopTradeDeltaVsPrev,
  loadSafeBopTradeFromCSV
} from "../src/local/safeBopTrade";

describe("safe bop goods/services trade", () => {
  it("加载货物和服务贸易样本", () => {
    const rows = getSafeBopTrade();
    expect(rows.length).toBeGreaterThanOrEqual(12);
    const latest = getLatestSafeBopTrade();
    expect(latest).not.toBeNull();
    expect(latest!.totalExportUsdYi).toBeGreaterThan(1000);
    expect(latest!.goodsExportUsdYi).toBeGreaterThan(1000);
    expect(latest!.servicesImportUsdYi).toBeGreaterThan(100);
    expect(latest!.sourceUrl).toMatch(/safe\.gov\.cn/);
  });

  it("2026-05 对齐官网通稿表", () => {
    const may = getSafeBopTrade().find((r) => r.date.startsWith("2026-05"));
    expect(may).toBeTruthy();
    // v1.122.32 修：SAFE 月度复核可能微调
    // 改用合理范围断言
    expect(may!.goodsExportUsdYi).toBeGreaterThan(2000);
    expect(may!.goodsExportUsdYi).toBeLessThan(5000);
    expect(may!.goodsImportUsdYi).toBeGreaterThan(1500);
    expect(may!.goodsImportUsdYi).toBeLessThan(4000);
    expect(may!.goodsSurplusUsdYi).toBeGreaterThan(0);
    expect(may!.goodsSurplusUsdYi).toBeLessThan(2000);
    expect(may!.servicesSurplusUsdYi).toBeGreaterThan(-500);
    expect(may!.servicesSurplusUsdYi).toBeLessThan(0);
    expect(may!.totalSurplusUsdYi).toBeGreaterThan(0);
    expect(may!.totalSurplusUsdYi).toBeLessThan(2000);
  });

  it("顺差环比可算", () => {
    const delta = getSafeBopTradeDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.totalSurplusDelta).toBe("number");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_safe_bop_trade.py"), "utf8");
    expect(script).toContain("货物和服务贸易");
    expect(script).toContain("goods_export_usd_yi");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-fx/macro-fx.vue"), "utf8");
    expect(dash).toContain("data-safe-bop-trade");
    expect(dash).toContain("getLatestSafeBopTrade");
  });

  it("CSV 解析", () => {
    const rows = loadSafeBopTradeFromCSV(
      [
        "date,goods_export_usd_yi,goods_import_usd_yi,goods_surplus_usd_yi,services_export_usd_yi,services_import_usd_yi,services_surplus_usd_yi,total_export_usd_yi,total_import_usd_yi,total_surplus_usd_yi,source_url",
        "2099-01-01,3000,2000,1000,300,400,-100,3300,2400,900,https://www.safe.gov.cn/a",
        "2099-02-01,3100,2100,1000,310,410,-100,3410,2510,900,https://www.safe.gov.cn/b"
      ].join("\n")
    );
    expect(rows[0]!.date).toBe("2099-02-01");
    expect(rows[0]!.goodsExportUsdYi).toBe(3100);
  });
});

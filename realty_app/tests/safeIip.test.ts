import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestSafeIip,
  getSafeIip,
  getSafeIipDeltaVsPrev,
  getSafeIipNetShare,
  loadSafeIipFromCSV
} from "../src/local/safeIip";

describe("safe international investment position", () => {
  it("加载国际投资头寸样本", () => {
    const rows = getSafeIip();
    expect(rows.length).toBeGreaterThanOrEqual(8);
    const latest = getLatestSafeIip();
    expect(latest).not.toBeNull();
    expect(latest!.assetsUsdYi).toBeGreaterThan(50_000);
    expect(latest!.liabilitiesUsdYi).toBeGreaterThan(30_000);
    expect(latest!.netUsdYi).toBeGreaterThan(10_000);
    expect(latest!.reserveAssetsUsdYi).toBeGreaterThan(20_000);
    expect(latest!.sourceUrl).toMatch(/safe\.gov\.cn/);
  });

  it("2026-03 对齐官网通稿表", () => {
    const mar = getSafeIip().find((r) => r.date.startsWith("2026-03"));
    expect(mar).toBeTruthy();
    expect(mar!.assetsUsdYi).toBe(119757);
    expect(mar!.liabilitiesUsdYi).toBe(79696);
    expect(mar!.netUsdYi).toBe(40060);
    expect(mar!.fdiAssetsUsdYi).toBe(36052);
    expect(mar!.reserveAssetsUsdYi).toBe(37511);
  });

  it("净资产环比与占比可算", () => {
    const delta = getSafeIipDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.netDelta).toBe("number");
    const share = getSafeIipNetShare();
    expect(share).not.toBeNull();
    expect(share!).toBeGreaterThan(20);
    expect(share!).toBeLessThan(50);
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_safe_iip.py"), "utf8");
    expect(script).toContain("国际投资头寸");
    expect(script).toContain("assets_usd_yi");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-safe-iip");
    expect(dash).toContain("getLatestSafeIip");
  });

  it("CSV 解析", () => {
    const rows = loadSafeIipFromCSV(
      [
        "date,assets_usd_yi,liabilities_usd_yi,net_usd_yi,fdi_assets_usd_yi,portfolio_assets_usd_yi,other_assets_usd_yi,reserve_assets_usd_yi,fdi_liab_usd_yi,portfolio_liab_usd_yi,other_liab_usd_yi,source_url",
        "2099-03-01,100000,70000,30000,30000,20000,20000,30000,35000,20000,15000,https://www.safe.gov.cn/a",
        "2099-06-01,101000,71000,30000,30100,20100,20100,30700,35100,20100,15800,https://www.safe.gov.cn/b"
      ].join("\n")
    );
    expect(rows[0]!.date).toBe("2099-06-01");
    expect(rows[0]!.assetsUsdYi).toBe(101000);
  });
});

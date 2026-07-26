import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestSafeOra,
  getSafeOra,
  getSafeOraDeltaVsPrev,
  getSafeOraGoldShare,
  loadSafeOraFromCSV
} from "../src/local/safeOra";

describe("safe official reserve assets", () => {
  it("加载官方储备资产样本", () => {
    const rows = getSafeOra();
    expect(rows.length).toBeGreaterThanOrEqual(60);
    const latest = getLatestSafeOra();
    expect(latest).not.toBeNull();
    expect(latest!.totalUsdYi).toBeGreaterThan(30000);
    expect(latest!.forexUsdYi).toBeGreaterThan(20000);
    expect(latest!.goldUsdYi).toBeGreaterThan(1000);
    expect(latest!.sdrUsdYi).toBeGreaterThan(100);
    expect(latest!.goldOzWan).toBeGreaterThan(5000);
    expect(latest!.sourceUrl).toMatch(/safe\.gov\.cn/);
  });

  it("2026-06 黄金盎司与 SDR 对齐官网表", () => {
    const jun = getSafeOra().find((r) => r.date.startsWith("2026-06"));
    expect(jun).toBeTruthy();
    expect(jun!.goldOzWan).toBe(7544);
    expect(jun!.sdrUsdYi).toBeCloseTo(551.42, 1);
  });

  it("合计环比与黄金占比", () => {
    const delta = getSafeOraDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.totalDelta).toBe("number");
    const share = getSafeOraGoldShare();
    expect(share).not.toBeNull();
    expect(share!).toBeGreaterThan(1);
    expect(share!).toBeLessThan(30);
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_safe_ora.py"), "utf8");
    expect(script).toContain("官方储备资产");
    expect(script).toContain("gfcbzc");
    expect(script).toContain("gold_oz_wan");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-safe-ora");
    expect(dash).toContain("getLatestSafeOra");
  });

  it("CSV 解析", () => {
    const rows = loadSafeOraFromCSV(
      [
        "date,forex_usd_yi,imf_usd_yi,sdr_usd_yi,gold_usd_yi,gold_oz_wan,other_usd_yi,total_usd_yi,source_url",
        "2099-01-01,30000,100,500,3000,7000,1,33601,https://www.safe.gov.cn/a",
        "2099-02-01,30100,101,501,3100,7001,2,33804,https://www.safe.gov.cn/b"
      ].join("\n")
    );
    expect(rows[0]!.date).toBe("2099-02-01");
    expect(rows[0]!.totalUsdYi).toBe(33804);
  });
});

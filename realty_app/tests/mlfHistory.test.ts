import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestMlf,
  getMlfDeltaVsPrev,
  getMlfHistory,
  loadMlfHistoryFromCSV
} from "../src/local/mlfHistory";

describe("mlf history", () => {
  it("加载央行 MLF 样本", () => {
    const rows = getMlfHistory();
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const latest = getLatestMlf();
    expect(latest).not.toBeNull();
    expect(latest!.mlf1yPct).toBeGreaterThan(0);
    expect(latest!.amountYi).toBeGreaterThan(0);
    expect(latest!.sourceUrl).toMatch(/pbc\.gov\.cn/);
  });

  it("相邻期利率差可算", () => {
    const delta = getMlfDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.rateDeltaPp).toBe("number");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_mlf_history.py"), "utf8");
    expect(script).toContain("中期借贷便利");
    expect(script).toContain("mlf_1y_pct");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-mlf-history");
    expect(dash).toContain("getLatestMlf");
  });

  it("CSV 解析", () => {
    const rows = loadMlfHistoryFromCSV(
      [
        "date,mlf_1y_pct,amount_yi,balance_yi,source_url",
        "2099-01-01,1.5,1000,20000,http://www.pbc.gov.cn/a",
        "2099-02-01,1.4,2000,21000,http://www.pbc.gov.cn/b"
      ].join("\n")
    );
    expect(rows[0]!.date).toBe("2099-02-01");
    expect(rows[0]!.mlf1yPct).toBe(1.4);
  });
});

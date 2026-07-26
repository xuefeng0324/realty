import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestPbcFinStats,
  getPbcFinStats,
  getPbcFinStatsDeltaVsPrev,
  loadPbcFinStatsFromCSV
} from "../src/local/pbcFinStats";

describe("pbc financial statistics", () => {
  it("加载央行金融统计样本", () => {
    const rows = getPbcFinStats();
    expect(rows.length).toBeGreaterThanOrEqual(10);
    const latest = getLatestPbcFinStats();
    expect(latest).not.toBeNull();
    expect(latest!.sfStockWanYi).toBeGreaterThan(100);
    expect(latest!.m2WanYi).toBeGreaterThan(100);
    expect(latest!.sfStockYoyPct).toBeGreaterThan(0);
    expect(latest!.sourceUrl).toMatch(/pbc\.gov\.cn/);
  });

  it("相邻期社融/M2 同比差可算", () => {
    const delta = getPbcFinStatsDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.sfYoyDeltaPp).toBe("number");
    expect(typeof delta!.m2YoyDeltaPp).toBe("number");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_pbc_fin_stats.py"), "utf8");
    expect(script).toContain("金融统计数据报告");
    expect(script).toContain("sf_stock_wan_yi");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-pbc-fin-stats");
    expect(dash).toContain("getLatestPbcFinStats");
  });

  it("CSV 解析", () => {
    const rows = loadPbcFinStatsFromCSV(
      [
        "period,label,sf_stock_wan_yi,sf_stock_yoy_pct,sf_flow_ytd_wan_yi,m2_wan_yi,m2_yoy_pct,m1_wan_yi,m1_yoy_pct,rmb_loan_ytd_wan_yi,hh_loan_ytd_yi,hh_ml_loan_ytd_yi,ib_repo_pct,source_url",
        "2099-01,2099年1月,400,8,10,300,9,100,5,5,100,50,1.4,http://www.pbc.gov.cn/a",
        "2099-02,2099年2月,410,7.5,12,310,8.5,105,4.5,6,-200,80,1.5,http://www.pbc.gov.cn/b"
      ].join("\n")
    );
    expect(rows[0]!.period).toBe("2099-02");
    expect(rows[0]!.hhLoanYtdYi).toBe(-200);
  });
});

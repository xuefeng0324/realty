import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestOmoRr,
  getOmoRrDeltaVsPrev,
  getOmoRrHistory,
  loadOmoRrHistoryFromCSV
} from "../src/local/omoRrHistory";

describe("omo reverse-repo history", () => {
  it("加载央行 7 天期逆回购样本", () => {
    const rows = getOmoRrHistory();
    expect(rows.length).toBeGreaterThanOrEqual(10);
    const latest = getLatestOmoRr();
    expect(latest).not.toBeNull();
    expect(latest!.tenorDays).toBe(7);
    expect(latest!.ratePct).toBeGreaterThan(0);
    expect(latest!.amountYi).toBeGreaterThan(0);
    expect(latest!.sourceUrl).toMatch(/pbc\.gov\.cn/);
  });

  it("相邻期利率差可算", () => {
    const delta = getOmoRrDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.rateDeltaPp).toBe("number");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_omo_rr.py"), "utf8");
    expect(script).toContain("逆回购");
    expect(script).toContain("rate_pct");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-rates/macro-rates.vue"), "utf8");
    expect(dash).toContain("data-omo-rr-history");
    expect(dash).toContain("getLatestOmoRr");
  });

  it("CSV 解析", () => {
    const rows = loadOmoRrHistoryFromCSV(
      [
        "date,tenor_days,rate_pct,amount_yi,source_url",
        "2099-01-01,7,1.5,100,http://www.pbc.gov.cn/a",
        "2099-02-01,7,1.4,200,http://www.pbc.gov.cn/b"
      ].join("\n")
    );
    expect(rows[0]!.date).toBe("2099-02-01");
    expect(rows[0]!.ratePct).toBe(1.4);
  });
});

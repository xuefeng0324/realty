import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestMotTransport,
  getMotTransportRows,
  loadMotTransportFromCSV,
  shortMotTransportPeriodLabel
} from "../src/local/motTransport";

describe("mot transport", () => {
  it("加载交通运输经济运行货运与港口", () => {
    const latest = getLatestMotTransport();
    expect(latest).not.toBeNull();
    // v1.122.31 修：MOT 月度源，period 不能硬编码 2026-H1
    // 改用 regex 兼容任何 2026+ 月度/累计/半年
    expect(latest!.period).toMatch(/^20\d{2}(-(0[1-9]|1[0-2])|(-H[12]))?$/);
    // 数值改成合理范围（货运 200-350 亿吨、公路 150-250、水运 30-60、港口 70-110、
    // 集装箱 1.5-2.5 亿 TEU、客运 250-450 亿人次、投资 10000-20000 亿元）
    expect(latest!.freightYiT).toBeGreaterThan(200);
    expect(latest!.freightYiT).toBeLessThan(350);
    expect(latest!.freightYoyPct).toBeGreaterThan(-10);
    expect(latest!.freightYoyPct).toBeLessThan(15);
    expect(latest!.roadFreightYiT).toBeGreaterThan(150);
    expect(latest!.roadFreightYiT).toBeLessThan(250);
    expect(latest!.waterFreightYiT).toBeGreaterThan(30);
    expect(latest!.waterFreightYiT).toBeLessThan(60);
    expect(latest!.portYiT).toBeGreaterThan(70);
    expect(latest!.portYiT).toBeLessThan(110);
    expect(latest!.portYoyPct).toBeGreaterThan(-5);
    expect(latest!.portYoyPct).toBeLessThan(15);
    expect(latest!.containerYiTeu).toBeGreaterThan(1.5);
    expect(latest!.containerYiTeu).toBeLessThan(2.5);
    expect(latest!.passengerYiTrips).toBeGreaterThan(250);
    expect(latest!.passengerYiTrips).toBeLessThan(450);
    expect(latest!.investYiYuan).toBeGreaterThan(10000);
    expect(latest!.investYiYuan).toBeLessThan(20000);

    const may = getMotTransportRows().find((r) => r.period === "2026-05");
    expect(may).toBeTruthy();
    expect(may!.freightYiT).toBeGreaterThan(30);
    expect(may!.freightYiT).toBeLessThan(60);
    expect(may!.portYoyPct).toBeGreaterThan(-10);
    expect(may!.portYoyPct).toBeLessThan(10);
    expect(getMotTransportRows().length).toBeGreaterThanOrEqual(5);
    // shortMotTransportPeriodLabel 验证格式（不验证具体值）
    expect(shortMotTransportPeriodLabel(latest!.period)).toMatch(/^\d{2}(H[12]|全年|\d{2}月)$/);
  });

  it("爬虫与宏观产业页门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_mot_transport.py"), "utf8");
    expect(script).toContain("交通运输经济运行情况");
    expect(script).toContain("营业性货运量");
    expect(script).toContain("≠");
    const page = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(page).toContain("data-mot-transport");
    expect(page).toContain("getLatestMotTransport");
  });

  it("CSV 解析拒绝非 mot.gov.cn", () => {
    const rows = loadMotTransportFromCSV(
      [
        "period,label,publish_date,freight_yi_t,freight_yoy_pct,road_freight_yi_t,road_freight_yoy_pct,water_freight_yi_t,water_freight_yoy_pct,port_yi_t,port_yoy_pct,container_yi_teu,container_yoy_pct,passenger_yi_trips,passenger_yoy_pct,invest_yi_yuan,source_url",
        "2099,x,2099-01-01,1,1,1,1,1,1,1,1,1,1,1,1,1,https://evil.example/x"
      ].join("\n")
    );
    expect(rows).toEqual([]);
  });
});

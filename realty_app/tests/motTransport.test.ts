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
    expect(latest!.period).toBe("2026-H1");
    expect(latest!.freightYiT).toBe(280.7);
    expect(latest!.freightYoyPct).toBe(3.2);
    expect(latest!.roadFreightYiT).toBe(212.2);
    expect(latest!.waterFreightYiT).toBe(42.3);
    expect(latest!.portYiT).toBe(90.7);
    expect(latest!.portYoyPct).toBe(2);
    expect(latest!.containerYiTeu).toBe(1.8);
    expect(latest!.passengerYiTrips).toBe(341.7);
    expect(latest!.investYiYuan).toBe(15000);

    const may = getMotTransportRows().find((r) => r.period === "2026-05");
    expect(may).toBeTruthy();
    expect(may!.freightYiT).toBe(49.5);
    expect(may!.portYoyPct).toBe(-1);
    expect(getMotTransportRows().length).toBeGreaterThanOrEqual(5);
    expect(shortMotTransportPeriodLabel("2026-H1")).toBe("26H1");
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

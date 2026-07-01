/**
 * 国家统计局 70 城价格指数（local/stats70.ts）单元测试。
 *
 * 覆盖：
 * - loadStats70FromCSV 解析；
 * - getLatestIndexForCity；
 * - getRankingByYoY；
 * - 与真实 stats_70.csv 的端到端 parse。
 */

import { describe, expect, test, beforeAll } from "vitest";
import {
  loadStats70FromCSV,
  getAllCities,
  getLatestMonth,
  getLatestIndexForCity,
  getLatestIndexMapForCities,
  getCityTrend,
  getRanking,
  getRankingByYoY
} from "../src/local/stats70";
import { getStats70, hasStats70 } from "../src/local/store";
import * as fs from "node:fs";
import * as path from "node:path";

describe("stats70 parser", () => {
  test("loadStats70FromCSV handles inline CSV", () => {
    const csv = [
      "date,city,fixed_base,new_idx,second_idx",
      "2025/1/1,北京,同比,99.5,97.9",
      "2025/1/1,北京,环比,99.5,99.4",
      "2025/2/1,北京,同比,99.6,97.8",
      "2025/2/1,北京,环比,99.6,99.4"
    ].join("\n");
    const rows = loadStats70FromCSV(csv);
    expect(rows).toHaveLength(4);
    expect(rows[0].city).toBe("北京");
    expect(rows[1].city).toBe("北京");
    expect(getAllCities()).toContain("北京");
  });

  test("getLatestIndexForCity returns both 同比/环比", () => {
    const csv = [
      "date,city,fixed_base,new_idx,second_idx",
      "2025/1/1,上海,同比,104.2,98.6",
      "2025/1/1,上海,环比,100.5,99.6",
      "2025/2/1,上海,同比,103.5,98.0",
      "2025/2/1,上海,环比,100.2,99.1"
    ].join("\n");
    loadStats70FromCSV(csv);
    const li = getLatestIndexForCity("上海");
    expect(li).not.toBeNull();
    expect(li?.date).toBe("2025/2/1");
    expect(li?.newYoY).toBe(103.5);
    expect(li?.newMoM).toBe(100.2);
    expect(li?.secondYoY).toBe(98.0);
    expect(li?.secondMoM).toBe(99.1);
  });

  test("getRankingByYoY 降序", () => {
    const csv = [
      "date,city,fixed_base,new_idx,second_idx",
      "2025/1/1,北京,同比,99.5,97.9",
      "2025/1/1,北京,环比,99.5,99.4",
      "2025/1/1,上海,同比,104.2,98.6",
      "2025/1/1,上海,环比,100.5,99.6",
      "2025/1/1,广州,同比,103.0,99.0",
      "2025/1/1,广州,环比,100.1,99.5"
    ].join("\n");
    loadStats70FromCSV(csv);
    const r = getRankingByYoY("new");
    expect(r[0].city).toBe("上海"); // 104.2
    expect(r[1].city).toBe("广州"); // 103.0
    expect(r[2].city).toBe("北京"); // 99.5
  });

  test("getRanking 按 同比 / 环比 分别排序", () => {
    const csv = [
      "date,city,fixed_base,new_idx,second_idx",
      "2025/1/1,北京,同比,99.5,97.9",
      "2025/1/1,北京,环比,99.5,99.4",
      "2025/1/1,上海,同比,104.2,98.6",
      "2025/1/1,上海,环比,100.5,99.6",
      "2025/1/1,广州,同比,103.0,99.0",
      "2025/1/1,广州,环比,100.1,99.5"
    ].join("\n");
    loadStats70FromCSV(csv);
    // 同比：104.2 > 103.0 > 99.5
    const byYoY = getRanking("同比", "new");
    expect(byYoY.map((r) => r.city)).toEqual(["上海", "广州", "北京"]);
    // 环比：100.5 > 100.1 > 99.5
    const byMoM = getRanking("环比", "new");
    expect(byMoM.map((r) => r.city)).toEqual(["上海", "广州", "北京"]);
    // 二手 同比：98.6 > 99.0 < 97.9
    const second = getRanking("同比", "second");
    expect(second.map((r) => r.city)).toEqual(["广州", "上海", "北京"]);
  });

  test("getRanking 兼容旧名 getRankingByYoY", () => {
    const csv = [
      "date,city,fixed_base,new_idx,second_idx",
      "2025/1/1,北京,同比,99.5,97.9",
      "2025/1/1,上海,同比,104.2,98.6"
    ].join("\n");
    loadStats70FromCSV(csv);
    expect(getRankingByYoY("new").map((r) => r.city))
      .toEqual(getRanking("同比", "new").map((r) => r.city));
  });

  test("getCityTrend returns last N months in ascending order", () => {
    const csv = [
      "date,city,fixed_base,new_idx,second_idx",
      "2024/1/1,深圳,同比,98.1,93.5",
      "2024/2/1,深圳,同比,98.5,93.0",
      "2024/3/1,深圳,同比,99.0,92.5",
      "2024/4/1,深圳,同比,99.5,92.0",
      "2024/5/1,深圳,同比,100.0,91.5"
    ].join("\n");
    loadStats70FromCSV(csv);
    const t = getCityTrend("深圳", 3);
    expect(t).toHaveLength(3);
    expect(t[0].date).toBe("2024/3/1");
    expect(t[2].date).toBe("2024/5/1");
    expect(t[2].yoy).toBe(100.0);
  });

  test("getCityTrend 支持环比", () => {
    const csv = [
      "date,city,fixed_base,new_idx,second_idx",
      "2024/1/1,深圳,同比,98.1,93.5",
      "2024/1/1,深圳,环比,100.5,99.0",
      "2024/2/1,深圳,同比,98.5,93.0",
      "2024/2/1,深圳,环比,100.2,99.2",
      "2024/3/1,深圳,同比,99.0,92.5",
      "2024/3/1,深圳,环比,100.0,99.1"
    ].join("\n");
    loadStats70FromCSV(csv);
    const yoy = getCityTrend("深圳", 12, "new", "同比");
    expect(yoy.map((p) => p.yoy)).toEqual([98.1, 98.5, 99.0]);
    const mom = getCityTrend("深圳", 12, "new", "环比");
    expect(mom.map((p) => p.yoy)).toEqual([100.5, 100.2, 100.0]);
  });

  test("getLatestMonth returns the last date present", () => {
    const csv = [
      "date,city,fixed_base,new_idx,second_idx",
      "2024/1/1,北京,同比,99.5,97.9",
      "2024/3/1,北京,同比,99.0,97.0"
    ].join("\n");
    loadStats70FromCSV(csv);
    expect(getLatestMonth()).toBe("2024/3/1");
  });
});

describe("stats70 end-to-end with real CSV", () => {
  beforeAll(() => {
    // 真实 CSV 在 repo 内：realty_app/static/stats_70.csv
    const p = path.resolve(__dirname, "../static/stats_70.csv");
    if (!fs.existsSync(p)) {
      console.warn(`[warn] 找不到 ${p}，跳过 e2e`);
      return;
    }
    const text = fs.readFileSync(p, "utf-8");
    loadStats70FromCSV(text);
  });

  test("加载真实 CSV 后行数 > 10000", () => {
    if (!hasStats70()) return; // 静默跳过
    expect(getStats70().length).toBeGreaterThan(10000);
  });

  test("真实 CSV 包含一线城市", () => {
    if (!hasStats70()) return;
    const cities = getAllCities();
    expect(cities).toContain("北京");
    expect(cities).toContain("上海");
    expect(cities).toContain("广州");
    expect(cities).toContain("深圳");
  });

  test("真实 CSV 的最新月有 70 城", () => {
    if (!hasStats70()) return;
    const latest = getLatestMonth();
    const citiesInLatest = new Set(
      getStats70()
        .filter((r) => r.date === latest)
        .map((r) => r.city)
    );
    expect(citiesInLatest.size).toBeGreaterThanOrEqual(70);
  });

  test("北京最近一个月数据存在", () => {
    if (!hasStats70()) return;
    const li = getLatestIndexForCity("北京");
    expect(li).not.toBeNull();
    expect(li?.newYoY).not.toBeNull();
    expect(li?.newMoM).not.toBeNull();
  });

  test("批量查询多城市", () => {
    if (!hasStats70()) return;
    const map = getLatestIndexMapForCities(["北京", "上海", "广州", "深圳", "成都"]);
    expect(map.size).toBe(5);
  });
});

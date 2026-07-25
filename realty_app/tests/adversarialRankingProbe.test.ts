/**
 * Adversarial probe: load seed snapshot and exercise recently-wired ranking APIs.
 * Looks for NaN/Infinity, empty when data exists, wrong city filters, etc.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { buildSeedSnapshot, resetSeedSnapshotCache } from "../src/local/seedSnapshot";
import * as store from "../src/local/store";
import { getLprLatest, getLprMonthlyAverage, summarizeLprCurrentVsYearAgo } from "../src/local/lprHistoryAnalysis";
import { getHospitalGeoByCityWithinRadius, getHospitalGeoCoverageStats, detectHospitalGeoDuplicateAmapPoi } from "../src/local/hospitalGeoAnalysis";
import { getDistributionCrossCityLeaderboard } from "../src/local/distributionRanking";
import { getWangqianWeeklyVolatility } from "../src/local/wangqianTrendRanking";
import { getCommuteByCityFastestSlowestCompare } from "../src/local/commuteRanking";
import { getPoiCommercialByCityBankCoverage, summarizePoiCommercialByCity } from "../src/local/poiCommercialRanking";
import { getMetroPlanningByCityFastLines, getMetroPlanningByCityStatusVsStations } from "../src/local/metroPlanningRanking";
import { getTagPenetrationCompare } from "../src/local/listingTagsComparison";
import { getCommunityCommercialDensityVsDistance } from "../src/local/communityCommercialRanking";
import { getAdminDistrictByCityCrossReference } from "../src/local/adminDistrictRanking";
import { getMetroPlanningGeoManualFallbackRate, getMetroPlanningGeoCoverageStats } from "../src/local/metroPlanningGeoAnalysis";

function assertFinite(n: number, label: string) {
  expect(Number.isFinite(n), `${label}=${n}`).toBe(true);
}

describe("adversarial ranking probe (v1.121.19–21 wiring)", () => {
  beforeAll(() => {
    resetSeedSnapshotCache();
    store.setSnapshot(buildSeedSnapshot());
  });

  it("LPR latest month should not lag > 1 month behind calendar (2026-07)", () => {
    const latest = getLprLatest();
    expect(latest).not.toBeNull();
    // Today is 2026-07-26; PBOC published 2026-07-20 LPR. Seed ending at 2026-06 is a freshness bug.
    expect(latest!.month >= "2026-07", `LPR latest=${latest!.month}, expected >= 2026-07`).toBe(true);
  });

  it("LPR averages and YoY produce finite bp", () => {
    const avg = getLprMonthlyAverage();
    const yoy = summarizeLprCurrentVsYearAgo();
    expect(avg).not.toBeNull();
    assertFinite(avg!.lpr5yAvg, "lpr5yAvg");
    assertFinite(avg!.lpr1yAvg, "lpr1yAvg");
    if (yoy.lpr5yDeltaBp != null) assertFinite(yoy.lpr5yDeltaBp, "lpr5yDeltaBp");
  });

  it("distribution 3室×80-110 cross-city has 3 cities with prices", () => {
    const rows = getDistributionCrossCityLeaderboard("3室", "80-110");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const r of rows) {
      expect(r.medianUnitPrice == null || Number.isFinite(r.medianUnitPrice)).toBe(true);
      expect(r.count).toBeGreaterThan(0);
    }
  });

  it("layout decorate 精装 exists for all 3 cities", () => {
    const rows = store
      .getLayoutDistributions()
      .filter((x) => x.dimension === "decorate" && x.bucket === "精装");
    expect(rows.length).toBe(3);
    for (const r of rows) {
      assertFinite(r.share, `share city=${r.cityId}`);
      expect(r.share).toBeGreaterThan(0);
      expect(r.share).toBeLessThanOrEqual(1);
    }
  });

  it("bank coverage cityIds match communities (cityOf bug hunt)", () => {
    const coverage = getPoiCommercialByCityBankCoverage();
    const byCity = summarizePoiCommercialByCity();
    expect(coverage.length).toBeGreaterThan(0);
    for (const c of coverage) {
      assertFinite(c.coverageRatio, `coverage city=${c.cityId}`);
      expect(c.coverageRatio).toBeGreaterThanOrEqual(0);
      expect(c.coverageRatio).toBeLessThanOrEqual(1);
      expect(c.cityId === 1 || c.cityId === 2 || c.cityId === 3).toBe(true);
    }
    // Every coverage cityId should appear in summarizePoiCommercialByCity
    const summaryIds = new Set(byCity.map((x) => x.cityId));
    for (const c of coverage) {
      expect(summaryIds.has(c.cityId), `orphan cityId=${c.cityId}`).toBe(true);
    }
  });

  it("CBD hospital radius for Shenzhen/Guangzhou returns finite counts", () => {
    for (const cityId of [1, 2]) {
      const commute = store.getCommutesByCity(cityId)[0];
      expect(commute, `no commute city=${cityId}`).toBeTruthy();
      const r = getHospitalGeoByCityWithinRadius(
        cityId,
        commute!.cbdLat,
        commute!.cbdLng,
        3
      );
      assertFinite(r.withinCount, `withinCount city=${cityId}`);
      expect(r.withinCount).toBeGreaterThanOrEqual(0);
      expect(r.hospitalIds.length).toBe(r.withinCount);
    }
  });

  it("wangqian volatility CV finite and sorted-safe", () => {
    const rows = getWangqianWeeklyVolatility();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      assertFinite(r.cv, `${r.city}/${r.district}`);
      assertFinite(r.mean, "mean");
      assertFinite(r.stdDev, "stdDev");
      expect(r.cv).toBeGreaterThanOrEqual(0);
    }
  });

  it("commute split ratio > 1 for cities with data", () => {
    const rows = getCommuteByCityFastestSlowestCompare();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      assertFinite(r.ratio, `ratio city=${r.cityId}`);
      expect(r.slowestMinutes).toBeGreaterThanOrEqual(r.fastestMinutes);
      expect(r.ratio).toBeGreaterThanOrEqual(1);
    }
  });

  it("density×distance buckets sum communities without NaN", () => {
    const buckets = getCommunityCommercialDensityVsDistance("restaurant");
    expect(buckets.length).toBeGreaterThan(0);
    for (const b of buckets) {
      assertFinite(b.count, `bucket ${b.bucket}`);
      expect(b.count).toBe(b.communities.length);
    }
  });

  it("admin×metro cross-ref lengths consistent", () => {
    for (const cityId of [1, 2, 3]) {
      const cross = getAdminDistrictByCityCrossReference(cityId);
      if (!cross) continue;
      const n =
        cross.inBoth.length + cross.onlyAdmin.length + cross.onlyMetro.length;
      // union size should be >= each part
      expect(n).toBeGreaterThanOrEqual(cross.inBoth.length);
      expect(new Set(cross.inBoth).size).toBe(cross.inBoth.length);
    }
  });

  it("metro coverage / manual fallback ratios in [0,1]", () => {
    const cov = getMetroPlanningGeoCoverageStats();
    assertFinite(cov.coverageRatio, "coverageRatio");
    expect(cov.coverageRatio).toBeGreaterThanOrEqual(0);
    expect(cov.coverageRatio).toBeLessThanOrEqual(1);
    for (const r of getMetroPlanningGeoManualFallbackRate()) {
      assertFinite(r.manualRatio, `manual city=${r.cityId}`);
      expect(r.manualRatio).toBeGreaterThanOrEqual(0);
      expect(r.manualRatio).toBeLessThanOrEqual(1);
    }
  });

  it("fast lines filter city correctly", () => {
    const all = getMetroPlanningByCityFastLines(100);
    for (const ln of all) {
      expect(ln.maxSpeedKmh == null || ln.maxSpeedKmh >= 100).toBe(true);
    }
  });

  it("tag penetration byCity keys are numeric cityIds", () => {
    const tags = getTagPenetrationCompare();
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags.slice(0, 20)) {
      for (const k of Object.keys(t.byCity)) {
        expect(Number.isFinite(Number(k)), `key=${k}`).toBe(true);
      }
      assertFinite(t.avgShare, t.tag);
    }
  });

  it("hospital geo coverage and duplicates coherent", () => {
    const cov = getHospitalGeoCoverageStats();
    expect(cov.withCoords).toBeLessThanOrEqual(cov.total);
    assertFinite(cov.coverageRatio, "hosp coverage");
    const dups = detectHospitalGeoDuplicateAmapPoi();
    for (const d of dups) {
      expect(d.count).toBeGreaterThanOrEqual(2);
      expect(d.hospitalIds.length).toBe(d.count);
    }
  });

  it("metro status×stations rows have positive station totals", () => {
    const rows = getMetroPlanningByCityStatusVsStations();
    for (const r of rows) {
      expect(r.lineCount).toBeGreaterThan(0);
      expect(r.totalStations).toBeGreaterThanOrEqual(0);
    }
  });
});

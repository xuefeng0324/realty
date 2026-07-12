/**
 * v0.18.0 map-2: 验证 cluster.ts 的网格聚合算法
 */
import { describe, it, expect } from "vitest";
import { clusterMarkers, clusterCellDeg, type ClusterInputPoint } from "../src/local/cluster";

describe("cluster.ts 网格聚合 (v0.18.0)", () => {
  it("clusterCellDeg: zoom 11 → 0.04°, zoom 14 → 0.005°", () => {
    expect(clusterCellDeg(11)).toBeCloseTo(0.04, 6);
    expect(clusterCellDeg(14)).toBeCloseTo(0.005, 6);
    expect(clusterCellDeg(17)).toBeCloseTo(0.000625, 6);
    // zoom < 11 → clamp 0.04
    expect(clusterCellDeg(9)).toBeCloseTo(0.04, 6);
  });

  it("单点无聚合：原 id 保留", () => {
    const pts: ClusterInputPoint[] = [
      { id: 1, latitude: 22.5, longitude: 114.0, payload: { name: "A" } }
    ];
    const out = clusterMarkers(pts, 11);
    expect(out.length).toBe(1);
    expect(out[0].id).toBe(1);
    expect(out[0].count).toBe(1);
    expect((out[0].payload[0] as { name: string }).name).toBe("A");
  });

  it("2 个点距离 < cell → 聚合成 1 个 cluster, count=2", () => {
    const pts: ClusterInputPoint[] = [
      { id: 1, latitude: 22.5, longitude: 114.0, payload: { name: "A" } },
      { id: 2, latitude: 22.5001, longitude: 114.0001, payload: { name: "B" } }
    ];
    const out = clusterMarkers(pts, 11);
    expect(out.length).toBe(1);
    expect(out[0].count).toBe(2);
    expect(out[0].id).toBeLessThan(0); // synthetic negative id
    expect(out[0].payload.length).toBe(2);
  });

  it("2 个点距离 > cell → 不聚合, 2 个单点", () => {
    const pts: ClusterInputPoint[] = [
      { id: 1, latitude: 22.5, longitude: 114.0, payload: { name: "A" } },
      { id: 2, latitude: 22.6, longitude: 114.2, payload: { name: "B" } }
    ];
    const out = clusterMarkers(pts, 11);
    expect(out.length).toBe(2);
    expect(out[0].count).toBe(1);
    expect(out[1].count).toBe(1);
  });

  it("zoom 越大 → 聚合越少", () => {
    const pts: ClusterInputPoint[] = [
      { id: 1, latitude: 22.5, longitude: 114.0, payload: {} },
      { id: 2, latitude: 22.501, longitude: 114.001, payload: {} },
      { id: 3, latitude: 22.502, longitude: 114.002, payload: {} }
    ];
    // zoom 11: 三点在一个 cell (0.04° cell)
    expect(clusterMarkers(pts, 11).length).toBe(1);
    // zoom 15: cell 0.00125°, 三个点分成 2-3 簇
    const z15 = clusterMarkers(pts, 15);
    expect(z15.length).toBeGreaterThanOrEqual(2);
    // zoom 18: cell 0.000156°, 每个点独立
    expect(clusterMarkers(pts, 18).length).toBe(3);
  });

  it("空输入 → 空输出", () => {
    expect(clusterMarkers([], 11)).toEqual([]);
  });

  it("聚合点 lat/lng = 平均值", () => {
    const pts: ClusterInputPoint[] = [
      { id: 1, latitude: 22.500, longitude: 114.000, payload: {} },
      { id: 2, latitude: 22.501, longitude: 114.001, payload: {} }
    ];
    const out = clusterMarkers(pts, 11);
    expect(out.length).toBe(1);
    expect(out[0].count).toBe(2);
    expect(out[0].latitude).toBeCloseTo(22.5005, 4);
    expect(out[0].longitude).toBeCloseTo(114.0005, 4);
  });
});
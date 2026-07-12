/**
 * map-2 marker 聚合 (v0.18.0)
 * ========================================
 *
 * 思路：用经纬度网格分桶。同一网格内的 marker 合并为 1 个 cluster，显示数量。
 * 网格大小根据 zoom level 计算：zoom 越大（看得越近），网格越小（聚合越少）。
 *
 * 为什么不依赖 uni-app 自带的 marker cluster：
 * - uni-app 的 marker cluster 仅在 App / 小程序支持，H5 不支持
 * - uni-app H5 用的是高德 JS API，我们直接计算网格更可控
 *
 * 算法：
 *   cellDeg = CLUSTER_CELL_DEG / 2^(zoom - 11)
 *   bucket(lat, lng) = (round(lat / cellDeg), round(lng / cellDeg))
 *   - 单点：cluster.count = 1
 *   - 多点：cluster.count > 1, 用桶内中心 (平均 lat/lng)
 */
export interface ClusterInputPoint {
  id: number;
  latitude: number;
  longitude: number;
  /** 透传字段：cluster marker 点击时用 */
  payload?: unknown;
}

export interface ClusterOutputPoint {
  /** 聚合 id: 负值 (-listingId-1) 避免与正常 listingId 冲突 */
  id: number;
  latitude: number;
  longitude: number;
  count: number;
  payload: unknown[];
}

/**
 * zoom 11 (城市级) → cell ≈ 0.04° (≈ 4km)
 * zoom 14 (小区级) → cell ≈ 0.005° (≈ 500m)
 * zoom 16+       → cell ≈ 0.00125° (≈ 130m) — 几乎不聚合
 */
export function clusterCellDeg(zoom: number): number {
  // base 0.04° at zoom 11
  return 0.04 / Math.pow(2, Math.max(0, zoom - 11));
}

export function clusterMarkers(
  points: ClusterInputPoint[],
  zoom: number
): ClusterOutputPoint[] {
  const cell = clusterCellDeg(zoom);
  if (cell <= 0) return [];
  // bucket → list of points
  const buckets = new Map<string, ClusterInputPoint[]>();
  for (const p of points) {
    const key =
      Math.round(p.latitude / cell) + ":" + Math.round(p.longitude / cell);
    const arr = buckets.get(key);
    if (arr) {
      arr.push(p);
    } else {
      buckets.set(key, [p]);
    }
  }
  const out: ClusterOutputPoint[] = [];
  let syntheticId = -1;
  for (const arr of buckets.values()) {
    if (arr.length === 1) {
      const p = arr[0];
      out.push({
        id: p.id,
        latitude: p.latitude,
        longitude: p.longitude,
        count: 1,
        payload: [p.payload]
      });
    } else {
      const sumLat = arr.reduce((s, p) => s + p.latitude, 0);
      const sumLng = arr.reduce((s, p) => s + p.longitude, 0);
      out.push({
        id: syntheticId--,
        latitude: sumLat / arr.length,
        longitude: sumLng / arr.length,
        count: arr.length,
        payload: arr.map((p) => p.payload)
      });
    }
  }
  return out;
}
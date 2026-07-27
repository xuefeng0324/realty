/**
 * v1.121.149 Batch 10: 4 张可视化卡的共享 composable
 *
 * 从 dashboard.vue 抽出 4 张卡的 refs/computed/loaders，供 dashboard
 * 与独立 sub-page pages/trend-analysis/trend-analysis.vue 共享。
 *
 * 包含：
 *  - bedroomArea / orientationFloor / decorateAge / scatter refs
 *  - baMaxCount / SCATTER_W / SCATTER_H / ofCellLabel / daCellClass 等常量/函数
 *  - reloadBedroomArea / reloadOrientationFloor / reloadDecorateAge / reloadScatter
 *  - onCityIdChange 注册函数
 */
import { computed, ref } from "vue";
import {
  getBedroomAreaDistribution,
  getOrientationFloorMatrix,
  getDecorateAgeMatrix,
  getCommunityScatter,
  type BedroomAreaResponse,
  type OrientationFloorResponse,
  type DecorateAgeResponse,
  type CommunityScatterResponse
} from "../local/queries";

const SCATTER_W_DEFAULT = 660;
const SCATTER_H_DEFAULT = 280;

export function useTrendVisualization() {
  const bedroomArea = ref<BedroomAreaResponse | null>(null);
  const orientationFloor = ref<OrientationFloorResponse | null>(null);
  const decorateAge = ref<DecorateAgeResponse | null>(null);
  const scatter = ref<CommunityScatterResponse | null>(null);
  const trendVizLoading = ref<boolean>(false);
  const trendVizError = ref<string | null>(null);

  async function reloadBedroomArea(cityId: number) {
    try {
      bedroomArea.value = await getBedroomAreaDistribution({ cityId });
    } catch (e) {
      console.warn("reloadBedroomArea failed:", e);
    }
  }

  async function reloadOrientationFloor(cityId: number) {
    try {
      orientationFloor.value = await getOrientationFloorMatrix({ cityId });
    } catch (e) {
      console.warn("reloadOrientationFloor failed:", e);
    }
  }

  async function reloadDecorateAge(cityId: number) {
    try {
      decorateAge.value = await getDecorateAgeMatrix({ cityId });
    } catch (e) {
      console.warn("reloadDecorateAge failed:", e);
    }
  }

  async function reloadScatter(cityId: number) {
    try {
      scatter.value = await getCommunityScatter({ cityId });
    } catch (e) {
      console.warn("reloadScatter failed:", e);
    }
  }

  async function reloadAll(cityId: number) {
    trendVizLoading.value = true;
    trendVizError.value = null;
    await Promise.all([
      reloadBedroomArea(cityId),
      reloadOrientationFloor(cityId),
      reloadDecorateAge(cityId),
      reloadScatter(cityId)
    ]);
    trendVizLoading.value = false;
  }

  // 共享 computed/helper
  const baMaxCount = computed<number>(() => {
    if (!bedroomArea.value) return 0;
    let m = 0;
    for (const row of bedroomArea.value.grid) {
      for (const cell of row) {
        if (cell.count > m) m = cell.count;
      }
    }
    return m;
  });

  const SCATTER_W = SCATTER_W_DEFAULT;
  const SCATTER_H = SCATTER_H_DEFAULT;

  function ofCellLabel(cellLabel: string, ratio: number | null): string {
    if (ratio == null) return cellLabel;
    const pct = ratio * 100;
    const sign = pct > 0 ? "+" : "";
    return `${cellLabel} ${sign}${pct.toFixed(1)}%`;
  }

  function daCellClass(ratio: number | null): string {
    if (ratio == null) return "";
    if (ratio > 0.01) return "da-cell--up";
    if (ratio < -0.01) return "da-cell--down";
    return "da-cell--flat";
  }

  // 散点分布 cohort 计算 (与 dashboard 一致)
  function scatterImproveCohort() {
    if (!scatter.value) return [];
    return scatter.value.points.map((p) => {
      let cohort = "mid";
      if (p.medianUnitPrice < scatter.value!.cityMedianUnit * 0.9) cohort = "value";
      else if (p.medianUnitPrice > scatter.value!.cityMedianUnit * 1.1) cohort = "premium";
      return { x: p.medianUnitPrice, y: p.medianTotalPrice10w * 10000, cohort };
    });
  }

  function scatterValueDip(): { count: number } {
    if (!scatter.value) return { count: 0 };
    const low = scatter.value.points.filter((p) => p.medianUnitPrice < scatter.value!.cityMedianUnit * 0.9);
    return { count: low.length };
  }

  return {
    // refs
    bedroomArea,
    orientationFloor,
    decorateAge,
    scatter,
    trendVizLoading,
    trendVizError,
    // loaders
    reloadBedroomArea,
    reloadOrientationFloor,
    reloadDecorateAge,
    reloadScatter,
    reloadAll,
    // helpers
    baMaxCount,
    SCATTER_W,
    SCATTER_H,
    ofCellLabel,
    daCellClass,
    scatterImproveCohort,
    scatterValueDip
  };
}
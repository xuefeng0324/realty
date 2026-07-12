import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { STORAGE_KEYS } from "../config";

/**
 * 全局筛选状态（城市、周期、数据来源、指标），持久化到 storage，
 * 保证各页面一致。
 */
export const useAppStore = defineStore("app", () => {
  const cityId = ref<number>(1);
  const weekEnd = ref<string>("");
  const source = ref<string>("");
  const metric = ref<"avg_unit_price" | "listing_count">("avg_unit_price");

  // 合法城市 ID 集合（深 2 / 广 1 / 珠 3）；载入时校验避免 localStorage 被脏写
  const VALID_CITY_IDS = new Set([1, 2, 3]);

  const cityIdInit = uni.getStorageSync(STORAGE_KEYS.cityId);
  if (typeof cityIdInit === "number" && VALID_CITY_IDS.has(cityIdInit)) {
    cityId.value = cityIdInit;
  } else if (typeof cityIdInit === "number") {
    // 无效值，清理 storage 避免下次仍出错
    try { uni.removeStorageSync(STORAGE_KEYS.cityId); } catch (_) {}
  }

  const weekEndInit = uni.getStorageSync(STORAGE_KEYS.weekEnd);
  if (typeof weekEndInit === "string") weekEnd.value = weekEndInit;

  const sourceInit = uni.getStorageSync(STORAGE_KEYS.source);
  if (typeof sourceInit === "string") source.value = sourceInit;

  const metricInit = uni.getStorageSync(STORAGE_KEYS.metric);
  if (metricInit === "avg_unit_price" || metricInit === "listing_count") metric.value = metricInit;

  function setCityId(v: number) {
    // 防御性：拒绝非法值
    if (!VALID_CITY_IDS.has(v)) {
      console.warn(`[app store] setCityId rejected invalid value: ${v}`);
      return;
    }
    cityId.value = v;
    uni.setStorageSync(STORAGE_KEYS.cityId, v);
  }
  function setWeekEnd(v: string) {
    weekEnd.value = v;
    uni.setStorageSync(STORAGE_KEYS.weekEnd, v);
  }
  function setSource(v: string) {
    source.value = v;
    uni.setStorageSync(STORAGE_KEYS.source, v);
  }
  function setMetric(v: "avg_unit_price" | "listing_count") {
    metric.value = v;
    uni.setStorageSync(STORAGE_KEYS.metric, v);
  }

  const queryParams = computed(() => ({
    cityId: cityId.value,
    weekEnd: weekEnd.value,
    source: source.value || undefined,
    metric: metric.value
  }));

  return {
    cityId,
    weekEnd,
    source,
    metric,
    queryParams,
    setCityId,
    setWeekEnd,
    setSource,
    setMetric
  };
});
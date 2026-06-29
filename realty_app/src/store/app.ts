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

  const cityIdInit = uni.getStorageSync(STORAGE_KEYS.cityId);
  if (typeof cityIdInit === "number") cityId.value = cityIdInit;

  const weekEndInit = uni.getStorageSync(STORAGE_KEYS.weekEnd);
  if (typeof weekEndInit === "string") weekEnd.value = weekEndInit;

  const sourceInit = uni.getStorageSync(STORAGE_KEYS.source);
  if (typeof sourceInit === "string") source.value = sourceInit;

  const metricInit = uni.getStorageSync(STORAGE_KEYS.metric);
  if (metricInit === "avg_unit_price" || metricInit === "listing_count") metric.value = metricInit;

  function setCityId(v: number) {
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
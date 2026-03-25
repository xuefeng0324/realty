<template>
  <div style="padding: 16px">
    <div style="margin-bottom: 12px">
      <button @click="goBackSafe">返回</button>
    </div>
    <h2 style="margin: 0 0 12px">社区详情（{{ communityId }}）</h2>

    <div v-if="loading">加载中...</div>

    <div v-else>
      <div style="display: grid; grid-template-columns: 1fr; gap: 16px">
        <div style="border: 1px solid #eee; padding: 12px; border-radius: 8px">
          <h3 style="margin: 0 0 12px">价格走势</h3>
          <div ref="priceTrendRef" style="height: 320px"></div>
        </div>

        <div style="border: 1px solid #eee; padding: 12px; border-radius: 8px">
          <h3 style="margin: 0 0 12px">质量分分布</h3>
          <div ref="qualityDistRef" style="height: 320px"></div>
        </div>

        <div style="border: 1px solid #eee; padding: 12px; border-radius: 8px">
          <h3 style="margin: 0 0 12px">优缺点评分雷达（维度固定）</h3>
          <div ref="radarRef" style="height: 320px"></div>
        </div>

        <div style="border: 1px solid #eee; padding: 12px; border-radius: 8px">
          <h3 style="margin: 0 0 12px">Top 优/缺点标签</h3>
          <div style="display: flex; gap: 24px; flex-wrap: wrap">
            <div>
              <h4 style="margin: 0 0 8px">优点</h4>
              <div v-for="t in topTags.advantages" :key="'a'+t.label">
                {{ t.label }}（{{ t.count }}）
              </div>
            </div>
            <div>
              <h4 style="margin: 0 0 8px">缺点</h4>
              <div v-for="t in topTags.disadvantages" :key="'d'+t.label">
                {{ t.label }}（{{ t.count }}）
              </div>
            </div>
          </div>
        </div>

        <div style="border: 1px solid #eee; padding: 12px; border-radius: 8px">
          <h3 style="margin: 0 0 12px">房源筛选（MVP：按质量分）</h3>
          <div style="display:flex; gap:12px; align-items:center; flex-wrap: wrap;">
            <label>
              最低质量分
              <input type="number" v-model.number="minQuality" style="margin-left: 8px; width: 120px" />
            </label>
            <label>
              最高质量分
              <input
                type="number"
                v-model="maxQualityRaw"
                placeholder="不填"
                style="margin-left: 8px; width: 120px"
              />
            </label>
            <label>
              最低总价(万)
              <input type="number" v-model.number="minTotalPrice" style="margin-left: 8px; width: 120px" />
            </label>
            <label>
              最高总价(万)
              <input
                type="number"
                v-model="maxTotalPriceRaw"
                placeholder="不填"
                style="margin-left: 8px; width: 120px"
              />
            </label>
            <label>
              最低面积(㎡)
              <input type="number" v-model.number="minArea" style="margin-left: 8px; width: 120px" />
            </label>
            <label>
              最高面积(㎡)
              <input type="number" v-model="maxAreaRaw" placeholder="不填" style="margin-left: 8px; width: 120px" />
            </label>
            <label>
              房源类型
              <select v-model="listingType" @change="loadListings" style="margin-left: 8px; width: 140px">
                <option value="all">全部</option>
                <option value="second_hand">二手房</option>
                <option value="new_house">新房</option>
              </select>
            </label>
            <button @click="loadListings" :disabled="tableLoading">搜索</button>
          </div>
          <div style="margin-top: 12px">
            <div>总数：{{ listings.total }}</div>
            <div
              v-if="!tableLoading && listings.total === 0"
              style="margin-top: 8px; color: #6b7280"
            >
              暂无该房源类型的数据（房源类型：{{ listingTypeLabel(listingType) }}）
            </div>
            <div v-if="tableError" style="margin-top: 8px; color: #b91c1c">{{ tableError }}</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px">
              <thead>
                <tr>
                  <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">标题</th>
                  <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">类型</th>
                  <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">质量分</th>
                  <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">单价</th>
                  <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">总价(万)</th>
                  <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">面积(㎡)</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="it in listings.items"
                  :key="it.listing_id"
                  style="cursor: pointer"
                  @click="openListingDetail(it.listing_id)"
                >
                  <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ it.title }}</td>
                  <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ listingTypeLabel(it.listing_type) }}</td>
                  <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ it.quality_score }}</td>
                  <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ it.unit_price ?? "-" }}</td>
                  <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ it.price_total ?? "-" }}</td>
                  <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ it.area_sqm ?? "-" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style="border: 1px solid #eee; padding: 12px; border-radius: 8px">
          <h3 style="margin: 0 0 12px">房源详情（点击上方表格行）</h3>
          <div v-if="detailLoading">加载房源详情中...</div>
          <div v-else-if="!selectedListingDetail" style="opacity: 0.8">请选择一条房源查看完整解释。</div>
          <div v-else>
            <div style="display:flex; justify-content: space-between; align-items:center; gap: 12px">
              <strong>{{ selectedListingDetail.listing.title }}</strong>
              <div style="display: flex; gap: 8px">
                <a
                  v-if="selectedListingDetail.listing.source_url"
                  :href="selectedListingDetail.listing.source_url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <button>打开源链接</button>
                </a>
                <button @click="closeListingDetail">关闭</button>
              </div>
            </div>
            <div style="margin-top: 8px; font-size: 14px; opacity: 0.9">
              质量总分：{{ selectedListingDetail.score.overall_score_0_100 }} |
              规则版本：{{ selectedListingDetail.score.rule_version }} |
              期别：{{ selectedListingDetail.score.computed_week_end_date }}
            </div>

            <div style="margin-top: 12px">
              <strong>维度评分与贡献</strong>
              <table style="width: 100%; border-collapse: collapse; margin-top: 6px">
                <thead>
                  <tr>
                    <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">维度</th>
                    <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">评分</th>
                    <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">贡献分</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in dimensionRows(selectedListingDetail)" :key="r.key">
                    <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ r.label }}</td>
                    <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ toFixedNum(r.score, 1) }}</td>
                    <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ toFixedNum(r.contrib, 2) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="margin-top: 12px; display:flex; gap: 24px; flex-wrap: wrap">
              <div style="flex: 1; min-width: 320px">
                <strong>优点标签</strong>
                <div
                  v-for="(a, idx) in selectedListingDetail.score.advantages_json"
                  :key="'adv'+idx"
                  style="margin-top: 8px; border: 1px solid #2e7d32; border-radius: 8px; padding: 8px"
                >
                  <div style="display: flex; justify-content: space-between; gap: 8px; font-weight: 600">
                    <span>{{ a.label }}</span>
                    <span :style="confidenceBadgeStyle(a.confidence)">置信 {{ toFixedNum(a.confidence, 2) }}</span>
                  </div>
                  <div style="margin-top: 4px; font-size: 12px; opacity: 0.85">
                    规则：<code>{{ a?.evidence?.rule ?? "-" }}</code>
                  </div>
                  <table
                    v-if="evidenceRows(a).length"
                    style="width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px"
                  >
                    <tbody>
                      <tr v-for="ev in evidenceRows(a)" :key="'aev'+idx+ev.key">
                        <td style="border-top: 1px dashed #3f3f46; padding: 4px 6px; opacity: 0.8">{{ ev.key }}</td>
                        <td style="border-top: 1px dashed #3f3f46; padding: 4px 6px">{{ ev.value }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div style="flex: 1; min-width: 320px">
                <strong>缺点标签</strong>
                <div
                  v-for="(d, idx) in selectedListingDetail.score.disadvantages_json"
                  :key="'dis'+idx"
                  style="margin-top: 8px; border: 1px solid #9f1239; border-radius: 8px; padding: 8px"
                >
                  <div style="display: flex; justify-content: space-between; gap: 8px; font-weight: 600">
                    <span>{{ d.label }}</span>
                    <span :style="confidenceBadgeStyle(d.confidence)">置信 {{ toFixedNum(d.confidence, 2) }}</span>
                  </div>
                  <div style="margin-top: 4px; font-size: 12px; opacity: 0.85">
                    规则：<code>{{ d?.evidence?.rule ?? "-" }}</code>
                  </div>
                  <table
                    v-if="evidenceRows(d).length"
                    style="width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px"
                  >
                    <tbody>
                      <tr v-for="ev in evidenceRows(d)" :key="'dev'+idx+ev.key">
                        <td style="border-top: 1px dashed #3f3f46; padding: 4px 6px; opacity: 0.8">{{ ev.key }}</td>
                        <td style="border-top: 1px dashed #3f3f46; padding: 4px 6px">{{ ev.value }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div style="margin-top: 12px">
              <strong>输入快照</strong>
              <pre style="white-space: pre-wrap; word-break: break-word; margin-top: 6px">{{ JSON.stringify(selectedListingDetail.score.explain_json?.inputs_snapshot ?? {}, null, 2) }}</pre>
            </div>
            <details style="margin-top: 12px">
              <summary style="cursor: pointer">查看完整 explain_json（原始）</summary>
              <pre style="white-space: pre-wrap; word-break: break-word; margin-top: 6px">{{ JSON.stringify(selectedListingDetail.score.explain_json, null, 2) }}</pre>
            </details>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import * as echarts from "echarts";
import { useRoute, useRouter } from "vue-router";

import type { TopTagsResponse, QualitySummaryResponse, CommunityPriceTrendResponse } from "../api/contracts";
import { getQualitySummary, getQualitySummaryFiltered, getTopTags } from "../api/communities";
import { getCommunityPriceTrend, getCommunityPriceTrendFiltered } from "../api/stats";
import { filterListings, getListingDetail } from "../api/listings";

const route = useRoute();
const router = useRouter();
const communityId = computed(() => Number(route.params.communityId));

function goBackSafe() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: "Dashboard" });
  }
}

const loading = ref(false);
const weekEnd = ref<string>(""); // for listings; for price trend we just use last window
const topTags = ref<TopTagsResponse>({ communityId: 0, advantages: [], disadvantages: [] });
const priceTrend = ref<CommunityPriceTrendResponse | null>(null);
const qualitySummary = ref<QualitySummaryResponse | null>(null);

const minQuality = ref<number>(60);
const maxQualityRaw = ref<string>("");
const minTotalPrice = ref<number>(0);
const maxTotalPriceRaw = ref<string>("");
const minArea = ref<number>(0);
const maxAreaRaw = ref<string>("");
const listings = ref<any>({ total: 0, items: [] });
const selectedListingDetail = ref<any | null>(null);
const detailLoading = ref<boolean>(false);
const tableLoading = ref<boolean>(false);
const tableError = ref<string>("");
const MIN_QUALITY_KEY_PREFIX = "realty_min_quality_v1_community_";
const LISTING_TYPE_KEY_PREFIX = "realty_listing_type_v1_community_";
const listingType = ref<string>("second_hand");

function listingTypeLabel(v: any): string {
  if (v === "second_hand") return "二手房";
  if (v === "new_house") return "新房";
  if (v === "all") return "全部";
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

function parseOptionalNumber(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const DIMENSION_LABELS: Record<string, string> = {
  location_score: "区位",
  house_quality_score: "房屋条件",
  building_age_score: "楼龄",
  amenity_score: "配套",
  price_value_score: "性价比"
};

function toFixedNum(v: any, digits = 1): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

function dimensionRows(detail: any): Array<{ key: string; label: string; score: any; contrib: any }> {
  const explain = detail?.score?.explain_json || {};
  const scores = explain.dimension_scores || {};
  const contrib = explain.dimension_contributions || {};
  const keys = Object.keys(scores);
  return keys.map((k: string) => {
    const cKey = k.replace("_score", "_contrib");
    return {
      key: k,
      label: DIMENSION_LABELS[k] || k,
      score: scores[k],
      contrib: contrib[cKey]
    };
  });
}

function evidenceRows(item: any): Array<{ key: string; value: any }> {
  const e = item?.evidence || {};
  return Object.keys(e)
    .filter((k) => k !== "rule")
    .map((k) => ({ key: k, value: e[k] }));
}

function confidenceBadgeStyle(confidence: any): Record<string, string> {
  const c = Number(confidence);
  let bg = "#374151";
  let color = "#e5e7eb";
  if (Number.isFinite(c) && c >= 0.9) {
    bg = "#14532d";
    color = "#bbf7d0";
  } else if (Number.isFinite(c) && c >= 0.7) {
    bg = "#78350f";
    color = "#fde68a";
  }
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "999px",
    background: bg,
    color,
    fontSize: "12px",
    lineHeight: "18px"
  };
}

const priceTrendRef = ref<HTMLElement | null>(null);
const qualityDistRef = ref<HTMLElement | null>(null);
const radarRef = ref<HTMLElement | null>(null);

let priceChart: echarts.ECharts | null = null;
let qualityChart: echarts.ECharts | null = null;
let radarChart: echarts.ECharts | null = null;

async function reloadChartsWithMinQuality() {
  const cid = communityId.value;
  // Keep the same weekEnd used by the listings filter.
  const we = weekEnd.value;
  const minQ = minQuality.value;
  const maxQ = parseOptionalNumber(maxQualityRaw.value);

  // 1) price trend filtered
  priceTrend.value = await getCommunityPriceTrendFiltered({
    communityId: cid,
    periodType: "weekly",
    weekEnd: we,
    minQualityScore: minQ,
    ...(maxQ !== null ? { maxQualityScore: maxQ } : {}),
    listingType: listingType.value,
  } as any);

  // 2) quality distribution filtered (same weekEnd)
  qualitySummary.value = await getQualitySummaryFiltered({
    communityId: cid,
    weekEnd: we,
    minQualityScore: minQ,
    ...(maxQ !== null ? { maxQualityScore: maxQ } : {}),
    periodType: "weekly",
    includeRadar: true,
    listingType: listingType.value,
  } as any);

  await nextTick();
  renderCharts();
}

async function loadAll() {
  loading.value = true;
  try {
    const cid = communityId.value;
    // default: ask last 2 months; backend will clip by exists
    priceTrend.value = await getCommunityPriceTrend({
      communityId: cid,
      periodType: "weekly",
      // backend requires endDate or weekEnd; we start with "today", then infer actual weekEnd from series.
      weekEnd: new Date().toISOString().slice(0, 10)
    } as any);

    // quality summary (last 30d)
    qualitySummary.value = await getQualitySummary({
      communityId: cid,
      days: 30,
      periodType: "weekly",
      includeRadar: true
    });

    topTags.value = await getTopTags({ communityId: cid, limit: 10 });

    // listings: infer weekEnd from the latest available price-trend point
    const lastPoint = priceTrend.value?.data?.[priceTrend.value.data.length - 1];
    weekEnd.value = lastPoint?.period_end ?? new Date().toISOString().slice(0, 10);
    await loadListings();
  } finally {
    loading.value = false;
  }
  // render after loading=false so chart containers exist in DOM
  await nextTick();
  renderCharts();
}

function renderCharts() {
  if (priceTrend.value && priceTrendRef.value) {
    priceChart = priceChart ?? echarts.init(priceTrendRef.value);
    const x = priceTrend.value.data.map((d) => d.period_end);
    const y = priceTrend.value.data.map((d) => d.avg_unit_price ?? 0);
    priceChart.setOption({
      textStyle: { fontFamily: "Microsoft YaHei, sans-serif" },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: x, axisLabel: { fontFamily: "Microsoft YaHei, sans-serif" } },
      yAxis: { type: "value", name: "均价(元/㎡)" },
      series: [{ type: "line", data: y, smooth: true }]
    });
  }

  if (qualitySummary.value && qualityDistRef.value) {
    qualityChart = qualityChart ?? echarts.init(qualityDistRef.value);
    const bins = qualitySummary.value.bins;
    qualityChart.setOption({
      textStyle: { fontFamily: "Microsoft YaHei, sans-serif" },
      tooltip: { trigger: "item" },
      xAxis: { type: "category", data: bins.map((b) => b.bin), axisLabel: { fontFamily: "Microsoft YaHei, sans-serif" } },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: bins.map((b) => b.count) }]
    });
  }

  if (qualitySummary.value?.radar && radarRef.value) {
    radarChart = radarChart ?? echarts.init(radarRef.value);
    const radar = qualitySummary.value.radar;
    // Radar dimensions come from backend JSON keys (e.g. location_score); map to Chinese display labels.
    const indicators = radar.dimensions.map((d) => ({ name: DIMENSION_LABELS[d] || d, max: 100 }));
    const values = radar.dimensions.map((d) => radar.values[d]?.avg ?? 0);
    radarChart.setOption({
      tooltip: {},
      textStyle: { fontFamily: "Microsoft YaHei, sans-serif" },
      radar: { indicator: indicators },
      series: [
        {
          type: "radar",
          data: [{ value: values, name: "均值" }]
        }
      ]
    });
  }
}

async function loadListings() {
  tableLoading.value = true;
  tableError.value = "";
  const cid = communityId.value;
  const maxQ = parseOptionalNumber(maxQualityRaw.value);
  const maxTotal = parseOptionalNumber(maxTotalPriceRaw.value);
  const maxArea = parseOptionalNumber(maxAreaRaw.value);
  const priceMax = maxTotal ?? 99999;
  const areaMax = maxArea ?? 100000;
  try {
    const res = await filterListings({
      communityId: cid,
      periodType: "weekly",
      weekEnd: weekEnd.value,
      page: 1,
      pageSize: 20,
      filters: {
        minQualityScore: minQuality.value,
        ...(maxQ !== null ? { maxQualityScore: maxQ } : {}),
        ...(listingType.value && listingType.value !== "all" ? { listingType: listingType.value } : {}),
        priceRange: [Math.max(0, minTotalPrice.value || 0), priceMax],
        areaRange: [Math.max(0, minArea.value || 0), areaMax],
      },
      sort: { field: "overall_score", direction: "desc" }
    });
    listings.value = res;
    // Keep charts consistent with the table minQuality filter.
    await reloadChartsWithMinQuality();
  } catch (e: any) {
    tableError.value = e?.message ? String(e.message) : String(e);
  } finally {
    tableLoading.value = false;
  }
}

async function openListingDetail(listingId: number) {
  detailLoading.value = true;
  try {
    selectedListingDetail.value = await getListingDetail(listingId, weekEnd.value);
  } finally {
    detailLoading.value = false;
  }
}

function closeListingDetail() {
  selectedListingDetail.value = null;
}

onMounted(() => {
  try {
    const k = `${MIN_QUALITY_KEY_PREFIX}${communityId.value}`;
    const raw = localStorage.getItem(k);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        minQuality.value = n;
      }
    }
    const rawTotal = localStorage.getItem(`${k}_minTotalPrice`);
    if (rawTotal !== null) {
      const n2 = Number(rawTotal);
      if (Number.isFinite(n2)) minTotalPrice.value = n2;
    }
    const rawArea = localStorage.getItem(`${k}_minArea`);
    if (rawArea !== null) {
      const n3 = Number(rawArea);
      if (Number.isFinite(n3)) minArea.value = n3;
    }

    const rawMaxQ = localStorage.getItem(`${k}_maxQuality`);
    if (rawMaxQ !== null) maxQualityRaw.value = rawMaxQ;

    const rawMaxTotal = localStorage.getItem(`${k}_maxTotalPrice`);
    if (rawMaxTotal !== null) maxTotalPriceRaw.value = rawMaxTotal;

    const rawMaxArea = localStorage.getItem(`${k}_maxArea`);
    if (rawMaxArea !== null) maxAreaRaw.value = rawMaxArea;

    const rawListingType = localStorage.getItem(`${LISTING_TYPE_KEY_PREFIX}${communityId.value}`);
    if (rawListingType && ["all", "second_hand", "new_house"].includes(rawListingType)) {
      listingType.value = rawListingType;
    }
  } catch {
    // ignore storage failure
  }
  loadAll();
});

watch(minQuality, (v) => {
  try {
    const k = `${MIN_QUALITY_KEY_PREFIX}${communityId.value}`;
    localStorage.setItem(k, String(v));
  } catch {
    // ignore storage failure
  }
});

watch(minTotalPrice, (v) => {
  try {
    const k = `${MIN_QUALITY_KEY_PREFIX}${communityId.value}`;
    localStorage.setItem(`${k}_minTotalPrice`, String(v));
  } catch {
    // ignore storage failure
  }
});

watch(minArea, (v) => {
  try {
    const k = `${MIN_QUALITY_KEY_PREFIX}${communityId.value}`;
    localStorage.setItem(`${k}_minArea`, String(v));
  } catch {
    // ignore storage failure
  }
});

watch(maxQualityRaw, (v) => {
  try {
    const k = `${MIN_QUALITY_KEY_PREFIX}${communityId.value}`;
    localStorage.setItem(`${k}_maxQuality`, String(v ?? ""));
  } catch {
    // ignore storage failure
  }
});

watch(maxTotalPriceRaw, (v) => {
  try {
    const k = `${MIN_QUALITY_KEY_PREFIX}${communityId.value}`;
    localStorage.setItem(`${k}_maxTotalPrice`, String(v ?? ""));
  } catch {
    // ignore storage failure
  }
});

watch(maxAreaRaw, (v) => {
  try {
    const k = `${MIN_QUALITY_KEY_PREFIX}${communityId.value}`;
    localStorage.setItem(`${k}_maxArea`, String(v ?? ""));
  } catch {
    // ignore storage failure
  }
});

watch(listingType, (v) => {
  try {
    localStorage.setItem(`${LISTING_TYPE_KEY_PREFIX}${communityId.value}`, String(v));
  } catch {
    // ignore storage failure
  }
});
</script>

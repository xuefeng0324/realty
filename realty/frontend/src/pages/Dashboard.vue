<template>
  <div style="padding: 16px">
    <h2 style="margin: 0 0 12px">Realty Dashboard</h2>
    <div v-if="runtimeMeta" style="font-size: 12px; opacity: 0.8; margin: 0 0 10px">
      DB: {{ runtimeMeta.database_file || runtimeMeta.database_url }} |
      规则: {{ runtimeMeta.rule_version_listing }} / {{ runtimeMeta.rule_version_school }} |
      数据量: 城市 {{ runtimeMeta.data_counts.cities }} / 小区 {{ runtimeMeta.data_counts.communities }} / 房源 {{ runtimeMeta.data_counts.listings }} |
      服务日期: {{ runtimeMeta.server_date }}
    </div>
    <div
      v-if="coverageMeta"
      style="font-size: 12px; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 8px 10px; margin: 0 0 12px"
    >
      来源：{{ coverageMeta.source_used || "全部" }}；
      覆盖率：{{ coverageMeta.covered_districts }}/{{ coverageMeta.total_districts }} 区
      （{{ (coverageMeta.coverage_ratio * 100).toFixed(1) }}%）；
      空区：{{ coverageMeta.empty_districts.length }}
      <span v-if="coverageMeta.empty_districts.length > 0">
        ｜{{ coverageMeta.empty_districts.slice(0, 8).join("、") }}{{ coverageMeta.empty_districts.length > 8 ? "..." : "" }}
      </span>
      <div
        v-if="coverageMeta.district_community_gaps?.length"
        style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #475569"
      >
        <div style="margin-bottom: 6px">小区缺失热力清单（Top 6）</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px">
          <thead>
            <tr>
              <th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid #334155">区</th>
              <th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid #334155">小区总数</th>
              <th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid #334155">有房源小区</th>
              <th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid #334155">缺失小区</th>
              <th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid #334155">覆盖率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in coverageMeta.district_community_gaps.slice(0, 6)" :key="g.district_name">
              <td style="padding: 4px 6px; border-bottom: 1px solid #1e293b">{{ g.district_name }}</td>
              <td style="padding: 4px 6px; border-bottom: 1px solid #1e293b">{{ g.community_total }}</td>
              <td style="padding: 4px 6px; border-bottom: 1px solid #1e293b">{{ g.community_with_listing }}</td>
              <td style="padding: 4px 6px; border-bottom: 1px solid #1e293b; color: #fca5a5">{{ g.community_missing_listing }}</td>
              <td style="padding: 4px 6px; border-bottom: 1px solid #1e293b">{{ (g.community_coverage_ratio * 100).toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 16px">
      <label>
        城市
        <select v-model.number="cityId" style="margin-left: 8px">
          <option v-for="c in cities" :key="c.city_id" :value="c.city_id">{{ c.city_name }}</option>
        </select>
      </label>

      <label>
        周期结束日
        <select v-model="weekEnd" style="margin-left: 8px">
          <option v-for="p in periodItems" :key="p" :value="p">{{ p }}</option>
        </select>
      </label>

      <label>
        指标
        <select v-model="metric" style="margin-left: 8px">
          <option value="avg_unit_price">均价</option>
          <option value="listing_count">挂牌数</option>
        </select>
      </label>

      <label>
        数据来源
        <select v-model="sourceFilter" style="margin-left: 8px">
          <option value="">全部</option>
          <option v-for="s in sourceOptions" :key="s.source || '__empty'" :value="s.source">
            {{ s.source || "(空来源)" }} ({{ s.listing_count }})
          </option>
        </select>
      </label>

      <label>
        每页
        <select v-model.number="rankingPageSize" style="margin-left: 8px">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
      </label>

      <button @click="load">刷新</button>
    </div>

    <div v-if="loading" style="margin: 8px 0">加载中...</div>
    <div v-if="errorMsg" style="margin: 8px 0; color: #b00020">{{ errorMsg }}</div>

    <div style="display: grid; grid-template-columns: 1fr; gap: 16px">
      <div style="border: 1px solid #eee; padding: 12px; border-radius: 8px">
        <h3 style="margin: 0 0 12px">区/板块对比</h3>
        <div style="font-size: 12px; color: #e5e7eb; margin-bottom: 6px">
          {{ metric === "listing_count" ? "挂牌数" : "均价(元/㎡)" }}
        </div>
        <div :style="{ height: '320px' }" ref="districtChartRef"></div>
      </div>

      <div style="border: 1px solid #eee; padding: 12px; border-radius: 8px">
        <h3 style="margin: 0 0 12px">小区排行（Top {{ topN }}）</h3>
        <table style="width: 100%; border-collapse: collapse">
          <thead>
            <tr>
              <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">#</th>
              <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">小区</th>
              <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">均价(元/㎡)</th>
              <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">挂牌数</th>
              <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">置信</th>
              <th style="border-bottom: 1px solid #ddd; text-align: left; padding: 8px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in ranking.data"
              :key="item.community_id"
              @click="goCommunity(item.community_id)"
              style="cursor: pointer"
            >
              <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ item.rank }}</td>
              <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ item.community_name }}</td>
              <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ item.avg_unit_price ?? "-" }}</td>
              <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ item.listing_count }}</td>
              <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">{{ item.coverage_score ?? "-" }}</td>
              <td style="border-bottom: 1px solid #f0f0f0; padding: 8px">
                <button @click.stop="goCommunity(item.community_id)">查看详情</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top: 10px; display: flex; align-items: center; gap: 12px">
          <button @click="prevPage" :disabled="rankingPage <= 1">上一页</button>
          <span>第 {{ rankingPage }} 页 / 共 {{ totalPages }} 页</span>
          <button @click="nextPage" :disabled="rankingPage >= totalPages">下一页</button>
          <span style="opacity: 0.8">共 {{ ranking.total || ranking.data?.length || 0 }} 条</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import * as echarts from "echarts";
import { useRouter } from "vue-router";

import type { CityItem, CoverageResponse, RuntimeMetaResponse, SourceStatItem } from "../api/contracts";
import { getCities, getCoverage, getPeriods, getRuntimeMeta, getSources } from "../api/meta";
import { getCommunityRanking, getDistrictCompare } from "../api/stats";

const router = useRouter();

const cities = ref<CityItem[]>([]);
const cityId = ref<number>(1);
const periodItems = ref<string[]>([]);
const weekEnd = ref<string>("");
const metric = ref<"avg_unit_price" | "listing_count">("avg_unit_price");
const topN = ref<number>(20);
const sourceFilter = ref<string>("");
const sourceOptions = ref<SourceStatItem[]>([]);
const rankingPage = ref<number>(1);
const rankingPageSize = ref<number>(10);

const ranking = ref<any>({ data: [] });
const districtChartRef = ref<HTMLElement | null>(null);
let districtChart: echarts.ECharts | null = null;

const loading = ref(false);
const errorMsg = ref<string | null>(null);
const runtimeMeta = ref<RuntimeMetaResponse | null>(null);
const coverageMeta = ref<CoverageResponse | null>(null);
const totalPages = ref<number>(1);
const DASHBOARD_STATE_KEY = "realty_dashboard_state_v1";

function getDistrictChartAxis(m: "avg_unit_price" | "listing_count") {
  if (m === "listing_count") {
    return { yLabel: "挂牌数", getY: (i: any) => (i.listing_count ?? null) as number | null };
  }
  return { yLabel: "均价(元/㎡)", getY: (i: any) => (i.avg_unit_price ?? null) as number | null };
}

async function loadPeriods() {
  errorMsg.value = null;
  try {
    const res = await getPeriods({ type: "weekly", cityId: cityId.value, limit: 20 });
    periodItems.value = res.items || [];
    if (!weekEnd.value && periodItems.value.length > 0) {
      weekEnd.value = periodItems.value[periodItems.value.length - 1];
    }
  } catch (e: any) {
    errorMsg.value = `加载周期失败：${e?.message || String(e)}`;
  }
}

async function loadSources() {
  try {
    const res = await getSources({ cityId: cityId.value });
    sourceOptions.value = res.items || [];
    if (sourceFilter.value && !sourceOptions.value.some((s) => s.source === sourceFilter.value)) {
      sourceFilter.value = "";
    }
  } catch {
    sourceOptions.value = [];
  }
}

async function load() {
  if (!weekEnd.value) {
    errorMsg.value = "weekEnd 为空，无法加载数据。";
    return;
  }
  loading.value = true;
  try {
    errorMsg.value = null;
    ranking.value = await getCommunityRanking({
      cityId: cityId.value,
      periodType: "weekly",
      weekEnd: weekEnd.value,
      metric: metric.value,
      top: topN.value,
      page: rankingPage.value,
      pageSize: rankingPageSize.value,
      source: sourceFilter.value || undefined
    });
    const total = Number(ranking.value?.total || ranking.value?.data?.length || 0);
    totalPages.value = Math.max(1, Math.ceil(total / rankingPageSize.value));

    const district = await getDistrictCompare({
      cityId: cityId.value,
      periodType: "weekly",
      weekEnd: weekEnd.value,
      source: sourceFilter.value || undefined
    });
    try {
      coverageMeta.value = await getCoverage({
        cityId: cityId.value,
        source: sourceFilter.value || undefined
      });
    } catch {
      coverageMeta.value = null;
    }

    // render district chart
    if (districtChartRef.value) {
      // If DOM node changed (e.g. hot reload), re-create chart instance.
      if (!districtChart || districtChart.getDom() !== districtChartRef.value) {
        if (districtChart) {
          districtChart.dispose();
        }
        districtChart = echarts.init(districtChartRef.value);
      }
      const axis = getDistrictChartAxis(metric.value);
      const x = district.items.map((i: any) => i.district_name);
      const y = district.items.map((i: any) => axis.getY(i));

      // Keep x/y length consistent; let ECharts handle null as gaps.
      const safeX = x.length > 0 ? x : ["暂无数据"];
      const safeY = y.length > 0 ? y : [null];

      districtChart.clear();
      districtChart.setOption({
        tooltip: { trigger: "axis" },
        textStyle: { fontFamily: "Microsoft YaHei, sans-serif" },
        grid: { left: 64, right: 28, top: 12, bottom: 56, containLabel: true },
        xAxis: {
          type: "category",
          data: safeX,
          axisLabel: {
            interval: 0,
            rotate: 30,
            fontFamily: "Microsoft YaHei, sans-serif",
            color: "#e5e7eb"
          },
          axisLine: { lineStyle: { color: "#6b7280" } }
        },
        yAxis: {
          type: "value",
          min: 0,
          axisLabel: { color: "#e5e7eb" },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
          axisLine: { lineStyle: { color: "#6b7280" } }
        },
        series: [
          {
            type: "bar",
            data: safeY,
            barMaxWidth: 72,
            barMinHeight: 6,
            itemStyle: { color: "#4ade80" }
          }
        ]
      });
    }
  } catch (e: any) {
    errorMsg.value = `加载失败：${e?.message || String(e)}`;
  } finally {
    loading.value = false;
  }
}

function goCommunity(communityId: number) {
  router.push({ name: "CommunityDetail", params: { communityId } });
}

async function prevPage() {
  if (rankingPage.value <= 1) return;
  rankingPage.value -= 1;
  await load();
}

async function nextPage() {
  if (rankingPage.value >= totalPages.value) return;
  rankingPage.value += 1;
  await load();
}

onMounted(async () => {
  try {
    const raw = localStorage.getItem(DASHBOARD_STATE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.cityId === "number") cityId.value = s.cityId;
      if (typeof s.weekEnd === "string") weekEnd.value = s.weekEnd;
      if (s.metric === "avg_unit_price" || s.metric === "listing_count") metric.value = s.metric;
      if (typeof s.sourceFilter === "string") sourceFilter.value = s.sourceFilter;
      if (typeof s.rankingPage === "number" && s.rankingPage > 0) rankingPage.value = s.rankingPage;
      if ([10, 20, 50].includes(Number(s.rankingPageSize))) rankingPageSize.value = Number(s.rankingPageSize);
    }
  } catch {
    // ignore invalid local storage
  }

  try {
    runtimeMeta.value = await getRuntimeMeta();
  } catch {
    runtimeMeta.value = null;
  }
  const cityRes = await getCities();
  cities.value = cityRes.items || [];
  if (cities.value.length > 0) {
    cityId.value = cities.value[0].city_id;
  } else {
    errorMsg.value = "未获取到城市列表（/api/v1/cities 为空）。请先在后端运行 seed_demo 写入 demo 数据。";
  }
  await loadSources();
  await loadPeriods();
  // demo 兜底：若 periods 为空，直接用“今天”作为 weekEnd（seed_demo 生成的 rolling week_end_date）
  if (!weekEnd.value) {
    weekEnd.value = new Date().toISOString().slice(0, 10);
  }
  await load();
});

watch(cityId, async () => {
  rankingPage.value = 1;
  await loadSources();
  await loadPeriods();
  await load();
});

watch([weekEnd, metric, sourceFilter, rankingPageSize], async () => {
  rankingPage.value = 1;
  await load();
});

watch([cityId, weekEnd, metric, sourceFilter, rankingPage, rankingPageSize], () => {
  try {
    localStorage.setItem(
      DASHBOARD_STATE_KEY,
      JSON.stringify({
        cityId: cityId.value,
        weekEnd: weekEnd.value,
        metric: metric.value,
        sourceFilter: sourceFilter.value,
        rankingPage: rankingPage.value,
        rankingPageSize: rankingPageSize.value
      })
    );
  } catch {
    // ignore storage failure
  }
});

onUnmounted(() => {
  if (districtChart) {
    districtChart.dispose();
    districtChart = null;
  }
});
</script>

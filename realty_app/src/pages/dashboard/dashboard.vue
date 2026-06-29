<template>
  <view class="page">
    <view class="container">
      <!-- 顶部筛选：用 view+tap 触发 action sheet，避开 picker 兼容问题 -->
      <view class="card">
        <view class="card-title">筛选</view>
        <view class="row-gap">
          <button class="form-row tap-row" hover-class="tap-row--active" @click="pickCity">
            <text class="form-label">城市</text>
            <view class="picker-value">
              <text>{{ currentCityLabel || "请选择" }}</text>
              <text class="picker-caret">▾</text>
            </view>
          </button>
          <button class="form-row tap-row" hover-class="tap-row--active" @click="pickPeriod">
            <text class="form-label">周期结束日</text>
            <view class="picker-value">
              <text>{{ app.weekEnd || "请选择" }}</text>
              <text class="picker-caret">▾</text>
            </view>
          </button>
          <button class="form-row tap-row" hover-class="tap-row--active" @click="pickSource">
            <text class="form-label">数据来源</text>
            <view class="picker-value">
              <text>{{ app.source || "全部" }}</text>
              <text class="picker-caret">▾</text>
            </view>
          </button>
          <button class="form-row tap-row" hover-class="tap-row--active" @click="pickMetric">
            <text class="form-label">指标</text>
            <view class="picker-value">
              <text>{{ metricLabels[metricIndex] }}</text>
              <text class="picker-caret">▾</text>
            </view>
          </button>
        </view>
        <view class="row-gap" style="margin-top: 16rpx">
          <button class="btn" size="mini" @click="reload">刷新</button>
        </view>
      </view>

      <!-- 全国 70 城指数（顶部第一张卡，入口也是 stats70 页） -->
      <view class="card stats70-card" @click="goStats70">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">全国 70 城价格指数</view>
          <view class="muted" style="font-size: 22rpx">{{ stats70MonthLabel }}</view>
        </view>

        <view v-if="!stats70Ready" class="empty" style="padding: 24rpx 0">
          70 城数据未加载。点击"刷新"或下拉重新加载。
        </view>
        <view v-else-if="!currentCityIndex" class="empty" style="padding: 24rpx 0">
          请先在上方选择城市
        </view>
        <view v-else>
          <view class="stats70-grid">
            <view class="stats70-cell">
              <text class="cell-label">新建 同比</text>
              <text class="cell-value" :class="trendClass(currentCityIndex.newYoY)">
                {{ formatIndex(currentCityIndex.newYoY) }}
              </text>
              <text class="cell-sub" v-if="currentCityIndex.newYoY != null">
                {{ deltaLabel(currentCityIndex.newYoY) }}
              </text>
            </view>
            <view class="stats70-cell">
              <text class="cell-label">新建 环比</text>
              <text class="cell-value" :class="trendClass(currentCityIndex.newMoM)">
                {{ formatIndex(currentCityIndex.newMoM) }}
              </text>
              <text class="cell-sub" v-if="currentCityIndex.newMoM != null">
                {{ deltaLabel(currentCityIndex.newMoM) }}
              </text>
            </view>
            <view class="stats70-cell">
              <text class="cell-label">二手 同比</text>
              <text class="cell-value" :class="trendClass(currentCityIndex.secondYoY)">
                {{ formatIndex(currentCityIndex.secondYoY) }}
              </text>
              <text class="cell-sub" v-if="currentCityIndex.secondYoY != null">
                {{ deltaLabel(currentCityIndex.secondYoY) }}
              </text>
            </view>
            <view class="stats70-cell">
              <text class="cell-label">二手 环比</text>
              <text class="cell-value" :class="trendClass(currentCityIndex.secondMoM)">
                {{ formatIndex(currentCityIndex.secondMoM) }}
              </text>
              <text class="cell-sub" v-if="currentCityIndex.secondMoM != null">
                {{ deltaLabel(currentCityIndex.secondMoM) }}
              </text>
            </view>
          </view>
        </view>

        <view class="stats70-foot muted">点击进入全国 70 城榜单 ›</view>
      </view>

      <view v-if="runtime" class="card muted">
        <text>DB: {{ runtime.database_file || runtime.database_url }}</text>
        <text> · 规则: {{ runtime.rule_version_listing }}</text>
        <text> · 数据量: 城市 {{ runtime.data_counts.cities }} / 小区 {{ runtime.data_counts.communities }} / 房源 {{ runtime.data_counts.listings }}</text>
      </view>

      <view v-if="coverage" class="card">
        <view class="card-title">数据覆盖</view>
        <view class="muted">
          来源：{{ coverage.source_used || "全部" }} ·
          覆盖率 {{ coverage.covered_districts }} / {{ coverage.total_districts }}
          （{{ (coverage.coverage_ratio * 100).toFixed(1) }}%）
        </view>
        <view v-if="coverage.empty_districts.length" class="muted" style="margin-top: 8rpx">
          空区（{{ coverage.empty_districts.length }}）：{{ coverage.empty_districts.slice(0, 6).join("、") }}{{ coverage.empty_districts.length > 6 ? "..." : "" }}
        </view>
      </view>

      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>

      <!-- 区/板块对比 -->
      <view class="card">
        <view class="row-between">
          <view class="card-title">区/板块对比</view>
          <view class="muted">{{ app.metric === "listing_count" ? "挂牌数" : "均价(元/㎡)" }}</view>
        </view>
        <view v-if="districtItems.length === 0" class="empty">暂无数据</view>
        <view v-else>
          <view
            v-for="(it, idx) in districtItems"
            :key="idx"
            class="bar-row"
            @click="onPickDistrict(it.district_name)"
          >
            <view class="bar-name">{{ it.district_name }}</view>
            <view class="bar-track">
              <view
                class="bar-fill"
                :style="{ width: districtPct(it) + '%' }"
              ></view>
            </view>
            <view class="bar-value">{{ formatBarValue(it) }}</view>
          </view>
        </view>
      </view>

      <!-- 小区排行 -->
      <view class="card">
        <view class="row-between">
          <view class="card-title">小区 Top {{ ranking.length }}</view>
          <view class="muted" v-if="rankingTotal">共 {{ rankingTotal }} 条</view>
        </view>

        <view v-if="ranking.length === 0" class="empty">暂无数据</view>
        <view
          v-for="item in ranking"
          :key="item.community_id"
          class="community-row"
          @click="goCommunity(item.community_id)"
        >
          <view class="community-rank">#{{ item.rank }}</view>
          <view class="community-main">
            <view class="community-name">{{ item.community_name }}</view>
            <view class="muted">
              均价 {{ formatUnitPrice(item.avg_unit_price) }} · 挂牌 {{ item.listing_count }}
            </view>
          </view>
          <view class="muted" style="font-size: 22rpx">置信 {{ coverageText(item.coverage_score) }}</view>
        </view>
      </view>
    </view>

    <!-- 内置 popup：城市/周期/来源/指标选择 -->
    <view v-if="sheet.open" class="sheet-mask" @click="closeSheet">
      <view class="sheet" @click.stop>
        <view class="sheet-title">{{ sheet.title }}</view>
        <scroll-view scroll-y class="sheet-list">
          <view
            v-for="(label, idx) in sheet.items"
            :key="idx"
            class="sheet-item"
            :class="{ 'sheet-item--active': idx === sheet.currentIndex }"
            @click="sheetPick(idx)"
          >
            <text>{{ label }}</text>
            <text v-if="idx === sheet.currentIndex" class="sheet-check">✓</text>
          </view>
        </scroll-view>
        <view class="sheet-cancel" @click="closeSheet">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import { useAppStore } from "../../store/app";
import { getCities, getCoverage, getPeriods, getRuntimeMeta, getSources } from "../../local/queries";
import { getCommunityRanking, getDistrictCompare } from "../../local/queries";
import {
  getLatestIndexForCity,
  getLatestMonth,
  type LatestIndexForCity
} from "../../local/stats70";
import { hasStats70 } from "../../local/store";
import type {
  CityItem,
  CommunityRankingItem,
  CoverageResponse,
  DistrictCompareItem,
  RuntimeMetaResponse,
  SourceStatItem
} from "../../api/contracts";
import { coverageText, formatUnitPrice, showToast } from "../../utils/format";

const app = useAppStore();

const cities = ref<CityItem[]>([]);
const periods = ref<string[]>([]);
const sourceOptions = ref<SourceStatItem[]>([]);
const runtime = ref<RuntimeMetaResponse | null>(null);
const coverage = ref<CoverageResponse | null>(null);

const ranking = ref<CommunityRankingItem[]>([]);
const rankingTotal = ref<number>(0);
const districtItems = ref<DistrictCompareItem[]>([]);

const errorMsg = ref<string>("");
const loading = ref<boolean>(false);

// Picker 辅助
const cityLabels = computed(() => cities.value.map((c) => c.city_name));
const cityIndex = computed(() => cities.value.findIndex((c) => c.city_id === app.cityId));
const currentCityLabel = computed(() => {
  const c = cities.value.find((c) => c.city_id === app.cityId);
  return c?.city_name || "";
});

const periodIndex = computed(() => {
  const idx = periods.value.findIndex((p) => p === app.weekEnd);
  return idx >= 0 ? idx : 0;
});

const sourceLabels = computed(() => ["全部", ...sourceOptions.value.map((s) => s.source || "(空来源)")]);
const sourceIndex = computed(() => {
  if (!app.source) return 0;
  const idx = sourceOptions.value.findIndex((s) => s.source === app.source);
  return idx >= 0 ? idx + 1 : 0;
});

const metricLabels = ["均价", "挂牌数"];
const metricIndex = computed(() => (app.metric === "avg_unit_price" ? 0 : 1));

// 内置 popup 状态（比 uni.showActionSheet 更可靠，所有 uni-app 平台都通用）
const sheet = ref<{
  open: boolean;
  title: string;
  items: string[];
  currentIndex: number;
  onPick: (idx: number) => void;
}>({
  open: false,
  title: "",
  items: [],
  currentIndex: -1,
  onPick: () => {}
});

function openSheet(title: string, items: string[], currentIndex: number, onPick: (idx: number) => void) {
  sheet.value = {
    open: true,
    title,
    items,
    currentIndex,
    onPick
  };
}
function closeSheet() {
  sheet.value.open = false;
}
function sheetPick(idx: number) {
  const cb = sheet.value.onPick;
  closeSheet();
  cb(idx);
}

function pickCity() {
  if (cities.value.length === 0) {
    showToast("暂无城市列表");
    return;
  }
  const items = cities.value.map((c) => c.city_name);
  const cur = cities.value.findIndex((c) => c.city_id === app.cityId);
  openSheet("选择城市", items, cur, (idx) => {
    const c = cities.value[idx];
    if (c) {
      app.setCityId(c.city_id);
      loadAll();
      showToast(`已切换到 ${c.city_name}`);
    }
  });
}

function pickPeriod() {
  if (periods.value.length === 0) {
    showToast("暂无周期数据");
    return;
  }
  const list = periods.value.slice().reverse();   // 最近的在前
  const cur = periods.value.indexOf(app.weekEnd);
  const listCur = list.indexOf(app.weekEnd);
  openSheet(
    "选择周期（最近的在前）",
    list,
    listCur >= 0 ? listCur : 0,
    (idx) => {
      const p = list[idx];
      if (p) {
        app.setWeekEnd(p);
        loadRankingAndDistrict();
        showToast(`已选周期 ${p}`);
      }
    }
  );
}

function pickSource() {
  const items = ["全部", ...sourceOptions.value.map((s) => s.source || "(空来源)")];
  // 计算当前索引
  let cur = 0;
  if (app.source) {
    const idx = sourceOptions.value.findIndex((s) => s.source === app.source);
    if (idx >= 0) cur = idx + 1;
  }
  openSheet("数据来源", items, cur, (idx) => {
    if (idx === 0) {
      app.setSource("");
    } else {
      const s = sourceOptions.value[idx - 1];
      if (s) app.setSource(s.source);
    }
    loadRankingAndDistrict();
    loadCoverage();
  });
}

function pickMetric() {
  openSheet(
    "指标",
    metricLabels,
    metricIndex.value,
    (idx) => {
      app.setMetric(idx === 0 ? "avg_unit_price" : "listing_count");
      loadRankingAndDistrict();
    }
  );
}

async function loadAll() {
  if (!app.cityId) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    await Promise.all([loadSources(), loadPeriods(), loadCoverage(), loadRuntime()]);
    if (!app.weekEnd && periods.value.length > 0) {
      app.setWeekEnd(periods.value[periods.value.length - 1]);
    } else if (!app.weekEnd) {
      const today = new Date().toISOString().slice(0, 10);
      app.setWeekEnd(today);
    }
    await loadRankingAndDistrict();
  } catch (e: any) {
    errorMsg.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function reload() {
  await loadAll();
  showToast("已刷新");
}

async function loadSources() {
  try {
    const res = await getSources({ cityId: app.cityId });
    sourceOptions.value = res.items || [];
    if (app.source && !sourceOptions.value.some((s) => s.source === app.source)) {
      app.setSource("");
    }
  } catch {
    sourceOptions.value = [];
  }
}

async function loadPeriods() {
  try {
    const res = await getPeriods({ cityId: app.cityId });
    periods.value = res.items || [];
  } catch (e: any) {
    errorMsg.value = `加载周期失败：${e?.message || String(e)}`;
  }
}

async function loadCoverage() {
  try {
    coverage.value = await getCoverage({ cityId: app.cityId, source: app.source || undefined });
  } catch {
    coverage.value = null;
  }
}

async function loadRuntime() {
  try {
    runtime.value = await getRuntimeMeta();
  } catch {
    runtime.value = null;
  }
}

async function loadRankingAndDistrict() {
  if (!app.cityId || !app.weekEnd) return;
  try {
    const [r, d] = await Promise.all([
      getCommunityRanking({
        cityId: app.cityId,
        weekEnd: app.weekEnd,
        metric: app.metric,
        top: 20,
        page: 1,
        pageSize: 20,
        source: app.source || undefined
      }),
      getDistrictCompare({
        cityId: app.cityId,
        weekEnd: app.weekEnd,
        source: app.source || undefined
      })
    ]);
    ranking.value = r.data || [];
    rankingTotal.value = Number(r.total || r.data?.length || 0);
    districtItems.value = d.items || [];
  } catch (e: any) {
    errorMsg.value = `加载失败：${e?.message || String(e)}`;
  }
}

function maxDistrictValue() {
  if (app.metric === "listing_count") {
    return Math.max(1, ...districtItems.value.map((i) => i.listing_count || 0));
  }
  const vals = districtItems.value.map((i) => i.avg_unit_price || 0);
  return Math.max(1, ...vals);
}

function districtPct(it: DistrictCompareItem): number {
  if (app.metric === "listing_count") {
    return ((it.listing_count || 0) / maxDistrictValue()) * 100;
  }
  return ((it.avg_unit_price || 0) / maxDistrictValue()) * 100;
}

function formatBarValue(it: DistrictCompareItem): string {
  if (app.metric === "listing_count") return `${it.listing_count ?? 0}`;
  return formatUnitPrice(it.avg_unit_price);
}

function onPickDistrict(name: string) {
  uni.showToast({ title: `已选区：${name}`, icon: "none" });
}

function goCommunity(id: number) {
  uni.navigateTo({ url: `/pages/community/community?id=${id}` });
}

function goStats70() {
  uni.navigateTo({ url: "/pages/stats70/stats70" });
}

// 70 城指数卡片 -------------------------------------------------------
const stats70Ready = computed(() => hasStats70());
const stats70MonthLabel = computed(() => {
  const m = getLatestMonth();
  if (!m) return "";
  const parts = m.split("/");
  if (parts.length < 3) return m;
  return `${parts[0]}-${parts[1].padStart(2, "0")}`;
});

const currentCityIndex = computed<LatestIndexForCity | null>(() => {
  if (!hasStats70()) return null;
  const city = cities.value.find((c) => c.city_id === app.cityId);
  if (!city) return null;
  return getLatestIndexForCity(city.city_name);
});

function formatIndex(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(1);
}

function deltaLabel(v: number | null): string {
  if (v == null) return "";
  const d = v - 100;
  if (Math.abs(d) < 0.05) return "持平";
  return d > 0 ? `↑ ${d.toFixed(1)}` : `↓ ${Math.abs(d).toFixed(1)}`;
}

function trendClass(v: number | null): string {
  if (v == null) return "";
  if (v > 100) return "stats70-up";
  if (v < 100) return "stats70-down";
  return "stats70-flat";
}

/** 现在 stats70 CSV 在 App.vue 里已经同步注入（?raw），这里不再二次 fetch。 */
async function ensureStats70Loaded() {
  /* 留作占位 */
  return;
}

onMounted(async () => {
  await ensureStats70Loaded();
  const res = await getCities();
  cities.value = res.items || [];
  if (cities.value.length > 0) {
    if (!cities.value.some((c) => c.city_id === app.cityId)) {
      app.setCityId(cities.value[0].city_id);
    }
  } else {
    errorMsg.value = "未获取到城市列表，请检查后端 /api/v1/cities";
  }
  await loadAll();
});

onPullDownRefresh(async () => {
  await ensureStats70Loaded();
  await loadAll();
  uni.stopPullDownRefresh();
});

// 监听筛选条件变化：切城市或切周期立即重新加载数据
let _lastCityId = -1;
let _lastWeekEnd = "";
let _skipFirstFilterWatch = true;
watch(
  () => [app.cityId, app.weekEnd] as const,
  async ([cityId, weekEnd]) => {
    if (cityId == null || weekEnd == null) return;
    if (_skipFirstFilterWatch) {
      _skipFirstFilterWatch = false;
      _lastCityId = cityId;
      _lastWeekEnd = weekEnd;
      return;
    }
    if (cityId === _lastCityId && weekEnd === _lastWeekEnd) return;
    _lastCityId = cityId;
    _lastWeekEnd = weekEnd;
    await loadAll();
  }
);

onShow(async () => {
  // 切回 tab 时若 cityId 变了也重新加载
  if (app.cityId !== _lastCityId) {
    _lastCityId = app.cityId;
    await loadAll();
  }
});
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 280rpx;
  flex: 1 1 280rpx;
}

/* 用 button 渲染点击区时要清掉默认浏览器样式 */
.tap-row {
  background: transparent;
  border: 0;
  padding: 0;
  margin: 0;
  text-align: left;
  line-height: 1.4;
  font-size: 28rpx;
  color: inherit;
}

.tap-row::after {
  /* 去掉 button 在小程序/app-plus 的默认边框 */
  border: 0;
}

.tap-row--active {
  opacity: 0.7;
}

.form-label {
  color: #94a3b8;
  font-size: 26rpx;
  min-width: 140rpx;
}

.picker-value {
  background: #1e293b;
  border-radius: 8rpx;
  padding: 12rpx 20rpx;
  color: #f3f4f6;
  min-width: 200rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-caret {
  color: #64748b;
  font-size: 22rpx;
  margin-left: 8rpx;
}

/* 内置 sheet popup */
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.sheet {
  width: 100%;
  max-height: 70vh;
  background: #0f172a;
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  display: flex;
  flex-direction: column;
  padding: 16rpx 0;
  box-sizing: border-box;
}

.sheet-title {
  text-align: center;
  font-size: 28rpx;
  color: #94a3b8;
  padding: 16rpx;
  border-bottom: 1rpx solid #1e293b;
}

.sheet-list {
  flex: 1;
  max-height: 56vh;
  padding: 0 16rpx;
}

.sheet-item {
  padding: 24rpx 16rpx;
  border-bottom: 1rpx solid #1e293b;
  color: #f3f4f6;
  font-size: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sheet-item--active {
  color: #4ade80;
  background: #1e293b;
}

.sheet-check {
  color: #4ade80;
  font-weight: bold;
}

.sheet-cancel {
  text-align: center;
  padding: 28rpx 0;
  color: #94a3b8;
  font-size: 30rpx;
  border-top: 1rpx solid #1e293b;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 0;
}

.bar-name {
  width: 140rpx;
  color: #cbd5e1;
  font-size: 24rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-track {
  flex: 1;
  height: 16rpx;
  background: #1f2937;
  border-radius: 8rpx;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #4ade80);
  border-radius: 8rpx;
}

.bar-value {
  width: 200rpx;
  text-align: right;
  color: #f3f4f6;
  font-size: 24rpx;
}

.community-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #1f2937;
}

.community-row:last-child {
  border-bottom: none;
}

.community-rank {
  width: 80rpx;
  font-weight: 600;
  color: #4ade80;
}

.community-main {
  flex: 1;
}

.community-name {
  font-size: 30rpx;
  color: #f3f4f6;
  margin-bottom: 4rpx;
}

/* ---------------- 70 城指数卡片 ---------------- */
.stats70-card {
  background: linear-gradient(135deg, #111827 0%, #0c1426 100%);
  border: 1rpx solid #1f2937;
}

.stats70-foot {
  margin-top: 16rpx;
  text-align: right;
  font-size: 22rpx;
  color: #4ade80;
}

.stats70-grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
  gap: 8rpx;
}

.stats70-cell {
  flex: 1 1 calc(50% - 8rpx);
  background: #0b1220;
  border: 1rpx solid #1f2937;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.cell-label {
  color: #94a3b8;
  font-size: 24rpx;
}

.cell-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #f3f4f6;
}

.cell-sub {
  font-size: 22rpx;
  color: #64748b;
}

.stats70-up {
  color: #4ade80 !important;
}

.stats70-down {
  color: #fca5a5 !important;
}

.stats70-flat {
  color: #94a3b8 !important;
}
</style>
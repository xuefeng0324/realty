<template>
  <view class="page">
    <view class="container">
      <!-- 筛选器 -->
      <view class="card">
        <view class="card-title">筛选</view>

        <view class="form-grid">
          <view class="form-item">
            <text class="form-label">城市</text>
            <view class="picker-value tap" @click="pickCity">
              {{ currentCityLabel || "请选择" }}
              <text class="picker-caret">▾</text>
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">周期</text>
            <view class="picker-value tap" @click="pickPeriod">
              {{ app.weekEnd || "请选择" }}
              <text class="picker-caret">▾</text>
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">来源</text>
            <view class="picker-value tap" @click="pickSource">
              {{ app.source || "全部" }}
              <text class="picker-caret">▾</text>
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">挂牌类型</text>
            <view class="picker-value tap" @click="pickListingType">
              {{ listingTypeLabels[listingTypeIndex] }}
              <text class="picker-caret">▾</text>
            </view>
          </view>

          <view class="form-item">
            <text class="form-label">最低评分</text>
            <view class="picker-value tap" @click="pickScore">
              {{ scoreIndex === 0 ? "不限" : minQualityScore + "+" }}
              <text class="picker-caret">▾</text>
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">装修</text>
            <view class="picker-value tap" @click="pickDecorate">
              {{ decorateOptions[decorateIndex] }}
              <text class="picker-caret">▾</text>
            </view>
          </view>
        </view>

        <view class="slider-row">
          <text class="form-label">总价（万）下限</text>
          <slider
            :min="PRICE_MIN" :max="PRICE_MAX" :step="PRICE_STEP" :value="priceRange[0]"
            activeColor="#22c55e" backgroundColor="#1f2937" block-size="20"
            show-value
            @change="onPriceLoChange"
            @changing="onPriceLoChange"
          />
          <text class="form-label">总价（万）上限</text>
          <slider
            :min="PRICE_MIN" :max="PRICE_MAX" :step="PRICE_STEP" :value="priceRange[1]"
            activeColor="#22c55e" backgroundColor="#1f2937" block-size="20"
            show-value
            @change="onPriceHiChange"
            @changing="onPriceHiChange"
          />
          <view class="range-meta muted">
            <text>当前区间：{{ priceRange[0] }} - {{ priceRange[1] }} 万</text>
          </view>
        </view>

        <view class="slider-row">
          <text class="form-label">面积（㎡）下限</text>
          <slider
            :min="AREA_MIN" :max="AREA_MAX" :step="AREA_STEP" :value="areaRange[0]"
            activeColor="#22c55e" backgroundColor="#1f2937" block-size="20"
            show-value
            @change="onAreaLoChange"
            @changing="onAreaLoChange"
          />
          <text class="form-label">面积（㎡）上限</text>
          <slider
            :min="AREA_MIN" :max="AREA_MAX" :step="AREA_STEP" :value="areaRange[1]"
            activeColor="#22c55e" backgroundColor="#1f2937" block-size="20"
            show-value
            @change="onAreaHiChange"
            @changing="onAreaHiChange"
          />
          <view class="range-meta muted">
            <text>当前区间：{{ areaRange[0] }} - {{ areaRange[1] }} ㎡</text>
          </view>
        </view>

        <view class="row-gap" style="margin-top: 16rpx">
          <button class="btn" size="mini" @click="applyFilter">应用筛选</button>
          <button class="btn btn-ghost" size="mini" @click="resetFilter">重置</button>
        </view>
      </view>

      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>

      <!-- 结果 -->
      <view class="card">
        <view class="row-between">
          <view class="card-title">结果</view>
          <view class="muted" v-if="total">共 {{ total }} 条</view>
        </view>
        <view v-if="items.length === 0" class="empty">暂无数据</view>
        <view
          v-for="it in items"
          :key="it.listing_id"
          class="listing-row"
          @click="goListing(it.listing_id)"
        >
          <view class="listing-main">
            <view class="listing-title">{{ it.title }}</view>
            <view class="muted listing-sub">
              {{ formatPrice(it.price_total) }} · {{ formatArea(it.area_sqm) }} ·
              {{ it.orientation || "-" }} · {{ it.decorate_type || "-" }}
              <text v-if="it.build_year"> · {{ it.build_year }}年</text>
            </view>
            <view v-if="it.advantages?.length || it.disadvantages?.length" class="tag-row">
              <text v-for="a in (it.advantages || []).slice(0, 2)" :key="'a' + a.label" class="tag tag-success">
                {{ a.label }}
              </text>
              <text v-for="d in (it.disadvantages || []).slice(0, 2)" :key="'d' + d.label" class="tag tag-danger">
                {{ d.label }}
              </text>
            </view>
            <!-- v0.37.0 trend-17: 5 维度迷你评分条 (位置/房屋/楼龄/配套/性价比) -->
            <view
              v-if="it.explain_preview?.dimension_scores"
              class="minidim-row"
            >
              <view
                v-for="d in MINI_DIM_DEFS"
                :key="d.key"
                class="minidim-cell"
              >
                <text class="minidim-label">{{ d.label }}</text>
                <view class="minidim-track">
                  <view
                    class="minidim-fill"
                    :class="minidimBandClass(it.explain_preview.dimension_scores[d.key] ?? 0)"
                    :style="{ width: (it.explain_preview.dimension_scores[d.key] ?? 0) + '%' }"
                  />
                </view>
                <text class="minidim-val">{{ Math.round(it.explain_preview.dimension_scores[d.key] ?? 0) }}</text>
              </view>
            </view>
          </view>
          <view class="score-pill" :class="scoreClass(it.quality_score)">
            {{ it.quality_score.toFixed(1) }}
          </view>
        </view>
      </view>
    </view>

    <!-- 内置 popup -->
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
import { computed, onMounted, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { filterListings } from "../../local/queries";
import { getCities, getPeriods, getSources } from "../../local/queries";
import type { CityItem, ListingItem, SourceStatItem } from "../../api/contracts";
import { toErrorMessage } from "../../utils/errorMessage";
import { useAppStore } from "../../store/app";
import {
  formatArea,
  formatPrice,
  scoreClass
} from "../../utils/format";

const app = useAppStore();

const cities = ref<CityItem[]>([]);
const periods = ref<string[]>([]);
const sourceOptions = ref<SourceStatItem[]>([]);

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

const listingTypeLabels = ["全部", "在售", "成交"];
const listingTypeIndex = ref(0);

// v0.37.0 trend-17: 5 维度迷你评分条
const MINI_DIM_DEFS = [
  { key: "location_score", label: "位置" },
  { key: "house_quality_score", label: "房屋" },
  { key: "building_age_score", label: "楼龄" },
  { key: "amenity_score", label: "配套" },
  { key: "price_value_score", label: "性价比" }
];
function minidimBandClass(v: number) {
  if (v >= 75) return "minidim-fill-green";
  if (v >= 50) return "minidim-fill-orange";
  return "minidim-fill-red";
}

const decorateOptions = ["不限", "精装", "简装", "毛坯"];
const decorateIndex = ref(0);

const scoreThresholds = [0, 40, 50, 60, 70, 80, 90];
const scoreIndex = ref(0);
const minQualityScore = computed(() => scoreThresholds[scoreIndex.value]);

const priceRange = ref<[number, number]>([0, 2000]);
const areaRange = ref<[number, number]>([0, 300]);

const filterCommunityId = ref<number | null>(null);

const items = ref<ListingItem[]>([]);
const total = ref(0);
const errorMsg = ref("");

// 内置 popup（替代 uni-app picker，跨平台一致）
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
  sheet.value = { open: true, title, items, currentIndex, onPick };
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
  if (cities.value.length === 0) return;
  const items = cities.value.map((c) => c.city_name);
  const cur = cities.value.findIndex((c) => c.city_id === app.cityId);
  openSheet("选择城市", items, cur, (idx) => {
    const c = cities.value[idx];
    if (c) {
      app.setCityId(c.city_id);
      loadMeta();
      applyFilter();
    }
  });
}

function pickPeriod() {
  if (periods.value.length === 0) return;
  const list = periods.value.slice().reverse();
  const cur = list.indexOf(app.weekEnd);
  openSheet("选择周期（最近的在前）", list, cur >= 0 ? cur : 0, (idx) => {
    const p = list[idx];
    if (p) {
      app.setWeekEnd(p);
      applyFilter();
    }
  });
}

function pickSource() {
  const items = ["全部", ...sourceOptions.value.map((s) => s.source || "(空来源)")];
  let cur = 0;
  if (app.source) {
    const idx = sourceOptions.value.findIndex((s) => s.source === app.source);
    if (idx >= 0) cur = idx + 1;
  }
  openSheet("数据来源", items, cur, (idx) => {
    if (idx === 0) app.setSource("");
    else {
      const s = sourceOptions.value[idx - 1];
      if (s) app.setSource(s.source);
    }
    applyFilter();
  });
}

function pickListingType() {
  openSheet("挂牌类型", listingTypeLabels, listingTypeIndex.value, (idx) => {
    listingTypeIndex.value = idx;
    applyFilter();
  });
}

function pickScore() {
  const items = scoreThresholds.map((v) => (v === 0 ? "不限" : `${v}+`));
  openSheet("最低评分", items, scoreIndex.value, (idx) => {
    scoreIndex.value = idx;
    applyFilter();
  });
}

function pickDecorate() {
  openSheet("装修", decorateOptions, decorateIndex.value, (idx) => {
    decorateIndex.value = idx;
    applyFilter();
  });
}

// 双 thumb slider：改用两个独立 <slider>（下限 / 上限），避开 <slider range> 在 H5 上的渲染问题
const PRICE_MIN = 0;
const PRICE_MAX = 2000;
const AREA_MIN = 0;
const AREA_MAX = 300;
const PRICE_STEP = 50;
const AREA_STEP = 10;

let _applyDebounce: ReturnType<typeof setTimeout> | null = null;
function scheduleApply() {
  if (_applyDebounce) clearTimeout(_applyDebounce);
  _applyDebounce = setTimeout(() => {
    applyFilter();
    _applyDebounce = null;
  }, 120);
}

function onPriceLoChange(e: any) {
  const v = Number(e.detail.value);
  if (!Number.isFinite(v)) return;
  const lo = Math.min(v, priceRange.value[1]);
  priceRange.value = [lo, priceRange.value[1]];
  scheduleApply();
}
function onPriceHiChange(e: any) {
  const v = Number(e.detail.value);
  if (!Number.isFinite(v)) return;
  const hi = Math.max(v, priceRange.value[0]);
  priceRange.value = [priceRange.value[0], hi];
  scheduleApply();
}
function onAreaLoChange(e: any) {
  const v = Number(e.detail.value);
  if (!Number.isFinite(v)) return;
  const lo = Math.min(v, areaRange.value[1]);
  areaRange.value = [lo, areaRange.value[1]];
  scheduleApply();
}
function onAreaHiChange(e: any) {
  const v = Number(e.detail.value);
  if (!Number.isFinite(v)) return;
  const hi = Math.max(v, areaRange.value[0]);
  areaRange.value = [areaRange.value[0], hi];
  scheduleApply();
}

async function loadMeta() {
  const [cityRes, periodRes, srcRes] = await Promise.all([
    cities.value.length ? Promise.resolve({ items: cities.value }) : getCities(),
    getPeriods({ cityId: app.cityId }),
    getSources({ cityId: app.cityId }).catch(() => ({ items: [] }))
  ]);
  if (!cities.value.length) cities.value = cityRes.items || [];
  periods.value = periodRes.items || [];
  sourceOptions.value = srcRes.items || [];
  if (app.source && !sourceOptions.value.some((s) => s.source === app.source)) {
    app.setSource("");
  }
  if (!app.weekEnd && periods.value.length > 0) {
    app.setWeekEnd(periods.value[periods.value.length - 1]);
  } else if (!app.weekEnd) {
    app.setWeekEnd(new Date().toISOString().slice(0, 10));
  }
}

async function applyFilter() {
  errorMsg.value = "";
  try {
    const body: any = {
      cityId: app.cityId,
      periodType: "weekly",
      weekEnd: app.weekEnd,
      page: 1,
      pageSize: 20,
      sort: { field: "overall_score", direction: "desc" },
      filters: {
        priceRange: priceRange.value,
        areaRange: areaRange.value,
        minQualityScore: minQualityScore.value || undefined
      }
    };
    if (filterCommunityId.value) body.communityId = filterCommunityId.value;

    if (listingTypeIndex.value === 1) body.filters.listingType = "在售";
    else if (listingTypeIndex.value === 2) body.filters.listingType = "成交";

    if (decorateIndex.value > 0) body.filters.decorateType = decorateOptions[decorateIndex.value];

    const res = await filterListings(body);
    items.value = res.items || [];
    total.value = res.total || items.value.length;
  } catch (e) {
    errorMsg.value = toErrorMessage(e);
    items.value = [];
    total.value = 0;
  }
}

function resetFilter() {
  priceRange.value = [0, 2000];
  areaRange.value = [0, 300];
  listingTypeIndex.value = 0;
  decorateIndex.value = 0;
  scoreIndex.value = 0;
  applyFilter();
}

function goListing(id: number) {
  uni.navigateTo({ url: `/pages/listing-detail/listing-detail?id=${id}` });
}

onLoad((q: any) => {
  if (q?.communityId) {
    filterCommunityId.value = Number(q.communityId);
  }
});

onMounted(async () => {
  await loadMeta();
  await applyFilter();
});
</script>

<style lang="scss" scoped>
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.form-label {
  color: #94a3b8;
  font-size: 24rpx;
}

.picker-value {
  background: #1e293b;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  color: #f3f4f6;
  font-size: 26rpx;
}

.slider-row {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.range-track {
  position: relative;
  height: 64rpx;
  padding: 26rpx 0;
  box-sizing: border-box;
  touch-action: none;
}

.range-track-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 6rpx;
  background: #1f2937;
  border-radius: 4rpx;
  transform: translateY(-50%);
}

.range-track-fill {
  position: absolute;
  top: 50%;
  height: 6rpx;
  background: #22c55e;
  border-radius: 4rpx;
  transform: translateY(-50%);
}

.range-thumb {
  position: absolute;
  top: 50%;
  width: 48rpx;
  height: 48rpx;
  background: #22c55e;
  border: 4rpx solid #f3f4f6;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.5);
  z-index: 2;
}

.thumb-bubble {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #0f172a;
  color: #f3f4f6;
  border-radius: 6rpx;
  padding: 2rpx 8rpx;
  font-size: 20rpx;
  white-space: nowrap;
  margin-bottom: 6rpx;
  border: 1rpx solid #1f2937;
}

.range-meta {
  display: flex;
  justify-content: space-between;
  font-size: 22rpx;
  margin-top: 4rpx;
}

.picker-value.tap {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-caret {
  color: #64748b;
  font-size: 22rpx;
  margin-left: 8rpx;
}

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
  background: #111827;
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

.listing-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #1f2937;
  min-height: 88rpx; /* a11y: 至少 44pt 触摸目标 */
}

.listing-row:last-child {
  border-bottom: none;
}

.listing-main {
  flex: 1;
}

.listing-title {
  font-size: 28rpx;
  color: #f3f4f6;
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.listing-sub {
  font-size: 22rpx;
  margin-bottom: 8rpx;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
</style>
/* v0.37.0 trend-17: 5 维度迷你评分条 */
.minidim-row {
  display: flex;
  gap: 12rpx;
  margin-top: 10rpx;
  align-items: center;
}
.minidim-cell {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}
.minidim-label {
  font-size: 18rpx;
  color: #94a3b8;
  font-weight: 500;
}
.minidim-track {
  width: 100%;
  height: 6rpx;
  background: #1f2937;
  border-radius: 4rpx;
  overflow: hidden;
}
.minidim-fill {
  height: 100%;
  border-radius: 4rpx;
  font-variant-numeric: tabular-nums;
  transition: width 0.3s ease;
}
.minidim-fill-green {
  background: linear-gradient(90deg, #22c55e, #10b981);
}
.minidim-fill-orange {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
}
.minidim-fill-red {
  background: linear-gradient(90deg, #f87171, #ef4444);
}
.minidim-val {
  font-size: 20rpx;
  font-weight: 700;
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}

<template>
  <view class="page">
    <view class="container">
      <!-- 筛选器 -->
      <view class="card">
        <view class="card-title">筛选</view>

        <view class="form-grid">
          <view class="form-item">
            <text class="form-label">城市</text>
            <picker mode="selector" :range="cityLabels" :value="cityIndex" @change="onCityChange">
              <view class="picker-value">{{ currentCityLabel }}</view>
            </picker>
          </view>
          <view class="form-item">
            <text class="form-label">周期</text>
            <picker mode="selector" :range="periods" :value="periodIndex" @change="onPeriodChange">
              <view class="picker-value">{{ app.weekEnd || "请选择" }}</view>
            </picker>
          </view>
          <view class="form-item">
            <text class="form-label">来源</text>
            <picker mode="selector" :range="sourceLabels" :value="sourceIndex" @change="onSourceChange">
              <view class="picker-value">{{ app.source || "全部" }}</view>
            </picker>
          </view>
          <view class="form-item">
            <text class="form-label">挂牌类型</text>
            <picker mode="selector" :range="listingTypeLabels" :value="listingTypeIndex" @change="onListingTypeChange">
              <view class="picker-value">{{ listingTypeLabels[listingTypeIndex] }}</view>
            </picker>
          </view>

          <view class="form-item">
            <text class="form-label">最低评分</text>
            <picker mode="selector" :range="scoreThresholds" :value="scoreIndex" @change="onScoreChange">
              <view class="picker-value">{{ minQualityScore || "不限" }}</view>
            </picker>
          </view>
          <view class="form-item">
            <text class="form-label">装修</text>
            <picker mode="selector" :range="decorateOptions" :value="decorateIndex" @change="onDecorateChange">
              <view class="picker-value">{{ decorateOptions[decorateIndex] }}</view>
            </picker>
          </view>
        </view>

        <view class="slider-row">
          <text class="form-label">总价 {{ priceRange[0] }} - {{ priceRange[1] }} 万</text>
          <slider
            range
            :min="0"
            :max="2000"
            :step="50"
            :value="priceRange"
            @change="onPriceChange"
            activeColor="#22c55e"
            backgroundColor="#1f2937"
          />
        </view>
        <view class="slider-row">
          <text class="form-label">面积 {{ areaRange[0] }} - {{ areaRange[1] }} ㎡</text>
          <slider
            range
            :min="0"
            :max="300"
            :step="10"
            :value="areaRange"
            @change="onAreaChange"
            activeColor="#22c55e"
            backgroundColor="#1f2937"
          />
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
          </view>
          <view class="score-pill" :class="scoreClass(it.quality_score)">
            {{ it.quality_score.toFixed(1) }}
          </view>
        </view>
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

function onCityChange(e: any) {
  const c = cities.value[Number(e.detail.value)];
  if (c) {
    app.setCityId(c.city_id);
    loadMeta();
  }
}

function onPeriodChange(e: any) {
  const p = periods.value[Number(e.detail.value)];
  if (p) {
    app.setWeekEnd(p);
    applyFilter();
  }
}

function onSourceChange(e: any) {
  const idx = Number(e.detail.value);
  if (idx === 0) app.setSource("");
  else app.setSource(sourceOptions.value[idx - 1].source);
  applyFilter();
}

function onListingTypeChange(e: any) {
  listingTypeIndex.value = Number(e.detail.value);
}

function onDecorateChange(e: any) {
  decorateIndex.value = Number(e.detail.value);
}

function onScoreChange(e: any) {
  scoreIndex.value = Number(e.detail.value);
}

function onPriceChange(e: any) {
  priceRange.value = e.detail.value as [number, number];
}

function onAreaChange(e: any) {
  areaRange.value = e.detail.value as [number, number];
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
  } catch (e: any) {
    errorMsg.value = e?.message || String(e);
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

.listing-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #1f2937;
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
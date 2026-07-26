<template>
  <view class="page">
    <view class="container">
      <!-- 筛选器 -->
      <view class="card">
        <view class="card-title">筛选</view>

        <view class="form-item search-input" data-listing-keyword>
          <input
            class="input"
            type="text"
            v-model="keyword"
            placeholder="小区 / 标题 / 行政区关键字"
            confirm-type="search"
            @confirm="() => applyFilter(true)"
          />
          <button class="btn" size="mini" @click="() => applyFilter(true)">搜索</button>
        </view>

        <view class="form-grid">
          <view class="form-item">
            <text class="form-label">城市</text>
            <view class="picker-value tap" @click="pickCity">
              {{ currentCityLabel || "请选择" }}
              <text class="picker-caret">▾</text>
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">行政区</text>
            <view class="picker-value tap" @click="pickDistrict">
              {{ districtName || "全部区" }}
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
            <text class="form-label">房屋类型</text>
            <view class="picker-value tap" @click="pickListingType">
              {{ listingTypeLabels[listingTypeIndex] }}
              <text class="picker-caret">▾</text>
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">户型</text>
            <view class="picker-value tap" @click="pickBedroom" data-filter-bedroom>
              {{ bedroomLabels[bedroomIndex] }}
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
            activeColor="#22c55e" backgroundColor="var(--color-soft-strong)" block-size="20"
            show-value
            @change="onPriceLoChange"
            @changing="onPriceLoChange"
          />
          <text class="form-label">总价（万）上限</text>
          <slider
            :min="PRICE_MIN" :max="PRICE_MAX" :step="PRICE_STEP" :value="priceRange[1]"
            activeColor="#22c55e" backgroundColor="var(--color-soft-strong)" block-size="20"
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
            activeColor="#22c55e" backgroundColor="var(--color-soft-strong)" block-size="20"
            show-value
            @change="onAreaLoChange"
            @changing="onAreaLoChange"
          />
          <text class="form-label">面积（㎡）上限</text>
          <slider
            :min="AREA_MIN" :max="AREA_MAX" :step="AREA_STEP" :value="areaRange[1]"
            activeColor="#22c55e" backgroundColor="var(--color-soft-strong)" block-size="20"
            show-value
            @change="onAreaHiChange"
            @changing="onAreaHiChange"
          />
          <view class="range-meta muted">
            <text>当前区间：{{ areaRange[0] }} - {{ areaRange[1] }} ㎡</text>
          </view>
        </view>

        <view class="row-gap" style="margin-top: 16rpx">
          <button class="btn" size="mini" @click="() => applyFilter(true)">应用筛选</button>
          <button class="btn btn-ghost" size="mini" @click="resetFilter">重置</button>
        </view>
      </view>

      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>

      <!-- v0.95.0 市场流动性（派生：基于 listing_freshness.csv） -->
      <view
        v-if="freshnessSummary && freshnessSummary.communityCount > 0"
        class="card"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">📡 市场流动性</view>
          <view class="muted" style="font-size: 22rpx">
            {{ freshnessSummary.communityCount }} 个小区样本
          </view>
        </view>
        <view style="margin-top: 10rpx">
          <view class="muted" style="font-size: 22rpx">
            当前城市 {{ freshnessSummary.cityName }} · 总挂牌 {{ freshnessSummary.totalListings }} ·
            鲜活度均值 {{ freshnessSummary.avgFreshness.toFixed(1) }}
            <text v-if="freshnessSummary.avgMedianAgeDays != null">
              · 中位挂牌 {{ Math.round(freshnessSummary.avgMedianAgeDays) }} 天
            </text>
          </view>
        </view>
        <view class="freshness-bar" style="margin-top: 10rpx">
          <view
            class="freshness-bar-new"
            :style="{ width: (freshnessSummary.new2wRate * 100).toFixed(1) + '%' }"
          />
          <view
            class="freshness-bar-r4"
            :style="{ width: ((freshnessSummary.recent4wRate - freshnessSummary.new2wRate) * 100).toFixed(1) + '%' }"
          />
          <view
            class="freshness-bar-stale"
            :style="{ width: ((1 - freshnessSummary.recent4wRate) * 100).toFixed(1) + '%' }"
          />
        </view>
        <view style="margin-top: 6rpx; font-size: 20rpx">
          <text class="legend-new">≤2 周 {{ formatPct(freshnessSummary.new2wRate) }}</text>
          <text class="legend-r4">  · ≤4 周 {{ formatPct(freshnessSummary.recent4wRate) }}</text>
          <text class="legend-stale">  · 陈旧 {{ formatPct(freshnessSummary.staleRate) }}</text>
        </view>
        <view
          v-if="freshestTop.length || stalestTop.length"
          style="margin-top: 14rpx"
        >
          <view v-if="freshestTop.length" style="margin-bottom: 6rpx">
            <view class="muted" style="font-size: 22rpx">最最新鲜 Top 3</view>
            <view
              v-for="(row, i) in freshestTop"
              :key="'fr' + row.communityId"
              class="drift-row"
            >
              <text class="drift-rank">{{ i + 1 }}</text>
              <text class="drift-city">
                {{ row.communityName }} <text class="muted">({{ row.districtName }})</text>
              </text>
              <text class="drift-value drift-up">
                {{ row.freshnessScore.toFixed(1) }}
              </text>
            </view>
          </view>
          <view v-if="stalestTop.length">
            <view class="muted" style="font-size: 22rpx">最积压 Top 3</view>
            <view
              v-for="(row, i) in stalestTop"
              :key="'st' + row.communityId"
              class="drift-row"
            >
              <text class="drift-rank">{{ i + 1 }}</text>
              <text class="drift-city">
                {{ row.communityName }} <text class="muted">({{ row.districtName }})</text>
              </text>
              <text class="drift-value drift-down">
                <text v-if="row.medianAgeDays != null">{{ row.medianAgeDays }}天</text>
                <text v-else>—</text>
              </text>
            </view>
          </view>
        </view>
        <view class="muted" style="font-size: 20rpx; margin-top: 8rpx">
          派生：snapshot.listingFreshness。鲜活度 = 近期新增数 / 总挂牌，年龄为小区内挂牌中位天数。
        </view>
      </view>

      <!-- v0.96.0 本市标签特征（不再默认混三市） -->
      <view
        v-if="tagCityLocal && tagCityLocal.topTags.length > 0"
        class="card"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏷️ 本市标签特征</view>
          <view class="muted" style="font-size: 22rpx">
            {{ tagCityLocal.cityName }} · {{ tagCityLocal.topTags.length }} 个
          </view>
        </view>
        <view style="margin-top: 10rpx">
          <view
            v-for="(t, i) in tagCityLocal.topTags.slice(0, 8)"
            :key="'tt-' + t.tag"
            class="drift-row"
          >
            <text class="drift-rank">{{ i + 1 }}</text>
            <text class="drift-city">{{ t.tag }}</text>
            <text class="drift-value">{{ (t.share * 100).toFixed(1) }}%</text>
          </view>
        </view>
      </view>

      <!-- v1.118.0 性价比之选（社区散点 Pareto 派生，仅本市） -->
      <view class="card" v-if="paretoTop.length">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">⭐ 性价比之选</view>
          <view class="muted" style="font-size: 22rpx">
            改善段 ≤ {{ paretoPriceCapWan }} 万/m² · 面积 Top {{ paretoTop.length }}
          </view>
        </view>
        <view class="pareto-desc muted">
          同面积段 + 同价格上限下，面积最大的小区 → 居住舒适度 × 总价可控
        </view>
        <view
          v-for="(row, i) in paretoTop"
          :key="row.communityId"
          class="pareto-row"
          @click="goCommunity(row.communityId)"
        >
          <view class="pareto-rank tap">{{ i + 1 }}</view>
          <view class="pareto-meta">
            <view class="pareto-name">{{ row.communityName }}</view>
            <view class="pareto-sub muted">
              {{ row.areaCohort }} · {{ row.quadrant }}
            </view>
          </view>
          <view class="pareto-stats">
            <text class="pareto-area">{{ row.medianArea.toFixed(0) }} m²</text>
            <text class="pareto-price muted">{{ (row.medianUnitPrice / 10000).toFixed(1) }} 万/m²</text>
          </view>
        </view>
      </view>

      <!-- 结果 -->
      <view class="card">
        <view class="row-between">
          <view class="card-title">结果</view>
          <view class="muted" v-if="total">
            共 {{ total }} 套 · 已显示 {{ items.length }}
            <text v-if="districtName"> · {{ districtName }}</text>
            <text v-if="keyword.trim()"> · 「{{ keyword.trim() }}」</text>
          </view>
        </view>
        <view v-if="filterCommunityId" class="community-filter-chip">
          <text>仅看小区：{{ filterCommunityLabel }}</text>
          <text class="community-filter-clear" @click.stop="clearCommunityFilter">清除</text>
        </view>
        <view v-if="total" class="muted" style="font-size: 22rpx; margin-bottom: 8rpx">
          {{ currentCityLabel }}筛选命中 {{ total }} 套（样本库本市共 {{ cityListingTotal }} 套）
        </view>
        <EmptyState
          v-if="items.length === 0"
          icon="⌂"
          title="暂无匹配房源"
          :desc="emptyFilterHint"
          action-text="重置筛选"
          @action="resetFilter"
        />
        <view
          v-for="it in items"
          :key="it.listing_id"
          class="listing-row"
          data-listing-card
          @click="goListing(it.listing_id)"
        >
          <image
            v-if="it.cover_url"
            class="listing-thumb"
            :src="it.cover_url"
            mode="aspectFill"
            lazy-load
            data-listing-thumb
          />
          <view v-else class="listing-thumb listing-thumb--empty" aria-hidden="true">
            <text class="listing-thumb-ph">房</text>
          </view>
          <view class="listing-main">
            <view class="listing-title">{{ it.title }}</view>
            <view class="listing-price-row">
              <text class="listing-price-main">{{ formatPrice(it.price_total) }}</text>
              <text class="listing-price-unit muted">{{ formatUnitPrice(it.unit_price) }}</text>
            </view>
            <view class="muted listing-sub">
              <template v-if="it.bedrooms != null">{{ it.bedrooms }}室<template v-if="it.bathrooms != null">{{ it.bathrooms }}卫</template> · </template>
              {{ formatArea(it.area_sqm) }} · {{ it.orientation || "-" }} · {{ it.decorate_type || "-" }}
              <text v-if="it.build_year"> · {{ it.build_year }}年</text>
            </view>
            <view v-if="listingCardTags(it).length" class="tag-row" data-listing-card-tags>
              <text v-for="tag in listingCardTags(it)" :key="tag" class="tag tag-pill">{{ tag }}</text>
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
        <view v-if="hasMore" class="row-gap" style="margin-top: 16rpx; justify-content: center">
          <button class="btn" size="mini" :loading="loadingMore" @click="loadMore">
            加载更多（还剩 {{ total - items.length }} 套）
          </button>
        </view>
        <view v-else-if="total > 0" class="muted" style="text-align: center; margin-top: 12rpx; font-size: 22rpx">
          已全部显示 {{ total }} 套
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
import { computed, onMounted, onUnmounted, ref } from "vue";
import { SNAPSHOT_UPDATED_EVENT } from "../../config";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { filterListings } from "../../local/queries";
import { takePendingListingQuery } from "../../local/homeEntry";
import {
  summarizeListingFreshnessByCity,
  getFreshestCommunityTopN,
  getStalestCommunityTopN,
  type CityFreshnessSummary,
  type FreshnessRankingEntry
} from "../../local/listingFreshnessRanking";
import {
  summarizeListingTagsByCity,
  type CityTagSummary
} from "../../local/listingTagsComparison";
import { getCities, getPeriods, getSources } from "../../local/queries";
import { getCommunityScatter, getCommunitiesByCity, getListingsByCity } from "../../local/store";
import {
  getCommunityScatterPareto,
  type ParetoEntry
} from "../../local/communityScatterRanking";
import type { CityItem, ListingItem, SourceStatItem } from "../../api/contracts";
import { toErrorMessage } from "../../utils/errorMessage";
import { useAppStore } from "../../store/app";
import EmptyState from "../../components/EmptyState.vue";
import {
  formatArea,
  formatPrice,
  formatUnitPrice,
  scoreClass
} from "../../utils/format";
import { getListingTagLabels } from "../../local/listingTags";
import { MAP_BEDROOM_BANDS, type MapBedroomBand } from "../../local/mapFind";
import * as store from "../../local/store";

const app = useAppStore();

const cities = ref<CityItem[]>([]);
const periods = ref<string[]>([]);
const sourceOptions = ref<SourceStatItem[]>([]);

const cityLabels = computed(() => cities.value.map((c) => c.city_name));
const cityIndex = computed(() => cities.value.findIndex((c) => c.city_id === app.cityId));
const currentCityLabel = computed(() => {
  const c = cities.value.find((c) => c.city_id === app.cityId);
  return c?.city_name || store.getCityById(app.cityId)?.cityName || "";
});
/** 数据查询用同步城市名，避免异步 cities 未就绪时性价比卡失真 */
const syncCityName = computed(
  () => store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? ""
);
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

const listingTypeLabels = ["全部", "二手房", "新房", "成交"];
const listingTypeIndex = ref(0);

const bedroomLabels = MAP_BEDROOM_BANDS.map((b) => b.label);
const bedroomIndex = ref(0);
const bedroomBand = computed<MapBedroomBand>(
  () => MAP_BEDROOM_BANDS[bedroomIndex.value]?.key ?? "all"
);

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

const decorateOptions = ["不限", "精装", "豪装", "普装", "简装", "毛坯"];
const decorateIndex = ref(0);

const scoreThresholds = [0, 40, 50, 60, 70, 80, 90];
const scoreIndex = ref(0);
const minQualityScore = computed(() => scoreThresholds[scoreIndex.value]);

const priceRange = ref<[number, number]>([0, 2000]);
const areaRange = ref<[number, number]>([0, 300]);

const filterCommunityId = ref<number | null>(null);
const districtName = ref<string>("");
const keyword = ref("");
const metaReady = ref(false);
const PAGE_SIZE = 30;
const page = ref(1);
const loadingMore = ref(false);

const districtOptions = computed(() => {
  const set = new Set<string>();
  for (const c of getCommunitiesByCity(app.cityId)) {
    if (c.districtName) set.add(c.districtName);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "zh"));
});

const cityListingTotal = computed(() => getListingsByCity(app.cityId).length);

/** 空结果时说明是哪个筛选项导致（避免「在售」字面量对不上种子「二手房」时用户以为坏了） */
const emptyFilterHint = computed(() => {
  const bits: string[] = [];
  if (listingTypeIndex.value === 1) {
    bits.push("类型=二手房");
  } else if (listingTypeIndex.value === 2) {
    bits.push("类型=新房");
  } else if (listingTypeIndex.value === 3) {
    bits.push("类型=成交（当前样本库几乎无成交套房源，请改回「全部/二手房/新房」）");
  }
  if (decorateIndex.value > 0) {
    bits.push(`装修=${decorateOptions[decorateIndex.value]}`);
  }
  if (bedroomIndex.value > 0) {
    bits.push(`户型=${bedroomLabels[bedroomIndex.value]}`);
  }
  if (districtName.value) bits.push(`区=${districtName.value}`);
  if (keyword.value.trim()) bits.push(`关键字「${keyword.value.trim()}」`);
  const head = bits.length ? `当前条件：${bits.join(" · ")}。` : "";
  return `${head}可点重置，或放宽总价/面积/装修；「成交」需有成交样本数据才会有结果。`;
});

const items = ref<ListingItem[]>([]);
const total = ref(0);
const errorMsg = ref("");
const hasMore = computed(() => items.value.length < total.value);

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
      districtName.value = "";
      loadMeta();
      applyFilter(true);
    }
  });
}

function pickDistrict() {
  const opts = districtOptions.value;
  if (opts.length === 0) {
    uni.showToast({ title: "本市暂无行政区数据", icon: "none" });
    return;
  }
  const labels = ["全部区", ...opts];
  const cur = districtName.value
    ? labels.indexOf(districtName.value)
    : 0;
  openSheet("选择行政区", labels, cur >= 0 ? cur : 0, (idx) => {
    districtName.value = idx === 0 ? "" : labels[idx] || "";
    applyFilter(true);
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
  openSheet("房屋类型", listingTypeLabels, listingTypeIndex.value, (idx) => {
    listingTypeIndex.value = idx;
    applyFilter();
  });
}

function pickBedroom() {
  openSheet("户型", bedroomLabels, bedroomIndex.value, (idx) => {
    bedroomIndex.value = idx;
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

async function applyFilter(resetPage = true) {
  errorMsg.value = "";
  if (resetPage) {
    page.value = 1;
    loadingMore.value = false;
  } else {
    loadingMore.value = true;
  }
  try {
    const body: any = {
      cityId: app.cityId,
      periodType: "weekly",
      weekEnd: app.weekEnd,
      page: page.value,
      pageSize: PAGE_SIZE,
      sort: { field: "overall_score", direction: "desc" },
      filters: {
        priceRange: priceRange.value,
        areaRange: areaRange.value,
        minQualityScore: minQualityScore.value || undefined,
        districtName: districtName.value || undefined,
        keyword: keyword.value.trim() || undefined
      }
    };
    if (filterCommunityId.value) body.communityId = filterCommunityId.value;

    if (listingTypeIndex.value === 1) body.filters.listingType = "二手房";
    else if (listingTypeIndex.value === 2) body.filters.listingType = "新房";
    else if (listingTypeIndex.value === 3) body.filters.listingType = "成交";

    if (bedroomBand.value !== "all") body.filters.bedroomBand = bedroomBand.value;

    if (decorateIndex.value > 0) body.filters.decorateType = decorateOptions[decorateIndex.value];

    const res = await filterListings(body);
    const batch = res.items || [];
    total.value = res.total || 0;
    items.value = resetPage ? batch : [...items.value, ...batch];
  } catch (e) {
    errorMsg.value = toErrorMessage(e);
    if (resetPage) {
      items.value = [];
      total.value = 0;
    }
  } finally {
    loadingMore.value = false;
  }
}

function loadMore() {
  if (!hasMore.value || loadingMore.value) return;
  page.value += 1;
  applyFilter(false);
}

function resetFilter() {
  priceRange.value = [0, 2000];
  areaRange.value = [0, 300];
  listingTypeIndex.value = 0;
  bedroomIndex.value = 0;
  decorateIndex.value = 0;
  scoreIndex.value = 0;
  districtName.value = "";
  keyword.value = "";
  filterCommunityId.value = null;
  applyFilter(true);
}

function clearCommunityFilter() {
  filterCommunityId.value = null;
  applyFilter(true);
}

const filterCommunityLabel = computed(() => {
  const id = filterCommunityId.value;
  if (id == null) return "";
  return store.getCommunityById(id)?.communityName ?? `小区 #${id}`;
});

function listingCardTags(it: ListingItem): string[] {
  return getListingTagLabels(it.listing_id, it.tags_json).slice(0, 4);
}

function goListing(id: number) {
  uni.navigateTo({ url: `/pages/listing-detail/listing-detail?id=${id}` });
}

function goCommunity(id: number) {
  uni.navigateTo({ url: `/pages/community/community?id=${id}` });
}

// v0.95.0：市场流动性（listing_freshness.csv）
const freshnessSummary = computed<CityFreshnessSummary | null>(() => {
  const all = summarizeListingFreshnessByCity();
  return all.find((s) => s.cityId === app.cityId) ?? null;
});
const freshestTop = computed<FreshnessRankingEntry[]>(() => {
  const all = getFreshestCommunityTopN(app.cityId, 3);
  return all;
});
const stalestTop = computed<FreshnessRankingEntry[]>(() => {
  const all = getStalestCommunityTopN(app.cityId, 3);
  return all;
});

/** 本地百分比格式化（listing-filter 页面未全局共享 formatPct） */
function formatPct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

// v0.96.0：本市标签（不再默认横评三市）
const tagCitySummary = computed<CityTagSummary[]>(() =>
  summarizeListingTagsByCity(8)
);
const tagCityLocal = computed<CityTagSummary | null>(
  () => tagCitySummary.value.find((c) => c.cityId === app.cityId) ?? null
);

// v1.118.0 性价比之选：同面积段 + 价格上限下面积 Top N
// 价格上限采用"当前城市单价中位数 + 50%" —— 让卡跟随当前城市动态调整
const paretoPriceCapWan = computed<number>(() => {
  const allScatter = getCommunityScatter();
  if (allScatter.length === 0) return 8; // 兜底
  const cityName = syncCityName.value;
  if (!cityName) return 8;
  const cityRows = allScatter.filter(
    (r) => r.cityName === cityName && r.areaCohort === "改善(60-110)"
  );
  if (cityRows.length === 0) return 8;
  const sorted = [...cityRows.map((r) => r.medianUnitPrice)].sort(
    (a, b) => a - b
  );
  const median = sorted[Math.floor(sorted.length / 2)]!;
  // 上限 = 中位数 × 1.5（容许小幅溢价去搜面积更大）
  return Math.round((median * 1.5) / 10000);
});
const paretoTop = computed<ParetoEntry[]>(() => {
  const capYuan = paretoPriceCapWan.value * 10000;
  const cityName = syncCityName.value;
  return getCommunityScatterPareto("改善(60-110)", capYuan, 12)
    .filter((r) => !cityName || r.cityName === cityName)
    .slice(0, 5);
});

onLoad((q: any) => {
  if (q?.communityId) {
    filterCommunityId.value = Number(q.communityId);
  }
});

onShow(async () => {
  const pending = takePendingListingQuery();
  if (!pending) return;
  keyword.value = pending;
  if (!metaReady.value) return;
  await applyFilter(true);
});

onMounted(async () => {
  uni.$on(SNAPSHOT_UPDATED_EVENT, refreshSnapshotData);
  await loadMeta();
  metaReady.value = true;
  await applyFilter();
});

async function refreshSnapshotData() {
  cities.value = [];
  await loadMeta();
  await applyFilter();
}

onUnmounted(() => {
  uni.$off(SNAPSHOT_UPDATED_EVENT, refreshSnapshotData);
});
</script>

<style lang="scss" scoped>
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.search-input {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.search-input .input {
  flex: 1;
  box-sizing: border-box;
  height: 64rpx;
  min-height: 64rpx;
  line-height: 64rpx;
  padding: 0 20rpx;
  border-radius: 12rpx;
  background: var(--color-soft);
  color: var(--color-heading);
  font-size: 28rpx;
}

/* v0.95.0：市场流动性条 */
.freshness-bar {
  display: flex;
  height: 12rpx;
  border-radius: 8rpx;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.15);
}

.freshness-bar-new {
  background: #16a34a; /* ≤2 周 鲜 */
  height: 100%;
}

.freshness-bar-r4 {
  background: #d97706; /* 2–4 周 中 */
  height: 100%;
}

.freshness-bar-stale {
  background: #9ca3af; /* 陈旧 */
  height: 100%;
}

.legend-new {
  color: #16a34a;
}

.legend-r4 {
  color: #d97706;
}

.legend-stale {
  color: #9ca3af;
}

/* v0.96.0：标签横评 */
.tag-penetration-row {
  padding: 6rpx 0;
}
.tag-penetration-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4rpx;
}
.tag-name {
  font-size: 22rpx;
  font-weight: 500;
}
.tag-penetration-bar {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.tag-penetration-cell {
  position: relative;
  display: flex;
  align-items: center;
  height: 18rpx;
  border-radius: 6rpx;
  background: rgba(148, 163, 184, 0.12);
  overflow: hidden;
}
.tag-penetration-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #6366f1);
  border-radius: 6rpx;
}
.tag-penetration-label {
  position: absolute;
  left: 6rpx;
  font-size: 18rpx;
  white-space: nowrap;
}

/* 复用项目里通用的 drift-row（如果全局已有则会被覆盖） */
.drift-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 6rpx 0;
  font-size: 22rpx;
}
.drift-rank {
  display: inline-block;
  width: 28rpx;
  text-align: center;
  font-weight: 600;
  color: var(--muted, #94a3b8);
}
.drift-city {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drift-value {
  font-variant-numeric: tabular-nums;
}
.drift-up {
  color: #16a34a;
}
.drift-down {
  color: #dc2626;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.form-label {
  color: var(--color-muted);
  font-size: 24rpx;
}

.picker-value {
  background: var(--color-soft);
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  color: var(--color-heading);
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
  background: var(--color-soft-strong);
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
  background: var(--color-panel);
  color: var(--color-heading);
  border-radius: 6rpx;
  padding: 2rpx 8rpx;
  font-size: 20rpx;
  white-space: nowrap;
  margin-bottom: 6rpx;
  border: 1rpx solid var(--color-soft-strong);
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
  color: var(--color-muted);
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
  background: var(--color-surface);
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  display: flex;
  flex-direction: column;
  padding: 16rpx 0 calc(16rpx + var(--safe-area-bottom, 0px));
  box-sizing: border-box;
}

.sheet-title {
  text-align: center;
  font-size: 28rpx;
  color: var(--color-muted);
  padding: 16rpx;
  border-bottom: 1rpx solid var(--color-soft);
}

.sheet-list {
  flex: 1;
  max-height: 56vh;
  padding: 0 16rpx;
}

.sheet-item {
  padding: 24rpx 16rpx;
  border-bottom: 1rpx solid var(--color-soft);
  color: var(--color-heading);
  font-size: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sheet-item--active {
  color: #4ade80;
  background: var(--color-soft);
}

.sheet-check {
  color: #4ade80;
  font-weight: bold;
}

.sheet-cancel {
  text-align: center;
  padding: 28rpx 0;
  color: var(--color-muted);
  font-size: 30rpx;
  border-top: 1rpx solid var(--color-soft);
}

/* v1.118.0 性价比之选卡 */
.pareto-desc {
  font-size: 22rpx;
  margin: 12rpx 0 16rpx;
  line-height: 1.5;
}
.pareto-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--color-soft-strong);
  cursor: pointer;
}
.pareto-row:last-child {
  border-bottom: none;
}
.pareto-row:active {
  background: var(--color-soft-strong);
}
.pareto-rank {
  width: 44rpx;
  height: 44rpx;
  border-radius: 22rpx;
  background: #facc15;
  color: var(--color-heading);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 26rpx;
  flex-shrink: 0;
}
.pareto-meta {
  flex: 1;
  min-width: 0;
}
.pareto-name {
  font-size: 28rpx;
  color: var(--color-heading);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pareto-sub {
  font-size: 22rpx;
  margin-top: 4rpx;
}
.pareto-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.pareto-area {
  font-size: 28rpx;
  color: #4ade80;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.pareto-price {
  font-size: 22rpx;
  font-variant-numeric: tabular-nums;
}

.listing-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--color-soft-strong);
  min-height: 88rpx; /* a11y: 至少 44pt 触摸目标 */
}

.listing-row:last-child {
  border-bottom: none;
}

.listing-thumb {
  width: 160rpx;
  height: 120rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  background: var(--color-soft-strong, #e2e8f0);
}
.listing-thumb--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.listing-thumb-ph {
  font-size: 28rpx;
  color: var(--color-muted, #94a3b8);
}

.listing-main {
  flex: 1;
  min-width: 0;
}

.listing-title {
  font-size: 28rpx;
  color: var(--color-heading);
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

.listing-price-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 4rpx;
}
.listing-price-main {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--color-danger, #e11d48);
  font-variant-numeric: tabular-nums;
}
.listing-price-unit {
  font-size: 22rpx;
}
.community-filter-chip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
  padding: 10rpx 14rpx;
  border-radius: 12rpx;
  background: var(--color-soft-strong);
  font-size: 24rpx;
  color: var(--color-heading);
}
.community-filter-clear {
  color: var(--color-primary, #2563eb);
  font-size: 22rpx;
}
.tag-pill {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-primary, #2563eb);
  border: none;
}

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
  color: var(--color-muted, #94a3b8);
  font-weight: 500;
}
.minidim-track {
  width: 100%;
  height: 6rpx;
  background: var(--color-soft-strong);
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
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
</style>

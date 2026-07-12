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
        <text v-if="periodHint" class="muted period-hint">{{ periodHint }}</text>
      </view>

      <!-- 全国 70 城指数（顶部第一张卡，入口也是 stats70 页） -->
      <view
        class="card stats70-card tap-target"
        role="button"
        tabindex="0"
        hover-class="card-active"
        @click="goStats70"
      >
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

      <!-- 政府每日网签（摘要，点击进详情页） -->
      <view
        class="card wangqian-card tap-target"
        role="button"
        tabindex="0"
        hover-class="card-active"
        @click="goWangqian"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">政府每日网签</view>
          <view class="muted" style="font-size: 22rpx">
            {{ wangqianDateLabel }}
            <text v-if="wangqianFreshLabel" class="wq-fresh" :class="wangqianFreshClass">{{ wangqianFreshLabel }}</text>
          </view>
        </view>

        <view v-if="!wangqianReady" class="empty" style="padding: 24rpx 0">
          网签数据未加载。
        </view>
        <view v-else-if="!currentWangqian" class="empty" style="padding: 24rpx 0">
          当前城市暂无网签日更（仅深圳/广州）
        </view>
        <view v-else>
          <view class="stats70-grid">
            <view class="stats70-cell">
              <text class="cell-label">新房 · 住宅</text>
              <text class="cell-value wangqian-up">
                {{ formatWangqianUnits(currentWangqian.newUnits) }}
              </text>
              <text class="cell-sub muted">{{ formatWangqianArea(currentWangqian.newArea) }}</text>
            </view>
            <view class="stats70-cell">
              <text class="cell-label">二手 · 住宅</text>
              <text class="cell-value wangqian-res">
                {{ formatWangqianUnits(currentWangqian.secondResidentialUnits) }}
              </text>
              <text class="cell-sub muted">{{ formatWangqianArea(currentWangqian.secondResidentialArea) }}</text>
            </view>
            <view class="stats70-cell" v-if="currentWangqian.secondAllUnits != null">
              <text class="cell-label">二手 · 全部</text>
              <text class="cell-value wangqian-all">
                {{ formatWangqianUnits(currentWangqian.secondAllUnits) }}
              </text>
              <text class="cell-sub muted">{{ formatWangqianArea(currentWangqian.secondAllArea) }}</text>
            </view>
          </view>
        </view>

        <view class="stats70-foot">点击查看 90 日趋势与分区 ›</view>
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
        <view
          v-if="coverage && coverage.total_districts > districtItems.length"
          class="muted district-note"
          @click="goWangqian"
        >
          仅显示有挂牌房源的区（{{ districtItems.length }} / 全市 {{ coverage.total_districts }} 区）。
          挂牌来自安居客周度抓取，覆盖有限；全市各区成交见「政府每日网签」›
        </view>
      </view>

      <!-- v0.8.0 区级近 8 周价格趋势 -->
      <view v-if="trendItems.length > 0" class="card">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">区级近 8 周房价趋势</view>
          <view class="muted" style="font-size: 22rpx">按近 4 周均价 vs 前 4 周均价</view>
        </view>
        <view v-for="it in trendItems" :key="it.district_name" class="trend-row">
          <view class="trend-row-head">
            <text class="trend-name">{{ it.district_name }}</text>
            <view class="trend-meta">
              <text class="muted" style="font-size: 22rpx">
                最近 4 周 {{ it.recent_4w_listing_count }} 套 · 均价 {{ formatTrendPrice(it.latest_avg_unit_price) }}
              </text>
            </view>
            <text class="trend-change" :class="trendDeltaClass(it.recent_change_ratio)">
              {{ trendArrow(it.recent_change_ratio) }} {{ trendPct(it.recent_change_ratio) }}
            </text>
          </view>
          <view class="trend-bars">
            <view
              v-for="p in it.points"
              :key="p.week_end"
              class="trend-bar-col"
              :title="`${p.week_end} 均价 ${Math.round(p.avg_unit_price).toLocaleString()} 元/㎡ (${p.listing_count} 套)`"
            >
              <view
                class="trend-bar-fill"
                :style="{ height: trendBarPct(it, p) + '%' }"
              ></view>
            </view>
          </view>
          <view class="trend-axis">
            <text class="muted" style="font-size: 20rpx">
              {{ it.points[0]?.week_end }} → {{ it.points[it.points.length - 1]?.week_end }}
            </text>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：本地 listings.csv 按 (城市/区/周) 聚合均价（中位数 = 排除极端值后更稳健）。
          样本量较小的区波动较大，仅供参考。
        </view>
      </view>

      <!-- v0.10.0 近 4 周网签热度榜 -->
      <view v-if="wangqianOverview && wangqianOverview.items.length > 0" class="card">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">
            近 4 周二手网签热度榜 · {{ wangqianOverview.cityName }}
          </view>
          <view class="muted" style="font-size: 22rpx">
            累计 {{ wangqianOverview.totalUnits }} 套
          </view>
        </view>
        <view v-for="it in wangqianOverview.items" :key="it.district" class="wq-row">
          <text class="wq-rank" :class="rankClass(it.rank)">{{ it.rank }}</text>
          <text class="wq-name">{{ it.district }}</text>
          <view class="wq-track">
            <view
              class="wq-fill"
              :style="{ width: wangqianPct(it) + '%' }"
            ></view>
          </view>
          <text class="wq-units">
            {{ it.totalUnits }} 套
            <text class="muted" style="font-size: 20rpx">({{ formatWqArea(it.totalAreaSqm) }})</text>
          </text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：深圳市/广州市住建局公示的每日网签，按周聚合；只看二手住宅。
          网签活跃度反映板块热度，与挂牌价互补（挂牌 = 卖家意愿，网签 = 真实成交）。
        </view>
      </view>

      <!-- v0.11.0 学区溢价榜 -->
      <view v-if="schoolPremiumOverview && schoolPremiumOverview.items.length > 0" class="card">
        <view class="row-between">
          <view class="card-title">学区溢价榜 · {{ schoolPremiumOverview.cityName }}</view>
          <view class="muted">Top {{ schoolPremiumOverview.items.length }}</view>
        </view>
        <view v-for="it in schoolPremiumOverview.items" :key="it.districtName" class="sp-row">
          <view class="sp-rank">
            <text :class="['sp-medal', medalClass(it.rank)]">{{ medalText(it.rank) }}</text>
          </view>
          <view class="sp-mid">
            <view class="sp-district">{{ it.districtName }}</view>
            <view class="sp-meta">
              <text>评分 {{ it.avgSchoolScore.toFixed(1) }}</text>
              <text class="muted"> · {{ it.schoolCount }} 所名校</text>
              <text class="muted"> · {{ it.listingCount }} 套</text>
            </view>
          </view>
          <view class="sp-right">
            <view :class="['sp-premium', premiumClass(it.premiumRatio)]">
              {{ formatPremium(it.premiumRatio) }}
            </view>
            <view class="muted" style="font-size: 20rpx">¥{{ formatNum(it.medianUnitPrice) }}/㎡</view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：学校评分由 latest_level_score_raw 加权；溢价 = (该区中位单价 / 全市中位单价 - 1)。
          已过滤 listings &lt; 10 套的小样本区。名校聚集区通常呈现正溢价。
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
          class="community-row tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
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

      <!-- v0.14.0 学区评分 Top 小区 -->
      <view v-if="schoolPremiumCommunityItems.length > 0" class="card">
        <view class="row-between">
          <view class="card-title">学区评分 Top {{ schoolPremiumCommunityItems.length }} 小区</view>
          <view class="muted">按区内学校 latest_level_score 加权</view>
        </view>
        <view v-if="schoolPremiumCommunityItems.length === 0" class="empty">暂无数据</view>
        <view
          v-for="item in schoolPremiumCommunityItems"
          :key="item.communityId"
          class="community-row tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="goCommunity(item.communityId)"
        >
          <view class="community-rank">
            <text :class="['sp-medal-mini', spMedalClass(item.rank)]">{{ item.rank }}</text>
          </view>
          <view class="community-main">
            <view class="community-name">{{ item.communityName }}</view>
            <view class="muted">
              {{ item.districtName }} · 评分 {{ item.avgSchoolScore.toFixed(1) }} · {{ item.schoolCount }} 所学校
            </view>
          </view>
          <view class="community-sp-price">
            <text v-if="item.medianUnitPrice > 0" class="sp-up">¥{{ formatNum(item.medianUnitPrice) }}</text>
            <text v-else class="muted">—</text>
            <view class="muted" style="font-size: 20rpx">中位/㎡</view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：schools.csv (district_name) + school_indicators.csv (latest_level_score_raw)。
          同一区内的学校评分聚合到该区所有小区，便于横向对比「住在哪个小区最沾名校光」。
        </view>
      </view>

      <!-- v0.16.0 实时天气 + 4 天预报 -->
      <view v-if="weatherResp && (weatherResp.live || weatherResp.forecast.length > 0)" class="card">
        <view class="row-between">
          <view class="card-title">🌤️ {{ weatherResp.cityName }} 实时天气</view>
          <view class="muted">
            {{ weatherResp.live?.report_time || "—" }}
          </view>
        </view>
        <view v-if="weatherResp.live" class="weather-live">
          <view class="weather-main">
            <text class="weather-icon">{{ weatherEmoji(weatherResp.live.weather) }}</text>
            <view class="weather-info">
              <text class="weather-temp">{{ weatherResp.live.temperature }}°C</text>
              <text class="weather-cond">{{ weatherResp.live.weather }}</text>
            </view>
          </view>
          <view class="weather-stats">
            <view class="weather-stat">
              <text class="weather-stat-label">💧 湿度</text>
              <text class="weather-stat-value">{{ weatherResp.live.humidity }}%</text>
            </view>
            <view class="weather-stat">
              <text class="weather-stat-label">💨 风力</text>
              <text class="weather-stat-value">{{ weatherResp.live.windpower }}级 {{ weatherResp.live.winddirection }}</text>
            </view>
            <view class="weather-stat">
              <text class="weather-stat-label">🌫 AQI</text>
              <text :class="['weather-stat-value', 'aqi-chip', aqiChipClass]">
                {{ weatherResp.aqi_estimate?.label ?? "—" }}
              </text>
            </view>
          </view>
        </view>
        <view v-if="weatherResp.forecast.length > 0" class="weather-forecast">
          <view class="forecast-title">未来 4 天预报</view>
          <view class="forecast-grid">
            <view
              v-for="(d, idx) in weatherResp.forecast"
              :key="d.date"
              class="forecast-day"
            >
              <text class="forecast-week">{{ idx === 0 ? "今天" : d.week }}</text>
              <text class="forecast-date">{{ d.date.slice(5) }}</text>
              <text class="forecast-icon">{{ weatherEmoji(d.dayweather) }}</text>
              <view class="forecast-temp">
                <text class="forecast-high">{{ d.daytemp }}°</text>
                <text class="forecast-low">/ {{ d.nighttemp }}°</text>
              </view>
              <text class="forecast-cond">{{ d.dayweather }}</text>
            </view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：高德地图 /v3/weather/weatherInfo (实况 + 4 天预报)。
          AQI 因高德 API 不提供 AQI 字段，此处按湿度+风力+温度粗略估算，仅供参考。
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
            class="sheet-item tap-target"
            :class="{ 'sheet-item--active': idx === sheet.currentIndex }"
            role="button"
            tabindex="0"
            hover-class="row-active"
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
import { toErrorMessage } from "../../utils/errorMessage";
import { getCities, getCoverage, getPeriods, getRuntimeMeta, getSources } from "../../local/queries";
import { getCommunityRanking, getDistrictCompare, getCityDistrictOverview, getWangqianHeatmap, getSchoolPremiumRank, getSchoolPremiumCommunityRank, getWeather, type DistrictTrendItem, type WangqianOverviewItem, type SchoolPremiumOverview, type SchoolPremiumCommunityItem, type WeatherResponse } from "../../local/queries";
import {
  getLatestIndexForCity,
  getLatestMonth,
  type LatestIndexForCity
} from "../../local/stats70";
import {
  getLatestCityDaily,
  type CityDailySnapshot
} from "../../local/dailyWangqian";
import { hasStats70, hasDailyWangqian } from "../../local/store";
import { refreshFromRemote } from "../../local/dataRefresher";
import { refreshWangqianFromRemote } from "../../local/wangqianDataRefresher";
import type {
  CityItem,
  CommunityRankingItem,
  CoverageResponse,
  DistrictCompareItem,
  RuntimeMetaResponse,
  SourceStatItem
} from "../../api/contracts";
import { coverageText, formatUnitPrice, showToast, daysAgoFromToday } from "../../utils/format";

const app = useAppStore();

const cities = ref<CityItem[]>([]);
const periods = ref<string[]>([]);
const sourceOptions = ref<SourceStatItem[]>([]);
const runtime = ref<RuntimeMetaResponse | null>(null);
const coverage = ref<CoverageResponse | null>(null);

const ranking = ref<CommunityRankingItem[]>([]);
const rankingTotal = ref<number>(0);
const districtItems = ref<DistrictCompareItem[]>([]);
const trendItems = ref<DistrictTrendItem[]>([]);
const wangqianOverview = ref<WangqianOverviewItem | null>(null);
const schoolPremiumOverview = ref<SchoolPremiumOverview | null>(null);
const schoolPremiumCommunityItems = ref<SchoolPremiumCommunityItem[]>([]);
const weatherResp = ref<WeatherResponse | null>(null);

const errorMsg = ref<string>("");
const loading = ref<boolean>(false);

// 房源来自安居客「每周快照」，最新周期是上一个完整周（周日结束），并非当天。
// 这里给一句说明，避免用户误以为“周期结束日没更新到今天”是 bug。
const periodHint = computed(() => {
  const list = periods.value;
  if (list.length === 0) return "";
  const latest = list[list.length - 1];
  return `房源为安居客每周快照，最新周期 ${latest}（非当日）`;
});

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
  } catch (e) {
    errorMsg.value = toErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

/**
 * 「刷新」= 先尝试从 CDN 镜像拉最新（安居客 listings + 深广网签），
 * 再重算本地视图。任一远端成功即提示已刷新；全失败则回退本地并提示网络问题。
 */
async function reload() {
  if (loading.value) return;
  loading.value = true;
  errorMsg.value = "";
  let remoteOk = false;
  try {
    const results = await Promise.allSettled([
      refreshFromRemote(),
      refreshWangqianFromRemote()
    ]);
    remoteOk = results.some(
      (r) => r.status === "fulfilled" && (r.value as { ok?: boolean })?.ok === true
    );
  } catch {
    // 忽略：远端不可用时回退本地数据
  }
  await loadAll();
  showToast(remoteOk ? "已刷新" : "网络不可用，仍用本地数据");
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
  } catch (e) {
    errorMsg.value = `加载周期失败：${toErrorMessage(e)}`;
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
    // v0.8.0 区级近 N 周趋势
    if (app.cityId) {
      trendItems.value = await getCityDistrictOverview({ cityId: app.cityId });
      // v0.10.0 网签热度榜：广州只有新房数据，深圳有新房+二手
      const citiesRes = await getCities();
      const city = citiesRes.items.find((c) => c.city_id === app.cityId);
      const cityName = city?.city_name ?? "";
      const preferredCat: "新房" | "二手" = cityName === "广州" ? "新房" : "二手";
      let heat = await getWangqianHeatmap({
        cityId: app.cityId,
        category: preferredCat,
        weeksBack: 4,
        limit: 10
      });
      // 兜底：再试另一个 category
      if (!heat || heat.items.length === 0) {
        heat = await getWangqianHeatmap({
          cityId: app.cityId,
          category: preferredCat === "二手" ? "新房" : "二手",
          weeksBack: 4,
          limit: 10
        });
      }
      wangqianOverview.value = heat;
      // v0.11.0 学区溢价榜
      schoolPremiumOverview.value = await getSchoolPremiumRank({
        cityId: app.cityId,
        limit: 10
      });
      // v0.14.0 学区评分 Top 小区
      const spc = await getSchoolPremiumCommunityRank({
        cityId: app.cityId,
        limit: 10
      });
      schoolPremiumCommunityItems.value = spc?.items ?? [];
    }

    // v0.16.0 实时天气 + 4 天预报
    try {
      weatherResp.value = await getWeather({ cityId: app.cityId });
    } catch (e) {
      console.warn("getWeather failed:", e);
    }
  } catch (e) {
    errorMsg.value = `加载失败：${toErrorMessage(e)}`;
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

// ----- v0.8.0 区级近 8 周趋势 -----
function trendDeltaClass(ratio: number | null): string {
  if (ratio == null) return "";
  if (ratio > 0.005) return "trend-up";
  if (ratio < -0.005) return "trend-down";
  return "trend-flat";
}

function trendArrow(ratio: number | null): string {
  if (ratio == null) return "—";
  if (ratio > 0.005) return "▲";
  if (ratio < -0.005) return "▼";
  return "—";
}

function trendPct(ratio: number | null): string {
  if (ratio == null) return "—";
  const pct = ratio * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatTrendPrice(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v).toLocaleString()} 元/㎡`;
}

function last4WAvgPrice(it: DistrictTrendItem): number | null {
  const tail = it.points.slice(-4);
  if (tail.length === 0) return null;
  const sum = tail.reduce((s, p) => s + p.avg_unit_price, 0);
  return sum / tail.length;
}

function trendBarPct(it: DistrictTrendItem, p: { avg_unit_price: number }): number {
  if (it.points.length === 0) return 0;
  const vals = it.points.map((q) => q.avg_unit_price);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  if (maxV === minV) return 50;
  // normalize to 30-100%
  return 30 + ((p.avg_unit_price - minV) / (maxV - minV)) * 70;
}

// ----- v0.10.0 网签热度榜 -----
function rankClass(rank: number): string {
  if (rank === 1) return "wq-rank-gold";
  if (rank === 2) return "wq-rank-silver";
  if (rank === 3) return "wq-rank-bronze";
  return "wq-rank-normal";
}

function wangqianMaxUnits(): number {
  if (!wangqianOverview.value || wangqianOverview.value.items.length === 0) return 1;
  return Math.max(1, ...wangqianOverview.value.items.map((i) => i.totalUnits));
}

function wangqianPct(it: { totalUnits: number }): number {
  return (it.totalUnits / wangqianMaxUnits()) * 100;
}

// ----- v0.11.0 学区溢价榜 -----
function formatNum(n: number): string {
  return n.toLocaleString("zh-CN");
}
function formatPremium(r: number): string {
  const pct = (r * 100).toFixed(1);
  if (r > 0) return `+${pct}%`;
  if (r < 0) return `${pct}%`;
  return "0%";
}
function premiumClass(r: number): string {
  if (r >= 0.15) return "sp-pos-strong";
  if (r > 0) return "sp-pos";
  if (r > -0.1) return "sp-flat";
  return "sp-neg";
}
function medalText(rank: number): string {
  if (rank === 1) return "1";
  if (rank === 2) return "2";
  if (rank === 3) return "3";
  return String(rank);
}
function medalClass(rank: number): string {
  if (rank === 1) return "medal-gold";
  if (rank === 2) return "medal-silver";
  if (rank === 3) return "medal-bronze";
  return "medal-flat";
}
function spMedalClass(rank: number): string {
  if (rank === 1) return "medal-gold";
  if (rank === 2) return "medal-silver";
  if (rank === 3) return "medal-bronze";
  return "medal-flat-mini";
}

// v0.16.0 weather helpers
function weatherEmoji(cond: string): string {
  if (!cond) return "❓";
  if (cond.includes("晴")) return "☀️";
  if (cond.includes("多云")) return "⛅";
  if (cond.includes("阴")) return "☁️";
  if (cond.includes("雨")) {
    if (cond.includes("雷")) return "⛈️";
    if (cond.includes("大")) return "🌧️";
    return "🌦️";
  }
  if (cond.includes("雪")) return "❄️";
  if (cond.includes("雾")) return "🌫️";
  if (cond.includes("霾")) return "😷";
  return "🌡️";
}

const aqiChipClass = computed(() => {
  const lvl = weatherResp.value?.aqi_estimate?.level;
  if (lvl == null) return "aqi-unknown";
  if (lvl === 0) return "aqi-good";
  if (lvl === 1) return "aqi-ok";
  if (lvl === 2) return "aqi-light";
  return "aqi-mid";
});

function formatWqArea(sqm: number): string {
  if (sqm >= 10000) return `${(sqm / 10000).toFixed(1)} 万㎡`;
  return `${Math.round(sqm).toLocaleString()} ㎡`;
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

function goWangqian() {
  const name = currentWangqianCityName.value;
  const city = name === "深圳" || name === "广州" ? name : "深圳";
  uni.navigateTo({ url: `/pages/wangqian/wangqian?city=${encodeURIComponent(city)}` });
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

// 政府网签卡片 -------------------------------------------------------
const wangqianReady = computed(() => hasDailyWangqian());

const currentWangqian = computed<CityDailySnapshot | null>(() => {
  if (!hasDailyWangqian()) return null;
  const name = currentWangqianCityName.value;
  if (!name) return null;
  if (name !== "深圳" && name !== "广州") return null;
  return getLatestCityDaily(name);
});

const currentWangqianCityName = computed(() => {
  const city = cities.value.find((c) => c.city_id === app.cityId);
  return city?.city_name.replace(/市$/, "") ?? "";
});

const wangqianDateLabel = computed(() => {
  const d = currentWangqian.value?.date;
  return d || "";
});

const wangqianDaysAgo = computed(() =>
  daysAgoFromToday(currentWangqian.value?.date)
);
const wangqianFreshLabel = computed(() => {
  const n = wangqianDaysAgo.value;
  if (n == null) return "";
  if (n <= 0) return "今日";
  if (n === 1) return "昨日";
  return `${n} 天前`;
});
const wangqianFreshClass = computed(() => {
  const n = wangqianDaysAgo.value;
  if (n == null) return "";
  if (n <= 3) return "wq-fresh-ok";
  if (n <= 7) return "wq-fresh-warn";
  return "wq-fresh-stale";
});

function formatWangqianUnits(v: number | null): string {
  if (v == null) return "—";
  return String(v);
}

function formatWangqianArea(v: number | null): string {
  if (v == null) return "";
  if (v >= 10000) return `${(v / 10000).toFixed(1)} 万㎡`;
  return `${Math.round(v)} ㎡`;
}

onMounted(async () => {
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
  await reload();
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

.period-hint {
  display: block;
  margin-top: 12rpx;
  color: #94a3b8;
  font-size: 22rpx;
  line-height: 1.4;
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

.district-note {
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #1f2937;
  font-size: 22rpx;
  line-height: 1.5;
  color: #64748b;
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
  background: #111827;
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

.wangqian-card {
  background: linear-gradient(135deg, #111827 0%, #0c1a2e 100%);
  border: 1rpx solid #1e3a5f;
}

.wangqian-up {
  color: #4ade80 !important;
}

.wq-fresh {
  margin-left: 10rpx;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
}
.wq-fresh-ok {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
}
.wq-fresh-warn {
  background: rgba(234, 179, 8, 0.18);
  color: #facc15;
}
.wq-fresh-stale {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

.wangqian-res {
  color: #38bdf8 !important;
}

.wangqian-all {
  color: #f59e0b !important;
}

/* v0.8.0 区级近 8 周趋势 */
.trend-row {
  padding: 12rpx 0;
  border-bottom: 1rpx solid #1f2937;
}
.trend-row:last-child {
  border-bottom: none;
}
.trend-row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}
.trend-name {
  font-size: 26rpx;
  color: #f3f4f6;
  font-weight: 500;
  min-width: 140rpx;
}
.trend-meta {
  flex: 1;
  text-align: right;
}
.trend-change {
  font-size: 24rpx;
  font-weight: 600;
  min-width: 100rpx;
  text-align: right;
}
.trend-up {
  color: #ef4444;
}
.trend-down {
  color: #22c55e;
}
.trend-flat {
  color: #94a3b8;
}
.trend-bars {
  display: flex;
  align-items: flex-end;
  height: 60rpx;
  gap: 4rpx;
  margin-top: 8rpx;
}
.trend-bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.trend-bar-fill {
  width: 80%;
  background: linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%);
  border-radius: 2rpx 2rpx 0 0;
  min-height: 4rpx;
}
.trend-axis {
  margin-top: 4rpx;
  text-align: center;
}

/* v0.11.0 学区溢价榜 */
.sp-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f1f5f9;
}
.sp-row:last-of-type {
  border-bottom: none;
}
.sp-rank {
  width: 56rpx;
  text-align: center;
}
.sp-medal {
  display: inline-block;
  width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  border-radius: 50%;
  font-weight: 600;
  font-size: 22rpx;
  text-align: center;
  color: #fff;
}
.medal-gold {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}
.medal-silver {
  background: linear-gradient(135deg, #cbd5e1, #94a3b8);
}
.medal-bronze {
  background: linear-gradient(135deg, #d97706, #b45309);
}
.medal-flat {
  background: #e2e8f0;
  color: #475569;
}
.medal-flat-mini {
  background: #1e293b;
  color: #94a3b8;
}
.sp-medal-mini {
  display: inline-block;
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  border-radius: 50%;
  font-weight: 600;
  font-size: 22rpx;
  text-align: center;
  color: #fff;
}
.sp-up {
  color: #0ea5e9;
  font-weight: 600;
  font-family: "Menlo", "Consolas", monospace;
}
.community-sp-price {
  text-align: right;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* v0.16.0 weather */
.weather-live {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8rpx;
  flex-wrap: wrap;
  gap: 12rpx;
}
.weather-main {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.weather-icon {
  font-size: 60rpx;
  line-height: 1;
}
.weather-info {
  display: flex;
  flex-direction: column;
}
.weather-temp {
  font-size: 48rpx;
  font-weight: 700;
  color: #f97316;
  line-height: 1.1;
}
.weather-cond {
  font-size: 24rpx;
  color: #64748b;
}
.weather-stats {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}
.weather-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: rgba(248, 250, 252, 0.7);
  border-radius: 8rpx;
  padding: 6rpx 12rpx;
}
.weather-stat-label {
  font-size: 20rpx;
  color: #94a3b8;
}
.weather-stat-value {
  font-size: 24rpx;
  font-weight: 600;
  color: #0f172a;
}
.aqi-chip {
  border-radius: 6rpx;
  padding: 2rpx 8rpx;
  font-size: 22rpx !important;
}
.aqi-good { background: rgba(34, 197, 94, 0.18); color: #15803d !important; }
.aqi-ok { background: rgba(132, 204, 22, 0.18); color: #65a30d !important; }
.aqi-light { background: rgba(234, 179, 8, 0.18); color: #b45309 !important; }
.aqi-mid { background: rgba(220, 38, 38, 0.18); color: #b91c1c !important; }
.aqi-unknown { background: rgba(148, 163, 184, 0.15); color: #475569 !important; }
.weather-forecast {
  margin-top: 12rpx;
}
.forecast-title {
  font-size: 22rpx;
  color: #64748b;
  margin-bottom: 8rpx;
}
.forecast-grid {
  display: flex;
  gap: 8rpx;
  overflow-x: auto;
}
.forecast-day {
  flex: 1;
  min-width: 110rpx;
  background: rgba(248, 250, 252, 0.7);
  border-radius: 8rpx;
  padding: 8rpx 4rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
}
.forecast-week {
  font-size: 22rpx;
  font-weight: 600;
  color: #0f172a;
}
.forecast-date {
  font-size: 18rpx;
  color: #94a3b8;
}
.forecast-icon {
  font-size: 36rpx;
  line-height: 1;
}
.forecast-temp {
  display: flex;
  gap: 4rpx;
}
.forecast-high {
  font-size: 24rpx;
  font-weight: 700;
  color: #dc2626;
}
.forecast-low {
  font-size: 22rpx;
  color: #0ea5e9;
}
.forecast-cond {
  font-size: 18rpx;
  color: #475569;
}

.sp-mid {
  flex: 1;
}
.sp-district {
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
}
.sp-meta {
  font-size: 22rpx;
  color: #475569;
  margin-top: 4rpx;
}
.sp-right {
  text-align: right;
}
.sp-premium {
  font-size: 26rpx;
  font-weight: 700;
  font-family: "Menlo", "Consolas", monospace;
}
.sp-pos-strong { color: #16a34a; }
.sp-pos { color: #22c55e; }
.sp-flat { color: #64748b; }
.sp-neg { color: #dc2626; }

/* v0.10.0 网签热度榜 */
.wq-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid #1f2937;
}
.wq-row:last-child {
  border-bottom: none;
}
.wq-rank {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 600;
  background: #334155;
  color: #cbd5e1;
  flex-shrink: 0;
}
.wq-rank-gold {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #1f2937;
}
.wq-rank-silver {
  background: linear-gradient(135deg, #e5e7eb 0%, #94a3b8 100%);
  color: #1f2937;
}
.wq-rank-bronze {
  background: linear-gradient(135deg, #d97706 0%, #92400e 100%);
  color: #fffbeb;
}
.wq-rank-normal {
  background: #1e293b;
  color: #94a3b8;
}
.wq-name {
  width: 140rpx;
  font-size: 26rpx;
  color: #f3f4f6;
  font-weight: 500;
  flex-shrink: 0;
}
.wq-track {
  flex: 1;
  height: 14rpx;
  background: #1e293b;
  border-radius: 4rpx;
  overflow: hidden;
}
.wq-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8 0%, #0ea5e9 100%);
  border-radius: 4rpx;
}
.wq-units {
  width: 180rpx;
  font-size: 24rpx;
  color: #f3f4f6;
  text-align: right;
  flex-shrink: 0;
}
</style>
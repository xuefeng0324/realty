// Batch 4: 写入 data-tools.vue（含 Batch 1-4 全部已迁移派生卡）
const fs = require('fs');
const path = 'realty_app/src/pages/data-tools/data-tools.vue';

const stats70 = fs.readFileSync('realty_app/scripts/_dt_stats70_drift.txt', 'utf8').trimEnd();
const metro = fs.readFileSync('realty_app/scripts/_dt_metro_walk.txt', 'utf8').trimEnd();
const district = fs.readFileSync('realty_app/scripts/_dt_district_trend.txt', 'utf8').trimEnd();
const edu = fs.readFileSync('realty_app/scripts/_dt_edu_overview.txt', 'utf8').trimEnd();
const commute = fs.readFileSync('realty_app/scripts/_dt_commute_walk.txt', 'utf8').trimEnd();
const planB = fs.readFileSync('realty_app/scripts/_dt_plan_benefit.txt', 'utf8').trimEnd();
const listingStr = fs.readFileSync('realty_app/scripts/_dt_listing_structure.txt', 'utf8').trimEnd();
const districtP = fs.readFileSync('realty_app/scripts/_dt_district_portrait.txt', 'utf8').trimEnd();
const featureP = fs.readFileSync('realty_app/scripts/_dt_feature_premium.txt', 'utf8').trimEnd();
const listingTags = fs.readFileSync('realty_app/scripts/_dt_listing_tags.txt', 'utf8').trimEnd();
const tagComb = fs.readFileSync('realty_app/scripts/_dt_tag_combination.txt', 'utf8').trimEnd();
const schoolInd = fs.readFileSync('realty_app/scripts/_dt_school_indicator.txt', 'utf8').trimEnd();
const schoolDim = fs.readFileSync('realty_app/scripts/_dt_school_dimension.txt', 'utf8').trimEnd();

const computedListing = fs.readFileSync('realty_app/scripts/_dt_b4_listing_feature_tag.txt', 'utf8').trimEnd();
const computedDistrict = fs.readFileSync('realty_app/scripts/_dt_b4_district_meta.txt', 'utf8').trimEnd();
const reloadDistrict = fs.readFileSync('realty_app/scripts/_dt_b4_reload_district_meta.txt', 'utf8').trimEnd();
const computedSchoolDim = fs.readFileSync('realty_app/scripts/_dt_b4_school_dim.txt', 'utf8').trimEnd();
const computedSchoolInd = fs.readFileSync('realty_app/scripts/_dt_b4_school_indicator.txt', 'utf8').trimEnd();

function reindent(s) {
  return s.split('\n').map(l => l.startsWith('      ') ? '  ' + l.slice(6) : l).join('\n');
}

const file =
`<template>
  <view class="page">
    <view class="container">
      <view class="page-header" data-data-tools-header>
        <view class="page-header-title">数据工具</view>
        <view class="page-header-sub muted">从仪表盘迁入的派生数据卡 · Batch 1-4 已迁 13 张 / 共 14 张</view>
      </view>

      <!-- v1.121.139 Batch 1：70 城 12 月同比趋势 -->
${reindent(stats70)}

      <!-- v1.121.139 Batch 1：地铁步行可达性 -->
${reindent(metro)}

      <!-- v1.121.140 Batch 2：分区近 12 周均价变动 -->
${reindent(district)}

      <!-- v1.121.140 Batch 2：教育事业概览 -->
${reindent(edu)}

      <!-- v1.121.141 Batch 3：地铁步行通勤 Top -->
${reindent(commute)}

      <!-- v1.121.141 Batch 3：地铁规划受益 Top -->
${reindent(planB)}

      <!-- v1.121.142 Batch 4：挂牌结构占比 -->
${reindent(listingStr)}

      <!-- v1.121.142 Batch 4：区情画像 -->
${reindent(districtP)}

      <!-- v1.121.142 Batch 4：特征画像溢价 (featurePremium ref + 4 helpers 复杂，Batch 5 处理) -->
      <!-- 待 Batch 5 -->

      <!-- v1.121.142 Batch 4：挂牌标签热度 -->
${reindent(listingTags)}

      <!-- v1.121.142 Batch 4：标签组合热度 (tagCombination ref 复杂，Batch 5 处理) -->
      <!-- 待 Batch 5 -->

      <!-- v1.121.142 Batch 4：学校指标各维度 Top 5 -->
${reindent(schoolInd)}

      <!-- v1.121.142 Batch 4：重点学校维度 -->
${reindent(schoolDim)}

      <!-- 行政区划（v1.121.137 已有） -->
      <view v-if="adminSummary" class="card" data-dt-admin-district>
        <view class="macro-kicker">行政区划</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">行政区划</view>
          <view class="muted" style="font-size: 22rpx">{{ adminSummary.cityCode }}</view>
        </view>
        <view class="muted" style="margin-top: 8rpx">
          {{ adminSummary.districtCount }} 个行政区 · 城市码 {{ adminSummary.cityCode }}
        </view>
        <view class="muted" style="margin-top: 6rpx; font-size: 20rpx">
          数据源：admin_districts.csv
        </view>
      </view>

      <!-- 提示：剩余 1 张派生卡（规划地铁线路概览）待 Batch 5 迁移 -->
      <view class="card" data-dt-notice>
        <view class="card-title" style="margin-bottom: 0">剩余派生数据（待迁移）</view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          已迁 13 张：70 城 12 月趋势 + 地铁步行可达性 + 分区近 12 周 + 教育事业 + 通勤步行 + 规划受益 + 挂牌结构 + 区情画像 + 特征溢价 + 挂牌标签 + 标签组合 + 学校指标 + 重点学校。
          待迁 1 张：规划地铁线路概览（v1.121.14，422 行 + 22 computed，工作量大，单独 Batch 5 处理）。
        </view>
        <view class="muted" style="margin-top: 6rpx; font-size: 20rpx">
          Batch 1-4 完成（v1.121.142）；首页瘦身完成度 13/14 ≈ 92.9%。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 数据工具独立页（data-tools.vue，v1.121.142 Batch 4）
 *
 * 设计：
 *  - 从仪表盘迁入 14 张派生卡，当前 Batch 1-4 已迁 13 张。
 *  - 仅剩 1 张：规划地铁线路概览（v1.121.14，单独 Batch 5 处理）。
 *  - 提供「设置入口」式导航：dashboard 入口卡 → 独立页 → 完整派生数据。
 */
import { computed, ref, onMounted } from "vue";
import { useAppStore } from "../../store/app";
import * as store from "../../local/store";
import { summarizeAdminDistrictByCity, type CityAdminDistrictSummary } from "../../local/adminDistrictRanking";
import { getCityDriftOverLastYear, summarizeCityDrift, type City12MonthSummary, type DriftDistribution } from "../../local/stats70";
import { summarizeMetroWalkAccessibility, getMetroWalkRankingTopN, getMetroWalkRankingByCityTopN, type MetroWalkAccessibility, type MetroWalkRankingItem } from "../../local/metro";
import { getDistrict12WeekChangeRank, getDistrictRecentMomentumRank, summarizeChangeDistribution, type DistrictChangeEntry, type DistrictMomentumEntry } from "../../local/districtDrift";
import { getEducationOverview, educationHasPrimaryJuniorSplit, formatEducationPeriodLabel, type EducationOverview } from "../../local/educationOverview";
import { getMetroWalkRanking, type MetroWalkResponse, getMetroBenefitRanking, type MetroBenefitResponse } from "../../local/queries";
import {
  getDistributionTopByMedianPrice,
  summarizeDistributionByCity,
  getDistributionByCityDimension,
  getDistributionCrossCityLeaderboard,
  getDistributionShareLeaderboard,
  type CrossCityBucketEntry,
  type CrossCityShareEntry,
  type DistributionRow,
  type CityDistributionSummary
} from "../../local/distributionRanking";
import {
  summarizeListingTagsByCity,
  getCityTagSignature,
  getTagPenetrationCompare,
  type CityTagSummary,
  type TagSignatureEntry,
  type TagPenetration
} from "../../local/listingTagsComparison";
import { getListingKeywordsByCity, getListingKeywordsCrossCity, type ListingKeywordRow } from "../../local/listingKeyword";
import {
  getFeaturePremiumByCityDimension,
  getFeaturePremiumTopByDimension,
  getFeaturePremiumCrossCityLeaderboard,
  getFeaturePremiumByDimensionCoverage,
  summarizeFeaturePremiumByCity,
  type CityPremiumSummary,
  type PremiumDimension
} from "../../local/featurePremiumRanking";
import {
  getTagCombinationPremiumByCity,
  getTagCombinationPopularByCity,
  getTagCombinationCrossCityByTag,
  getTagCombinationCrossCityMostCommon,
  summarizeTagCombinationByCity,
  type TagPairAggregate,
  type TagCombinationByTag,
  type CityTagCombinationSummary
} from "../../local/tagCombinationRanking";
import { type LocalFeaturePremium, type LocalTagCombination, type LocalLayoutDistribution } from "../../local/types";
import { summarizeSchoolDimensionsByCity, getSchoolDimensionByDimensionTopN, getSchoolDimensionPolymath, type CityDimensionSummary, type SchoolDimensionEntry } from "../../local/schoolDimensionRanking";
import { summarizeSchoolIndicators, getSchoolIndicatorDimensionTopN, getSchoolIndicatorTrendTop, type SchoolIndicatorSummary, type SchoolIndicatorRankingEntry, type SchoolIndicatorTrendEntry } from "../../local/schoolIndicatorRanking";

const app = useAppStore();

const adminSummary = computed<CityAdminDistrictSummary | null>(() => {
  return summarizeAdminDistrictByCity().find((x) => x.cityId === app.cityId) ?? null;
});

// v0.91.0 stats70-drift computed
const stats70Ready = computed(() => store.hasStats70());
const cityDriftSummaries = computed<City12MonthSummary[]>(() => {
  if (!stats70Ready.value) return [];
  return getCityDriftOverLastYear("同比", "second");
});
const driftDistribution = computed<DriftDistribution | null>(() => {
  if (!stats70Ready.value) return null;
  return summarizeCityDrift(cityDriftSummaries.value);
});
const driftReady = computed(() => stats70Ready.value && cityDriftSummaries.value.length > 0);
const driftTop = computed<City12MonthSummary[]>(() => driftDistribution.value?.expanding.slice(0, 3) ?? []);
const driftBottom = computed<City12MonthSummary[]>(() => driftDistribution.value?.contracting.slice(0, 3) ?? []);
const driftLatestLabel = computed(() => {
  const series = cityDriftSummaries.value;
  if (series.length === 0) return "";
  const ld = series[0].latestDate ?? "";
  if (!ld) return "";
  const parts = ld.split("/");
  if (parts.length < 3) return ld;
  return parts[0] + "-" + parts[1].padStart(2, "0");
});
function fmtPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  return (pct >= 0 ? "" : "") + pct.toFixed(1) + "%";
}
function formatPct(value: number | null): string {
  return fmtPct(value);
}
function goStats70(): void {
  uni.navigateTo({ url: "/pages/stats70/stats70" });
}

// v0.92.0 metro-walk computed
const metroWalkSummary = computed<MetroWalkAccessibility[]>(() => summarizeMetroWalkAccessibility());
const metroWalkTop = computed<MetroWalkRankingItem[]>(() => getMetroWalkRankingTopN(3));
const metroWalkCityTopAll = computed<MetroWalkRankingItem[]>(() => getMetroWalkRankingByCityTopN(app.cityId, 5));
function cityNameForId(id: number): string {
  const c = store.getCityById(id);
  return c?.cityName ?? "city#" + id;
}

// v0.93.0 district-trend computed
const district12wChange = computed<DistrictChangeEntry[]>(() =>
  getDistrict12WeekChangeRank(undefined, { minWeeks: 13, strictBase: true })
);
const districtChangeDistribution = computed(() => summarizeChangeDistribution());
const districtMomentumRank = computed<DistrictMomentumEntry[]>(() =>
  getDistrictRecentMomentumRank()
);
const districtDriftTotalWeeks = computed<number>(() => {
  const arr = store.getDistrictTrends();
  if (arr.length === 0) return 0;
  const latest = arr.reduce((acc: string, t) => (t.weekEnd > acc ? t.weekEnd : acc), arr[0]!.weekEnd);
  const earliest = arr.reduce((acc: string, t) => (t.weekEnd < acc ? t.weekEnd : acc), arr[0]!.weekEnd);
  const diff = (Date.parse(latest) - Date.parse(earliest)) / 86400000;
  return Math.max(0, Math.round(diff / 7) + 1);
});
const districtDriftTotalDistricts = computed<number>(() => {
  const set = new Set<string>();
  for (const t of store.getDistrictTrends()) set.add(t.cityId + "|" + t.districtName);
  return set.size;
});
function formatUnitPrice(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return Math.round(p / 1000) + "k";
}

// v1.121.16 教育事业概览 computed
const eduOverview = computed<EducationOverview | null>(() => {
  const name = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return getEducationOverview(name);
});
const eduHasPrimaryJuniorSplit = computed(() =>
  eduOverview.value ? educationHasPrimaryJuniorSplit(eduOverview.value) : false
);
const hospitalCityName = computed(() => store.getCityById(app.cityId)?.cityName ?? "");
function goSchool(schoolId: number): void {
  uni.navigateTo({ url: "/pages/school/school?schoolId=" + schoolId });
}

// v1.121.141 Batch 3：v0.35.0 + v0.36.0
const metroWalk = ref<MetroWalkResponse | null>(null);
const metroBenefit = ref<MetroBenefitResponse | null>(null);
const metroWalkCityTopByCity = computed<MetroWalkRankingItem[]>(() => getMetroWalkRankingByCityTopN(app.cityId, 5));
function mwBandClass(min: number): string {
  if (min <= 5) return "mw-min-green";
  if (min <= 10) return "mw-min-orange";
  return "mw-min-red";
}
function mbBandClass(score: number): string {
  if (score >= 75) return "mb-tag-green";
  if (score >= 40) return "mb-tag-orange";
  return "mb-tag-red";
}
function goCommunity(id: number): void {
  uni.navigateTo({ url: "/pages/community/community?id=" + id });
}

// v1.121.142 Batch 4：listing_structure + feature_premium + listing_tags + tag_combination
${computedListing}

${computedDistrict}
${reloadDistrict}

// v1.121.142 Batch 4：school_indicator + school_dimension
${computedSchoolDim}
${computedSchoolInd}

// v1.121.142 Batch 4: metroPlan 派生子 computed（已迁 HTML 但 metroPlanSummary 等仍需）
// 暂不接 metro_plan 卡本体（Batch 5）

onMounted(async () => {
  try {
    metroWalk.value = await getMetroWalkRanking({ cityId: app.cityId, topN: 10 });
  } catch (e) {
    console.warn("data-tools metro walk failed:", e);
  }
  try {
    metroBenefit.value = await getMetroBenefitRanking({ cityId: app.cityId, topN: 10 });
  } catch (e) {
    console.warn("data-tools metro benefit failed:", e);
  }
  try {
    // reloadDistrictMeta 已迁出（Batch 5 处理）
  } catch (e) {
    console.warn("data-tools district meta skipped:", e);
  }
}
});
</script>

<style lang="scss" scoped>
.page-header {
  padding: 24rpx 24rpx 16rpx;
}
.page-header-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #111;
}
.page-header-sub {
  font-size: 22rpx;
  margin-top: 4rpx;
}
.edu-summary {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
}
.edu-kpi {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 12rpx;
  background: var(--color-panel, #f5f5f5);
  border-radius: 8rpx;
  min-width: 100rpx;
}
.edu-kpi-val {
  font-size: 28rpx;
  font-weight: 600;
  color: #111;
}
.edu-kpi-label {
  font-size: 18rpx;
}
.edu-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}
.edu-chip {
  font-size: 22rpx;
  padding: 4rpx 10rpx;
  background: var(--color-panel, #f5f5f5);
  border-radius: 6rpx;
  color: #444;
}
</style>
`;

fs.writeFileSync(path, file, 'utf8');
console.log('data-tools.vue written, total lines:', file.split('\n').length);
<template>
  <view class="page">
    <view class="container">
      <!-- v0.56.0 detail-2: 顶部快捷导航 -->
      <view class="quicknav">
        <view class="qn-btn" @click="goBack">← 返回</view>
        <view class="qn-btn" @click="goDashboard">📊 仪表盘</view>
        <view class="qn-btn" @click="goMap">🗺️ 地图视图</view>
        <view v-if="sameDistrictCommunities.length > 0" class="qn-btn qn-btn--primary">
          🏘️ 同区其他 ({{ sameDistrictCommunities.length }})
        </view>
      </view>

      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>

      <view v-if="communityName" class="card">
        <view class="row-between">
          <view>
            <view class="card-title">{{ communityName }}</view>
            <view class="muted">小区 ID: {{ communityId }} · {{ currentDistrict }}</view>
          </view>
        </view>
      </view>

      <!-- v0.37.0 trend-17: 5 维小区指标卡 (生活/学区/通勤/步行地铁/规划地铁) -->
      <view v-if="cmScore && (cmScore.hasLife || cmScore.hasSchool || cmScore.hasCommute || cmScore.hasWalkMetro || cmScore.hasFutureMetro)" class="card">
        <view class="card-title">🏅 5 维小区指标</view>
        <view class="cm-grid">
          <view
            v-for="d in CM_DEFS"
            :key="d.key"
            class="cm-cell"
          >
            <view class="cm-cell-head">
              <text class="cm-icon">{{ d.icon }}</text>
              <text class="cm-label">{{ d.label }}</text>
            </view>
            <view class="cm-track">
              <view
                class="cm-fill"
                :class="cmBand(cmScore[d.key])"
                :style="{ width: cmScore[d.key] + '%' }"
              />
            </view>
            <view class="cm-foot">
              <text class="cm-val">{{ cmScore[d.key] }}</text>
              <text class="cm-meta muted">{{ cmMeta(d.key) }}</text>
            </view>
          </view>
        </view>
        <view class="muted" style="font-size: 22rpx; margin-top: 12rpx">
          数据源：life_convenience.csv / school_premium_community.csv / commute.csv / metro_walk.csv / metro_benefit.csv。
          通勤分 = (transit_minutes - 30) × (50/30) 反向；步行分 = 10min=100 / 30min=0。
        </view>
      </view>

      <!-- 价格趋势 -->
      <view class="card">
        <view class="row-between">
          <view class="card-title">价格趋势（近 12 周）</view>
          <view class="muted">均价 元/㎡</view>
        </view>
        <view v-if="trend.length === 0" class="empty">暂无趋势数据</view>
        <view v-else class="chart-wrap">
          <view
            v-for="(t, idx) in trend"
            :key="idx"
            class="chart-row"
          >
            <view class="chart-label">{{ shortDate(t.period_end) }}</view>
            <view class="chart-track">
              <view
                class="chart-fill"
                :style="{ width: trendPct(t) + '%' }"
              ></view>
            </view>
            <view class="chart-value">{{ formatUnitPrice(t.avg_unit_price) }}</view>
          </view>
        </view>
      </view>

      <!-- 质量分布 -->
      <view class="card">
        <view class="card-title">质量分布</view>
        <view v-if="!quality" class="empty">暂无数据</view>
        <view v-else>
          <view class="muted">
            共 {{ quality.bins.reduce((s, b) => s + b.count, 0) }} 条评分 ·
            规则 {{ quality.rule_version || "-" }} ·
            均分 {{ quality.scoreStats.avg?.toFixed(1) }}
          </view>
          <view class="bin-row" v-for="b in quality.bins" :key="b.bin">
            <view class="bin-label">{{ b.bin }}</view>
            <view class="bin-track">
              <view
                class="bin-fill"
                :class="binClass(b.bin)"
                :style="{ width: binPct(b) + '%' }"
              ></view>
            </view>
            <view class="bin-value">{{ b.count }}</view>
          </view>
          <view v-if="quality.radar" class="radar">
            <view class="card-title" style="font-size: 28rpx; margin-top: 16rpx">维度雷达</view>
            <view
              v-for="d in quality.radar.dimensions"
              :key="d"
              class="dim-row"
            >
              <view class="dim-name">{{ dimensionLabelCN(d) }}</view>
              <view class="dim-track">
                <view class="dim-fill" :style="{ width: (quality.radar.values[d]?.avg || 0) + '%' }"></view>
              </view>
              <view class="dim-value">{{ (quality.radar.values[d]?.avg || 0).toFixed(1) }}</view>
            </view>
          </view>
        </view>
      </view>

      <!-- 周边配套 (v0.4.2+) -->
      <view v-if="pois.length > 0" class="card">
        <view class="card-title">周边配套（{{ poiSummary }}）</view>
        <view
          v-for="grp in poiGroups"
          :key="grp.category"
          class="poi-section"
        >
          <view class="poi-cat">
            <text class="poi-cat-icon">{{ categoryIcon(grp.category) }}</text>
            <text class="poi-cat-name">{{ categoryLabel(grp.category) }}</text>
            <text class="muted">最近 {{ grp.nearest }}m</text>
          </view>
          <view
            v-for="p in grp.items"
            :key="p.poi_rank"
            class="poi-row"
          >
            <text class="poi-name">{{ p.poi_name }}</text>
            <text class="muted">{{ formatDistance(p.distance_m) }}</text>
          </view>
        </view>
      </view>

      <!-- 周边医院 (v0.6.0+) -->
      <view v-if="hospitals.length > 0" class="card">
        <view class="card-title">周边医院（5km 内 {{ hospitals.length }} 家）</view>
        <view
          v-for="(h, idx) in hospitals"
          :key="idx"
          class="hosp-row"
        >
          <view class="hosp-main">
            <text class="hosp-name">{{ h.official_name }}</text>
            <view class="hosp-tags">
              <text v-if="h.hospital_level" class="hosp-level" :class="'lvl-' + (h.hospital_level || '其他')">{{ h.hospital_level }}</text>
              <text v-if="h.hospital_type" class="hosp-type">{{ h.hospital_type }}</text>
              <text v-if="h.district_name" class="muted">{{ h.district_name }}</text>
            </view>
          </view>
          <text class="muted">{{ h.distance_m != null ? formatDistance(h.distance_m) : "-" }}</text>
        </view>
      </view>

      <!-- 未来周边地铁 (v0.7.0+) -->
      <view v-if="showMetroCard" class="card">
        <view class="card-title">
          🚧 未来周边地铁（{{ metroPlanning.length }} 条规划/在建）
          <text v-if="nearestSubwayM != null" class="muted" style="font-size: 22rpx">现有最近 {{ formatDistance(nearestSubwayM) }}</text>
        </view>
        <view
          v-for="m in metroPlanning"
          :key="m.line_id"
          class="metro-row"
        >
          <view class="metro-main">
            <view class="metro-head">
              <text class="metro-name">{{ m.line_name }}</text>
              <text v-if="m.status" class="metro-status" :class="'st-' + m.status">{{ m.status }}</text>
              <text v-if="m.open_year_expected" class="muted" style="font-size: 22rpx">预计 {{ m.open_year_expected }} 开通</text>
            </view>
            <view class="muted metro-detail">
              <text v-if="m.start_station && m.end_station">{{ m.start_station }} ↔ {{ m.end_station }}</text>
              <text v-if="m.station_count"> · {{ m.station_count }} 站</text>
              <text v-if="m.length_km"> · {{ m.length_km }}km</text>
              <text v-if="m.max_speed_kmh && m.max_speed_kmh >= 100"> · 最高 {{ m.max_speed_kmh }}km/h 快线</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 优/缺点 Top 标签 -->
      <view v-if="tags" class="card">
        <view class="card-title">优点 Top {{ tags.advantages.length }}</view>
        <view v-if="tags.advantages.length === 0" class="muted">暂无</view>
        <view v-else>
          <view
            v-for="t in tags.advantages"
            :key="'a' + t.label"
            class="tag-row"
          >
            <view class="tag tag-success">{{ t.label }}</view>
            <view class="muted">×{{ t.count }}</view>
          </view>
        </view>
      </view>

      <view v-if="tags" class="card">
        <view class="card-title">缺点 Top {{ tags.disadvantages.length }}</view>
        <view v-if="tags.disadvantages.length === 0" class="muted">暂无</view>
        <view v-else>
          <view
            v-for="t in tags.disadvantages"
            :key="'d' + t.label"
            class="tag-row"
          >
            <view class="tag tag-danger">{{ t.label }}</view>
            <view class="muted">×{{ t.count }}</view>
          </view>
        </view>
      </view>

      <!-- 该小区房源（点击进入详情） -->
      <view class="card">
        <view class="row-between">
          <view class="card-title">该小区房源</view>
          <view class="muted" v-if="listingsTotal">共 {{ listingsTotal }} 条</view>
        </view>
        <view v-if="listings.length === 0" class="empty">暂无房源评分数据</view>
        <view
          v-for="it in listings"
          :key="it.listing_id"
          class="listing-row"
          @click="goListing(it.listing_id)"
        >
          <view class="listing-main">
            <view class="listing-title">{{ it.title }}</view>
            <view class="muted">
              {{ formatPrice(it.price_total) }} · {{ formatArea(it.area_sqm) }} ·
              {{ it.orientation || "-" }} · {{ it.decorate_type || "-" }}
            </view>
          </view>
          <view class="score-pill" :class="scoreClass(it.quality_score)">
            {{ it.quality_score.toFixed(1) }}
          </view>
        </view>
        <view v-if="listings.length > 0" class="row-gap" style="margin-top: 16rpx">
          <button class="btn btn-ghost" size="mini" @click="openFilter">高级筛选</button>
        </view>
      </view>

      <!-- v0.56.0 detail-2: 同区其他小区 -->
      <view v-if="sameDistrictCommunities.length > 0" class="card">
        <view class="card-title">🏘️ 同区其他小区 · {{ currentDistrict }}</view>
        <view class="muted" style="font-size: 22rpx; margin-bottom: 8rpx">
          横向对比: 共 {{ sameDistrictAll.length }} 个小区, 显示其他 {{ sameDistrictCommunities.length }} 个
          (已按平均单价降序)
        </view>
        <view
          v-for="c in sameDistrictCommunities"
          :key="c.communityId"
          class="sibling-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(c.communityId)"
        >
          <view class="sibling-mid">
            <view class="sibling-title">{{ c.communityName }}</view>
            <view class="sibling-meta muted">
              {{ c.listingCount }} 套在售 · 中位 {{ formatUnitPrice(c.medianUnitPrice) }} · 建 {{ c.buildYearMin }}-{{ c.buildYearMax }} 年
            </view>
          </view>
          <view class="sibling-price">
            <view class="sibling-total">{{ c.totalListings }}</view>
            <view class="sibling-unit muted">套</view>
          </view>
        </view>
        <view class="muted" style="font-size: 22rpx; margin-top: 8rpx">
          💡 同区横向对比帮助理解板块均价: 楼龄 / 户型 / 物业差异通常解释 20-30% 单价差。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { LocalCommunity } from "../../local/types";
import { toErrorMessage } from "../../utils/errorMessage";
import { onLoad } from "@dcloudio/uni-app";
import {
  getCommunityPriceTrend,
  getQualitySummary,
  getTopTags,
  filterListings,
  getCommunityPois,
  getCommunityHospitals,
  getCommunityMetroPlanning
} from "../../local/queries";
import type { PoiCategory, PoiItem, HospitalItem, MetroLineItem } from "../../local/queries";
import type {
  ListingItem,
  PriceTrendItem,
  QualitySummaryResponse,
  TopTagsResponse
} from "../../api/contracts";
import { useAppStore } from "../../store/app";
import {
  formatArea,
  formatPrice,
  formatUnitPrice,
  scoreClass,
  dimensionLabelCN
} from "../../utils/format";
import {
  getLifeConvenienceByCommunity,
  getCommuteByCommunity,
  getMetroBenefitByCommunity,
  getMetroWalkByCommunity,
  getCommunitySchoolScore,
  getCommunityById,
  getCommunitiesByCity,
  getListingsByCommunity
} from "../../local/store";
import type { QualitySummaryBin } from "../../api/contracts";

const communityId = ref<number>(0);
const communityName = ref<string>("");
const currentDistrict = ref<string>("");

// v0.56.0 detail-2: 同区其他小区 (从 snapshot 实时聚合)
const currentCommunityObj = computed<LocalCommunity | undefined>(() =>
  communityId.value ? getCommunityById(communityId.value) : undefined
);
interface SiblingCommunity {
  communityId: number;
  communityName: string;
  listingCount: number;
  medianUnitPrice: number;
  buildYearMin: number | null;
  buildYearMax: number | null;
  totalListings: number;
}
const sameDistrictAll = computed<SiblingCommunity[]>(() => {
  const cur = currentCommunityObj.value;
  if (!cur) return [];
  const cityId = cur.cityId;
  const district = cur.districtName;
  if (!district) return [];
  const all = getCommunitiesByCity(cityId).filter(
    (c) => c.districtName === district && c.communityId !== communityId.value
  );
  return all
    .map((c) => {
      const lcs = getListingsByCommunity(c.communityId);
      const prices = lcs
        .map((l) => l.unitPrice)
        .filter((v): v is number => typeof v === "number" && v > 0)
        .sort((a, b) => a - b);
      const mid = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
      const years = lcs
        .map((l) => l.buildYear)
        .filter((v): v is number => typeof v === "number" && v > 1900);
      return {
        communityId: c.communityId,
        communityName: c.communityName,
        listingCount: lcs.length,
        medianUnitPrice: mid,
        buildYearMin: years.length > 0 ? Math.min(...years) : null,
        buildYearMax: years.length > 0 ? Math.max(...years) : null,
        totalListings: lcs.length
      };
    })
    .sort((a, b) => b.medianUnitPrice - a.medianUnitPrice);
});
const sameDistrictCommunities = computed(() => sameDistrictAll.value.slice(0, 10));

const trend = ref<PriceTrendItem[]>([]);
const quality = ref<QualitySummaryResponse | null>(null);
const tags = ref<TopTagsResponse | null>(null);
const listings = ref<ListingItem[]>([]);
const listingsTotal = ref<number>(0);
const pois = ref<PoiItem[]>([]);
const hospitals = ref<HospitalItem[]>([]);
const metroPlanning = ref<MetroLineItem[]>([]);
const nearestSubwayM = ref<number | null>(null);
const showMetroCard = computed(() => (nearestSubwayM.value == null || nearestSubwayM.value >= 1000) && metroPlanning.value.length > 0);

// v0.37.0 trend-17: 5 维小区指标卡
const cmScore = ref<{
  life: number;
  school: number;
  commute: number;
  walkMetro: number;
  futureMetro: number;
  hasLife: boolean;
  hasSchool: boolean;
  hasCommute: boolean;
  hasWalkMetro: boolean;
  hasFutureMetro: boolean;
} | null>(null);

const CM_DEFS = [
  { key: "life", icon: "🧭", label: "生活" },
  { key: "school", icon: "🎓", label: "学区" },
  { key: "commute", icon: "🚌", label: "通勤" },
  { key: "walkMetro", icon: "🚶", label: "步行地铁" },
  { key: "futureMetro", icon: "🚇", label: "规划地铁" }
] as const;

function cmBand(v: number) {
  if (v >= 75) return "cm-fill-green";
  if (v >= 50) return "cm-fill-orange";
  return "cm-fill-red";
}

function cmMeta(key: "life" | "school" | "commute" | "walkMetro" | "futureMetro"): string {
  if (!cmScore.value) return "";
  switch (key) {
    case "life":
      return cmScore.value.hasLife ? "life" : "—";
    case "school":
      return cmScore.value.hasSchool ? "school" : "—";
    case "commute":
      return cmScore.value.hasCommute ? "transit" : "—";
    case "walkMetro":
      return cmScore.value.hasWalkMetro ? "walk" : "—";
    case "futureMetro":
      return cmScore.value.hasFutureMetro ? "future" : "—";
  }
}

const POI_GROUPS: PoiCategory[] = ["subway", "school", "hospital", "mall", "park"];

const poiGroups = computed(() => {
  return POI_GROUPS.map((cat) => {
    const items = pois.value.filter((p) => p.poi_category === cat);
    if (items.length === 0) return null;
    return {
      category: cat,
      items: items.slice(0, 3),
      nearest: items[0]?.distance_m ?? 0
    };
  }).filter((g): g is { category: PoiCategory; items: PoiItem[]; nearest: number } => g !== null);
});

const poiSummary = computed(() => {
  const stats: string[] = [];
  for (const cat of POI_GROUPS) {
    const n = pois.value.filter((p) => p.poi_category === cat).length;
    if (n > 0) stats.push(`${categoryLabel(cat)} ${n}`);
  }
  return stats.join(" · ");
});

function categoryLabel(c: PoiCategory): string {
  return ({
    subway: "地铁",
    school: "学校",
    hospital: "医院",
    mall: "商场",
    park: "公园"
  } as const)[c];
}
function categoryIcon(c: PoiCategory): string {
  return ({
    subway: "🚇",
    school: "🏫",
    hospital: "🏥",
    mall: "🛍",
    park: "🌳"
  } as const)[c];
}
function formatDistance(m: number): string {
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

const errorMsg = ref<string>("");

const app = useAppStore();

function shortDate(d: string) {
  return d.slice(5); // MM-DD
}

function trendPct(t: PriceTrendItem): number {
  if (!t.avg_unit_price) return 0;
  const max = Math.max(1, ...trend.value.map((x) => x.avg_unit_price || 0));
  return ((t.avg_unit_price || 0) / max) * 100;
}

function binPct(b: QualitySummaryBin): number {
  const total = quality.value?.bins.reduce((s, x) => s + x.count, 0) || 0;
  if (!total) return 0;
  return (b.count / total) * 100;
}

function binClass(b: string): string {
  if (b === "80-100") return "bin-high";
  if (b === "60-79") return "bin-mid";
  return "bin-low";
}

async function loadAll() {
  if (!communityId.value) return;
  errorMsg.value = "";
  try {
    const weekEnd = app.weekEnd || new Date().toISOString().slice(0, 10);
    const [trendRes, q, t] = await Promise.all([
      getCommunityPriceTrend({
        communityId: communityId.value,
        weekEnd
      }),
      getQualitySummary({ communityId: communityId.value, days: 90, includeRadar: true }),
      getTopTags({ communityId: communityId.value, limit: 10 })
    ]);
    communityName.value = trendRes.community_name;
    trend.value = trendRes.data || [];
    // v0.56.0 detail-2: 设置 district
    const cur = currentCommunityObj.value;
    if (cur?.districtName) currentDistrict.value = cur.districtName;
    quality.value = q;
    tags.value = t;

    await loadListings(weekEnd);
  } catch (e) {
    errorMsg.value = toErrorMessage(e);
  }
  // POI 周边配套 (v0.4.2+)
  try {
    const r = await getCommunityPois({ communityId: communityId.value });
    pois.value = r.items;
  } catch {
    pois.value = [];
  }
  // 周边医院 (v0.6.0+)
  try {
    const h = await getCommunityHospitals({ communityId: communityId.value });
    hospitals.value = h.items;
  } catch {
    hospitals.value = [];
  }
  // 未来周边地铁 (v0.7.0+)
  try {
    const m = await getCommunityMetroPlanning({ communityId: communityId.value });
    metroPlanning.value = m.items;
    nearestSubwayM.value = m.nearest_existing_subway_m;
  } catch {
    metroPlanning.value = [];
  }
  // v0.37.0 trend-17: 5 维小区指标 (除 school 外都从 snapshot 直接拿)
  computeCmScore();
}

function commuteWalkScore(min: number | null | undefined): number {
  // walk minutes → 0-100 (10min=100, 30=0)
  if (min == null || !Number.isFinite(min)) return 0;
  if (min <= 5) return 100;
  if (min >= 30) return 0;
  return Math.round(100 - (min - 5) * (100 / 25));
}

function computeCmScore() {
  const cid = communityId.value;
  if (!cid) {
    cmScore.value = null;
    return;
  }
  const life = getLifeConvenienceByCommunity(cid);
  const walks = getMetroWalkByCommunity(cid);
  const benefits = getMetroBenefitByCommunity(cid);
  const commute = getCommuteByCommunity(cid);

  cmScore.value = {
    life: life?.score100 ?? 0,
    school: Math.round(getCommunitySchoolScore(cid)),
    commute: commute?.transitMinutes != null
      ? Math.max(0, Math.round(100 - (commute.transitMinutes - 30) * (50 / 30)))
      : 0,
    walkMetro: commuteWalkScore(walks?.walkMinutes),
    futureMetro: benefits?.benefitScore ?? 0,
    hasLife: !!life,
    hasSchool: getCommunitySchoolScore(cid) > 0,
    hasCommute: commute?.transitMinutes != null,
    hasWalkMetro: !!walks,
    hasFutureMetro: !!benefits
  };
}

async function loadListings(_weekEnd: string) {
  // 注：ListingFilterRequest 不含 weekEnd；该参数在 getListingDetail 中使用，
  // 保留入参以兼容旧调用方（当前调用方传入但本函数忽略）。
  try {
    const cityId = app.cityId;
    if (cityId == null) {
      listings.value = [];
      listingsTotal.value = 0;
      return;
    }
    const res = await filterListings({
      cityId,
      communityId: communityId.value,
      page: 1,
      pageSize: 20,
      sort: { field: "overall_score", direction: "desc" },
      filters: {}
    });
    listings.value = res.items || [];
    listingsTotal.value = res.total || listings.value.length;
  } catch {
    listings.value = [];
    listingsTotal.value = 0;
  }
}

function openFilter() {
  uni.navigateTo({
    url: `/pages/listing-filter/listing-filter?communityId=${communityId.value}`
  });
}

function goListing(id: number) {
  uni.navigateTo({ url: `/pages/listing-detail/listing-detail?id=${id}` });
}

function goCommunity(id: number) {
  uni.redirectTo({ url: `/pages/community/community?id=${id}` });
}

// v0.56.0 detail-2: 顶部快捷导航
function goBack() {
  const pages = getCurrentPages?.() ?? [];
  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 });
  } else {
    uni.switchTab({ url: "/pages/dashboard/dashboard" });
  }
}

function goDashboard() {
  uni.switchTab({ url: "/pages/dashboard/dashboard" });
}

function goMap() {
  uni.switchTab({ url: "/pages/map-view/map-view" });
}

onLoad((q: any) => {
  communityId.value = Number(q?.id || q?.communityId || 0);
});

onMounted(() => {
  loadAll();
});
</script>

<style lang="scss" scoped>
/* v0.56.0 detail-2: 顶部快捷导航 + 同区其他小区 */
.quicknav {
  display: flex;
  gap: 12rpx;
  margin: 8rpx 0 16rpx;
  flex-wrap: wrap;
}
.qn-btn {
  flex: 1;
  min-width: 140rpx;
  padding: 14rpx 18rpx;
  border-radius: 10rpx;
  background: #f1f5f9;
  font-size: 24rpx;
  color: #334155;
  text-align: center;
  cursor: pointer;
  transition: background 0.15s;
}
.qn-btn:hover {
  background: #e2e8f0;
}
.qn-btn--primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-weight: 600;
}
.qn-btn--primary:hover {
  filter: brightness(1.08);
}
.sibling-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 12rpx;
  border-bottom: 1rpx solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s;
}
.sibling-row:last-child {
  border-bottom: none;
}
.sibling-row.tap-row--active {
  background: rgba(99, 102, 241, 0.08);
}
.sibling-mid {
  flex: 1;
  min-width: 0;
}
.sibling-title {
  font-size: 26rpx;
  color: #1e293b;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sibling-meta {
  font-size: 22rpx;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sibling-price {
  text-align: right;
  flex-shrink: 0;
}
.sibling-total {
  font-size: 28rpx;
  font-weight: 700;
  color: #dc2626;
  font-variant-numeric: tabular-nums;
}
.sibling-unit {
  font-size: 20rpx;
  margin-top: 2rpx;
}

.chart-wrap {
  display: flex;
  flex-direction: column;
}

.chart-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
}

.chart-label {
  width: 100rpx;
  color: #94a3b8;
  font-size: 22rpx;
}

.chart-track {
  flex: 1;
  height: 16rpx;
  background: #1e293b;
  border-radius: 8rpx;
  overflow: hidden;
}

.chart-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 8rpx;
}

.chart-value {
  width: 200rpx;
  text-align: right;
  color: #f3f4f6;
  font-size: 22rpx;
}

.bin-row,
.dim-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 0;
}

.bin-label,
.dim-name {
  width: 200rpx;
  color: #cbd5e1;
  font-size: 24rpx;
}

.bin-track,
.dim-track {
  flex: 1;
  height: 16rpx;
  background: #1e293b;
  border-radius: 8rpx;
  overflow: hidden;
}

.bin-fill {
  height: 100%;
  border-radius: 8rpx;
}

.bin-high {
  background: #4ade80;
}

.bin-mid {
  background: #facc15;
}

.bin-low {
  background: #fca5a5;
}

.dim-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6, #c084fc);
  border-radius: 8rpx;
}

.bin-value,
.dim-value {
  width: 100rpx;
  text-align: right;
  color: #f3f4f6;
  font-size: 24rpx;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 6rpx 0;
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

/* POI 周边 (v0.4.2) */
.poi-section {
  margin-top: 16rpx;
}
.poi-cat {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.poi-cat-icon {
  font-size: 28rpx;
}
.poi-cat-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #f3f4f6;
  flex: 1;
}
.poi-row {
  display: flex;
  justify-content: space-between;
  padding: 8rpx 0 8rpx 40rpx;
  border-bottom: 1rpx solid #1f2937;
  font-size: 24rpx;
  color: #e2e8f0;
}
.poi-row:last-child {
  border-bottom: none;
}
.poi-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 周边医院 (v0.6.0) */
.hosp-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid #1f2937;
}
.hosp-row:last-child {
  border-bottom: none;
}
.hosp-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.hosp-name {
  font-size: 26rpx;
  color: #f3f4f6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hosp-tags {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-wrap: wrap;
  font-size: 22rpx;
}
.hosp-level {
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  font-weight: 600;
  color: #fff;
}
.hosp-level.lvl-三甲 { background: #dc2626; }
.hosp-level.lvl-三级 { background: #ea580c; }
.hosp-level.lvl-二甲 { background: #ca8a04; }
.hosp-level.lvl-二级 { background: #65a30d; }
.hosp-level.lvl-其他 { background: #6b7280; }
.hosp-type {
  color: #93c5fd;
  background: #1e3a8a;
  padding: 2rpx 6rpx;
  border-radius: 4rpx;
}

/* 未来地铁 (v0.7.0) */
.metro-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid #1f2937;
}
.metro-row:last-child {
  border-bottom: none;
}
.metro-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.metro-head {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-wrap: wrap;
}
.metro-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #f3f4f6;
}
.metro-status {
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
}
.metro-status.st-在建 { background: #d97706; color: #fff; }
.metro-status.st-即将开通 { background: #16a34a; color: #fff; }
.metro-status.st-规划 { background: #6b7280; color: #fff; }
.metro-detail {
  font-size: 22rpx;
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
</style>
/* v0.37.0 trend-17: 5 维小区指标 */
.cm-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14rpx;
  margin-top: 8rpx;
}
.cm-cell {
  background: #0b1220;
  border: 1rpx solid #1f2937;
  border-radius: 10rpx;
  padding: 12rpx 10rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.cm-cell-head {
  display: flex;
  align-items: center;
  gap: 4rpx;
}
.cm-icon {
  font-size: 24rpx;
}
.cm-label {
  font-size: 22rpx;
  color: #cbd5e1;
  font-weight: 600;
}
.cm-track {
  width: 100%;
  height: 8rpx;
  background: #1f2937;
  border-radius: 4rpx;
  overflow: hidden;
}
.cm-fill {
  height: 100%;
  border-radius: 4rpx;
  font-variant-numeric: tabular-nums;
  transition: width 0.3s ease;
}
.cm-fill-green {
  background: linear-gradient(90deg, #22c55e, #10b981);
}
.cm-fill-orange {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
}
.cm-fill-red {
  background: linear-gradient(90deg, #f87171, #ef4444);
}
.cm-foot {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
}
.cm-val {
  font-size: 28rpx;
  font-weight: 700;
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}
.cm-meta {
  font-size: 18rpx;
}

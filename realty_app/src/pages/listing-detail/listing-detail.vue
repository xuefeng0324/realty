<template>
  <view class="page">
    <view class="container">
      <!-- v0.54.0 detail-1: 顶部快捷导航 (返回 + 同区其他小区 + 小区详情) -->
      <view class="quicknav">
        <view class="qn-btn" @click="goBack">← 返回</view>
        <view class="qn-btn" @click="goDashboard">📊 仪表盘</view>
        <view class="qn-btn" @click="goCommunity">🏘️ 小区详情</view>
        <view v-if="sameCommunityListings.length > 0" class="qn-btn qn-btn--primary">
          🔁 同小区其他 ({{ sameCommunityListings.length }})
        </view>
      </view>

      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>

      <view v-if="data" class="card">
        <view class="row-between">
          <view class="card-title">{{ data.listing.title }}</view>
          <view class="score-pill" :class="scoreClass(data.score.overall_score_0_100)">
            {{ data.score.overall_score_0_100.toFixed(1) }}
          </view>
        </view>

        <view class="price-row">
          <view class="price-main">{{ formatPrice(data.listing.total_price_10k) }}</view>
          <view class="muted">{{ formatUnitPrice(data.listing.unit_price) }}</view>
        </view>

        <view class="row-gap info-grid">
          <view class="info-cell">
            <text class="muted">面积</text>
            <text>{{ formatArea(data.listing.area_sqm) }}</text>
          </view>
          <view class="info-cell">
            <text class="muted">朝向</text>
            <text>{{ data.listing.orientation || "-" }}</text>
          </view>
          <view class="info-cell">
            <text class="muted">装修</text>
            <text>{{ data.listing.decorate_type || "-" }}</text>
          </view>
          <view class="info-cell">
            <text class="muted">楼层</text>
            <text>{{ data.listing.floor_number || "-" }}</text>
          </view>
          <view class="info-cell">
            <text class="muted">电梯</text>
            <text>{{ data.listing.has_elevator ? "有" : "无" }}</text>
          </view>
          <view class="info-cell">
            <text class="muted">建成</text>
            <text>{{ data.listing.build_year || "-" }}年</text>
          </view>
          <view class="info-cell">
            <text class="muted">户型</text>
            <text>{{ data.listing.bedrooms || "-" }} 室 {{ data.listing.bathrooms || "-" }} 卫</text>
          </view>
          <view class="info-cell">
            <text class="muted">最近地铁</text>
            <text>{{ data.listing.nearest_metro_distance_m ? data.listing.nearest_metro_distance_m + "m" : "-" }}</text>
          </view>
        </view>

        <view class="row-gap" style="margin-top: 24rpx">
          <button v-if="data.listing.source_url" class="btn" size="mini" @click="openSource">查看源链接</button>
          <button v-if="data.listing.source_url" class="btn btn-ghost" size="mini" @click="copyUrl">复制链接</button>
          <button class="btn btn-ghost" size="mini" @click="goCommunity">小区详情</button>
        </view>
      </view>

      <!-- 维度分 -->
      <view v-if="data" class="card">
        <view class="card-title">维度评分</view>
        <view v-if="!hasDimension" class="muted">暂无维度数据</view>
        <view v-for="d in dimensionKeys" :key="d" class="dim-row">
          <view class="dim-name">{{ dimensionLabelCN(d) }}</view>
          <view class="dim-track">
            <view class="dim-fill" :style="{ width: (data.score.dimension_scores_json[d] || 0) + '%' }"></view>
          </view>
          <view class="dim-value">{{ (data.score.dimension_scores_json[d] || 0).toFixed(1) }}</view>
        </view>
      </view>

      <!-- v0.54.0 detail-1: 同小区其他在售 -->
      <view v-if="sameCommunityListings.length > 0" class="card">
        <view class="card-title">🔁 同小区其他在售 · {{ sameCommunityName }}</view>
        <view class="muted" style="font-size: 22rpx; margin-bottom: 8rpx">
          横向对比: 共 {{ sameCommunityAll.length }} 套在售, 显示其他 {{ sameCommunityListings.length }} 套
          (已按单价降序)
        </view>
        <view
          v-for="l in sameCommunityListings"
          :key="l.listingId"
          class="sibling-row tap-row"
          hover-class="tap-row--active"
          @click="goListing(l.listingId)"
        >
          <view class="sibling-mid">
            <view class="sibling-title">{{ l.title }}</view>
            <view class="sibling-meta muted">
              {{ l.bedrooms }}室{{ l.bathrooms }}卫 · {{ formatArea(l.areaSqm) }} · {{ l.orientation || '-' }}
              · {{ l.decorateType || '-' }}
            </view>
          </view>
          <view class="sibling-price">
            <view class="sibling-total">{{ formatPrice(l.totalPrice10k) }}</view>
            <view class="sibling-unit muted">{{ formatUnitPrice(l.unitPrice) }}</view>
          </view>
        </view>
        <view class="muted" style="font-size: 22rpx; margin-top: 8rpx">
          💡 横向对比能更清楚看到不同户型 / 楼层 / 朝向的差价 — 通常同小区同户型差价在 ±5-10% 内属正常议价空间。
        </view>
      </view>

      <!-- 优缺点 -->
      <view v-if="data" class="card">
        <view class="card-title">亮点</view>
        <view v-if="!data.score.advantages_json?.length" class="muted">暂无</view>
        <view v-else>
          <view
            v-for="(a, idx) in data.score.advantages_json"
            :key="'a' + idx"
            class="tag-row"
          >
            <text class="tag tag-success">{{ a.label }}</text>
            <text class="muted">置信 {{ ((a.confidence || 0) * 100).toFixed(0) }}%</text>
          </view>
        </view>
      </view>

      <view v-if="data" class="card">
        <view class="card-title">不足</view>
        <view v-if="!data.score.disadvantages_json?.length" class="muted">暂无</view>
        <view v-else>
          <view
            v-for="(d, idx) in data.score.disadvantages_json"
            :key="'d' + idx"
            class="tag-row"
          >
            <text class="tag tag-danger">{{ d.label }}</text>
            <text class="muted">置信 {{ ((d.confidence || 0) * 100).toFixed(0) }}%</text>
          </view>
        </view>
      </view>

      <!-- 学校 -->
      <view v-if="data && data.score.school_future_score_max != null" class="card">
        <view class="card-title">学校未来趋势</view>
        <view class="muted">
          学校最大未来趋势分：{{ data.score.school_future_score_max?.toFixed(1) }} ·
          省重点：{{ data.score.school_province_key_flag_any ? "是" : "否" }} ·
          市重点：{{ data.score.school_city_key_flag_any ? "是" : "否" }}
        </view>
      </view>

      <!-- 周边配套 (v0.4.2+ 高德 POI 数据) -->
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

      <!-- 周边医院 (v0.6.0+ hospitals.csv 真数据：等级/类型/区) -->
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

      <!-- 未来周边地铁 (v0.7.0+ metro_planning.csv：规划/在建线路) -->
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

      <!-- 解释 JSON 折叠 -->
      <view v-if="data && data.score.explain_json" class="card">
        <view
          class="row-between tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="toggleExplain"
        >
          <view class="card-title">评分解释</view>
          <view class="muted">{{ explainOpen ? "收起" : "展开" }}</view>
        </view>
        <view v-if="explainOpen" class="explain-box">
          <text>{{ explainText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { getListingDetail, getCommunityPois, getCommunityHospitals, getCommunityMetroPlanning } from "../../local/queries";
import type { ListingDetailResponse } from "../../api/contracts";
import type { PoiCategory, PoiItem, HospitalItem, MetroLineItem } from "../../local/queries";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  copyText,
  dimensionLabelCN,
  formatArea,
  formatPrice,
  formatUnitPrice,
  scoreClass,
  showToast
} from "../../utils/format";
import { getListingsByCommunity, getCommunityById } from "../../local/store";

const listingId = ref<number>(0);
const data = ref<ListingDetailResponse | null>(null);
const errorMsg = ref<string>("");
const explainOpen = ref(false);

// v0.54.0 detail-1: 同小区其他 listings
const sameCommunityAll = ref<ReturnType<typeof getListingsByCommunity>>([]);
const sameCommunityListings = computed(() => {
  return sameCommunityAll.value
    .filter((l) => l.listingId !== listingId.value)
    .filter((l) => l.unitPrice && l.unitPrice > 0)
    .sort((a, b) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0))
    .slice(0, 10);
});
const sameCommunityName = computed(() => {
  if (!data.value) return "";
  const c = getCommunityById(data.value.listing.community_id);
  return c?.communityName ?? "";
});
const pois = ref<PoiItem[]>([]);
const hospitals = ref<HospitalItem[]>([]);
const metroPlanning = ref<MetroLineItem[]>([]);
const nearestSubwayM = ref<number | null>(null);
const showMetroCard = computed(() => (nearestSubwayM.value == null || nearestSubwayM.value >= 1000) && metroPlanning.value.length > 0);

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

const dimensionKeys = computed(() => {
  if (!data.value) return [];
  return Object.keys(data.value.score.dimension_scores_json || {});
});

const hasDimension = computed(() => dimensionKeys.value.length > 0);

const explainText = computed(() => {
  if (!data.value) return "";
  try {
    return JSON.stringify(data.value.score.explain_json, null, 2);
  } catch {
    return String(data.value.score.explain_json);
  }
});

function openSource() {
  if (!data.value?.listing.source_url) return;
  // #ifdef H5
  window.open(data.value.listing.source_url, "_blank");
  // #endif
  // #ifndef H5
  uni.setClipboardData({
    data: data.value.listing.source_url,
    success: () => showToast("链接已复制，请到浏览器打开")
  });
  // #endif
}

function copyUrl() {
  if (data.value?.listing.source_url) {
    copyText(data.value.listing.source_url);
  }
}

function goCommunity() {
  if (data.value) {
    uni.navigateTo({ url: `/pages/community/community?id=${data.value.listing.community_id}` });
  }
}

// v0.54.0 detail-1: 顶部快捷导航
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

function goListing(id: number) {
  uni.redirectTo({ url: `/pages/listing-detail/listing-detail?id=${id}` });
}

function toggleExplain() {
  explainOpen.value = !explainOpen.value;
}

onLoad((q: any) => {
  listingId.value = Number(q?.id || 0);
});

onMounted(async () => {
  if (!listingId.value) {
    errorMsg.value = "未指定房源 ID";
    return;
  }
  try {
    data.value = await getListingDetail(listingId.value);
    if (data.value?.listing.community_id) {
      // v0.54.0 detail-1: 同小区其他 listings
      sameCommunityAll.value = getListingsByCommunity(data.value.listing.community_id);
      try {
        const r = await getCommunityPois({
          communityId: data.value.listing.community_id
        });
        pois.value = r.items;
      } catch {
        // POI 不可用时不阻塞主流程
        pois.value = [];
      }
      try {
        const h = await getCommunityHospitals({
          communityId: data.value.listing.community_id
        });
        hospitals.value = h.items;
      } catch {
        hospitals.value = [];
      }
      try {
        const m = await getCommunityMetroPlanning({
          communityId: data.value.listing.community_id
        });
        metroPlanning.value = m.items;
        nearestSubwayM.value = m.nearest_existing_subway_m;
      } catch {
        metroPlanning.value = [];
      }
    }
  } catch (e) {
    errorMsg.value = toErrorMessage(e);
  }
});
</script>

<style lang="scss" scoped>
/* v0.54.0 detail-1: 顶部快捷导航 */
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

/* 同小区其他在售 */
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

.price-row {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin: 16rpx 0;
}

.price-main {
  font-size: 44rpx;
  font-weight: 700;
  color: #fbbf24;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 16rpx;
  margin-top: 16rpx;
}

.info-cell {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  font-size: 26rpx;
  color: #f3f4f6;
}

.dim-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 0;
}

.dim-name {
  width: 200rpx;
  color: #cbd5e1;
  font-size: 24rpx;
}

.dim-track {
  flex: 1;
  height: 16rpx;
  background: #1f2937;
  border-radius: 8rpx;
  overflow: hidden;
}

.dim-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6, #c084fc);
  border-radius: 8rpx;
}

.dim-value {
  width: 100rpx;
  text-align: right;
  color: #f3f4f6;
  font-size: 24rpx;
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

.tag-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 6rpx 0;
}

.explain-box {
  margin-top: 16rpx;
  padding: 16rpx;
  background: #111827;
  border: 1rpx solid #1f2937;
  border-radius: 12rpx;
  font-family: monospace;
  font-size: 22rpx;
  color: #cbd5e1;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 480rpx;
  overflow: auto;
}
</style>
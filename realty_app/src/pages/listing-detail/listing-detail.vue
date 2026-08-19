<template>
  <view class="page" :data-realty-theme="realtyTheme" :class="'realty-theme-' + realtyTheme">
    <view class="container">
      <!-- v0.54.0 detail-1: 顶部快捷导航 (返回 + 同区其他小区 + 小区详情) -->
      <view class="quicknav">
        <view class="qn-btn" @click="goBack">← 返回</view>
        <view class="qn-btn" @click="goDashboard">📊 仪表盘</view>
        <view class="qn-btn" @click="goCommunity">🏘️ 小区详情</view>
        <view v-if="sameCommunityListings.length > 0" class="qn-btn qn-btn--primary" @click="scrollToSameCommunity">
          🔁 同小区其他 ({{ sameCommunityListings.length }})
        </view>
      </view>

      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>

      <!-- 对照贝壳：首屏图集；有 cover_url 才展示，绝不伪造 -->
      <view v-if="data" class="card listing-gallery" data-listing-gallery>
        <image
          v-if="data.listing.cover_url"
          class="gallery-cover"
          :src="data.listing.cover_url"
          mode="aspectFill"
          lazy-load
          data-listing-cover
          @click="openSource"
        />
        <view v-else class="gallery-empty" @click="data.listing.source_url ? openSource() : undefined">
          <text class="gallery-empty-title">暂无实景图</text>
          <text class="muted gallery-empty-desc">
            {{
              data.listing.source_url
                ? "样本库暂无封面 URL；可点此处或底栏打开源站查看图集。"
                : "样本库无封面 URL；有真图源后再接入轮播（对照贝壳详情首屏）。"
            }}
          </text>
        </view>
      </view>

      <view v-if="data" class="card listing-hero">
        <view class="row-between">
          <view class="card-title listing-title">{{ data.listing.title }}</view>
          <view class="listing-hero-actions">
            <FavoriteButton v-if="listingLibraryItem" :item="listingLibraryItem" />
            <view class="score-pill" :class="scoreClass(data.score.overall_score_0_100)">
              {{ data.score.overall_score_0_100.toFixed(1) }}
            </view>
          </view>
        </view>

        <!-- 对照贝壳/链家：总价大字 + 单价辅文 + 一行户型摘要 -->
        <view class="price-row">
          <view class="price-main">{{ formatPrice(data.listing.total_price_10k) }}</view>
          <view class="price-unit muted">{{ formatUnitPrice(data.listing.unit_price) }}</view>
        </view>
        <view class="fact-strip muted">{{ listingFactStrip }}</view>
        <view v-if="listingTagPills.length > 0" class="listing-tag-pills" data-listing-tags>
          <text v-for="tag in listingTagPills" :key="tag" class="listing-tag-pill">{{ tag }}</text>
        </view>
        <view v-else class="muted" style="font-size: 22rpx; margin-bottom: 8rpx" data-listing-tags-empty>
          暂无挂牌标签
        </view>
        <view class="meta-line muted" v-if="data.listing.listing_type || data.listing.crawl_date">
          <text v-if="data.listing.listing_type">类型 {{ data.listing.listing_type }}</text>
          <text v-if="data.listing.crawl_date"> · 样本日 {{ data.listing.crawl_date }}</text>
        </view>
        <view class="community-chip tap-row" hover-class="tap-row--active" @click="goCommunity">
          <text class="community-chip-label">小区</text>
          <text class="community-chip-name">{{ sameCommunityName || "查看小区" }}</text>
          <text class="community-chip-caret">›</text>
        </view>

        <view class="source-trust-row">
          <text class="source-trust" :class="'source-trust--' + data.listing.source_kind.toLowerCase()">
            {{ sourceKindLabel }}
          </text>
          <text class="muted">{{ data.listing.source || "来源未注明" }}</text>
        </view>
        <view v-if="data.listing.source_kind === 'DERIVED'" class="derived-warning">
          此房源为公开城市指标与市场参考价生成的分析样本，不代表真实逐套挂牌或成交记录。
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
      </view>

      <!-- 对照贝壳底栏：有源链则唤起；无链仍保留辅操作 -->
      <view v-if="data" class="source-dock">
        <button
          v-if="data.listing.source_url"
          class="source-dock-primary"
          @click="openSource"
          @longpress="openSourceMenu"
        >
          {{ sourceLinkLabel }}
        </button>
        <button v-else class="source-dock-primary" @click="goListingFilterSameCommunity">
          同小区全部房源
        </button>
        <button class="source-dock-ghost" @click="data.listing.source_url ? copyUrl() : copyTitle()">
          {{ data.listing.source_url ? "复制链接" : "复制标题" }}
        </button>
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

      <!-- v0.54.0 detail-1: 同小区其他挂牌 -->
      <view v-if="sameCommunityListings.length > 0" id="same-community-listings" class="card">
        <view class="card-title">🔁 同小区其他挂牌 · {{ sameCommunityName }}</view>
        <view class="muted" style="font-size: 22rpx; margin-bottom: 8rpx">
          横向对比: 同小区共 {{ sameCommunityAll.length }} 套样本, 显示其他 {{ sameCommunityListings.length }} 套
          (已按单价降序；无价房源仍列出)
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
import { resolvedThemeRef as realtyTheme } from "../../utils/theme";
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
  scoreClass
} from "../../utils/format";
import { getListingsByCommunity, getCommunityById, getCityById } from "../../local/store";
import { listingSourceKindLabel } from "../../local/listingSource";
import { getListingTagLabels } from "../../local/listingTags";
import { housingAppHint, openHousingSourceUrl } from "../../utils/openExternal";
import FavoriteButton from "../../components/FavoriteButton.vue";
import type { UserLibraryEntityInput } from "../../local/userLibrary";
import { useUserLibraryStore } from "../../store/userLibrary";

const listingId = ref<number>(0);
const data = ref<ListingDetailResponse | null>(null);
const errorMsg = ref<string>("");
const explainOpen = ref(false);
const userLibrary = useUserLibraryStore();
const listingLibraryItem = computed<UserLibraryEntityInput | null>(() => {
  const listing = data.value?.listing;
  if (!listing) return null;
  return {
    type: "listing",
    id: listing.listing_id,
    title: listing.title,
    city: getCityById(listing.city_id)?.cityName ?? "",
    coverUrl: listing.cover_url,
    route: "/pages/listing-detail/listing-detail",
    query: { id: listing.listing_id }
  };
});
const sourceKindLabel = computed(() => data.value ? listingSourceKindLabel(data.value.listing.source_kind) : "");
const sourceLinkLabel = computed(() => {
  const url = data.value?.listing.source_url;
  if (url) {
    const hint = housingAppHint(url);
    if (hint) return hint.label;
  }
  return data.value?.listing.source_kind === "DERIVED" ? "查看参考页面" : "查看源链接";
});

/** 贝壳式一行摘要：户型 · 面积 · 朝向 · 装修 · 楼龄 */
const listingFactStrip = computed(() => {
  const l = data.value?.listing;
  if (!l) return "";
  const parts: string[] = [];
  if (l.bedrooms != null || l.bathrooms != null) {
    parts.push(`${l.bedrooms ?? "-"}室${l.bathrooms ?? "-"}卫`);
  }
  if (l.area_sqm) parts.push(formatArea(l.area_sqm));
  if (l.orientation) parts.push(l.orientation);
  if (l.decorate_type) parts.push(l.decorate_type);
  if (l.build_year) parts.push(`${l.build_year}年建`);
  return parts.join(" · ");
});

const listingTagPills = computed(() => {
  const l = data.value?.listing;
  if (!l) return [] as string[];
  return getListingTagLabels(l.listing_id, l.tags_json).slice(0, 8);
});
// v0.54.0 detail-1: 同小区其他 listings
const sameCommunityAll = ref<ReturnType<typeof getListingsByCommunity>>([]);
const sameCommunityListings = computed(() => {
  return sameCommunityAll.value
    .filter((l) => l.listingId !== listingId.value)
    .sort((a, b) => {
      const ua = a.unitPrice && a.unitPrice > 0 ? a.unitPrice : -1;
      const ub = b.unitPrice && b.unitPrice > 0 ? b.unitPrice : -1;
      if (ub !== ua) return ub - ua;
      return a.listingId - b.listingId;
    })
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
  const url = data.value?.listing.source_url;
  if (!url) return;
  // App：直接唤起贝壳/链家/安居客；失败再选浏览器/复制。长按见 openSourceMenu。
  openHousingSourceUrl(url, { mode: "app" });
}

function openSourceMenu() {
  const url = data.value?.listing.source_url;
  if (!url) return;
  openHousingSourceUrl(url, { mode: "sheet" });
}

function copyUrl() {
  if (data.value?.listing.source_url) {
    copyText(data.value.listing.source_url);
  }
}

function copyTitle() {
  const t = data.value?.listing.title;
  if (t) copyText(t);
}

function scrollToSameCommunity() {
  uni.pageScrollTo({
    selector: "#same-community-listings",
    duration: 280,
    fail: () => uni.showToast({ title: "同小区列表在下方", icon: "none" })
  });
}

function goListingFilterSameCommunity() {
  const cid = data.value?.listing.community_id;
  if (cid == null) return;
  uni.navigateTo({
    url: `/pages/listing-filter/listing-filter?communityId=${cid}`
  });
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
    if (listingLibraryItem.value) {
      userLibrary.recordHistory(listingLibraryItem.value);
    }
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
.listing-hero-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10rpx;
}

.listing-gallery {
  margin-bottom: 12rpx;
  padding: 0;
  overflow: hidden;
}
.gallery-cover {
  width: 100%;
  height: 360rpx;
  display: block;
  background: var(--color-soft-strong, #e2e8f0);
}
.gallery-empty {
  min-height: 220rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 32rpx 24rpx;
  background: linear-gradient(180deg, var(--color-soft-strong, #e2e8f0), var(--color-soft, #f1f5f9));
}
.gallery-empty-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--color-heading);
}
.gallery-empty-desc {
  font-size: 22rpx;
  text-align: center;
  line-height: 1.45;
  max-width: 560rpx;
}
.listing-hero {
  margin-bottom: 16rpx;
}
.listing-title {
  flex: 1;
  padding-right: 12rpx;
  line-height: 1.35;
}
.price-row {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-top: 12rpx;
}
.price-main {
  font-size: 48rpx;
  font-weight: 700;
  color: #e11d48;
  line-height: 1.1;
}
.price-unit {
  font-size: 24rpx;
}
.fact-strip {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.4;
}
.listing-tag-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}
.listing-tag-pill {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  background: var(--color-soft);
  color: var(--color-chip-text);
  border: 1rpx solid var(--color-border);
}
.community-chip {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 12rpx;
  background: var(--color-soft);
}
.community-chip-label {
  font-size: 22rpx;
  color: var(--color-muted);
}
.community-chip-name {
  flex: 1;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-heading);
}
.community-chip-caret {
  color: var(--color-muted);
  font-size: 28rpx;
}

/* 对照贝壳详情底栏：主色 CTA 占满、辅操作次之 */
.source-dock {
  position: sticky;
  bottom: calc(12rpx + var(--safe-area-bottom, 0px));
  z-index: 20;
  display: flex;
  gap: 12rpx;
  padding: 12rpx 8rpx;
  margin: 8rpx 0 24rpx;
  background: color-mix(in srgb, var(--color-card, var(--color-surface)) 92%, transparent);
  backdrop-filter: blur(8px);
  border-radius: 16rpx;
  border: 1rpx solid var(--color-border, rgba(148, 163, 184, 0.25));
}
.source-dock-primary,
button.source-dock-primary {
  flex: 1.4;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 80rpx;
  padding: 0 24rpx;
  border-radius: 12rpx;
  background: #00ae66 !important;
  color: #fff !important;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.2;
}
.source-dock-ghost,
button.source-dock-ghost {
  flex: 0.8;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 80rpx;
  padding: 0 16rpx;
  border-radius: 12rpx;
  background: var(--color-soft) !important;
  color: var(--color-text) !important;
  border: 1rpx solid var(--color-border) !important;
  font-size: 26rpx;
  line-height: 1.2;
}

.source-trust-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 12rpx;
}
.source-trust {
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
}
.source-trust--real { background: rgba(34, 197, 94, 0.18); color: #4ade80; }
.source-trust--derived { background: rgba(245, 158, 11, 0.18); color: #fbbf24; }
.source-trust--estimated,
.source-trust--unknown { background: rgba(148, 163, 184, 0.18); color: #cbd5e1; }
.derived-warning {
  margin-top: 12rpx;
  padding: 12rpx 16rpx;
  border-radius: 10rpx;
  background: rgba(245, 158, 11, 0.12);
  color: #fde68a;
  font-size: 22rpx;
  line-height: 1.5;
}
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
  background: var(--color-soft);
  font-size: 24rpx;
  color: var(--color-chip-text);
  text-align: center;
  cursor: pointer;
  transition: background 0.15s;
}
.qn-btn:hover {
  background: var(--color-soft-strong);
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
  color: var(--color-heading);
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
  color: var(--color-heading);
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
  background: var(--color-soft-strong);
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
  color: var(--color-heading);
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
  color: var(--color-heading);
  flex: 1;
}
.poi-row {
  display: flex;
  justify-content: space-between;
  padding: 8rpx 0 8rpx 40rpx;
  border-bottom: 1rpx solid var(--color-soft-strong);
  font-size: 24rpx;
  color: var(--color-text);
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
  border-bottom: 1rpx solid var(--color-soft-strong);
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
  color: var(--color-heading);
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
  border-bottom: 1rpx solid var(--color-soft-strong);
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
  color: var(--color-heading);
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
  background: var(--color-surface);
  border: 1rpx solid var(--color-soft-strong);
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

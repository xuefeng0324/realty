<template>
  <view class="page" :data-realty-theme="realtyTheme" :class="'realty-theme-' + realtyTheme">
    <view class="card map-control-card">
      <view class="row-between">
        <view>
          <view class="control-eyebrow">MAP FIND</view>
          <view class="card-title map-title" style="margin-bottom: 0">地图找房</view>
        </view>
        <view class="map-summary" data-map-summary>
          {{ citiesReady ? `${visibleListingCount} 套 · ${visibleCommunityCount} 小区` : "加载中…" }}
        </view>
      </view>
      <view class="control-section">
        <view class="control-label">城市</view>
        <view class="city-segment">
          <button class="btn city-option" :class="{ 'city-option--active': app.cityId === 2, 'btn--active': app.cityId === 2 }" size="mini" @click="zoomToCity(2)">深圳</button>
          <button class="btn city-option" :class="{ 'city-option--active': app.cityId === 1, 'btn--active': app.cityId === 1 }" size="mini" @click="zoomToCity(1)">广州</button>
          <button class="btn city-option" :class="{ 'city-option--active': app.cityId === 3, 'btn--active': app.cityId === 3 }" size="mini" @click="zoomToCity(3)">珠海</button>
        </view>
      </view>

      <view class="control-label layer-label">找房筛选</view>
      <scroll-view scroll-x class="map-mode-scroll" data-map-price-filters>
        <view class="map-mode-list">
          <button
            v-for="item in priceBandItems"
            :key="item.key"
            class="map-filter-btn"
            :class="{ 'map-filter-btn--active': priceBand === item.key }"
            :data-price-band="item.key"
            size="mini"
            @click="setPriceBand(item.key)"
          >
            {{ item.label }}
          </button>
        </view>
      </scroll-view>
      <scroll-view scroll-x class="map-mode-scroll" data-map-bedroom-filters>
        <view class="map-mode-list">
          <button
            v-for="item in bedroomBandItems"
            :key="item.key"
            class="map-filter-btn"
            :class="{ 'map-filter-btn--active': bedroomBand === item.key }"
            :data-bedroom-band="item.key"
            size="mini"
            @click="setBedroomBand(item.key)"
          >
            {{ item.label }}
          </button>
        </view>
      </scroll-view>

      <view class="control-label layer-label">图层模式</view>
      <scroll-view scroll-x class="map-mode-scroll">
        <view class="map-mode-list">
          <button
            v-for="item in mapModeItems"
            :key="item.key"
            class="map-mode-btn"
            :class="{ 'map-mode-btn--active': mode === item.key }"
            :data-map-mode="item.key"
            size="mini"
            @click="setMapMode(item.key)"
          >
            {{ item.icon }} {{ item.label }}
          </button>
        </view>
      </scroll-view>
      <view class="mode-summary-row">
        <view class="mode-summary-dot"></view>
        <text>当前：{{ modeLabel }} · 点标注看盘 / 进详情</text>
        <button class="cycle-btn" size="mini" @click="toggleType">切换下一图层</button>
      </view>
      <view class="muted legend">
        <text v-if="mode === 'listings'">
          找房（对照贝壳/链家）：气泡=房源聚合；点单套房源进详情；点聚合可放大并打开附近小区底栏；上方可筛总价/户型。地图最多展示部分挂牌点。
        </text>
        <text v-else-if="mode === 'price'">
          挂牌均价热力：点地图/小区气泡打开本小区房源底栏（卖方挂牌均价，非成交价）
        </text>
        <text v-else-if="mode === 'count'">
          挂牌数热力：点地图/小区气泡打开本小区房源底栏
        </text>
        <text v-else-if="mode === 'poi'">
          POI overlay：5 类配套；找房请切回「找房」图层
        </text>
        <text v-else>
          地铁规划线；找房请切回「找房」图层
        </text>
      </view>

      <view v-if="mode === 'metro'" class="curvature-card">
        <view class="row-between">
          <view class="curvature-title">🌀 弯曲系数 Top 5</view>
          <view class="muted" style="font-size: 22rpx">actual / straight · 越高越曲折</view>
        </view>
        <view class="curvature-desc muted">
          同等直线距离下，实际线路长度比值。比值高 → 站点更多 / 拐弯更多 → 覆盖广
        </view>
        <view v-for="(row, i) in curvatureTop5" :key="row.lineId" class="curvature-row">
          <view class="curvature-rank">{{ i + 1 }}</view>
          <view class="curvature-meta">
            <view class="curvature-name">{{ row.lineName }}</view>
            <view class="curvature-sub muted">
              实际 {{ row.actualLengthKm?.toFixed(1) ?? "?" }} km ·
              直线 {{ row.straightLineKm.toFixed(1) }} km
            </view>
          </view>
          <view class="curvature-ratio">
            {{ row.curvatureRatio != null ? row.curvatureRatio.toFixed(2) : "—" }}
          </view>
        </view>
      </view>

      <view v-if="mode === 'poi'" class="poi-toggles">
        <view
          v-for="cat in (['subway', 'school', 'hospital', 'mall', 'park'] as PoiCat[])"
          :key="cat"
          :class="['poi-toggle', poiFilter.has(cat) ? 'poi-toggle-on' : 'poi-toggle-off']"
          @click="togglePoiCategory(cat)"
        >
          <text>{{ poiEmoji(cat) }} {{ poiLabel(cat) }} {{ poiCategoryCounts[cat] }}</text>
        </view>
      </view>
    </view>

    <view class="map-wrap">
      <map
        id="realty-map"
        :key="mapReloadKey"
        class="map"
        :data-map-mode="mode"
        :data-overlay-count="currentOverlayCount"
        :data-map-reload-key="mapReloadKey"
        :data-find-listing-count="visibleListingCount"
        :latitude="mapCenter.lat"
        :longitude="mapCenter.lng"
        :scale="mapScale"
        :markers="activeMarkers"
        :circles="heatMode ? heatCircles : []"
        :polyline="mode === 'metro' ? metroPolylines : []"
        :show-location="true"
        :enable-zoom="true"
        :enable-scroll="true"
        @markertap="onMarkerTap"
        @tap="onMapTap"
        @updated="onMapUpdated"
        @error="onMapError"
      ></map>
      <view v-if="mapStatus !== 'ready'" class="map-status" :class="{ 'map-status--slow': mapStatus === 'slow' }" data-map-status>
        <view v-if="mapStatus === 'loading'" class="map-status-content">
          <view class="map-spinner"></view>
          <text>正在连接地图服务…</text>
        </view>
        <view v-else class="map-status-content map-status-content--slow">
          <view>
            <view class="map-status-title">底图加载较慢</view>
            <view class="map-status-hint">图层数据仍可切换；请检查网络或地图服务配置后重试。</view>
          </view>
          <button class="map-retry-btn" size="mini" data-map-retry @click="retryMap">重新加载</button>
        </view>
      </view>
    </view>

    <view v-if="mode === 'price' && priceBuckets.length > 0" class="card legend-card">
      <view class="card-title" style="margin-bottom: 4rpx">🎨 挂牌价格分位图例</view>
      <view class="muted" style="font-size: 22rpx; margin-bottom: 8rpx">
        颜色 = 5 档挂牌单价分位 (绿便宜 → 红贵)；半径 = 价格×挂牌数 (大=贵+多)；非成交价
      </view>
      <view class="legend-row" v-for="b in priceBuckets" :key="b.label" data-price-bucket>
        <view class="legend-swatch" :style="{ background: b.color }" data-legend-swatch></view>
        <text class="legend-text">{{ b.label }}</text>
        <text class="legend-range" data-legend-range>{{ formatPriceRange(b.min, b.max) }} 元/㎡</text>
      </view>
      <view class="legend-summary">
        <text class="muted">
          样本小区挂牌均价 {{ cityAvgPrice ? Math.round(cityAvgPrice).toLocaleString() : "—" }} 元/㎡
          <text class="muted">（有均价小区算术平均，非成交价）</text>
          · 已覆盖 {{ pricedCommunityCount }} 个有挂牌均价的社区
        </text>
      </view>
    </view>

    <view v-if="findSheetOpen" class="find-sheet" data-find-sheet>
      <view class="find-sheet-head">
        <view class="find-sheet-title-wrap">
          <text class="find-sheet-title">{{ findSheetTitle }}</text>
          <text class="find-sheet-sub muted">{{ sheetListings.length }} 套符合筛选 · 挂牌价</text>
        </view>
        <text class="info-close" data-find-sheet-close @click="closeFindSheet">✕</text>
      </view>
      <scroll-view scroll-y class="find-sheet-list">
        <view
          v-for="row in sheetListings"
          :key="row.listingId"
          class="find-listing-row"
          :data-find-listing-id="row.listingId"
          @click="goListingDetail(row.listingId)"
        >
          <view class="find-listing-main">
            <text class="find-listing-title">{{ row.title || `挂牌 #${row.listingId}` }}</text>
            <text class="find-listing-meta muted">{{ listingCardLine(row) }}</text>
          </view>
          <text class="find-listing-go">详情</text>
        </view>
        <view v-if="sheetListings.length === 0" class="find-empty muted">
          当前筛选下本小区暂无挂牌，试试放宽总价/户型
        </view>
      </scroll-view>
      <view class="find-sheet-actions">
        <button class="btn find-sheet-btn" size="mini" data-find-all @click="goCommunityListings">
          本小区全部房源 →
        </button>
        <button class="btn-ghost find-sheet-btn" size="mini" data-find-community @click="goCommunity">
          小区详情
        </button>
      </view>
    </view>

    <view v-if="selectedPoi" class="info-card">
      <view class="row-between">
        <text class="info-name">
          {{ poiEmoji(selectedPoi.poiCategory) }} {{ selectedPoi.poiName }}
        </text>
        <text class="info-close" @click="closePoiCard">✕</text>
      </view>
      <text class="info-line">
        {{ poiLabel(selectedPoi.poiCategory) }} · {{ selectedPoi.poiType || "" }}
      </text>
      <view class="info-row">
        <view class="info-stat">
          <text class="info-stat-label">距离</text>
          <text class="info-stat-value">{{ Math.round(selectedPoi.distanceM) }}m</text>
        </view>
        <view class="info-stat">
          <text class="info-stat-label">所属小区</text>
          <text class="info-stat-value">#{{ selectedPoi.communityId }}</text>
        </view>
      </view>
      <text v-if="selectedPoi.address" class="info-line">{{ selectedPoi.address }}</text>
      <button class="btn" size="mini" data-find-poi-community @click="openCommunitySheet(selectedPoi.communityId)">
        看该小区房源 →
      </button>
    </view>

    <view v-if="selectedMetro" class="info-card">
      <view class="row-between">
        <text class="info-name">🚇 {{ selectedMetro.lineName }}</text>
        <text class="info-close" @click="closeMetroCard">✕</text>
      </view>
      <text class="info-line">
        {{ selectedMetro.status || "—" }} · 预计 {{ selectedMetro.openYearExpected ?? "?" }} 开通
      </text>
      <view class="info-row">
        <view class="info-stat">
          <text class="info-stat-label">线路</text>
          <text class="info-stat-value">{{ selectedMetro.startStation }} ↔ {{ selectedMetro.endStation }}</text>
        </view>
        <view class="info-stat">
          <text class="info-stat-label">站点</text>
          <text class="info-stat-value">{{ selectedMetro.stationCount ?? "—" }}</text>
        </view>
        <view class="info-stat">
          <text class="info-stat-label">长度</text>
          <text class="info-stat-value">{{ selectedMetro.lengthKm ?? "—" }}km</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { resolvedThemeRef as realtyTheme } from "../../utils/theme";
import { computed, ref } from "vue";
import { onMounted, onUnmounted } from "vue";
import { SNAPSHOT_UPDATED_EVENT } from "../../config";
import { useAppStore } from "../../store/app";
import {
  getCommunitiesByCity,
  getListingsByCity,
  getCommunityById,
  getPoisByCity,
  getMetroLineGeosByCity,
  getMetroLinesByCity,
  getCommunityGeoByCity
} from "../../local/store";
import { getCities, getPoisByCommunity } from "../../local/store";
import { getMetroPlanningGeoByCityCrossReference, type CurvatureEntry } from "../../local/metroPlanningGeoAnalysis";
import { toErrorMessage } from "../../utils/errorMessage";
import { showToast } from "../../utils/format";
import { clusterMarkers, type ClusterInputPoint, type ClusterOutputPoint } from "../../local/cluster";
import {
  buildCountHeatCircles,
  buildPriceBuckets,
  buildPriceHeatCircles,
  formatPriceRangeK,
  priceColorRamp5
} from "../../local/mapMath";
import {
  MAP_BEDROOM_BANDS,
  MAP_PRICE_BANDS,
  filterMapListings,
  formatListingCardLine,
  nearestCommunityId,
  sortMapListingsForSheet,
  type MapBedroomBand,
  type MapFindListing,
  type MapPriceBand
} from "../../local/mapFind";

// v0.18.0 高德 H5 marker 必须有 iconPath, 否则 console 报 "Marker.iconPath is required"
// 用 inline SVG data URI 兜底 (16x16 蓝色圆点)
const DEFAULT_MARKER_ICON =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#0ea5e9" stroke="#fff" stroke-width="2"/></svg>`
  );
// cluster 红气泡 (32x32)
const CLUSTER_MARKER_ICON_SMALL =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#ef4444" stroke="#fff" stroke-width="3"/></svg>`
  );
const CLUSTER_MARKER_ICON_LARGE =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="#ef4444" stroke="#fff" stroke-width="3"/></svg>`
  );

const app = useAppStore();
const errorMsg = ref<string>("");
/** 模式: listings=找房主路径; count/price=热力; poi/metro=配套 */
type MapMode = "count" | "price" | "listings" | "poi" | "metro";
type PoiCat = "subway" | "school" | "hospital" | "mall" | "park";
const mode = ref<MapMode>("listings");
const mapStatus = ref<"loading" | "slow" | "ready">("loading");
const mapReloadKey = ref(0);
const priceBand = ref<MapPriceBand>("all");
const bedroomBand = ref<MapBedroomBand>("all");
const findSheetOpen = ref(false);

const priceBandItems = MAP_PRICE_BANDS;
const bedroomBandItems = MAP_BEDROOM_BANDS;

const mapModeItems: { key: MapMode; icon: string; label: string }[] = [
  { key: "listings", icon: "🏠", label: "找房" },
  { key: "count", icon: "🔴", label: "挂牌热力" },
  { key: "price", icon: "💰", label: "挂牌均价" },
  { key: "poi", icon: "🏫", label: "POI" },
  { key: "metro", icon: "🚇", label: "地铁" }
];

function setPriceBand(next: MapPriceBand) {
  priceBand.value = next;
}

function setBedroomBand(next: MapBedroomBand) {
  bedroomBand.value = next;
}

function setMapMode(next: MapMode) {
  mode.value = next;
  selectedPoi.value = null;
  selectedMetroLineId.value = null;
  if (next === "poi" || next === "metro") findSheetOpen.value = false;
}

function onMapUpdated() {
  mapStatus.value = "ready";
}

function onMapError() {
  mapStatus.value = "slow";
}

function retryMap() {
  mapStatus.value = "loading";
  mapReloadKey.value += 1;
  mapScale.value = mapScale.value;
}
const poiFilter = ref<Set<PoiCat>>(new Set(["subway", "school", "hospital", "mall", "park"]));
const selectedCommunityId = ref<number | null>(null);
const selectedPoi = ref<{ poiName: string; poiCategory: PoiCat; poiType: string | null; distanceM: number; address: string | null; communityId: number } | null>(null);
const selectedMetroLineId = ref<number | null>(null);
const selectedMetro = computed(() => {
  if (selectedMetroLineId.value == null) return null;
  return getMetroLinesByCity(app.cityId).find((l) => l.lineId === selectedMetroLineId.value) ?? null;
});
function closeMetroCard() {
  selectedMetroLineId.value = null;
}

const modeLabel = computed(() => {
  const item = mapModeItems.find((m) => m.key === mode.value);
  return item ? `${item.icon} ${item.label}` : mode.value;
});

const currentOverlayCount = computed(() => {
  if (mode.value === "listings") return listingClusterMarkers.value.length;
  if (mode.value === "poi") return poiMarkers.value.length;
  if (mode.value === "metro") return metroPolylines.value.length + metroLineMarkers.value.length;
  return heatCircles.value.length + communityBubbleMarkers.value.length;
});

const heatMode = computed(() => mode.value === "count" || mode.value === "price");

const filteredCityListings = computed<MapFindListing[]>(() => {
  if (!app.cityId) return [];
  return filterMapListings(getListingsByCity(app.cityId), {
    priceBand: priceBand.value,
    bedroomBand: bedroomBand.value
  });
});

const visibleListingCount = computed(() => filteredCityListings.value.length);

const filteredCommunityIds = computed(() => {
  const set = new Set<number>();
  for (const l of filteredCityListings.value) set.add(l.communityId);
  return set;
});

const visibleCommunityCount = computed(() => {
  return communityMarkers.value.filter(
    (c) => c.cityId === app.cityId && filteredCommunityIds.value.has(c.communityId)
  ).length;
});

const sheetListings = computed(() => {
  if (selectedCommunityId.value == null) return [];
  return sortMapListingsForSheet(
    filterMapListings(filteredCityListings.value, { communityId: selectedCommunityId.value }),
    40
  );
});

const findSheetTitle = computed(() => {
  const c = communityMarkers.value.find((x) => x.communityId === selectedCommunityId.value);
  return c ? c.communityName : "本小区房源";
});

function listingCardLine(row: MapFindListing): string {
  return formatListingCardLine(row);
}

function openCommunitySheet(communityId: number) {
  selectedCommunityId.value = communityId;
  selectedPoi.value = null;
  findSheetOpen.value = true;
  const c = communityMarkers.value.find((x) => x.communityId === communityId);
  if (c) {
    mapCenter.value = { lat: c.lat, lng: c.lng };
    if (mapScale.value < 13) mapScale.value = 14;
  }
}

function closeFindSheet() {
  findSheetOpen.value = false;
  selectedCommunityId.value = null;
}

function goListingDetail(id: number) {
  uni.navigateTo({
    url: `/pages/listing-detail/listing-detail?id=${id}`,
    fail: (e: any) => showToast(`跳转失败: ${toErrorMessage(e)}`)
  });
}

function goCommunityListings() {
  if (selectedCommunityId.value == null) return;
  uni.navigateTo({
    url: `/pages/listing-filter/listing-filter?communityId=${selectedCommunityId.value}`,
    fail: (e: any) => showToast(`跳转失败: ${toErrorMessage(e)}`)
  });
}

function onMapTap(e: any) {
  if (mode.value === "poi" || mode.value === "metro") return;
  const detail = e?.detail ?? {};
  const lat = Number(detail.latitude);
  const lng = Number(detail.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const candidates = communityMarkers.value.filter(
    (c) => c.cityId === app.cityId && filteredCommunityIds.value.has(c.communityId)
  );
  const id = nearestCommunityId(lat, lng, candidates, 1.5);
  if (id != null) openCommunitySheet(id);
}

function togglePoiCategory(cat: PoiCat) {
  const next = new Set(poiFilter.value);
  if (next.has(cat)) next.delete(cat);
  else next.add(cat);
  poiFilter.value = next;
}

function poiLabel(cat: PoiCat): string {
  return { subway: "地铁", school: "学校", hospital: "医院", mall: "商场", park: "公园" }[cat];
}

function poiColor(cat: PoiCat): string {
  return {
    subway: "#0ea5e9",
    school: "#22c55e",
    hospital: "#dc2626",
    mall: "#f59e0b",
    park: "#16a34a"
  }[cat];
}

function poiEmoji(cat: PoiCat): string {
  return { subway: "🚇", school: "🏫", hospital: "🏥", mall: "🛍", park: "🌳" }[cat];
}

interface CommunityMarker {
  communityId: number;
  cityId: number;
  communityName: string;
  district: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  listingCount: number;
  avgUnitPrice: number | null;
}

const communityMarkers = ref<CommunityMarker[]>([]);

const citiesReady = computed(() => communityMarkers.value.length > 0);
const totalMarkers = computed(() => communityMarkers.value.length);
const totalListings = computed(() =>
  communityMarkers.value.reduce((s, c) => s + c.listingCount, 0)
);

const mapCenter = ref<{ lat: number; lng: number }>({ lat: 22.543, lng: 114.06 });
const mapScale = ref<number>(11);

function formatCoord(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return "—";
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

const selectedCommunity = computed<(CommunityMarker & { priceLevel?: string }) | null>(() => {
  if (selectedCommunityId.value == null) return null;
  const c = communityMarkers.value.find((x) => x.communityId === selectedCommunityId.value);
  if (!c) return null;
  // 计算价格档（基于当前城市的 max/min）
  const priced = communityMarkers.value
    .filter((x) => x.cityId === c.cityId && x.avgUnitPrice != null && x.avgUnitPrice > 0)
    .map((x) => x.avgUnitPrice!) as number[];
  if (priced.length === 0 || c.avgUnitPrice == null) return c;
  const min = Math.min(...priced);
  const max = Math.max(...priced);
  if (max <= min) return c;
  const t = (c.avgUnitPrice - min) / (max - min);
  if (t < 0.2) return { ...c, priceLevel: "low" };
  if (t < 0.4) return { ...c, priceLevel: "mid_low" };
  if (t < 0.6) return { ...c, priceLevel: "mid" };
  if (t < 0.8) return { ...c, priceLevel: "mid_high" };
  return { ...c, priceLevel: "high" };
});

const priceLevelClass = computed(() => {
  if (!selectedCommunity.value?.priceLevel) return "";
  return `price-${selectedCommunity.value.priceLevel}`;
});

const priceLevelText = computed(() => {
  const map: Record<string, string> = {
    low: "便宜",
    mid_low: "中低",
    mid: "中等",
    mid_high: "中高",
    high: "昂贵"
  };
  return map[selectedCommunity.value?.priceLevel ?? ""] ?? "";
});

// POI overlay markers: 每个 POI 一个 marker，按 category 着色
// v0.22.0 map-3: POI marker 聚合
// - 复用 cluster.ts (类内 cluster，避免不同类混合)
// - 每类单独 cluster → 单点显示 emoji+name，聚合显示带数字气泡
// - 高 zoom (>=15) 几乎不聚合 (cell ≈ 250m)
// - tap: 单点 → info-card；聚合 → 放大到下一 zoom
const poiMarkers = computed(() => {
  if (!app.cityId || mode.value !== "poi") return [];
  const all = getPoisByCity(app.cityId);
  const filtered = all.filter((p) => poiFilter.value.has(p.poiCategory));
  if (filtered.length === 0) return [];
  // 每类单独 cluster (避免 5 类 POI 混合成一颗大球)
  const out: any[] = [];
  const cats: PoiCat[] = ["subway", "school", "hospital", "mall", "park"];
  const syntheticIdBase = -1000000;
  let syntheticIdCounter = 0;
  for (const cat of cats) {
    if (!poiFilter.value.has(cat)) continue;
    const list = filtered.filter((p) => p.poiCategory === cat);
    if (list.length === 0) continue;
    const color = poiColor(cat);
    // 用 cluster 算法
    const inputs: ClusterInputPoint[] = list.map((p) => ({
      id: -1 * (p.communityId * 1000 + p.poiRank * 10 + catCode(cat)),
      latitude: p.lat,
      longitude: p.lng,
      payload: p
    }));
    const clusters = clusterMarkers(inputs, Math.round(mapScale.value));
    for (const c of clusters) {
      if (c.count === 1) {
        const p = c.payload[0] as any;
        out.push({
          id: c.id,
          latitude: c.latitude,
          longitude: c.longitude,
          width: 24,
          height: 24,
          iconPath: POI_MARKER_ICONS[cat],
          title: `${poiEmoji(cat)} ${p.poiName}`,
          callout: {
            content: `${poiEmoji(cat)} ${p.poiName}\n${poiLabel(cat)} · ${Math.round(p.distanceM)}m`,
            color: "#ffffff",
            bgColor: color,
            padding: 4,
            borderRadius: 4,
            fontSize: 11,
            display: "BYCLICK"
          }
        });
      } else {
        // 聚合点: 大号彩色气泡 + 数字
        const size = c.count >= 50 ? 44 : c.count >= 10 ? 38 : 32;
        out.push({
          id: syntheticIdBase - syntheticIdCounter++,
          latitude: c.latitude,
          longitude: c.longitude,
          width: size,
          height: size,
          iconPath: makePoiClusterIcon(cat, c.count, color),
          title: `${poiEmoji(cat)} ${poiLabel(cat)} · ${c.count} 个`,
          callout: {
            content: `${poiEmoji(cat)} ${poiLabel(cat)} 聚合 ${c.count} 个\n点击放大展开`,
            color: "#ffffff",
            bgColor: color,
            padding: 4,
            borderRadius: 4,
            fontSize: 11,
            display: "BYCLICK"
          }
        });
      }
    }
  }
  return out;
});

// v0.22.0 map-3: POI 单点图标 (彩色 emoji + 类别色背景圆)
const POI_MARKER_ICONS: Record<PoiCat, string> = {
  subway: makePoiSingleIcon("🚇", "#0ea5e9"),
  school: makePoiSingleIcon("🏫", "#22c55e"),
  hospital: makePoiSingleIcon("🏥", "#dc2626"),
  mall: makePoiSingleIcon("🛍", "#f97316"),
  park: makePoiSingleIcon("🌳", "#16a34a")
};

function makePoiSingleIcon(emoji: string, color: string): string {
  // SVG data URI: 圆形背景 + emoji
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="${color}" stroke="#ffffff" stroke-width="2"/><text x="16" y="22" text-anchor="middle" font-size="16">${emoji}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function makePoiClusterIcon(cat: PoiCat, count: number, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="${color}" fill-opacity="0.85" stroke="#ffffff" stroke-width="3"/><text x="22" y="28" text-anchor="middle" font-size="16" font-weight="bold" fill="#ffffff">${count}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function catCode(cat: PoiCat): number {
  return { subway: 1, school: 2, hospital: 3, mall: 4, park: 5 }[cat];
}

// v0.15.0 metro overlay
function metroStatusColor(status: string | null): string {
  if (status === "即将开通") return "#22c55e"; // 绿
  if (status === "在建") return "#f59e0b"; // 橙
  return "#94a3b8"; // 灰 (规划)
}

const metroLineMarkers = computed(() => {
  if (!app.cityId || mode.value !== "metro") return [];
  const geos = getMetroLineGeosByCity(app.cityId);
  const out: any[] = [];
  for (const g of geos) {
    if (g.startLat == null || g.startLng == null) continue;
    out.push({
      id: 9000000 + g.lineId,
      latitude: g.startLat,
      longitude: g.startLng,
      width: 24,
      height: 24,
      iconPath: DEFAULT_MARKER_ICON,
      title: `🚇 ${g.lineName} · 起点 ${g.startStation}`,
      callout: {
        content: `🚇 ${g.lineName}\n${g.startStation}`,
        color: "#ffffff",
        bgColor: "#0ea5e9",
        padding: 4,
        borderRadius: 4,
        fontSize: 11,
        display: "BYCLICK"
      }
    });
    if (g.endLat == null || g.endLng == null) continue;
    out.push({
      id: 9100000 + g.lineId,
      latitude: g.endLat,
      longitude: g.endLng,
      width: 24,
      height: 24,
      iconPath: DEFAULT_MARKER_ICON,
      title: `🚇 ${g.lineName} · 终点 ${g.endStation}`,
      callout: {
        content: `🚇 ${g.lineName}\n${g.endStation}`,
        color: "#ffffff",
        bgColor: "#0ea5e9",
        padding: 4,
        borderRadius: 4,
        fontSize: 11,
        display: "BYCLICK"
      }
    });
  }
  return out;
});

const metroPolylines = computed(() => {
  if (!app.cityId || mode.value !== "metro") return [];
  const geos = getMetroLineGeosByCity(app.cityId);
  const lines = getMetroLinesByCity(app.cityId);
  const lineMap = new Map(lines.map((l) => [l.lineId, l]));
  const out: any[] = [];
  for (const g of geos) {
    if (g.startLat == null || g.startLng == null || g.endLat == null || g.endLng == null) continue;
    const line = lineMap.get(g.lineId);
    const status = line?.status ?? null;
    const color = metroStatusColor(status);
    out.push({
      points: [
        { latitude: g.startLat, longitude: g.startLng },
        { latitude: g.endLat, longitude: g.endLng }
      ],
      color,
      width: 4,
      // H5 高德 polyline 不支持 dottedLine，但用色码已够区分
      arrowLine: true
    });
  }
  return out;
});

// v1.119.0 弯曲系数 Top 5（当前城市，按弯曲比降序）
const curvatureTop5 = computed<CurvatureEntry[]>(() => {
  if (!app.cityId) return [];
  return getMetroPlanningGeoByCityCrossReference()
    .filter((r) => r.cityId === app.cityId)
    .slice(0, 5);
});

// poiSeed 总体统计（5 类各多少）
const poiCategoryCounts = computed(() => {
  if (!app.cityId) return { subway: 0, school: 0, hospital: 0, mall: 0, park: 0 };
  const all = getPoisByCity(app.cityId);
  const out: Record<PoiCat, number> = { subway: 0, school: 0, hospital: 0, mall: 0, park: 0 };
  for (const p of all) out[p.poiCategory] += 1;
  return out;
});

// v0.18.0 map-2: listings 模式下用网格聚合 (cluster) 而非逐点
//   - 每个 listing 先转成 ClusterInputPoint
//   - 根据当前 mapScale 算 cell 大小 (zoom 11 → 4km, zoom 14 → 500m)
//   - 输出 cluster markers (单点保留原 id, 多点用负 id + count)
const listingMarkerInputs = computed<ClusterInputPoint[]>(() => {
  if (!app.cityId) return [];
  const listings = filteredCityListings.value;
  const cidToGeo = new Map<number, { lat: number; lng: number; name: string; district: string }>();
  for (const c of communityMarkers.value) {
    if (c.cityId === app.cityId) {
      cidToGeo.set(c.communityId, {
        lat: c.lat,
        lng: c.lng,
        name: c.communityName,
        district: c.district
      });
    }
  }
  const out: ClusterInputPoint[] = [];
  for (let i = 0; i < listings.length && i < 600; i++) {
    const l = listings[i];
    const geo = cidToGeo.get(l.communityId);
    if (!geo) continue;
    out.push({
      id: l.listingId,
      latitude: geo.lat,
      longitude: geo.lng,
      payload: {
        listingId: l.listingId,
        communityId: l.communityId,
        name: geo.name,
        totalPrice10k: l.totalPrice10k
      }
    });
  }
  return out;
});

/** 热力模式下可点的小区气泡（对照贝壳：点气泡出房源） */
const COMMUNITY_MARKER_BASE = 8000000;
const communityBubbleMarkers = computed(() => {
  if (!app.cityId || !heatMode.value) return [];
  const list = communityMarkers.value.filter(
    (c) => c.cityId === app.cityId && filteredCommunityIds.value.has(c.communityId)
  );
  return list.slice(0, 80).map((c) => {
    const count = filteredCityListings.value.filter((l) => l.communityId === c.communityId).length;
    const price =
      c.avgUnitPrice != null ? `${Math.round(c.avgUnitPrice / 1000)}k` : `${count}套`;
    return {
      id: COMMUNITY_MARKER_BASE + c.communityId,
      latitude: c.lat,
      longitude: c.lng,
      width: 28,
      height: 28,
      iconPath: DEFAULT_MARKER_ICON,
      title: c.communityName,
      callout: {
        content: `${c.communityName}\n${count}套 · ${price}`,
        color: "#0f172a",
        bgColor: "#ffffff",
        padding: 6,
        borderRadius: 8,
        fontSize: 11,
        display: "ALWAYS"
      }
    };
  });
});

const activeMarkers = computed(() => {
  if (mode.value === "listings") return listingClusterMarkers.value;
  if (mode.value === "poi") return poiMarkers.value;
  if (mode.value === "metro") return metroLineMarkers.value;
  return communityBubbleMarkers.value;
});

const listingClusterMarkers = computed<any[]>(() => {
  // v0.27.0 map-8: 密度过滤 — 低 zoom 时只保留 listings 较多的社区
  const scale = Math.round(mapScale.value);
  const inputs = listingMarkerInputs.value;
  let visibleInputs: ClusterInputPoint[] = inputs;
  if (scale <= 10) {
    // zoom <= 10 (城市级): 只保留 listing_count >= 5 的社区
    const cnt = new Map<number, number>();
    for (const p of inputs) {
      const cid = (p.payload as { communityId?: number }).communityId;
      if (cid == null) continue;
      cnt.set(cid, (cnt.get(cid) ?? 0) + 1);
    }
    visibleInputs = inputs.filter((p) => {
      const cid = (p.payload as { communityId?: number }).communityId;
      return cid != null && (cnt.get(cid) ?? 0) >= 5;
    });
  } else if (scale <= 11) {
    // zoom 11 (区级): 保留 listing_count >= 2
    const cnt = new Map<number, number>();
    for (const p of inputs) {
      const cid = (p.payload as { communityId?: number }).communityId;
      if (cid == null) continue;
      cnt.set(cid, (cnt.get(cid) ?? 0) + 1);
    }
    visibleInputs = inputs.filter((p) => {
      const cid = (p.payload as { communityId?: number }).communityId;
      return cid != null && (cnt.get(cid) ?? 0) >= 2;
    });
  }
  const clusters = clusterMarkers(visibleInputs, scale);
  return clusters.map((c) => {
    if (c.count === 1) {
      const p = c.payload[0] as { listingId: number; name: string; totalPrice10k: number | null };
      return {
        id: c.id,
        latitude: c.latitude,
        longitude: c.longitude,
        width: 16,
        height: 16,
        iconPath: DEFAULT_MARKER_ICON,
        title: `${p.name} · ${p.totalPrice10k ?? "?"}万`,
        callout: {
          content: `${p.name}\n${p.totalPrice10k ?? "?"}万`,
          color: "#ffffff",
          bgColor: "#0ea5e9",
          padding: 4,
          borderRadius: 4,
          fontSize: 11,
          display: "BYCLICK"
        }
      };
    }
    // 聚合点：用大号圆形 + 数字 (uni-app 不支持自定义 canvas, 用宽高度 + label)
    const size = c.count >= 100 ? 44 : c.count >= 10 ? 38 : 32;
    return {
      id: c.id,
      latitude: c.latitude,
      longitude: c.longitude,
      width: size,
      height: size,
      iconPath: size >= 44 ? CLUSTER_MARKER_ICON_LARGE : CLUSTER_MARKER_ICON_SMALL,
      // 用 callout 模拟 cluster 气泡 (高德 H5 不支持自定义 marker DOM)
      callout: {
        content: `${c.count} 套`,
        color: "#ffffff",
        bgColor: "#ef4444",
        padding: 6,
        borderRadius: size / 2,
        fontSize: 13,
        display: "ALWAYS"
      }
    };
  });
});

// 热力图：uni-app map circles（fillColor 必须 8 位 hex；price 模式只画有均价社区）
const heatCircles = computed(() => {
  if (!app.cityId || !heatMode.value) return [];
  const cm = communityMarkers.value
    .filter((c) => c.cityId === app.cityId && filteredCommunityIds.value.has(c.communityId))
    .map((c) => {
      const count = filteredCityListings.value.filter((l) => l.communityId === c.communityId).length;
      return {
        lat: c.lat,
        lng: c.lng,
        listingCount: count || c.listingCount,
        avgUnitPrice: c.avgUnitPrice
      };
    });
  if (cm.length === 0) return [];
  if (mode.value === "price") return buildPriceHeatCircles(cm);
  return buildCountHeatCircles(cm);
});

const priceBuckets = computed(() => {
  if (!app.cityId) return [];
  const priced = communityMarkers.value
    .filter((c) => c.cityId === app.cityId)
    .map((c) => c.avgUnitPrice)
    .filter((p): p is number => p != null && p > 0);
  return buildPriceBuckets(priced);
});

const cityAvgPrice = computed<number | null>(() => {
  if (!app.cityId) return null;
  const cm = communityMarkers.value.filter(
    (c) => c.cityId === app.cityId && c.avgUnitPrice != null && c.avgUnitPrice > 0
  );
  if (cm.length === 0) return null;
  return cm.reduce((s, c) => s + (c.avgUnitPrice ?? 0), 0) / cm.length;
});

const pricedCommunityCount = computed<number>(() => {
  if (!app.cityId) return 0;
  return communityMarkers.value.filter(
    (c) => c.cityId === app.cityId && c.avgUnitPrice != null && c.avgUnitPrice > 0
  ).length;
});

function formatPriceRange(min: number, max: number): string {
  return formatPriceRangeK(min, max);
}

/** buildIntegrity：页面仍引用 priceColorRamp5 符号 */
const _priceRampKeep = priceColorRamp5;
void _priceRampKeep;

function onMarkerTap(e: any) {
  const detail = e?.detail ?? {};
  const markerId = detail.markerId ?? detail.id;
  if (markerId == null) return;
  // 热力模式小区气泡
  if (markerId >= COMMUNITY_MARKER_BASE && markerId < 9000000) {
    openCommunitySheet(markerId - COMMUNITY_MARKER_BASE);
    return;
  }
  // v0.15.0 metro line markers: 9000000 = start, 9100000 = end
  if (markerId >= 9000000 && markerId < 9200000) {
    const base = markerId >= 9100000 ? markerId - 9100000 : markerId - 9000000;
    selectedMetroLineId.value = base;
    selectedCommunityId.value = null;
    selectedPoi.value = null;
    findSheetOpen.value = false;
    return;
  }
  if (markerId < 0) {
    if (markerId <= -1000000) {
      const clusters = poiMarkers.value;
      const clusterHit = clusters.find((c) => c.id === markerId);
      if (clusterHit) {
        mapScale.value = Math.min(17, Math.round(mapScale.value) + 1);
        mapCenter.value = { lat: clusterHit.latitude, lng: clusterHit.longitude };
        showToast(`放大到 zoom ${mapScale.value}`);
        return;
      }
    }
    const clusters = listingClusterMarkers.value;
    const clusterHit = clusters.find((c) => c.id === markerId);
    if (clusterHit && typeof clusterHit.callout?.content === "string") {
      const m = clusterHit.callout.content.match(/^(\d+)\s*套$/);
      if (m && Number(m[1]) > 1) {
        // 聚合：先放大；同时若能解析社区则打开底栏
        mapScale.value = Math.min(17, Math.round(mapScale.value) + 1);
        mapCenter.value = { lat: clusterHit.latitude, lng: clusterHit.longitude };
        const near = nearestCommunityId(
          clusterHit.latitude,
          clusterHit.longitude,
          communityMarkers.value.filter((c) => c.cityId === app.cityId),
          2
        );
        if (near != null) openCommunitySheet(near);
        else showToast(`放大到 zoom ${mapScale.value} (聚合 ${m[1]} 套)`);
        return;
      }
    }
    const absId = -markerId;
    const cats: PoiCat[] = ["subway", "school", "hospital", "mall", "park"];
    for (const cat of cats) {
      const cc = catCode(cat);
      const candidates = getPoisByCity(app.cityId).filter((p) => p.poiCategory === cat);
      const match = candidates.find((p) => absId === p.communityId * 1000 + p.poiRank * 10 + cc);
      if (match) {
        selectedPoi.value = {
          poiName: match.poiName,
          poiCategory: match.poiCategory,
          poiType: match.poiType,
          distanceM: match.distanceM,
          address: match.address,
          communityId: match.communityId
        };
        findSheetOpen.value = false;
        return;
      }
    }
    return;
  }
  // 找房主路径：点单套房源 → 进详情（对照贝壳）
  const listing = getListingsByCity(app.cityId).find((l) => l.listingId === markerId);
  if (listing) {
    goListingDetail(listing.listingId);
    return;
  }
  showToast("无法识别该标注");
}

function toggleType() {
  if (mode.value === "listings") {
    mode.value = "count";
    showToast("挂牌数热力（点小区看盘）");
  } else if (mode.value === "count") {
    mode.value = "price";
    showToast("挂牌均价热力（非成交价）");
  } else if (mode.value === "price") {
    mode.value = "poi";
    selectedPoi.value = null;
    findSheetOpen.value = false;
    showToast("POI 模式");
  } else if (mode.value === "poi") {
    mode.value = "metro";
    selectedPoi.value = null;
    findSheetOpen.value = false;
    showToast("地铁规划模式");
  } else {
    mode.value = "listings";
    selectedMetroLineId.value = null;
    showToast("找房模式（点房源进详情）");
  }
}

function closePoiCard() {
  selectedPoi.value = null;
}

function zoomToCity(cityId: number) {
  app.setCityId(cityId);
  selectedPoi.value = null;
  findSheetOpen.value = false;
  selectedCommunityId.value = null;
  const city = getCities().find((c) => c.cityId === cityId);
  if (!city) return;
  const centers: Record<number, { lat: number; lng: number }> = {
    1: { lat: 23.129, lng: 113.264 },
    2: { lat: 22.543, lng: 114.06 },
    3: { lat: 22.271, lng: 113.576 }
  };
  const c = centers[cityId];
  if (c) {
    mapCenter.value = c;
    mapScale.value = 11;
  }
  loadCommunityMarkers();
}

function goCommunity() {
  if (selectedCommunityId.value == null) return;
  const url = `/pages/community/community?id=${selectedCommunityId.value}`;
  uni.navigateTo({ url, fail: (e: any) => showToast(`跳转失败: ${toErrorMessage(e)}`) });
}

// 加载 communities_geo 数据 → 内存中的 communityMarkers
async function loadCommunityMarkers() {
  errorMsg.value = "";
  try {
    const all: CommunityMarker[] = [];
    for (const cityId of [1, 2, 3]) {
      const communities = getCommunitiesByCity(cityId);
      const listings = getListingsByCity(cityId);
      // listings 按 communityId 聚合
      const agg = new Map<number, { count: number; sum: number }>();
      for (const l of listings) {
        if (!l.communityId || !l.unitPrice) continue;
        const cur = agg.get(l.communityId) ?? { count: 0, sum: 0 };
        cur.count += 1;
        cur.sum += l.unitPrice;
        agg.set(l.communityId, cur);
      }
      // 从 communities_geo 取 lat/lng — App-Plus WebView 没有 fetch, 必须走 store
      const geos = getCommunityGeoByCity(cityId);
      const geoMap = new Map(
        geos.map((g) => [
          g.communityId,
          {
            lat: g.lat,
            lng: g.lng,
            district: g.district ?? "",
            formattedAddress: ""
          }
        ])
      );
      for (const c of communities) {
        const geo = geoMap.get(c.communityId);
        if (!geo) continue;
        const a = agg.get(c.communityId);
        all.push({
          communityId: c.communityId,
          cityId,
          communityName: c.communityName,
          district: c.districtName ?? geo.district ?? "",
          lat: geo.lat,
          lng: geo.lng,
          formattedAddress: geo.formattedAddress,
          listingCount: a?.count ?? 0,
          avgUnitPrice: a && a.count > 0 ? a.sum / a.count : null
        });
      }
    }
    communityMarkers.value = all;
  } catch (e) {
    errorMsg.value = `加载失败：${toErrorMessage(e)}`;
  }
}

function _parseGeoCsvRemoved_v1_121_0() {
  // 占位删除: 历史 fetch('/static/seed/communities_geo.csv') 改走 store.getCommunityGeoByCity
}

onMounted(() => {
  uni.$on(SNAPSHOT_UPDATED_EVENT, loadCommunityMarkers);
  loadCommunityMarkers();
  // H5 E2E 钩子：模拟「点小区」打开找房底栏（地图 marker 非 DOM）
  if (typeof window !== "undefined") {
    (window as unknown as { __realtyMapFind?: Record<string, unknown> }).__realtyMapFind = {
      openCommunitySheet,
      closeFindSheet,
      goListingDetail
    };
  }
});

onUnmounted(() => {
  uni.$off(SNAPSHOT_UPDATED_EVENT, loadCommunityMarkers);
  if (typeof window !== "undefined") {
    delete (window as unknown as { __realtyMapFind?: unknown }).__realtyMapFind;
  }
});
</script>

<style scoped>
.page {
  padding: 16rpx;
}
.map-wrap {
  width: 100%;
  height: 80vh;
  border-radius: 12rpx;
  overflow: hidden;
  margin-top: 16rpx;
  /* 底图未出前的浅色占位：禁止透出页面深色底变成「黑乎乎」 */
  background: #e8eef5;
  border: 1rpx solid var(--color-border);
}
.map {
  width: 100%;
  height: 100%;
  background: #e8eef5;
}
.row-gap {
  display: flex;
  gap: 12rpx;
}
.btn {
  background: var(--color-accent) !important;
  color: var(--color-accent-text) !important;
  font-size: 24rpx;
  padding: 4rpx 16rpx;
  border-radius: 4rpx;
}
.legend {
  margin-top: 8rpx;
  font-size: 22rpx;
}
.legend-card {
  margin-top: 12rpx;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 4rpx 0;
}
.legend-swatch {
  width: 28rpx;
  height: 28rpx;
  border-radius: 4rpx;
  border: 1rpx solid var(--color-border);
}
.legend-text {
  flex: 1;
  font-size: 24rpx;
  color: var(--color-text);
}
.legend-range {
  font-size: 22rpx;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}
.legend-summary {
  margin-top: 8rpx;
  padding-top: 8rpx;
  border-top: 1rpx dashed var(--color-border);
}
.info-card {
  position: fixed;
  left: 16rpx;
  right: 16rpx;
  bottom: calc(24rpx + var(--window-bottom, 0px) + var(--safe-area-bottom, 0px));
  background: var(--color-surface);
  border: 1rpx solid var(--color-border);
  border-radius: 12rpx;
  padding: 16rpx;
  z-index: 100;
  box-shadow: var(--shadow-card);
}
.info-name {
  color: var(--color-heading);
  font-size: 30rpx;
  font-weight: 600;
}
.info-close {
  color: var(--color-muted);
  font-size: 32rpx;
  padding: 0 8rpx;
}
.info-line {
  display: block;
  color: var(--color-muted);
  font-size: 22rpx;
  margin-top: 4rpx;
}
.info-row {
  display: flex;
  gap: 24rpx;
  margin: 12rpx 0;
}
.info-stat {
  display: flex;
  flex-direction: column;
}
.info-stat-label {
  color: var(--color-muted);
  font-size: 22rpx;
}
.info-stat-value {
  color: var(--color-heading);
  font-size: 30rpx;
  font-weight: 600;
}
.price-tag {
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  font-size: 24rpx !important;
  font-weight: 500 !important;
}
.price-low {
  background: rgba(34, 197, 94, 0.25);
  color: #4ade80 !important;
}
.price-mid_low {
  background: rgba(132, 204, 22, 0.25);
  color: #a3e635 !important;
}
.price-mid {
  background: rgba(234, 179, 8, 0.25);
  color: #fbbf24 !important;
}
.price-mid_high {
  background: rgba(249, 115, 22, 0.25);
  color: #fb923c !important;
}
.price-high {
  background: rgba(220, 38, 38, 0.3);
  color: #fca5a5 !important;
}
/* v1.119.0 弯曲系数 Top 5 卡 */
.curvature-card {
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  background: var(--color-panel);
  border: 1rpx solid var(--color-soft);
  border-radius: 14rpx;
}
.curvature-title {
  font-size: 28rpx;
  color: var(--color-heading);
  font-weight: 600;
}
.curvature-desc {
  font-size: 22rpx;
  margin: 10rpx 0 14rpx;
  line-height: 1.5;
}
.curvature-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid var(--color-soft-strong);
}
.curvature-row:last-child {
  border-bottom: none;
}
.curvature-rank {
  width: 40rpx;
  height: 40rpx;
  border-radius: 20rpx;
  background: #38bdf8;
  color: var(--color-heading);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 24rpx;
  flex-shrink: 0;
}
.curvature-meta {
  flex: 1;
  min-width: 0;
}
.curvature-name {
  font-size: 26rpx;
  color: var(--color-heading);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.curvature-sub {
  font-size: 22rpx;
  margin-top: 4rpx;
  font-variant-numeric: tabular-nums;
}
.curvature-ratio {
  font-size: 30rpx;
  color: #facc15;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* v0.13.0 POI toggles */
.poi-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 8rpx;
}
.poi-toggle {
  padding: 4rpx 14rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
  border: 1rpx solid transparent;
  cursor: pointer;
}
.poi-toggle-on {
  background: var(--color-info-soft);
  border-color: #0ea5e9;
  color: var(--color-heading);
}
.poi-toggle-off {
  background: var(--color-soft);
  border-color: var(--color-border);
  color: var(--color-muted);
}

.map-control-card {
  padding: 26rpx;
  border-radius: 22rpx;
}

.control-eyebrow {
  color: #0ea5e9;
  font-size: 19rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
}

.map-summary {
  padding: 7rpx 14rpx;
  border-radius: 999rpx;
  background: var(--color-surface-raised);
  color: var(--color-text-secondary, var(--color-muted));
  font-size: 20rpx;
}

.control-section {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 20rpx;
}

.control-label {
  flex: 0 0 auto;
  color: var(--color-muted);
  font-size: 21rpx;
  font-weight: 650;
}

.layer-label {
  margin-top: 18rpx;
}

.city-segment {
  display: inline-flex;
  padding: 5rpx;
  border: 1rpx solid var(--color-border);
  border-radius: 14rpx;
  background: var(--color-surface-raised);
}

.city-option {
  min-width: 96rpx;
  margin: 0;
  padding: 6rpx 18rpx;
  background: transparent;
}

.city-option--active {
  background: var(--color-primary);
  color: var(--color-primary-text, #052e16);
}

.map-mode-scroll {
  width: 100%;
  white-space: nowrap;
}

.map-mode-list {
  display: inline-flex;
  gap: 8rpx;
  padding: 8rpx 0;
}

.map-mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: var(--color-surface-raised);
  color: var(--color-text);
  border: 1rpx solid var(--color-border);
  line-height: 1.2;
}

.map-mode-btn--active {
  border-color: var(--color-primary);
  color: var(--color-primary-contrast);
}

.map-filter-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: var(--color-soft) !important;
  color: var(--color-text) !important;
  border: 1rpx solid var(--color-border) !important;
  font-size: 22rpx;
  line-height: 1.2;
}
.map-filter-btn--active {
  background: var(--color-primary) !important;
  color: var(--color-primary-text) !important;
  border-color: var(--color-primary-strong) !important;
}

.find-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--window-bottom, 0px) + var(--safe-area-bottom, 0px));
  z-index: 120;
  max-height: 46vh;
  background: var(--color-surface);
  border-top: 1rpx solid var(--color-border);
  border-radius: 24rpx 24rpx 0 0;
  box-shadow: 0 -8rpx 28rpx rgba(15, 23, 42, 0.12);
  padding: 16rpx 20rpx calc(16rpx + var(--safe-area-bottom, 0px));
  display: flex;
  flex-direction: column;
}
.find-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.find-sheet-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.find-sheet-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--color-heading);
}
.find-sheet-sub {
  font-size: 22rpx;
}
.find-sheet-list {
  flex: 1;
  max-height: 28vh;
}
.find-listing-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 4rpx;
  border-bottom: 1rpx solid var(--color-border);
}
.find-listing-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.find-listing-title {
  font-size: 26rpx;
  color: var(--color-heading);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.find-listing-meta {
  font-size: 22rpx;
}
.find-listing-go {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 600;
  flex-shrink: 0;
}
.find-empty {
  padding: 32rpx 8rpx;
  text-align: center;
  font-size: 24rpx;
}
.find-sheet-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
}
.find-sheet-btn {
  flex: 1;
}

.mode-summary-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 12rpx;
  font-size: 22rpx;
}

.map-status {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.72);
  z-index: 2;
}

.map-status-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 24rpx;
  text-align: center;
}

.map-status-content--slow {
  flex-direction: row;
  text-align: left;
}

.map-retry-btn {
  margin-left: 12rpx;
}

.map-wrap {
  position: relative;
}
</style>

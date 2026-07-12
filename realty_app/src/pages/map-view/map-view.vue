<template>
  <view class="page">
    <view class="card">
      <view class="row-between">
        <view class="card-title" style="margin-bottom: 0">地图找房</view>
        <view class="muted" style="font-size: 22rpx">
          {{ citiesReady ? `${totalMarkers} 个小区 · ${totalListings} 套挂牌` : "加载中…" }}
        </view>
      </view>
      <view class="row-gap" style="margin-top: 12rpx">
        <button class="btn" size="mini" @click="zoomToCity(2)">深圳</button>
        <button class="btn" size="mini" @click="zoomToCity(1)">广州</button>
        <button class="btn" size="mini" @click="zoomToCity(3)">珠海</button>
        <button class="btn" size="mini" @click="toggleType">
          {{ modeLabel }}
        </button>
      </view>
      <view class="muted legend">
        <text v-if="mode === 'price'">
          成交价热力 (v0.21.0)：5 档价格分位 (P0/P20/P40/P60/P80) + 半径按价格×挂牌数综合 (大=贵+多)；图例卡片见下方
        </text>
        <text v-else-if="mode === 'count'">
          挂牌数热力：圆点 = 挂牌数 (颜色: 红=多 / 蓝=少)
        </text>
        <text v-else-if="mode === 'listings'">
          挂牌点 (v0.18.0 聚合)：每点 = 该小区 1 套挂牌 (单点)；多套聚合显示数字 (红气泡)，点击放大；点击单点 → 小区详情
        </text>
        <text v-else-if="mode === 'poi'">
          POI overlay (v0.22.0 聚合)：5 类配套图标 (🚇地铁 / 🏫学校 / 🏥医院 / 🛍商场 / 🌳公园)，同类按 grid 聚合；单点=该 POI，聚合=带数字气泡，点击聚合放大
        </text>
        <text v-else>
          地铁规划：21 条规划/在建线路（绿=即将开通 / 橙=在建 / 灰=规划）；按 status 着色
        </text>
      </view>

      <!-- v0.13.0 POI 模式下显示 5 类 toggle -->
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
        class="map"
        :latitude="mapCenter.lat"
        :longitude="mapCenter.lng"
        :scale="mapScale"
        :markers="mode === 'listings' ? listingClusterMarkers : (mode === 'poi' ? poiMarkers : (mode === 'metro' ? metroLineMarkers : []))"
        :circles="(mode === 'listings' || mode === 'poi' || mode === 'metro') ? [] : heatCircles"
        :polyline="mode === 'metro' ? metroPolylines : []"
        :show-location="true"
        :enable-zoom="true"
        :enable-scroll="true"
        @markertap="onMarkerTap"
      ></map>
    </view>

    <!-- v0.21.0 map-7: 价格热力 5 档分位 legend -->
    <view v-if="mode === 'price' && priceBuckets.length > 0" class="card legend-card">
      <view class="card-title" style="margin-bottom: 4rpx">🎨 价格分位图例</view>
      <view class="muted" style="font-size: 22rpx; margin-bottom: 8rpx">
        颜色 = 5 档价格分位 (绿便宜 → 红贵)；半径 = 价格×挂牌数 (大=贵+多)
      </view>
      <view class="legend-row" v-for="b in priceBuckets" :key="b.label">
        <view class="legend-swatch" :style="{ background: b.color }"></view>
        <text class="legend-text">{{ b.label }}</text>
        <text class="legend-range">{{ formatPriceRange(b.min, b.max) }} 元/㎡</text>
      </view>
      <view class="legend-summary">
        <text class="muted">
          城市均价 {{ cityAvgPrice ? Math.round(cityAvgPrice).toLocaleString() : "—" }} 元/㎡
          · 已覆盖 {{ pricedCommunityCount }} 个有挂牌均价的社区
        </text>
      </view>
    </view>

    <!-- v0.13.0 POI info card -->
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
    </view>

    <!-- 选中 marker 浮层 -->
    <view v-if="selectedCommunity" class="info-card">
      <view class="row-between">
        <text class="info-name">{{ selectedCommunity.communityName }}</text>
        <text class="info-close" @click="selectedCommunity = null">✕</text>
      </view>
      <text class="info-line">
        {{ selectedCommunity.district || "" }} · {{ formatCoord(selectedCommunity.lat, selectedCommunity.lng) }}
      </text>
      <view class="info-row">
        <view class="info-stat">
          <text class="info-stat-label">挂牌</text>
          <text class="info-stat-value">{{ selectedCommunity.listingCount }}</text>
        </view>
        <view class="info-stat">
          <text class="info-stat-label">均价</text>
          <text class="info-stat-value">
            {{ selectedCommunity.avgUnitPrice
              ? Math.round(selectedCommunity.avgUnitPrice).toLocaleString()
              : "—" }} 元/㎡
          </text>
        </view>
        <view v-if="selectedCommunity.priceLevel" class="info-stat">
          <text class="info-stat-label">价位</text>
          <text :class="['info-stat-value', 'price-tag', priceLevelClass]">
            {{ priceLevelText }}
          </text>
        </view>
      </view>
      <button class="btn" size="mini" @click="goCommunity">查看小区详情 →</button>
    </view>

    <!-- v0.15.0 Metro line info card -->
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
import { computed, ref } from "vue";
import { onMounted } from "vue";
import { useAppStore } from "../../store/app";
import {
  getCommunitiesByCity,
  getListingsByCity,
  getCommunityById,
  getPoisByCity,
  getMetroLineGeosByCity,
  getMetroLinesByCity
} from "../../local/store";
import { getCities, getPoisByCommunity } from "../../local/store";
import { toErrorMessage } from "../../utils/errorMessage";
import { showToast } from "../../utils/format";
import { clusterMarkers, type ClusterInputPoint, type ClusterOutputPoint } from "../../local/cluster";

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
/** v0.12.0 三种模式: count=挂牌数热力, price=成交价热力, listings=挂牌点
 *  v0.13.0 加 poi 模式: 5 类 POI marker overlay
 *  v0.15.0 加 metro 模式: 地铁规划线 polyline overlay
 */
type MapMode = "count" | "price" | "listings" | "poi" | "metro";
type PoiCat = "subway" | "school" | "hospital" | "mall" | "park";
const mode = ref<MapMode>("count");
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
  if (mode.value === "count") return "切到成交价热力";
  if (mode.value === "price") return "切到挂牌点";
  if (mode.value === "listings") return "切到 POI";
  if (mode.value === "poi") return "切到地铁规划";
  return "切到挂牌数热力";
});

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
      width: 14,
      height: 14,
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
      width: 14,
      height: 14,
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
  const listings = getListingsByCity(app.cityId);
  // 按 community 索引 lat/lng
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
  // 上限 600 (城市级一次性渲染过多 marker 会卡)
  for (let i = 0; i < listings.length && i < 600; i++) {
    const l = listings[i];
    const geo = cidToGeo.get(l.communityId);
    if (!geo) continue;
    out.push({
      id: l.listingId,
      latitude: geo.lat,
      longitude: geo.lng,
      payload: { listingId: l.listingId, communityId: l.communityId, name: geo.name, totalPrice10k: l.totalPrice10k }
    });
  }
  return out;
});

const listingClusterMarkers = computed<any[]>(() => {
  const clusters = clusterMarkers(listingMarkerInputs.value, Math.round(mapScale.value));
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

// 热力图：用 uni-app map 的 circles 模拟 (无独立热力图层)
// v0.12.0 支持两种热力：挂牌数(count) 或 成交价(price)
// v0.21.0 map-7: 价格热力升级
// - 5 档分位 (P20/P40/P60/P80/P100) → 颜色 (绿/黄绿/黄/橙/红)
// - 半径按 价格分位 + 挂牌数 综合 (贵=大+多=大)
// - legend 卡片显示 5 档价格区间 + 城市均价
const heatCircles = computed(() => {
  if (!app.cityId || mode.value === "listings") return [];
  const cm = communityMarkers.value.filter((c) => c.cityId === app.cityId);
  if (cm.length === 0) return [];
  const maxCount = Math.max(1, ...cm.map((c) => c.listingCount));
  // 价格模式: 仅对有均价的社区画 + 计算价格的 min/max
  const priced = cm.filter((c) => c.avgUnitPrice != null && c.avgUnitPrice > 0);
  const minPrice = priced.length > 0 ? Math.min(...priced.map((c) => c.avgUnitPrice!)) : 0;
  const maxPrice = priced.length > 0 ? Math.max(...priced.map((c) => c.avgUnitPrice!)) : 0;
  return cm.map((c) => {
    let fillColor: string;
    let radius: number;
    if (mode.value === "price") {
      // v0.21.0: 颜色按价格分位 (5 档)
      if (c.avgUnitPrice == null || c.avgUnitPrice <= 0 || maxPrice <= minPrice) {
        fillColor = "#94a3b8"; // 没数据/单一价: 灰
      } else {
        const tPrice = (c.avgUnitPrice - minPrice) / (maxPrice - minPrice); // 0..1
        fillColor = priceColorRamp5(tPrice);
      }
      // v0.21.0: 半径按 价格分位 + 挂牌数 综合
      const tPrice = maxPrice > minPrice ? (c.avgUnitPrice ?? minPrice - 1) - minPrice / (maxPrice - minPrice) : 0;
      const tCount = c.listingCount / maxCount;
      // 价格 30% + 挂牌 70% → 200m (便宜小区少挂牌) → 1000m (贵小区多挂牌)
      const combined = 0.3 * Math.max(0, tPrice) + 0.7 * tCount;
      radius = 200 + Math.round(combined * 800);
    } else {
      // count 模式: 蓝 → 红 (数量)
      const tCount = c.listingCount / maxCount;
      fillColor = colorRamp(tCount);
      radius = 200 + Math.round(tCount * 800); // 200-1000m
    }
    return {
      longitude: c.lng,
      latitude: c.lat,
      color: "#ffffff",
      fillColor,
      radius,
      strokeWidth: 1
    };
  });
});

// v0.21.0 map-7: 价格分位区间 (legend)
interface PriceBucket {
  label: string;
  color: string;
  min: number;
  max: number;
}

const priceBuckets = computed<PriceBucket[]>(() => {
  if (!app.cityId) return [];
  const cm = communityMarkers.value.filter((c) => c.cityId === app.cityId);
  const priced = cm
    .map((c) => c.avgUnitPrice)
    .filter((p): p is number => p != null && p > 0)
    .sort((a, b) => a - b);
  if (priced.length === 0) return [];
  const p = (q: number): number => priced[Math.min(priced.length - 1, Math.floor(priced.length * q))];
  const minPrice = priced[0];
  const maxPrice = priced[priced.length - 1];
  return [
    { label: "P0-P20 最便宜", color: "#22c55e", min: minPrice, max: p(0.2) },
    { label: "P20-P40", color: "#a3e635", min: p(0.2), max: p(0.4) },
    { label: "P40-P60 中位", color: "#fbbf24", min: p(0.4), max: p(0.6) },
    { label: "P60-P80", color: "#f97316", min: p(0.6), max: p(0.8) },
    { label: "P80-P100 最贵", color: "#dc2626", min: p(0.8), max: maxPrice }
  ];
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

function priceColorRamp5(t: number): string {
  // 5 档离散: 绿 → 黄绿 → 黄 → 橙 → 红
  const stops = [
    { t: 0.0, color: [34, 197, 94] },   // 绿
    { t: 0.25, color: [163, 230, 53] }, // 黄绿
    { t: 0.5, color: [251, 191, 36] },  // 黄
    { t: 0.75, color: [249, 115, 22] }, // 橙
    { t: 1.0, color: [220, 38, 38] }    // 红
  ];
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const k = (clamped - a.t) / (b.t - a.t);
      const r = Math.round(a.color[0] + k * (b.color[0] - a.color[0]));
      const g = Math.round(a.color[1] + k * (b.color[1] - a.color[1]));
      const bl = Math.round(a.color[2] + k * (b.color[2] - a.color[2]));
      return `rgb(${r},${g},${bl})`;
    }
  }
  return `rgb(${stops[stops.length - 1].color.join(",")})`;
}

function formatPriceRange(min: number, max: number): string {
  const round = (n: number) => Math.round(n / 1000) * 1000;
  return `${round(min / 1000)}k-${round(max / 1000)}k`;
}

function colorRamp(t: number): string {
  // t=0 (蓝) → t=1 (红)
  const r = Math.round(30 + t * 220);
  const g = Math.round(120 - t * 100);
  const b = Math.round(200 - t * 180);
  return `rgb(${r},${g},${b})`;
}

function onMarkerTap(e: any) {
  const detail = e?.detail ?? {};
  const markerId = detail.markerId ?? detail.id;
  if (markerId == null) return;
  // v0.15.0 metro line markers: 9000000 = start, 9100000 = end
  if (markerId >= 9000000 && markerId < 9200000) {
    const base = markerId >= 9100000 ? markerId - 9100000 : markerId - 9000000;
    selectedMetroLineId.value = base;
    selectedCommunityId.value = null;
    selectedPoi.value = null;
    return;
  }
  if (markerId < 0) {
    // v0.22.0 POI cluster markers: syntheticIdBase = -1000000
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
    // v0.18.0 listing cluster markers: 负 id + count > 1 → zoom in +1
    // 优先判断 cluster marker (callout 是 "N 套" 格式)
    const clusters = listingClusterMarkers.value;
    const clusterHit = clusters.find((c) => c.id === markerId);
    if (clusterHit && typeof clusterHit.callout?.content === "string") {
      const m = clusterHit.callout.content.match(/^(\d+)\s*套$/);
      if (m && Number(m[1]) > 1) {
        mapScale.value = Math.min(17, Math.round(mapScale.value) + 1);
        mapCenter.value = { lat: clusterHit.latitude, lng: clusterHit.longitude };
        showToast(`放大到 zoom ${mapScale.value} (聚合 ${m[1]} 套)`);
        return;
      }
    }
    // 否则走 POI 流程
    const absId = -markerId;
    const cats: PoiCat[] = ["subway", "school", "hospital", "mall", "park"];
    for (const cat of cats) {
      const cc = catCode(cat);
      const candidates = getPoisByCity(app.cityId).filter(
        (p) => p.poiCategory === cat
      );
      const match = candidates.find(
        (p) => absId === p.communityId * 1000 + p.poiRank * 10 + cc
      );
      if (match) {
        selectedPoi.value = {
          poiName: match.poiName,
          poiCategory: match.poiCategory,
          poiType: match.poiType,
          distanceM: match.distanceM,
          address: match.address,
          communityId: match.communityId
        };
        selectedCommunityId.value = match.communityId;
        return;
      }
    }
    return;
  }
  // listingMarkers 用 listingId 作 id, 需要找到其 communityId
  const listing = getListingsByCity(app.cityId).find((l) => l.listingId === markerId);
  if (listing) {
    selectedCommunityId.value = listing.communityId;
    return;
  }
  // 兜底：communityMarkers 用 communityId
  selectedCommunityId.value = markerId;
}

function toggleType() {
  // count → price → listings → poi → metro → count
  if (mode.value === "count") {
    mode.value = "price";
    showToast("成交价热力（绿=便宜/红=贵）");
  } else if (mode.value === "price") {
    mode.value = "listings";
    showToast("挂牌点模式");
  } else if (mode.value === "listings") {
    mode.value = "poi";
    selectedPoi.value = null;
    selectedMetroLineId.value = null;
    showToast("POI 模式（5 类配套图标）");
  } else if (mode.value === "poi") {
    mode.value = "metro";
    selectedPoi.value = null;
    showToast("地铁规划模式（21 条线路）");
  } else {
    mode.value = "count";
    selectedMetroLineId.value = null;
    showToast("挂牌数热力（红=多/蓝=少）");
  }
}

function closePoiCard() {
  selectedPoi.value = null;
}

function zoomToCity(cityId: number) {
  app.setCityId(cityId);
  selectedPoi.value = null;
  const city = getCities().find((c) => c.cityId === cityId);
  if (!city) return;
  // 用城市中心点 (硬编码)
  const centers: Record<number, { lat: number; lng: number }> = {
    1: { lat: 23.129, lng: 113.264 }, // 广州
    2: { lat: 22.543, lng: 114.06 }, // 深圳
    3: { lat: 22.271, lng: 113.576 } // 珠海
  };
  const c = centers[cityId];
  if (c) {
    mapCenter.value = c;
    mapScale.value = 11;
  }
  // 重新加载该城市的 markers
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
      // 从 communities_geo 取 lat/lng (通过 store.getCommunityById 不带 lat/lng, 需另读)
      // 这里直接读 raw csv via fetch
      const csvText = await fetch("/static/seed/communities_geo.csv").then((r) =>
        r.ok ? r.text() : ""
      );
      const geoMap = parseGeoCsv(csvText);
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

function parseGeoCsv(text: string): Map<number, { lat: number; lng: number; district: string; formattedAddress: string }> {
  const m = new Map<number, { lat: number; lng: number; district: string; formattedAddress: string }>();
  if (!text) return m;
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return m;
  const header = lines[0].split(",");
  const idx = (k: string) => header.indexOf(k);
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 3) continue;
    const cid = Number(cols[idx("community_id")]);
    const lat = Number(cols[idx("lat")]);
    const lng = Number(cols[idx("lng")]);
    if (!cid || Number.isNaN(lat) || Number.isNaN(lng)) continue;
    m.set(cid, {
      lat,
      lng,
      district: cols[idx("district")] ?? "",
      formattedAddress: cols[idx("formatted_address")] ?? ""
    });
  }
  return m;
}

onMounted(() => {
  loadCommunityMarkers();
});
</script>

<style scoped>
.page {
  padding: 16rpx;
}
.map-wrap {
  width: 100%;
  height: 80vh;
  border-radius: 8rpx;
  overflow: hidden;
  margin-top: 16rpx;
}
.map {
  width: 100%;
  height: 100%;
}
.row-gap {
  display: flex;
  gap: 12rpx;
}
.btn {
  background: #0ea5e9;
  color: #ffffff;
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
  border: 1rpx solid #ffffff20;
}
.legend-text {
  flex: 1;
  font-size: 24rpx;
  color: #cbd5e1;
}
.legend-range {
  font-size: 22rpx;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}
.legend-summary {
  margin-top: 8rpx;
  padding-top: 8rpx;
  border-top: 1rpx dashed #ffffff20;
}
.info-card {
  position: fixed;
  left: 16rpx;
  right: 16rpx;
  bottom: 24rpx;
  background: rgba(15, 23, 42, 0.95);
  border: 1rpx solid #334155;
  border-radius: 12rpx;
  padding: 16rpx;
  z-index: 100;
}
.info-name {
  color: #f3f4f6;
  font-size: 30rpx;
  font-weight: 600;
}
.info-close {
  color: #94a3b8;
  font-size: 32rpx;
  padding: 0 8rpx;
}
.info-line {
  display: block;
  color: #cbd5e1;
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
  color: #94a3b8;
  font-size: 22rpx;
}
.info-stat-value {
  color: #f3f4f6;
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
  background: rgba(14, 165, 233, 0.2);
  border-color: #0ea5e9;
  color: #f0f9ff;
}
.poi-toggle-off {
  background: rgba(148, 163, 184, 0.1);
  border-color: #475569;
  color: #94a3b8;
}
</style>
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
          成交价热力：圆点颜色 = 挂牌均价 (绿=便宜 → 红=贵)，半径 = 挂牌数
        </text>
        <text v-else-if="mode === 'count'">
          挂牌数热力：圆点 = 挂牌数 (颜色: 红=多 / 蓝=少)
        </text>
        <text v-else-if="mode === 'listings'">
          挂牌点：每点 = 该小区 1 套挂牌；点击 → 小区详情
        </text>
        <text v-else-if="mode === 'poi'">
          POI overlay：5 类配套图标 (🚇地铁 / 🏫学校 / 🏥医院 / 🛍商场 / 🌳公园)
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
        :markers="mode === 'listings' ? listingMarkers : (mode === 'poi' ? poiMarkers : (mode === 'metro' ? metroLineMarkers : []))"
        :circles="(mode === 'listings' || mode === 'poi' || mode === 'metro') ? [] : heatCircles"
        :polyline="mode === 'metro' ? metroPolylines : []"
        :show-location="true"
        :enable-zoom="true"
        :enable-scroll="true"
        @markertap="onMarkerTap"
      ></map>
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
const poiMarkers = computed(() => {
  if (!app.cityId || mode.value !== "poi") return [];
  const all = getPoisByCity(app.cityId);
  const filtered = all.filter((p) => poiFilter.value.has(p.poiCategory));
  // 每个 POI 类取最近 N 个，避免 marker 太多（每类 20 上限）
  const byCat = new Map<PoiCat, typeof filtered>();
  for (const cat of poiFilter.value) byCat.set(cat, []);
  for (const p of filtered) {
    const arr = byCat.get(p.poiCategory) ?? [];
    if (arr.length < 25) arr.push(p);
    byCat.set(p.poiCategory, arr);
  }
  const out: any[] = [];
  for (const [cat, list] of byCat.entries()) {
    for (const p of list) {
      const color = poiColor(cat);
      out.push({
        id: -1 * (p.communityId * 1000 + p.poiRank * 10 + catCode(cat)),
        latitude: p.lat,
        longitude: p.lng,
        width: 24,
        height: 24,
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
    }
  }
  return out;
});

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

// listings 模式下：每个 listing 一个 marker (限 200 / 城市避免卡)
const listingMarkers = computed(() => {
  if (!app.cityId) return [];
  const listings = getListingsByCity(app.cityId);
  const out: any[] = [];
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
  for (let i = 0; i < listings.length && i < 200; i++) {
    const l = listings[i];
    const geo = cidToGeo.get(l.communityId);
    if (!geo) continue;
    out.push({
      id: l.listingId,
      latitude: geo.lat,
      longitude: geo.lng,
      width: 16,
      height: 16,
      // callout 用：marker 点击时显示
      title: `${geo.name} · ${l.totalPrice10k ?? "?"}万`,
      // H5 用 callout (气泡)
      callout: {
        content: `${geo.name}\n${l.totalPrice10k ?? "?"}万`,
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

// 热力图：用 uni-app map 的 circles 模拟 (无独立热力图层)
// v0.12.0 支持两种热力：挂牌数(count) 或 成交价(price)
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
    const tCount = c.listingCount / maxCount; // 0..1
    const radius = 200 + Math.round(tCount * 800); // 200-1000m
    let fillColor: string;
    if (mode.value === "price") {
      // 价格: 绿 (便宜) → 黄 → 红 (贵)
      if (c.avgUnitPrice == null || c.avgUnitPrice <= 0 || maxPrice <= minPrice) {
        fillColor = "#94a3b8"; // 没数据/单一价: 灰
      } else {
        const tPrice = (c.avgUnitPrice - minPrice) / (maxPrice - minPrice); // 0..1
        fillColor = priceColorRamp(tPrice);
      }
    } else {
      // count: 蓝 → 红 (数量)
      fillColor = colorRamp(tCount);
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

function priceColorRamp(t: number): string {
  // t=0 绿 (便宜) → t=0.5 黄 → t=1 红 (贵)
  let r: number, g: number, b: number;
  if (t < 0.5) {
    // 绿 (#22c55e = 34,199,94) → 黄 (#fbbf24 = 251,191,36)
    const k = t / 0.5;
    r = Math.round(34 + k * (251 - 34));
    g = Math.round(199 + k * (191 - 199));
    b = Math.round(94 + k * (36 - 94));
  } else {
    // 黄 → 红 (#dc2626 = 220,38,38)
    const k = (t - 0.5) / 0.5;
    r = Math.round(251 + k * (220 - 251));
    g = Math.round(191 + k * (38 - 191));
    b = Math.round(36 + k * (38 - 36));
  }
  return `rgb(${r},${g},${b})`;
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
    // POI marker: 反解 id → communityId + poiRank + category
    const absId = -markerId;
    const cats: PoiCat[] = ["subway", "school", "hospital", "mall", "park"];
    for (const cat of cats) {
      const cc = catCode(cat);
      // 找包含该 (communityId, poiRank, cc) 的 POI
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
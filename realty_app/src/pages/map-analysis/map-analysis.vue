<template>
  <view class="page">
    <view class="header">
      <view class="title">🗺️ 行政区 + 社区 marker 地图</view>
      <view class="muted">
        {{ districtMap?.cityName ?? "—" }} · 5 种模式聚合 + 行政区 polygon + 社区 marker
      </view>
      <view class="muted" style="margin-top: 4rpx; font-size: 22rpx">
        v1.121.153 Batch 14 · marker / count / price / school / metro 模式
      </view>
    </view>

    <!-- 模式切换 -->
    <view class="card">
      <view class="row-between">
        <view class="card-title">模式切换</view>
        <view class="muted">{{ districtMap?.districts.length ?? 0 }} 区 · {{ districtMap?.markers.length ?? 0 }} 社区</view>
      </view>
      <view class="map-mode-tabs">
        <view
          v-for="m in MAP_MODES"
          :key="m.key"
          :class="['map-mode-tab', { 'map-mode-tab--active': mapMode === m.key }]"
          @click="mapMode = m.key"
        >
          <text class="map-mode-icon">{{ m.icon }}</text>
          <text class="map-mode-label">{{ m.label }}</text>
        </view>
      </view>
      <view v-if="mapMode !== 'marker'" class="map-legend">
        <text class="map-legend-title">{{ mapModeTitle }}:</text>
        <view class="map-legend-bar" :style="{ background: mapModeGradient }"></view>
        <text class="map-legend-min">{{ mapModeMin }}</text>
        <text class="map-legend-max">{{ mapModeMax }}</text>
      </view>
    </view>

    <!-- 大图 -->
    <view v-if="districtMap && districtMap.districts.length > 0" class="card map-card-full">
      <svg
        :viewBox="`0 0 ${MAP_W} ${MAP_H}`"
        class="map-svg-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <g class="map-districts">
          <path
            v-for="d in districtMap.districts"
            :key="'d_' + d.districtCode"
            :d="districtAllPath(d.polygons, districtMap.bbox.minLng, districtMap.bbox.maxLng, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
            :class="['map-district-p', { 'map-district-p--mode': mapMode !== 'marker' }]"
            :data-name="d.districtName"
            :fill="districtFill(d.districtName)"
            fill-rule="evenodd"
          />
          <text
            v-for="d in districtMap.districts"
            :key="'lbl_' + d.districtCode"
            :x="mapX(d.centerLng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
            :y="mapY(d.centerLat, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
            text-anchor="middle"
            dominant-baseline="middle"
            class="map-district-lbl"
          >{{ d.districtName }}</text>
        </g>
        <g v-if="mapMode === 'marker' && districtMap.markers.length <= 30">
          <g
            v-for="m in districtMap.markers"
            :key="'m_' + m.communityId"
            class="map-marker-g tap-row"
            @click="goCommunity(m.communityId)"
          >
            <circle
              :cx="mapX(m.lng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
              :cy="mapY(m.lat, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
              r="6"
              class="map-marker"
            />
            <text
              :x="mapX(m.lng, districtMap.bbox.minLng, districtMap.bbox.maxLng) + 8"
              :y="mapY(m.lat, districtMap.bbox.minLat, districtMap.bbox.maxLat) + 4"
              class="map-marker-lbl"
            >{{ m.communityName }}</text>
          </g>
        </g>
        <g v-else-if="mapMode === 'marker'">
          <circle
            v-for="m in districtMap.markers"
            :key="'mb_' + m.communityId"
            :cx="mapX(m.lng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
            :cy="mapY(m.lat, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
            r="3"
            class="map-marker-bare tap-row"
            :data-community-id="m.communityId"
            :data-name="m.communityName"
            @click="goCommunity(m.communityId)"
          ><title>{{ m.communityName }}</title></circle>
        </g>
        <g v-else>
          <text
            v-for="d in districtMap.districts"
            :key="'v_' + d.districtCode"
            :x="mapX(d.centerLng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
            :y="mapY(d.centerLat, districtMap.bbox.minLat, districtMap.bbox.maxLat) + 22"
            text-anchor="middle"
            dominant-baseline="middle"
            class="map-district-val"
          >{{ districtStatLabel(d.districtName) }}</text>
        </g>
      </svg>
    </view>

    <!-- 行政区数据明细列表 -->
    <view v-if="districtMap && districtMap.districts.length > 0" class="card">
      <view class="card-title">📋 区级数据明细</view>
      <view
        v-for="d in districtMap.districts"
        :key="d.districtCode"
        class="map-district-row"
      >
        <view class="map-district-name">{{ d.districtName }}</view>
        <view class="map-district-vals">
          <text class="map-stat">count: {{ mapStatVal(d.districtName, "count") }}</text>
          <text class="map-stat">price: {{ mapStatVal(d.districtName, "avgPrice") }}</text>
          <text class="map-stat">school: {{ mapStatVal(d.districtName, "avgSchool") }}</text>
          <text class="map-stat">metro: {{ mapStatVal(d.districtName, "avgMetroMin") }}</text>
        </view>
      </view>
    </view>

    <view v-if="!districtMap && !mapLoading" class="card">
      <view class="empty">暂无数据</view>
    </view>
    <view v-if="mapLoading" class="card">
      <view class="muted">正在加载地图数据…</view>
    </view>
    <view v-if="mapError" class="card">
      <view class="empty">加载失败：{{ mapError }}</view>
    </view>

    <view class="footer">
      <button class="back-btn" size="mini" hover-class="tap-row--active" @click.stop="goBack">← 返回首页</button>
      <button class="reload-btn" size="mini" hover-class="tap-row--active" @click.stop="onReload" :disabled="mapLoading">🔄 重新加载</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useAppStore } from "../../store/app";
import * as store from "../../local/store";
import { getDistrictMap, type DistrictMapResponse } from "../../local/queries";

type MapModeKey = "marker" | "count" | "price" | "school" | "metro";

const MAP_W = 660;
const MAP_H = 480;

const MAP_MODES: { key: MapModeKey; icon: string; label: string }[] = [
  { key: "marker", icon: "📍", label: "marker" },
  { key: "count", icon: "🔢", label: "count" },
  { key: "price", icon: "💰", label: "price" },
  { key: "school", icon: "🏫", label: "school" },
  { key: "metro", icon: "🚇", label: "metro" }
];

const app = useAppStore();
const districtMap = ref<DistrictMapResponse | null>(null);
const mapLoading = ref<boolean>(false);
const mapError = ref<string | null>(null);
const mapMode = ref<MapModeKey>("marker");

async function loadDistrictMap(cityId: number) {
  mapLoading.value = true;
  mapError.value = null;
  try {
    districtMap.value = await getDistrictMap(cityId);
  } catch (e) {
    console.warn("getDistrictMap failed:", e);
    mapError.value = String(e);
    districtMap.value = null;
  }
  mapLoading.value = false;
}

async function onReload() {
  await loadDistrictMap(app.cityId);
}

function goBack() {
  uni.navigateBack({ delta: 1, fail: () => uni.switchTab({ url: "/pages/dashboard/dashboard" }) });
}

function goCommunity(communityId: number) {
  uni.navigateTo({ url: `/pages/community/community?id=${communityId}` });
}

function mapX(lng: number, minLng: number, maxLng: number): number {
  if (maxLng === minLng) return MAP_W / 2;
  return ((lng - minLng) / (maxLng - minLng)) * MAP_W;
}

function mapY(lat: number, minLat: number, maxLat: number): number {
  if (maxLat === minLat) return MAP_H / 2;
  return ((lat - minLat) / (maxLat - minLat)) * MAP_H;
}

function districtAllPath(
  districtPolygons: Array<Array<[number, number]>>,
  minLng: number,
  maxLng: number,
  minLat: number,
  maxLat: number
): string {
  if (districtPolygons.length === 0) return "";
  return districtPolygons
    .map((poly) => {
      if (poly.length === 0) return "";
      const path = poly
        .map(([lng, lat], idx) => {
          const x = mapX(lng, minLng, maxLng);
          const y = mapY(lat, minLat, maxLat);
          return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ");
      return path + " Z";
    })
    .join(" ");
}

const mapDistrictStats = computed<Record<string, { count: number; avgPrice: number; avgSchool: number; avgMetroMin: number }>>(() => {
  if (!districtMap.value) return {};
  const stats: Record<string, { count: number; sumPrice: number; sumSchool: number; sumMetro: number; cntPrice: number; cntSchool: number; cntMetro: number }> = {};
  // 1. count + price: 用 listings 聚合
  const listings = store.getListingsByCity(app.cityId).filter((l) => l.unitPrice && l.unitPrice > 0);
  for (const l of listings) {
    const m: { district: string } | undefined = districtMap.value.markers.find((x) => x.communityId === l.communityId);
    if (!m) continue;
    const d = m.district;
    if (!stats[d]) stats[d] = { count: 0, sumPrice: 0, sumSchool: 0, sumMetro: 0, cntPrice: 0, cntSchool: 0, cntMetro: 0 };
    stats[d].count += 1;
    stats[d].sumPrice += l.unitPrice!;
    stats[d].cntPrice += 1;
  }
  // 2. school: 用 listingSchoolPremium 聚合
  const lsp = store.getListingSchoolPremiumByCity(app.cityId);
  for (const x of lsp) {
    const m: { district: string } | undefined = districtMap.value.markers.find((mm) => mm.communityId === x.communityId);
    if (!m) continue;
    const d = m.district;
    if (!stats[d]) stats[d] = { count: 0, sumPrice: 0, sumSchool: 0, sumMetro: 0, cntPrice: 0, cntSchool: 0, cntMetro: 0 };
    stats[d].sumSchool += x.avgSchoolScore;
    stats[d].cntSchool += 1;
  }
  // 输出
  const out: Record<string, { count: number; avgPrice: number; avgSchool: number; avgMetroMin: number }> = {};
  for (const k of Object.keys(stats)) {
    const s = stats[k];
    out[k] = {
      count: s.count,
      avgPrice: s.cntPrice > 0 ? Math.round(s.sumPrice / s.cntPrice) : 0,
      avgSchool: s.cntSchool > 0 ? +(s.sumSchool / s.cntSchool).toFixed(1) : 0,
      avgMetroMin: 0
    };
  }
  return out;
});

function mapStatVal(name: string, field: "count" | "avgPrice" | "avgSchool" | "avgMetroMin"): string {
  const s = mapDistrictStats.value[name];
  if (!s) return "—";
  const v = s[field];
  if (field === "count") return String(v);
  if (v === 0) return "—";
  return v.toFixed(0);
}

function districtStatLabel(name: string): string {
  const s = mapDistrictStats.value[name];
  if (!s) return "—";
  switch (mapMode.value) {
    case "count": return String(s.count);
    case "price": return s.avgPrice > 0 ? Math.round(s.avgPrice / 1000) + "k" : "—";
    case "school": return s.avgSchool > 0 ? s.avgSchool.toFixed(0) : "—";
    case "metro": return s.avgMetroMin > 0 ? Math.round(s.avgMetroMin) + "m" : "—";
    default: return "—";
  }
}

const mapStatRange = computed<{ min: number; max: number }>(() => {
  if (!districtMap.value) return { min: 0, max: 1 };
  const vals: number[] = [];
  for (const name of Object.keys(mapDistrictStats.value)) {
    const s = mapDistrictStats.value[name];
    if (mapMode.value === "count") vals.push(s.count);
    else if (mapMode.value === "price") vals.push(s.avgPrice);
    else if (mapMode.value === "school") vals.push(s.avgSchool);
    else if (mapMode.value === "metro") vals.push(s.avgMetroMin);
  }
  if (vals.length === 0) return { min: 0, max: 1 };
  return { min: Math.min(...vals), max: Math.max(...vals) };
});

function districtFill(name: string): string {
  if (mapMode.value === "marker") return "#f1f5f9";
  const s = mapDistrictStats.value[name];
  if (!s) return "#f1f5f9";
  const r = mapStatRange.value;
  let v = 0;
  if (mapMode.value === "count") v = s.count;
  else if (mapMode.value === "price") v = s.avgPrice;
  else if (mapMode.value === "school") v = s.avgSchool;
  else if (mapMode.value === "metro") v = s.avgMetroMin;
  if (r.max === r.min) return "#94a3b8";
  const ratio = (v - r.min) / (r.max - r.min);
  // 0..1 → 蓝→红
  const hue = 220 - 220 * ratio;
  return `hsl(${hue}, 70%, 55%)`;
}

const mapModeTitle = computed(() => {
  switch (mapMode.value) {
    case "count": return "挂牌数";
    case "price": return "均价(元/㎡)";
    case "school": return "学区评分";
    case "metro": return "地铁平均时长";
    default: return "";
  }
});

const mapModeMin = computed(() => {
  if (!mapStatRange.value) return "";
  return Math.round(mapStatRange.value.min).toString();
});

const mapModeMax = computed(() => {
  if (!mapStatRange.value) return "";
  return Math.round(mapStatRange.value.max).toString();
});

const mapModeGradient = computed(() => {
  return "linear-gradient(to right, hsl(220, 70%, 55%), hsl(0, 70%, 55%))";
});

onMounted(async () => {
  await loadDistrictMap(app.cityId);
});

watch(
  () => app.cityId,
  async (newId) => {
    if (!districtMap.value) {
      await loadDistrictMap(newId);
      return;
    }
    await loadDistrictMap(newId);
  }
);
</script>

<style scoped>
.page { padding: 16rpx; padding-bottom: 80rpx; }
.header { padding: 16rpx 24rpx; background: var(--color-surface, #fff); border-radius: 16rpx; margin-bottom: 16rpx; }
.title { font-size: 36rpx; font-weight: 700; color: var(--color-text, #333); }
.muted { color: var(--color-muted, #666); font-size: 24rpx; }
.empty { text-align: center; padding: 40rpx 0; color: var(--color-muted, #999); }
.row-between { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12rpx; }
.card { background: var(--color-surface, #fff); border-radius: 16rpx; padding: 20rpx; margin-bottom: 16rpx; border: 1rpx solid var(--color-border-soft, #eee); }
.card-title { font-size: 30rpx; font-weight: 600; color: var(--color-text, #333); }
.footer { display: flex; justify-content: space-between; gap: 12rpx; margin-top: 24rpx; }
.back-btn, .reload-btn { flex: 1; margin: 0; font-size: 26rpx; padding: 0 24rpx; border-radius: 999px !important; background: var(--color-soft, #f5f5f5) !important; color: var(--color-text, #333) !important; }

.map-mode-tabs {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
  flex-wrap: wrap;
}
.map-mode-tab {
  flex: 1;
  min-width: 100rpx;
  text-align: center;
  padding: 12rpx 8rpx;
  background: var(--color-soft, #f5f5f5);
  border-radius: 12rpx;
}
.map-mode-tab--active {
  background: var(--color-primary, #4f46e5);
  color: #fff;
}
.map-mode-icon { display: block; font-size: 32rpx; }
.map-mode-label { display: block; font-size: 22rpx; }

.map-legend { margin-top: 12rpx; display: flex; align-items: center; gap: 8rpx; font-size: 22rpx; }
.map-legend-title { color: var(--color-text, #333); font-weight: 600; }
.map-legend-bar { flex: 1; height: 16rpx; border-radius: 8rpx; }
.map-legend-min, .map-legend-max { color: var(--color-muted, #666); }

.map-card-full { padding: 12rpx; }
.map-svg-full {
  width: 100%;
  height: 600rpx;
  background: var(--color-soft, #f5f5f5);
  border-radius: 12rpx;
}

.map-districts { cursor: pointer; }
.map-district-p { stroke: #fff; stroke-width: 1; fill: #f1f5f9; transition: fill 0.2s; }
.map-district-p--mode { stroke: #fff; stroke-width: 1.5; }
.map-district-lbl { font-size: 14px; fill: #475569; pointer-events: none; font-weight: 600; }
.map-district-val { font-size: 12px; fill: #1e293b; font-weight: 700; pointer-events: none; }

.map-marker { fill: #4f46e5; stroke: #fff; stroke-width: 1.5; }
.map-marker-lbl { font-size: 12px; fill: #4f46e5; font-weight: 500; }
.map-marker-bare { fill: #4f46e5; cursor: pointer; }
.map-marker-g:hover .map-marker { fill: #ef4444; }

.map-district-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 12rpx;
  margin: 4rpx 0;
  background: var(--color-soft, #f5f5f5);
  border-radius: 8rpx;
}
.map-district-name { font-size: 26rpx; font-weight: 600; color: var(--color-text, #333); }
.map-district-vals { display: flex; gap: 12rpx; font-size: 20rpx; color: var(--color-muted, #666); }
.map-stat { background: var(--color-surface, #fff); padding: 4rpx 8rpx; border-radius: 6rpx; }
</style>
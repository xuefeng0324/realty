<template>
  <view class="page" :data-realty-theme="realtyTheme" :class="'realty-theme-' + realtyTheme">
    <view class="header">
      <view class="muted">
        {{ districtMap?.cityName ?? "—" }} · 社区点位与行政区汇总，可切换查看数量、单价、学校与地铁覆盖。
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
          <text class="map-mode-label">{{ m.label }}</text>
        </view>
      </view>
      <view v-if="mapMode !== 'marker'" class="map-legend">
        <text class="map-legend-title">{{ mapModeTitle }}</text>
        <view class="map-legend-bar" :style="{ background: mapModeGradient }"></view>
        <text class="map-legend-min">{{ mapModeMin }}</text>
        <text class="map-legend-max">~ {{ mapModeMax }}</text>
      </view>
    </view>

    <!-- 大图 -->
    <view v-if="districtMap && districtMap.districts.length > 0" class="card map-card-full">
      <view class="map-canvas">
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
              :style="{ fill: districtFill(d.districtName) }"
              fill-rule="evenodd"
            />
          </g>
          <g v-if="mapMode === 'marker' && districtMap.markers.length <= 30">
            <g
              v-for="m in districtMap.markers"
              :key="'m_' + m.communityId"
              class="map-marker-g tap-row"
              role="button"
              tabindex="0"
              :aria-label="`打开小区：${m.communityName}`"
              @click="goCommunity(m.communityId)"
              @keyup.enter="goCommunity(m.communityId)"
            >
              <circle
                :cx="mapX(m.lng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
                :cy="mapY(m.lat, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
                r="32"
                class="map-marker-hit"
              />
              <circle
                :cx="mapX(m.lng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
                :cy="mapY(m.lat, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
                r="6"
                class="map-marker"
              />
            </g>
          </g>
          <g v-else-if="mapMode === 'marker'">
            <g
              v-for="m in districtMap.markers"
              :key="'mb_' + m.communityId"
              class="map-marker-g tap-row"
              :data-community-id="m.communityId"
              :data-name="m.communityName"
              role="button"
              tabindex="0"
              :aria-label="`打开小区：${m.communityName}`"
              @click="goCommunity(m.communityId)"
              @keyup.enter="goCommunity(m.communityId)"
            >
              <circle
                :cx="mapX(m.lng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
                :cy="mapY(m.lat, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
                r="32"
                class="map-marker-hit"
              />
              <circle
                :cx="mapX(m.lng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
                :cy="mapY(m.lat, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
                r="3"
                class="map-marker-bare"
              />
            </g>
          </g>
        </svg>

        <!-- SVG 内 <text> 会被 uni-app 编译成 uni-text 而不可见，改用 HTML 叠层定位 -->
        <view class="map-labels" aria-hidden="true">
          <text
            v-for="p in districtLabels"
            :key="'lbl_' + p.code"
            class="map-lbl map-district-lbl"
            :style="{ left: p.left, top: p.top }"
          >{{ p.name }}</text>
        </view>
      </view>
    </view>

    <!-- 行政区数据明细列表 -->
    <view v-if="districtMap && districtMap.districts.length > 0" class="card">
      <view class="card-title">区级数据明细</view>
      <view
        v-for="d in districtMap.districts"
        :key="d.districtCode"
        class="map-district-row"
      >
        <view class="map-district-name">{{ d.districtName }}</view>
        <view v-if="hasDistrictStats(d.districtName)" class="map-district-vals">
          <text class="map-stat">数量 {{ mapStatVal(d.districtName, "count") }}</text>
          <text class="map-stat">单价 {{ mapStatVal(d.districtName, "avgPrice") }}</text>
          <text class="map-stat">学校 {{ mapStatVal(d.districtName, "avgSchool") }}</text>
          <text class="map-stat">地铁 {{ mapStatVal(d.districtName, "avgMetroMin") }}</text>
        </view>
        <text v-else class="map-stat map-stat--empty">暂无样本</text>
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
      <button class="reload-btn" size="mini" hover-class="tap-row--active" @click.stop="onReload" :disabled="mapLoading">重新加载</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { resolvedThemeRef as realtyTheme } from "../../utils/theme";
import { computed, onMounted, ref, watch } from "vue";
import { useAppStore } from "../../store/app";
import * as store from "../../local/store";
import { getDistrictMap, type DistrictMapResponse } from "../../local/queries";

type MapModeKey = "marker" | "count" | "price" | "school" | "metro";

const MAP_W = 660;
const MAP_H = 480;

const MAP_MODES: { key: MapModeKey; label: string }[] = [
  { key: "marker", label: "小区" },
  { key: "count", label: "数量" },
  { key: "price", label: "单价" },
  { key: "school", label: "学校" },
  { key: "metro", label: "地铁" }
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

function districtShortName(name: string): string {
  return name.replace(/区$/, "");
}

const districtLabels = computed<Array<{ code: string; name: string; left: string; top: string }>>(() => {
  const dm = districtMap.value;
  if (!dm) return [];
  const items = dm.districts.map((d) => {
    const x = Math.min(93, Math.max(7, (mapX(d.centerLng, dm.bbox.minLng, dm.bbox.maxLng) / MAP_W) * 100));
    const y = (mapY(d.centerLat, dm.bbox.minLat, dm.bbox.maxLat) / MAP_H) * 100;
    return { code: d.districtCode, name: districtShortName(d.districtName), x, y };
  });
  items.sort((a, b) => a.x - b.x || a.y - b.y);
  const placed: typeof items = [];
  for (const it of items) {
    let y = Math.min(94, Math.max(6, it.y));
    // 中心城区标签容易叠在一起，按横向/纵向间距自动错开
    for (let guard = 0; guard < 8; guard += 1) {
      const hit = placed.some((p) => Math.abs(p.x - it.x) < 8 && Math.abs(p.y - y) < 5.5);
      if (!hit) break;
      y = y + 7 <= 94 ? y + 7 : y - 14;
    }
    placed.push({ ...it, y });
  }
  return placed.map((p) => ({
    code: p.code,
    name: p.name,
    left: p.x.toFixed(2) + "%",
    top: p.y.toFixed(2) + "%"
  }));
});

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
  if (field === "avgPrice") return `${(v / 10000).toFixed(1)}万`;
  if (field === "avgMetroMin") return `${v.toFixed(0)}分`;
  return v.toFixed(0);
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

function hasDistrictStats(name: string): boolean {
  const s = mapDistrictStats.value[name];
  return !!(s && s.count > 0);
}

function districtFill(name: string): string {
  if (mapMode.value === "marker") return "var(--color-surface-raised)";
  const s = mapDistrictStats.value[name];
  if (!s || s.count === 0) return "var(--color-surface-raised)";
  const r = mapStatRange.value;
  let v = 0;
  if (mapMode.value === "count") v = s.count;
  else if (mapMode.value === "price") v = s.avgPrice;
  else if (mapMode.value === "school") v = s.avgSchool;
  else if (mapMode.value === "metro") v = s.avgMetroMin;
  if (r.max === r.min) return "hsl(214, 80%, 60%)";
  const ratio = (v - r.min) / (r.max - r.min);
  // 蓝色单色阶：浅（低）→ 深（高）
  return `hsl(214, 88%, ${92 - 52 * ratio}%)`;
}

const mapModeTitle = computed(() => {
  switch (mapMode.value) {
    case "count": return "挂牌数";
    case "price": return "均价（元/㎡）";
    case "school": return "学区评分";
    case "metro": return "地铁（分钟）";
    default: return "";
  }
});

function mapLegendValue(v: number): string {
  return mapMode.value === "price" ? `${(v / 10000).toFixed(1)}万` : Math.round(v).toString();
}

const mapModeMin = computed(() => {
  if (!mapStatRange.value) return "";
  return mapLegendValue(mapStatRange.value.min);
});

const mapModeMax = computed(() => {
  if (!mapStatRange.value) return "";
  return mapLegendValue(mapStatRange.value.max);
});

const mapModeGradient = computed(() => {
  return "linear-gradient(to right, hsl(214, 88%, 92%), hsl(214, 88%, 40%))";
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
.page { padding: var(--space-3); padding-bottom: 80rpx; }
.header { padding: var(--space-3) var(--space-4); background: var(--color-surface); border-radius: var(--radius-md); margin-bottom: var(--space-3); }
.title { font-size: var(--font-title-md); font-weight: var(--font-weight-bold); color: var(--color-text); }
.muted { color: var(--color-muted); font-size: var(--font-body-sm); }
.empty { text-align: center; padding: var(--space-6) 0; color: var(--color-muted); }
.row-between { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); }
.card { background: var(--color-surface); border-radius: var(--radius-md); padding: 20rpx; margin-bottom: var(--space-3); border: 1rpx solid var(--color-border-soft); }
.card-title { font-size: var(--font-title-sm); font-weight: var(--font-weight-semibold); color: var(--color-text); }
.footer { display: flex; justify-content: space-between; gap: var(--space-2); margin-top: var(--space-4); }
.back-btn, .reload-btn { flex: 1; margin: 0; font-size: 26rpx; padding: 0 var(--space-4); border-radius: var(--radius-pill) !important; background: var(--color-soft) !important; color: var(--color-text) !important; }

.map-mode-tabs {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
  flex-wrap: wrap;
}
.map-mode-tab {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 100rpx;
  min-height: 64rpx;
  padding: var(--space-2) var(--space-1);
  background: var(--color-soft);
  border-radius: var(--radius-md2);
  text-align: center;
}
.map-mode-tab--active {
  background: var(--color-primary);
  color: #fff;
}
.map-mode-label { font-size: var(--font-caption); }

.map-legend { margin-top: var(--space-2); display: flex; align-items: center; gap: var(--space-1); font-size: var(--font-caption); }
.map-legend-title { color: var(--color-text); font-weight: var(--font-weight-semibold); }
.map-legend-bar { flex: 1; height: 16rpx; border-radius: var(--radius-sm2); }
.map-legend-min, .map-legend-max { color: var(--color-muted); }

.map-card-full { padding: var(--space-2); }
.map-canvas {
  position: relative;
  width: 100%;
  padding-top: 72.73%;
}
.map-svg-full {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--color-soft);
  border-radius: var(--radius-md2);
}
.map-labels {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
}
.map-lbl {
  position: absolute;
  transform: translate(-50%, -50%);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.2;
  white-space: nowrap;
  text-shadow: 0 0 3rpx var(--color-surface), 0 0 6rpx var(--color-surface);
}

.map-districts { cursor: pointer; }
.map-district-p { stroke: var(--color-border); stroke-width: 1.5; fill: var(--color-panel-soft); transition: fill 0.2s; }
.map-district-p--mode { stroke: var(--color-surface); stroke-width: 1.5; }
.map-district-lbl { color: var(--color-heading); font-size: 22rpx; font-weight: var(--font-weight-semibold); }

.map-marker { fill: #3b82f6; stroke: var(--color-surface); stroke-width: 1.5; }
.map-marker-hit { fill: transparent; pointer-events: all; }
.map-marker-bare { fill: #3b82f6; cursor: pointer; }
.map-marker-g:hover .map-marker { fill: var(--color-danger); }

.map-district-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-1) var(--space-2);
  margin: 4rpx 0;
  background: var(--color-soft);
  border-radius: var(--radius-sm2);
}
.map-district-name { font-size: 26rpx; font-weight: var(--font-weight-semibold); color: var(--color-text); }
.map-district-vals {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-gap-xs);
  margin-left: var(--space-2);
  color: var(--color-muted);
  font-size: var(--font-micro);
  font-variant-numeric: tabular-nums;
}
.map-stat {
  overflow: hidden;
  padding: 0;
  background: transparent;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-stat--empty {
  flex: 1;
  margin-left: var(--space-2);
  color: var(--color-muted);
  text-align: right;
}
</style>

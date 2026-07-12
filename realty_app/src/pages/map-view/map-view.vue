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
          {{ showHeatmap ? "切到挂牌点" : "切到热力图" }}
        </button>
      </view>
      <view class="muted legend">
        <text v-if="showHeatmap">
          热力图：圆点 = 挂牌数 (颜色: 红=多 / 蓝=少)
        </text>
        <text v-else>
          挂牌点：每点 = 该小区 1 套挂牌；点击 → 小区详情
        </text>
      </view>
    </view>

    <view class="map-wrap">
      <map
        id="realty-map"
        class="map"
        :latitude="mapCenter.lat"
        :longitude="mapCenter.lng"
        :scale="mapScale"
        :markers="showHeatmap ? [] : listingMarkers"
        :circles="showHeatmap ? heatCircles : []"
        :show-location="true"
        :enable-zoom="true"
        :enable-scroll="true"
        @markertap="onMarkerTap"
      ></map>
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
      </view>
      <button class="btn" size="mini" @click="goCommunity">查看小区详情 →</button>
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
  getCommunityById
} from "../../local/store";
import { getCities } from "../../local/store";
import { toErrorMessage } from "../../utils/errorMessage";
import { showToast } from "../../utils/format";

const app = useAppStore();
const errorMsg = ref<string>("");
const showHeatmap = ref<boolean>(true);
const selectedCommunityId = ref<number | null>(null);

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

const selectedCommunity = computed<CommunityMarker | null>(() => {
  if (selectedCommunityId.value == null) return null;
  return communityMarkers.value.find((c) => c.communityId === selectedCommunityId.value) ?? null;
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
// 按 listing 数分级 → 半径 (m) + 颜色
const heatCircles = computed(() => {
  if (!app.cityId) return [];
  const cm = communityMarkers.value.filter((c) => c.cityId === app.cityId);
  if (cm.length === 0) return [];
  const maxCount = Math.max(1, ...cm.map((c) => c.listingCount));
  return cm.map((c) => {
    const t = c.listingCount / maxCount; // 0..1
    const radius = 200 + Math.round(t * 800); // 200-1000m
    const fillColor = colorRamp(t); // "#RRGGBB"
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
  showHeatmap.value = !showHeatmap.value;
  showToast(showHeatmap.value ? "切换到热力图" : "切换到挂牌点");
}

function zoomToCity(cityId: number) {
  app.setCityId(cityId);
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
</style>
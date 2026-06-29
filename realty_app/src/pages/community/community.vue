<template>
  <view class="page">
    <view class="container">
      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>

      <view v-if="communityName" class="card">
        <view class="card-title">{{ communityName }}</view>
        <view class="muted">小区 ID: {{ communityId }}</view>
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
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { getCommunityPriceTrend } from "../../local/queries";
import { getQualitySummary, getTopTags } from "../../local/queries";
import { filterListings } from "../../local/queries";
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
import type { QualitySummaryBin } from "../../api/contracts";

const communityId = ref<number>(0);
const communityName = ref<string>("");

const trend = ref<PriceTrendItem[]>([]);
const quality = ref<QualitySummaryResponse | null>(null);
const tags = ref<TopTagsResponse | null>(null);
const listings = ref<ListingItem[]>([]);
const listingsTotal = ref<number>(0);

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
    quality.value = q;
    tags.value = t;

    await loadListings(weekEnd);
  } catch (e: any) {
    errorMsg.value = e?.message || String(e);
  }
}

async function loadListings(weekEnd: string) {
  try {
    const res = await filterListings({
      cityId: app.cityId || undefined,
      communityId: communityId.value,
      weekEnd,
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

onLoad((q: any) => {
  communityId.value = Number(q?.id || q?.communityId || 0);
});

onMounted(() => {
  loadAll();
});
</script>

<style lang="scss" scoped>
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
  background: #1f2937;
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
  background: #1f2937;
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
}

.listing-row:last-child {
  border-bottom: none;
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
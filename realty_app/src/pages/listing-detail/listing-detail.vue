<template>
  <view class="page">
    <view class="container">
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

      <!-- 解释 JSON 折叠 -->
      <view v-if="data && data.score.explain_json" class="card">
        <view class="row-between" @click="toggleExplain">
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
import { getListingDetail } from "../../local/queries";
import type { ListingDetailResponse } from "../../api/contracts";
import {
  copyText,
  dimensionLabelCN,
  formatArea,
  formatPrice,
  formatUnitPrice,
  scoreClass,
  showToast
} from "../../utils/format";

const listingId = ref<number>(0);
const data = ref<ListingDetailResponse | null>(null);
const errorMsg = ref<string>("");
const explainOpen = ref(false);

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
  } catch (e: any) {
    errorMsg.value = e?.message || String(e);
  }
});
</script>

<style lang="scss" scoped>
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

.tag-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 6rpx 0;
}

.explain-box {
  margin-top: 16rpx;
  padding: 16rpx;
  background: #0f172a;
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
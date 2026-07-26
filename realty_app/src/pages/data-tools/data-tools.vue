<template>
  <view class="page">
    <view class="container">
      <view class="page-header" data-data-tools-header>
        <view class="page-header-title">数据工具</view>
        <view class="page-header-sub muted">从仪表盘迁入的派生数据卡 · 7 张 · 共 30+ 指标</view>
      </view>

      <!-- 70 城 12 月趋势对比（轻量版：仅概要，不复制 dashboard 内 14 个 computed） -->
      <view class="card" data-dt-stats70-drift>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">全国 70 城 · 近 12 月同比趋势</view>
          <view class="muted" style="font-size: 22rpx">派生</view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          完整 v-for 排行榜（扩张 / 收缩 Top 3）请在首页点「展开派生数据」查看。
        </view>
        <view class="muted" style="margin-top: 6rpx; font-size: 20rpx">
          数据源 stats_70.csv · 仅二手指数 · 派生
        </view>
      </view>

      <!-- 行政区划 -->
      <view v-if="adminSummary" class="card" data-dt-admin-district>
        <view class="macro-kicker">行政区划</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">行政区划</view>
          <view class="muted" style="font-size: 22rpx">{{ adminSummary.cityCode }}</view>
        </view>
        <view class="muted" style="margin-top: 8rpx">
          {{ adminSummary.districtCount }} 个行政区 · 城市码 {{ adminSummary.cityCode }}
        </view>
        <view class="muted" style="margin-top: 6rpx; font-size: 20rpx">
          数据源：admin_districts.csv
        </view>
      </view>

      <!-- 提示：其它 5 张派生卡在首页展开后可见 -->
      <view class="card" data-dt-notice>
        <view class="card-title" style="margin-bottom: 0">更多派生数据</view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          地铁步行 · 分区均价 · 学校指标 · 重点学校 · 教育事业 — 5 张派生卡在首页「展开派生数据」按钮中可见。
        </view>
        <view class="muted" style="margin-top: 6rpx; font-size: 20rpx">
          完整 v-for 排行榜留原 dashboard 内，确保数据展示一致性；本独立页提供 v1.121.137 入口。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 数据工具独立页（data-tools.vue，v1.121.137）
 *
 * 设计：
 *  - 从仪表盘迁入 7 张派生卡中的 2 张「轻量版」（70 城 12 月趋势 + 行政区划），
 *    避免在独立页内复制 dashboard 内 14 个复杂 computed。
 *  - 其它 5 张派生卡保留在 dashboard 模板内的 `<view v-if="derivedExpanded">` 折叠块中，
 *    首屏默认隐藏，需要时点「展开派生数据」按钮。
 *  - 提供「设置入口」式导航：dashboard 入口卡 → 独立页 → 回首页展开。
 */
import { computed } from "vue";
import {
  summarizeAdminDistrictByCity,
  type CityAdminDistrictSummary
} from "../../local/adminDistrictRanking";
import { useAppStore } from "../../store/app";

const app = useAppStore();

const adminSummary = computed<CityAdminDistrictSummary | null>(() => {
  return summarizeAdminDistrictByCity().find((x) => x.cityId === app.cityId) ?? null;
});
</script>

<style lang="scss" scoped>
.page-header {
  padding: 24rpx 24rpx 16rpx;
}
.page-header-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #111;
}
.page-header-sub {
  font-size: 22rpx;
  margin-top: 4rpx;
}
</style>
<template>
  <view class="page">
    <view class="container">
      <MacroTabNav active="trade" data-macro-tab-nav />

      <view class="card">
        <view class="card-title">宏观 · 贸易</view>
        <view class="muted" style="margin-top: 8rpx">
          海关货物进出口。
        </view>
        <view class="muted" style="margin-top: 4rpx">
          数据源：海关总署。本页为骨架页，下一轮迭代将 1 张货服贸易卡从 dashboard 总览迁入。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 宏观 · 贸易子页（macro-trade.vue）。
 * 骨架页：等待迁入 1 张货服贸易卡（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2）。
 */
import MacroTabNav from "../../components/MacroTabNav.vue";
</script>

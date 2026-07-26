<template>
  <view class="page">
    <view class="container">
      <MacroTabNav active="industry" data-macro-tab-nav />

      <view class="card">
        <view class="card-title">宏观 · 产业</view>
        <view class="muted" style="margin-top: 8rpx">
          工业增加值 / 工业利润 / CPI / PPI / 固投 / 居民收支 / PMI。
        </view>
        <view class="muted" style="margin-top: 4rpx">
          数据源：国家统计局。本页为骨架页，下一轮迭代将 7 张产业卡从 dashboard 总览迁入。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 宏观 · 产业子页（macro-industry.vue）。
 * 骨架页：等待迁入 7 张产业卡（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2）。
 */
import MacroTabNav from "../../components/MacroTabNav.vue";
</script>

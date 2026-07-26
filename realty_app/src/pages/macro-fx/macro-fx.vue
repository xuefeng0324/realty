<template>
  <view class="page">
    <view class="container">
      <MacroTabNav active="fx" data-macro-tab-nav />

      <view class="card">
        <view class="card-title">宏观 · 汇市</view>
        <view class="muted" style="margin-top: 8rpx">
          外储 / 官方储备 / 美元中间价 / 外汇市场 / 结售汇 / BOP / IIP。
        </view>
        <view class="muted" style="margin-top: 4rpx">
          数据源：外汇交易中心 / 外汇管理局。本页为骨架页，下一轮迭代将 8 张汇市卡从 dashboard 总览迁入。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 宏观 · 汇市子页（macro-fx.vue）。
 * 骨架页：等待迁入 8 张汇市卡（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2）。
 */
import MacroTabNav from "../../components/MacroTabNav.vue";
</script>

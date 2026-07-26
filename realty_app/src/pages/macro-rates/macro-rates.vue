<template>
  <view class="page">
    <view class="container">
      <MacroTabNav active="rates" data-macro-tab-nav />

      <view class="card">
        <view class="card-title">宏观 · 利率</view>
        <view class="muted" style="margin-top: 8rpx">
          LPR / MLF / 逆回购 / Shibor / 国债 / 回购定盘 FR/FDR。
        </view>
        <view class="muted" style="margin-top: 4rpx">
          数据源：人民银行 / 交易中心 / 债券通。本页为骨架页，下一轮迭代将 6 张利率卡从 dashboard 总览迁入。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 宏观 · 利率子页（macro-rates.vue）。
 * 骨架页：等待迁入 6 张利率卡（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2）。
 */
import MacroTabNav from "../../components/MacroTabNav.vue";
</script>

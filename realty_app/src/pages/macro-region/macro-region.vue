<template>
  <view class="page">
    <view class="container">
      <MacroTabNav active="region" data-macro-tab-nav />

      <view class="card">
        <view class="card-title">宏观 · 区域</view>
        <view class="muted" style="margin-top: 8rpx">
          广东 · 房地产简况 / 经济运行 / 固定资产投资 / 施工产值。
        </view>
        <view class="muted" style="margin-top: 4rpx">
          数据源：广东省统计局。本页为骨架页，下一轮迭代将 4 张广东卡从 dashboard 总览迁入。
        </view>
      </view>

      <view class="card">
        <view class="card-title">为什么迁出去</view>
        <view class="muted" style="margin-top: 6rpx; line-height: 1.6">
          1）总览页太长（dashboard.vue 16,746 行 / 14 张宏卡），违反预算上限（≤ 8 张宏卡）。<br />
          2）宏卡之间数据耦合度低，单独成页便于住户专项查看。<br />
          3）导航走通后，下一轮按子页分批迁真实数据卡片。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 宏观子页聚合页（macro-region.vue）。
 * 当前是骨架页：顶部 5 tab 切换组件（MacroTabNav）共用，下一轮迭代迁 4 张广东卡。
 *
 * 详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2 路由分配。
 */
import MacroTabNav from "../../components/MacroTabNav.vue";
</script>

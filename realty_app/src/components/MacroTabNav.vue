<template>
  <view class="macro-tabs" data-macro-tabs>
    <view
      v-for="t in tabs"
      :key="t.key"
      :class="['macro-tab', { 'macro-tab--active': active === t.key }]"
      :data-macro-tab="t.key"
      @click="onClick(t)"
    >
      <text class="macro-tab-icon">{{ t.icon }}</text>
      <text class="macro-tab-label">{{ t.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 宏观 5 子页 tab 切换组件（MacroTabNav）。
 *
 * 5 个子页共用：rates / fx / industry / region / trade。
 * 通过 active prop 告知当前 active tab；点击其它 tab 时跳转。
 * 详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2。
 */
export type MacroTabKey = "rates" | "fx" | "industry" | "region" | "trade";

export interface MacroTab {
  key: MacroTabKey;
  label: string;
  icon: string;
  path: string;
}

const TABS: MacroTab[] = [
  { key: "rates", label: "利率", icon: "💱", path: "/pages/macro-rates/macro-rates" },
  { key: "fx", label: "汇市", icon: "💴", path: "/pages/macro-fx/macro-fx" },
  { key: "industry", label: "产业", icon: "🏭", path: "/pages/macro-industry/macro-industry" },
  { key: "region", label: "区域", icon: "🏙️", path: "/pages/macro-region/macro-region" },
  { key: "trade", label: "贸易", icon: "🚢", path: "/pages/macro-trade/macro-trade" }
];

const props = defineProps<{ active: MacroTabKey }>();
const emit = defineEmits<{ (e: "change", key: MacroTabKey): void }>();
const tabs = TABS;

function onClick(t: MacroTab): void {
  if (t.key === props.active) return;
  emit("change", t.key);
  uni.redirectTo({ url: t.path });
}
</script>

<style scoped>
.macro-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8rpx 4rpx;
  margin-bottom: 16rpx;
}
.macro-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 4rpx;
  border-radius: 12rpx;
  background-color: #f7f8fa;
  transition: background-color 0.15s ease;
}
.macro-tab--active {
  background-color: #e8f1ff;
  color: #2a6df4;
}
.macro-tab-icon {
  font-size: 32rpx;
  line-height: 1;
  margin-bottom: 6rpx;
}
.macro-tab-label {
  font-size: 22rpx;
  line-height: 1.2;
}
</style>

<template>
  <view class="macro-tabs" data-macro-tabs>
    <view
      v-for="t in tabs"
      :key="t.key"
      :class="['macro-tab', { 'macro-tab--active': active === t.key }]"
      :data-macro-tab="t.key"
      @click="onClick(t)"
    >
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
  path: string;
}

const TABS: MacroTab[] = [
  { key: "rates", label: "利率", path: "/pages/macro-rates/macro-rates" },
  { key: "fx", label: "汇市", path: "/pages/macro-fx/macro-fx" },
  { key: "industry", label: "产业", path: "/pages/macro-industry/macro-industry" },
  { key: "region", label: "区域", path: "/pages/macro-region/macro-region" },
  { key: "trade", label: "贸易", path: "/pages/macro-trade/macro-trade" }
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
  gap: var(--space-1) var(--space-gap-xs);
  margin-bottom: var(--space-3);
}
.macro-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64rpx;
  padding: var(--space-1) var(--space-gap-xs);
  border-radius: var(--radius-md2);
  background-color: var(--color-soft);
  transition: background-color 0.15s ease;
}
.macro-tab--active {
  background-color: var(--color-primary-soft);
  color: var(--color-primary-strong);
}
.macro-tab-label {
  color: inherit;
  font-size: var(--font-micro);
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}
</style>

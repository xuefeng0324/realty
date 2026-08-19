<template>
  <view class="metric-card" :class="`metric-card--${tone}`">
    <view class="metric-card__head">
      <text class="metric-card__label">{{ label }}</text>
      <slot name="badge" />
    </view>
    <view class="metric-card__value-row">
      <text class="metric-card__value">{{ value }}</text>
      <text v-if="unit" class="metric-card__unit">{{ unit }}</text>
    </view>
    <text v-if="helper" class="metric-card__helper">{{ helper }}</text>
    <slot />
  </view>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    unit?: string;
    helper?: string;
    tone?: "default" | "primary" | "positive" | "negative";
  }>(),
  { unit: "", helper: "", tone: "default" }
);
</script>

<style scoped lang="scss">
.metric-card {
  min-width: 0;
  padding: var(--space-4, 24rpx);
  border: 1rpx solid var(--color-border-soft);
  border-radius: var(--radius-lg, 24rpx);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.metric-card--primary { border-top: 5rpx solid var(--color-primary); }
.metric-card--positive { border-top: 5rpx solid var(--color-trend-up); }
.metric-card--negative { border-top: 5rpx solid var(--color-trend-down); }

.metric-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2, 12rpx);
}

.metric-card__label,
.metric-card__helper {
  color: var(--color-muted);
  font-size: var(--font-caption, 22rpx);
  line-height: 1.45;
}

.metric-card__value-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-1, 8rpx);
  margin-top: var(--space-2, 12rpx);
}

.metric-card__value {
  min-width: 0;
  overflow: hidden;
  color: var(--color-heading);
  font-size: 38rpx;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-card__unit {
  color: var(--color-text-secondary);
  font-size: var(--font-body-sm, 24rpx);
}

.metric-card__helper { display: block; margin-top: var(--space-2, 12rpx); }
</style>

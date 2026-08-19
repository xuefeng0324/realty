<template>
  <scroll-view
    class="segmented-tabs"
    scroll-x
    :show-scrollbar="false"
    :aria-label="ariaLabel"
  >
    <view class="segmented-tabs__track">
      <button
        v-for="item in items"
        :key="item.key"
        class="segmented-tabs__item"
        :class="{ 'segmented-tabs__item--active': item.key === modelValue }"
        :disabled="item.disabled"
        :aria-pressed="item.key === modelValue"
        @click="select(item)"
      >
        <text>{{ item.label }}</text>
        <text v-if="item.badge != null" class="segmented-tabs__badge">{{ item.badge }}</text>
      </button>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
export interface SegmentedTabItem {
  key: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
}

withDefaults(
  defineProps<{
    modelValue: string;
    items: SegmentedTabItem[];
    ariaLabel?: string;
  }>(),
  { ariaLabel: "分段导航" }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [value: string];
}>();

function select(item: SegmentedTabItem): void {
  if (item.disabled) return;
  emit("update:modelValue", item.key);
  emit("change", item.key);
}
</script>

<style scoped lang="scss">
.segmented-tabs {
  width: 100%;
  white-space: nowrap;
}

.segmented-tabs__track {
  display: inline-flex;
  min-width: 100%;
  gap: var(--space-1, 8rpx);
  padding: 6rpx;
  border: 1rpx solid var(--color-border-soft);
  border-radius: var(--radius-lg, 24rpx);
  background: var(--color-panel-soft);
}

.segmented-tabs__item {
  flex: 1 0 auto;
  min-height: 72rpx;
  padding: 0 var(--space-4, 24rpx);
  border-radius: 18rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-body-sm, 24rpx);
  font-weight: 500;
  white-space: nowrap;
}

.segmented-tabs__item--active {
  background: var(--color-surface);
  color: var(--color-primary-strong);
  box-shadow: var(--shadow-card);
}

.segmented-tabs__item[disabled] { opacity: 0.45; }

.segmented-tabs__badge {
  margin-left: var(--space-1, 8rpx);
  color: var(--color-muted);
  font-size: 20rpx;
}
</style>

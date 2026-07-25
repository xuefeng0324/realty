<template>
  <view class="progress-bar" :class="{ 'progress-bar--lg': size === 'lg' }">
    <view class="progress-bar__track">
      <view
        class="progress-bar__fill"
        :class="'progress-bar__fill--' + tone"
        :style="{ width: clamped + '%' }"
      />
    </view>
    <text v-if="showLabel" class="progress-bar__label">{{ clamped }}%</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** 0–100 */
    percent: number;
    showLabel?: boolean;
    size?: "md" | "lg";
    tone?: "primary" | "accent" | "warn";
  }>(),
  {
    showLabel: true,
    size: "md",
    tone: "primary"
  }
);

const clamped = computed(() => {
  const n = Number(props.percent);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
});
</script>

<style scoped lang="scss">
.progress-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  width: 100%;
}
.progress-bar__track {
  flex: 1;
  height: 12rpx;
  border-radius: 999rpx;
  background: var(--color-soft);
  overflow: hidden;
}
.progress-bar--lg .progress-bar__track {
  height: 16rpx;
}
.progress-bar__fill {
  height: 100%;
  border-radius: 999rpx;
  transition: width 0.25s ease;
}
.progress-bar__fill--primary {
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-contrast));
}
.progress-bar__fill--accent {
  background: var(--color-accent);
}
.progress-bar__fill--warn {
  background: #f59e0b;
}
.progress-bar__label {
  min-width: 64rpx;
  text-align: right;
  font-size: 22rpx;
  color: var(--color-muted);
}
</style>

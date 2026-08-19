<template>
  <view
    class="async-state"
    :class="[`async-state--${status}`, { 'async-state--compact': compact }]"
    :role="status === 'error' ? 'alert' : 'status'"
    :aria-live="isBusy ? 'polite' : 'off'"
  >
    <view v-if="isBusy" class="async-state__spinner" aria-hidden="true" />
    <view v-else class="async-state__marker" aria-hidden="true">{{ marker }}</view>
    <view class="async-state__copy">
      <text class="async-state__title">{{ resolvedTitle }}</text>
      <text v-if="resolvedDescription" class="async-state__description">
        {{ resolvedDescription }}
      </text>
    </view>
    <button
      v-if="actionText"
      class="async-state__action"
      size="mini"
      @click="$emit('action')"
    >
      {{ actionText }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

export type AsyncStateStatus =
  | "loading"
  | "empty"
  | "error"
  | "offline"
  | "stale"
  | "refreshing";

const props = withDefaults(
  defineProps<{
    status: AsyncStateStatus;
    title?: string;
    description?: string;
    actionText?: string;
    compact?: boolean;
  }>(),
  { title: "", description: "", actionText: "", compact: false }
);

defineEmits<{ action: [] }>();

const DEFAULT_COPY: Record<AsyncStateStatus, { title: string; description: string; marker: string }> = {
  loading: { title: "正在加载", description: "请稍候，数据马上就好。", marker: "" },
  empty: { title: "暂时没有内容", description: "可以调整筛选条件后再试。", marker: "—" },
  error: { title: "加载失败", description: "请检查网络或稍后重试。", marker: "!" },
  offline: { title: "当前处于离线状态", description: "已优先展示本机可用的数据。", marker: "离线" },
  stale: { title: "正在显示缓存数据", description: "联网后会自动获取最新内容。", marker: "缓存" },
  refreshing: { title: "正在更新", description: "当前内容仍可继续查看。", marker: "" }
};

const defaults = computed(() => DEFAULT_COPY[props.status]);
const resolvedTitle = computed(() => props.title || defaults.value.title);
const resolvedDescription = computed(() => props.description || defaults.value.description);
const marker = computed(() => defaults.value.marker);
const isBusy = computed(() => props.status === "loading" || props.status === "refreshing");
</script>

<style scoped lang="scss">
.async-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3, 16rpx);
  width: 100%;
  padding: 72rpx var(--space-4, 24rpx);
  color: var(--color-text);
  text-align: center;
}

.async-state--compact {
  flex-direction: row;
  justify-content: flex-start;
  padding: var(--space-3, 16rpx) var(--space-4, 24rpx);
  border: 1rpx solid var(--color-border-soft);
  border-radius: var(--radius-md, 16rpx);
  background: var(--color-panel-soft);
  text-align: left;
}

.async-state__spinner,
.async-state__marker {
  flex: 0 0 auto;
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--radius-pill, 999rpx);
}

.async-state__spinner {
  border: 5rpx solid var(--color-border);
  border-top-color: var(--color-primary);
  animation: async-state-spin 0.8s linear infinite;
}

.async-state__marker {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-soft);
  color: var(--color-text-secondary);
  font-size: 20rpx;
  font-weight: 600;
}

.async-state--error .async-state__marker {
  background: var(--color-danger-soft);
  color: var(--color-on-danger-soft);
}

.async-state__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-1, 8rpx);
}

.async-state__title {
  color: var(--color-heading);
  font-size: var(--font-body, 28rpx);
  font-weight: 600;
}

.async-state__description {
  color: var(--color-muted);
  font-size: var(--font-body-sm, 24rpx);
  line-height: 1.55;
}

.async-state__action {
  min-height: 72rpx;
  padding: 0 var(--space-4, 24rpx);
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill, 999rpx);
  background: var(--color-surface);
  color: var(--color-primary-strong);
  font-size: var(--font-body-sm, 24rpx);
}

@keyframes async-state-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .async-state__spinner { animation-duration: 1.8s; }
}
</style>

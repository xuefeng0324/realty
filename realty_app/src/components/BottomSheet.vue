<template>
  <view
    v-if="modelValue"
    class="bottom-sheet"
    role="dialog"
    aria-modal="true"
    :aria-label="title || '底部面板'"
    @touchmove.stop.prevent
  >
    <view class="bottom-sheet__mask" @click="onMaskClick" />
    <view class="bottom-sheet__panel" @click.stop>
      <view v-if="showHandle" class="bottom-sheet__handle" aria-hidden="true" />
      <view v-if="title || description" class="bottom-sheet__header">
        <view class="bottom-sheet__copy">
          <text v-if="title" class="bottom-sheet__title">{{ title }}</text>
          <text v-if="description" class="bottom-sheet__description">{{ description }}</text>
        </view>
        <button class="bottom-sheet__close" aria-label="关闭" @click="close">关闭</button>
      </view>
      <view class="bottom-sheet__body"><slot /></view>
      <view v-if="$slots.footer" class="bottom-sheet__footer"><slot name="footer" /></view>
    </view>
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    description?: string;
    closeOnMask?: boolean;
    showHandle?: boolean;
  }>(),
  { title: "", description: "", closeOnMask: true, showHandle: true }
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  close: [];
}>();

function close(): void {
  emit("update:modelValue", false);
  emit("close");
}

function onMaskClick(): void {
  if (props.closeOnMask) close();
}
</script>

<style scoped lang="scss">
.bottom-sheet {
  position: fixed;
  z-index: 900;
  inset: 0;
}

.bottom-sheet__mask {
  position: absolute;
  inset: 0;
  background: var(--color-overlay);
}

.bottom-sheet__panel {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  max-height: 82vh;
  overflow-y: auto;
  padding-bottom: var(--safe-area-bottom, 0px);
  border-radius: var(--radius-xl, 32rpx) var(--radius-xl, 32rpx) 0 0;
  background: var(--color-surface);
  box-shadow: var(--shadow-sheet);
}

.bottom-sheet__handle {
  width: 72rpx;
  height: 8rpx;
  margin: var(--space-2, 12rpx) auto var(--space-1, 8rpx);
  border-radius: var(--radius-pill, 999rpx);
  background: var(--color-soft-strong);
}

.bottom-sheet__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4, 24rpx);
  padding: var(--space-3, 16rpx) var(--space-4, 24rpx);
  border-bottom: 1rpx solid var(--color-border-soft);
}

.bottom-sheet__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-1, 8rpx);
}

.bottom-sheet__title {
  color: var(--color-heading);
  font-size: var(--font-title-sm, 32rpx);
  font-weight: 650;
}

.bottom-sheet__description {
  color: var(--color-muted);
  font-size: var(--font-body-sm, 24rpx);
  line-height: 1.45;
}

.bottom-sheet__close {
  min-width: 88rpx;
  min-height: 64rpx;
  color: var(--color-primary-strong);
  font-size: var(--font-body-sm, 24rpx);
}

.bottom-sheet__body { padding: var(--space-4, 24rpx); }

.bottom-sheet__footer {
  padding: var(--space-3, 16rpx) var(--space-4, 24rpx);
  border-top: 1rpx solid var(--color-border-soft);
  background: var(--color-surface);
}
</style>

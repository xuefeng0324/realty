<template>
  <view
    class="app-header"
    :class="{
      'app-header--safe-area': safeArea,
      'app-header--sticky': sticky,
      'app-header--transparent': transparent
    }"
  >
    <view class="app-header__leading">
      <slot name="leading">
        <button
          v-if="showBack"
          class="app-header__back"
          aria-label="返回上一页"
          @click="handleBack"
        >
          <text aria-hidden="true">‹</text>
        </button>
      </slot>
    </view>

    <view class="app-header__copy">
      <text v-if="eyebrow" class="app-header__eyebrow">{{ eyebrow }}</text>
      <text class="app-header__title">{{ title }}</text>
      <text v-if="subtitle" class="app-header__subtitle">{{ subtitle }}</text>
    </view>

    <view class="app-header__actions">
      <slot name="actions" />
    </view>
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    eyebrow?: string;
    subtitle?: string;
    showBack?: boolean;
    autoBack?: boolean;
    safeArea?: boolean;
    sticky?: boolean;
    transparent?: boolean;
  }>(),
  {
    eyebrow: "",
    subtitle: "",
    showBack: false,
    autoBack: true,
    safeArea: true,
    sticky: false,
    transparent: false
  }
);

const emit = defineEmits<{ back: [] }>();

function handleBack(): void {
  emit("back");
  if (!props.autoBack) return;
  uni.navigateBack({ fail: () => undefined });
}
</script>

<style scoped lang="scss">
.app-header {
  position: relative;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(72rpx, auto) minmax(0, 1fr) minmax(72rpx, auto);
  align-items: center;
  gap: var(--space-3, 16rpx);
  min-height: 104rpx;
  padding: var(--space-3, 16rpx) calc(var(--content-padding, 24rpx) + var(--safe-area-right, 0px));
  padding-left: calc(var(--content-padding, 24rpx) + var(--safe-area-left, 0px));
  border-bottom: 1rpx solid var(--color-border-soft);
  background: var(--color-surface);
}

.app-header--safe-area {
  padding-top: calc(var(--space-3, 16rpx) + var(--safe-area-top, 0px));
}

.app-header--sticky {
  position: sticky;
  top: 0;
}

.app-header--transparent {
  border-bottom-color: transparent;
  background: transparent;
}

.app-header__leading,
.app-header__actions {
  display: flex;
  align-items: center;
}

.app-header__actions { justify-content: flex-end; }

.app-header__back {
  width: 72rpx;
  height: 72rpx;
  border: 1rpx solid var(--color-border-soft);
  border-radius: var(--radius-pill, 999rpx);
  background: var(--color-panel-soft);
  color: var(--color-heading);
  font-size: 50rpx;
  line-height: 1;
}

.app-header__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4rpx;
}

.app-header__eyebrow {
  color: var(--color-primary-strong);
  font-size: 20rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.app-header__title {
  overflow: hidden;
  color: var(--color-heading);
  font-size: 36rpx;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header__subtitle {
  overflow: hidden;
  color: var(--color-muted);
  font-size: 22rpx;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

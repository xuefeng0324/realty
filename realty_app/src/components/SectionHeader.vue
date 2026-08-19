<template>
  <view class="section-header">
    <view class="section-header__copy">
      <text v-if="eyebrow" class="section-header__eyebrow">{{ eyebrow }}</text>
      <text class="section-header__title">{{ title }}</text>
      <text v-if="subtitle" class="section-header__subtitle">{{ subtitle }}</text>
    </view>
    <slot name="action">
      <button
        v-if="actionText"
        class="section-header__action"
        @click="$emit('action')"
      >
        {{ actionText }}
      </button>
    </slot>
  </view>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    eyebrow?: string;
    subtitle?: string;
    actionText?: string;
  }>(),
  { eyebrow: "", subtitle: "", actionText: "" }
);

defineEmits<{ action: [] }>();
</script>

<style scoped lang="scss">
.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4, 24rpx);
  margin: var(--space-6, 40rpx) 0 var(--space-3, 16rpx);
}

.section-header__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6rpx;
}

.section-header__eyebrow {
  color: var(--color-primary-strong);
  font-size: 20rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.section-header__title {
  color: var(--color-heading);
  font-size: var(--font-title-sm, 32rpx);
  font-weight: 650;
  line-height: 1.3;
}

.section-header__subtitle {
  color: var(--color-muted);
  font-size: var(--font-body-sm, 24rpx);
  line-height: 1.5;
}

.section-header__action {
  flex: 0 0 auto;
  min-height: 64rpx;
  color: var(--color-primary-strong);
  font-size: var(--font-body-sm, 24rpx);
}
</style>

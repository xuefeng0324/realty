<template>
  <view class="empty-state">
    <text v-if="icon" class="empty-state__icon">{{ icon }}</text>
    <text class="empty-state__title">{{ title }}</text>
    <text v-if="desc" class="empty-state__desc">{{ desc }}</text>
    <button
      v-if="actionText"
      class="btn empty-state__action"
      size="mini"
      @click="$emit('action')"
    >
      {{ actionText }}
    </button>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  desc?: string;
  icon?: string;
  actionText?: string;
}>();

defineEmits<{
  action: [];
}>();
</script>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6, 40rpx) var(--space-4, 24rpx);
  text-align: center;
  gap: var(--space-gap-md, 10rpx);
}
.empty-state__icon {
  font-size: var(--font-display, 52rpx);
  line-height: 1.2;
  margin-bottom: var(--space-gap-xs, 4rpx);
}
.empty-state__title {
  font-size: var(--font-body, 28rpx);
  color: var(--color-heading);
  font-weight: var(--font-weight-semibold);
}
.empty-state__desc {
  font-size: var(--font-caption, 24rpx);
  color: var(--color-muted);
  max-width: 520rpx;
  line-height: 1.5;
}
.empty-state__action {
  margin-top: var(--space-2, 12rpx);
}
</style>

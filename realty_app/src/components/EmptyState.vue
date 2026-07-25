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
  padding: 48rpx 24rpx;
  text-align: center;
  gap: 10rpx;
}
.empty-state__icon {
  font-size: 56rpx;
  line-height: 1.2;
  margin-bottom: 4rpx;
}
.empty-state__title {
  font-size: 28rpx;
  color: var(--color-heading);
  font-weight: 600;
}
.empty-state__desc {
  font-size: 22rpx;
  color: var(--color-muted);
  max-width: 520rpx;
  line-height: 1.5;
}
.empty-state__action {
  margin-top: 12rpx;
}
</style>

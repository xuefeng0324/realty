<template>
  <button
    class="entity-list-item"
    :class="{ 'entity-list-item--selected': selected }"
    :disabled="disabled"
    :aria-label="ariaLabel || `${title}，${actionText}`"
    @click="$emit('click')"
  >
    <view v-if="imageSrc || $slots.leading" class="entity-list-item__leading">
      <image
        v-if="imageSrc"
        class="entity-list-item__image"
        :src="imageSrc"
        mode="aspectFill"
        :alt="title"
      />
      <slot v-else name="leading" />
    </view>

    <view class="entity-list-item__copy">
      <text v-if="eyebrow" class="entity-list-item__eyebrow">{{ eyebrow }}</text>
      <text class="entity-list-item__title">{{ title }}</text>
      <text v-if="subtitle" class="entity-list-item__subtitle">{{ subtitle }}</text>
      <text v-if="meta" class="entity-list-item__meta">{{ meta }}</text>
    </view>

    <view class="entity-list-item__trailing">
      <slot name="trailing">
        <text class="entity-list-item__action">{{ actionText }}</text>
        <text class="entity-list-item__chevron" aria-hidden="true">›</text>
      </slot>
    </view>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    meta?: string;
    eyebrow?: string;
    imageSrc?: string;
    actionText?: string;
    ariaLabel?: string;
    selected?: boolean;
    disabled?: boolean;
  }>(),
  {
    subtitle: "",
    meta: "",
    eyebrow: "",
    imageSrc: "",
    actionText: "查看",
    ariaLabel: "",
    selected: false,
    disabled: false
  }
);

defineEmits<{ click: [] }>();
</script>

<style scoped lang="scss">
.entity-list-item {
  display: flex;
  width: 100%;
  min-height: 112rpx;
  align-items: center;
  gap: var(--space-3, 16rpx);
  padding: var(--space-3, 16rpx) 0;
  border-bottom: 1rpx solid var(--color-border-soft);
  border-radius: 0;
  color: var(--color-text);
  text-align: left;
}

.entity-list-item--selected {
  background: var(--color-primary-soft);
}

.entity-list-item[disabled] { opacity: 0.45; }

.entity-list-item__leading {
  display: flex;
  width: 96rpx;
  height: 96rpx;
  flex: 0 0 96rpx;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--radius-md, 16rpx);
  background: var(--color-panel-soft);
}

.entity-list-item__image { width: 100%; height: 100%; }

.entity-list-item__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5rpx;
}

.entity-list-item__eyebrow {
  color: var(--color-primary-strong);
  font-size: 19rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.entity-list-item__title {
  overflow: hidden;
  color: var(--color-heading);
  font-size: var(--font-body, 28rpx);
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entity-list-item__subtitle,
.entity-list-item__meta {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-caption, 22rpx);
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entity-list-item__meta { color: var(--color-muted); }

.entity-list-item__trailing {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4rpx;
  color: var(--color-muted);
}

.entity-list-item__action { font-size: var(--font-caption, 22rpx); }
.entity-list-item__chevron { font-size: 40rpx; line-height: 1; }
</style>

<template>
  <button
    class="favorite-button"
    :class="{ 'favorite-button--active': saved, 'favorite-button--compact': compact }"
    size="mini"
    :aria-label="saved ? '取消收藏' : '收藏'"
    @click.stop="toggle"
  >
    <text class="favorite-button__icon">{{ saved ? "★" : "☆" }}</text>
    <text v-if="!compact">{{ saved ? "已收藏" : "收藏" }}</text>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { UserLibraryEntityInput } from "../local/userLibrary";
import { useUserLibraryStore } from "../store/userLibrary";

const props = withDefaults(defineProps<{
  item: UserLibraryEntityInput;
  compact?: boolean;
}>(), {
  compact: false
});

const userLibrary = useUserLibraryStore();
const saved = computed(() => userLibrary.isFavorite(props.item.type, props.item.id));

function toggle(): void {
  const favorite = userLibrary.toggleFavorite(props.item);
  uni.showToast({
    title: favorite ? "已保存到本机收藏" : "已取消收藏",
    icon: "none"
  });
}
</script>

<style lang="scss" scoped>
.favorite-button {
  display: inline-flex;
  min-width: 132rpx;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  margin: 0;
  border: 1rpx solid var(--color-border);
  border-radius: 999rpx;
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.25;
}

.favorite-button::after {
  border: 0;
}

.favorite-button--active {
  border-color: rgba(16, 185, 129, 0.45);
  background: rgba(16, 185, 129, 0.12);
  color: var(--color-primary);
}

.favorite-button--compact {
  min-width: 64rpx;
  width: 64rpx;
  padding-right: 0;
  padding-left: 0;
}

.favorite-button__icon {
  font-size: 28rpx;
  line-height: 1;
}
</style>

<template>
  <view
    v-if="scrollable"
    class="scrollbar"
    :class="{ 'scrollbar--dragging': dragging }"
    :style="trackStyle"
    @touchstart.stop.prevent="onTrackTouch"
    @touchmove.stop.prevent="onTrackTouch"
    @touchend.stop.prevent="onEnd"
  >
    <view class="scrollbar__track" />
    <view
      class="scrollbar__thumb"
      :style="thumbStyle"
      @touchstart.stop.prevent="onThumbStart"
      @touchmove.stop.prevent="onThumbMove"
      @touchend.stop.prevent="onEnd"
    >
      <view class="scrollbar__grip" />
    </view>
    <view v-if="dragging" class="scrollbar__bubble" :style="bubbleStyle">{{ percentLabel }}%</view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  maxScroll,
  scrollFraction,
  scrollTopFromFraction,
  thumbLength,
  thumbOffset,
  fractionFromTouch
} from "../utils/scrollProgress";

const props = withDefaults(
  defineProps<{
    scrollTop: number;
    contentHeight: number;
    viewportHeight: number;
    /** 轨道占视口高度比例（默认 0.56，居中偏上） */
    trackRatio?: number;
    /** 轨道顶端占视口比例（默认 0.2） */
    topRatio?: number;
  }>(),
  { trackRatio: 0.56, topRatio: 0.2 }
);

const emit = defineEmits<{ (e: "seek", scrollTop: number): void }>();

const dragging = ref(false);

const scrollable = computed(
  () => maxScroll(props.contentHeight, props.viewportHeight) > 4
);

const trackTopPx = computed(() => (props.viewportHeight || 0) * props.topRatio);
const trackLenPx = computed(() => (props.viewportHeight || 0) * props.trackRatio);
const thumbPx = computed(() =>
  thumbLength(props.contentHeight, props.viewportHeight, trackLenPx.value)
);
const fraction = computed(() =>
  scrollFraction(props.scrollTop, props.contentHeight, props.viewportHeight)
);
const offsetPx = computed(() =>
  thumbOffset(fraction.value, trackLenPx.value, thumbPx.value)
);
const percentLabel = computed(() => Math.round(fraction.value * 100));

const trackStyle = computed(() => ({
  top: `${trackTopPx.value}px`,
  height: `${trackLenPx.value}px`
}));
const thumbStyle = computed(() => ({
  top: `${offsetPx.value}px`,
  height: `${thumbPx.value}px`
}));
const bubbleStyle = computed(() => ({
  top: `${offsetPx.value + thumbPx.value / 2}px`
}));

function clientYOf(e: TouchEvent): number {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  // uni-app 触点提供 clientY（视口相对，CSS px）
  return t ? (t as unknown as { clientY: number }).clientY : 0;
}

function seekFromClientY(clientY: number) {
  const offset = clientY - trackTopPx.value;
  const f = fractionFromTouch(offset, trackLenPx.value, thumbPx.value);
  emit("seek", scrollTopFromFraction(f, props.contentHeight, props.viewportHeight));
}

/** 点/拖轨道任意位置 → 跳到该处 */
function onTrackTouch(e: TouchEvent) {
  dragging.value = true;
  seekFromClientY(clientYOf(e));
}
function onThumbStart(e: TouchEvent) {
  dragging.value = true;
  seekFromClientY(clientYOf(e));
}
function onThumbMove(e: TouchEvent) {
  seekFromClientY(clientYOf(e));
}
function onEnd() {
  dragging.value = false;
}
</script>

<style scoped lang="scss">
.scrollbar {
  position: fixed;
  right: 6rpx;
  width: 48rpx;
  z-index: 900;
  display: flex;
  justify-content: center;
  /* 触摸区宽，视觉轨道窄 */
}
.scrollbar__track {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6rpx;
  border-radius: 999rpx;
  background: var(--color-border);
  opacity: 0.5;
}
.scrollbar__thumb {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 10rpx;
  min-height: 48px;
  border-radius: 999rpx;
  background: var(--color-primary);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.25);
  transition: background 0.15s ease;
}
.scrollbar--dragging .scrollbar__thumb {
  width: 16rpx;
  background: var(--color-primary-strong);
}
.scrollbar__grip {
  position: absolute;
  inset: 0;
}
.scrollbar__bubble {
  position: absolute;
  right: 56rpx;
  transform: translateY(-50%);
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: var(--color-primary-strong);
  color: var(--color-primary-text);
  font-size: 22rpx;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.3);
}
</style>

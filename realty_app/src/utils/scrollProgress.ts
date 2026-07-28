/**
 * 可拖动滚动进度条的纯数学（与 UI 解耦，便于单测）。
 *
 * 约定：
 * - scrollTop：当前已滚动距离（px）
 * - contentHeight：内容总高（px，含视口外）
 * - viewportHeight：可视高度（px）
 * - 可滚动距离 maxScroll = max(0, contentHeight - viewportHeight)
 */

export function maxScroll(contentHeight: number, viewportHeight: number): number {
  const m = (Number(contentHeight) || 0) - (Number(viewportHeight) || 0);
  return m > 0 ? m : 0;
}

/** 当前滚动占比 0..1（内容不足一屏时恒为 0） */
export function scrollFraction(
  scrollTop: number,
  contentHeight: number,
  viewportHeight: number
): number {
  const max = maxScroll(contentHeight, viewportHeight);
  if (max <= 0) return 0;
  const f = (Number(scrollTop) || 0) / max;
  return clamp01(f);
}

/** 由占比反推 scrollTop（拖动 thumb 时用） */
export function scrollTopFromFraction(
  fraction: number,
  contentHeight: number,
  viewportHeight: number
): number {
  return clamp01(fraction) * maxScroll(contentHeight, viewportHeight);
}

/**
 * thumb 在轨道内的顶端偏移（px）。
 * trackLength：轨道可用长度；thumbLength：滑块长度。
 */
export function thumbOffset(
  fraction: number,
  trackLength: number,
  thumbLength: number
): number {
  const travel = Math.max(0, (Number(trackLength) || 0) - (Number(thumbLength) || 0));
  return clamp01(fraction) * travel;
}

/**
 * 由触摸点在轨道内的绝对位置（相对轨道顶端的 px）反推占比。
 * touchOffset：手指相对轨道顶端的 px；以 thumb 中心对齐，避免起手跳一格。
 */
export function fractionFromTouch(
  touchOffset: number,
  trackLength: number,
  thumbLength: number
): number {
  const travel = Math.max(0, (Number(trackLength) || 0) - (Number(thumbLength) || 0));
  if (travel <= 0) return 0;
  const centered = (Number(touchOffset) || 0) - (Number(thumbLength) || 0) / 2;
  return clamp01(centered / travel);
}

/** thumb 高度：按可视占比给一个易抓取的最小值 */
export function thumbLength(
  contentHeight: number,
  viewportHeight: number,
  trackLength: number,
  minThumb = 48
): number {
  const content = Number(contentHeight) || 0;
  const track = Number(trackLength) || 0;
  if (content <= 0 || track <= 0) return minThumb;
  const ratio = clamp01((Number(viewportHeight) || 0) / content);
  return Math.max(minThumb, Math.round(ratio * track));
}

function clamp01(n: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

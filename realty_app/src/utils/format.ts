/**
 * 通用工具方法
 */

export function formatPrice(totalPrice10k: number | null | undefined): string {
  if (totalPrice10k == null) return "-";
  if (totalPrice10k >= 10000) {
    const yi = totalPrice10k / 10000;
    return `${yi.toFixed(2)}亿`;
  }
  return `${totalPrice10k.toFixed(0)}万`;
}

export function formatUnitPrice(price: number | null | undefined): string {
  if (price == null) return "-";
  return `${price.toLocaleString("zh-CN")} 元/㎡`;
}

export function formatArea(area: number | null | undefined): string {
  if (area == null) return "-";
  return `${area.toFixed(1)}㎡`;
}

export function scoreClass(score: number | null | undefined): string {
  if (score == null) return "score-mid";
  if (score >= 80) return "score-high";
  if (score >= 60) return "score-mid";
  return "score-low";
}

export function coverageText(score: number | null | undefined): string {
  if (score == null) return "-";
  return `${(score * 100).toFixed(0)}%`;
}

export function dimensionLabelCN(d: string): string {
  const map: Record<string, string> = {
    location_score: "地段",
    house_quality_score: "房屋品质",
    building_age_score: "楼龄",
    amenity_score: "配套",
    price_value_score: "性价比"
  };
  return map[d] || d;
}

export function showToast(title: string, icon: "success" | "error" | "none" = "none") {
  uni.showToast({ title, icon, duration: 2000 });
}

export async function copyText(text: string): Promise<void> {
  // #ifdef H5
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制");
  } catch {
    showToast("复制失败");
  }
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: text, success: () => showToast("已复制") });
  // #endif
}
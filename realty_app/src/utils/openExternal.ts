/**
 * 在系统浏览器 / 新窗口打开外链（政府站登录、SSL、跳转更稳定）。
 */
export function openExternalUrl(url: string): void {
  if (!url) return;

  // #ifdef APP-PLUS
  plus.runtime.openURL(url);
  return;
  // #endif

  // #ifdef H5
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  // #endif

  // #ifdef MP-WEIXIN
  uni.setClipboardData({
    data: url,
    success: () => uni.showToast({ title: "链接已复制，请在浏览器打开", icon: "none" })
  });
  return;
  // #endif

  uni.showToast({ title: "请复制链接到浏览器打开", icon: "none" });
}

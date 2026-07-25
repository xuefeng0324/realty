/**
 * 在系统浏览器 / 新窗口打开外链（政府站登录、SSL、跳转更稳定）。
 */
export function openExternalUrl(url: string): void {
  if (!url) return;

  const showFallback = () => {
    uni.showToast({ title: "请复制链接到浏览器打开", icon: "none" });
  };

  if (typeof plus !== "undefined" && (plus as { runtime?: { openURL?: (url: string) => void } }).runtime?.openURL) {
    (plus as { runtime: { openURL: (url: string) => void } }).runtime.openURL(url);
    return;
  }

  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  if (typeof uni !== "undefined" && typeof uni.setClipboardData === "function") {
    uni.setClipboardData({
      data: url,
      success: () => uni.showToast({ title: "链接已复制，请在浏览器打开", icon: "none" }),
      fail: () => uni.showToast({ title: "复制失败，请手动复制链接", icon: "none" })
    });
    return;
  }

  showFallback();
}

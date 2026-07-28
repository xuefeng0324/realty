/**
 * 首页「使用指南」banner 显示状态。
 * 必须在 setup 同步读 storage，禁止先 true 再 onMounted 改 false——
 * 否则首帧会画出浅色渐变卡，启动页关掉后上半截必闪白。
 */

export const DASHBOARD_GUIDE_KEY = "realty_dashboard_guide_dismissed";

export function isDashboardGuideDismissed(
  getStorage: (key: string) => unknown = (k) =>
    typeof uni !== "undefined" ? uni.getStorageSync(k) : ""
): boolean {
  try {
    const raw = getStorage(DASHBOARD_GUIDE_KEY);
    if (typeof raw === "string" && raw.length > 0) {
      return Boolean(JSON.parse(raw));
    }
    if (typeof raw === "boolean") return raw;
  } catch {
    /* ignore */
  }
  return false;
}

/** 首帧是否应显示指南（已关闭则 false，避免白闪） */
export function shouldShowDashboardGuide(
  getStorage?: (key: string) => unknown
): boolean {
  return !isDashboardGuideDismissed(getStorage);
}

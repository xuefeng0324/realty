/**
 * 总览专业 Tab 过滤（F-DASH-04）
 * App / H5 均必须以页面根节点 data-dash-tab 生效；不可只写 document.body（App 无 document）。
 */

export type DashTabKey = "overview" | "price" | "school" | "transit" | "map";

export const DASH_TAB_KEYS: DashTabKey[] = ["overview", "price", "school", "transit", "map"];

/**
 * 与 dashboard 全局 CSS 语义一致：
 * - 无 data-tab → 始终可见（入口/工作台等）
 * - 含 all → 全 Tab 可见
 * - 否则仅当列表包含当前 activeTab 时可见
 */
export function cardVisibleOnDashTab(
  dataTabAttr: string | null | undefined,
  activeTab: DashTabKey
): boolean {
  const raw = String(dataTabAttr ?? "").trim();
  if (!raw) return true;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.includes("all")) return true;
  return parts.includes(activeTab);
}

/** 金刚区 / Tab 切换后应给出可感知反馈的最小集合 */
export function dashTabSwitchFeedback(tab: DashTabKey): {
  toast: string;
  scrollSelector: string;
} {
  const labels: Record<DashTabKey, string> = {
    overview: "概览",
    price: "价格画像",
    school: "学区配套",
    transit: "通勤地铁",
    map: "地图视图"
  };
  return {
    toast: `已切换到${labels[tab]}`,
    scrollSelector: "#dash-tabs"
  };
}

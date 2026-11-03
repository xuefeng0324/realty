/**
 * 总览首页多入口配置（F-ENTRY-01）
 * 对照：美团定位+搜索；房价三轴不误标成交价。
 * v1.121.143：频道/金刚「供需·工具」等改为 navigate 独立页，不再本页滚动。
 * v1.123.11：HOME_CHANNELS / HOME_KINGKONG 库定义删除（v1.123.10 起已无 UI 消费者）；
 * v1.123.27：遗留锚点系统退役（scroll variant / HomeScrollAvailability / resolveHomeScrollAnchor /
 * homeSupplyEntryOwner / homeLandEntryOwner 全删）——主入口已全部走独立页 navigate，
 * resolveHomeSearch 无 scroll 产出，挂载 id 的卡已随第三批死 DOM 清理移除；
 * 保留搜索模式 / 关键词路由 / pending query（v122 壳层与 listing-filter/school 消费）。
 */

export type HomeSearchMode = "school" | "listing" | "page";

/** 五栏改版后的统一找房入口模式。旧 school 路由仍保留深链兼容。 */
export type FindHubMode = "listing" | "community" | "school";

export const HOME_SEARCH_MODES: { key: HomeSearchMode; label: string; placeholder: string }[] = [
  { key: "school", label: "学校", placeholder: "搜学校名，如 实验、外国语" },
  { key: "listing", label: "房源", placeholder: "去房源页按区/总价筛选" },
  { key: "page", label: "本页", placeholder: "宏观 / 网签 / 库存 / 70城…" }
];

/** 本页搜索关键词 → 独立页（不再滚锚点） */
const PAGE_KEYWORD_ROUTES: Array<{
  keys: string[];
  resolve: HomeSearchResolve;
}> = [
  { keys: ["宏观", "gdp", "经济", "固投", "建筑"], resolve: { kind: "navigate", path: "/pages/macro-region/macro-region" } },
  { keys: ["70", "七十", "指数", "stats"], resolve: { kind: "navigate", path: "/pages/stats70/stats70" } },
  { keys: ["网签", "成交量"], resolve: { kind: "navigate", path: "/pages/wangqian/wangqian" } },
  { keys: ["库存", "可售", "供需", "计划入市", "保障房"], resolve: { kind: "navigate", path: "/pages/supply/supply?focus=inventory" } },
  { keys: ["土地", "地块"], resolve: { kind: "navigate", path: "/pages/supply/supply?focus=land" } },
  { keys: ["利率", "lpr", "房贷"], resolve: { kind: "navigate", path: "/pages/macro-rates/macro-rates" } },
  { keys: ["学校", "学区", "教育"], resolve: { kind: "school", q: "" } },
  { keys: ["工具", "派生"], resolve: { kind: "navigate", path: "/pages/data-tools/data-tools" } },
  { keys: ["通勤", "地铁"], resolve: { kind: "navigate", path: "/pages/data-tools/data-tools" } }
];

export type HomeSearchResolve =
  | { kind: "school"; q: string }
  | { kind: "listing"; path: string; q: string }
  | { kind: "navigate"; path: string }
  | { kind: "none"; reason: string };

let pendingSchoolQuery = "";
let pendingListingQuery = "";
let pendingFindMode: FindHubMode | null = null;

export function setPendingFindMode(mode: FindHubMode): void {
  pendingFindMode = mode;
}

/** 消费一次找房模式；避免后续返回 Tab 时反复覆盖用户当前选择。 */
export function takePendingFindMode(): FindHubMode | null {
  const mode = pendingFindMode;
  pendingFindMode = null;
  return mode;
}

export function setPendingSchoolQuery(q: string): void {
  pendingSchoolQuery = String(q ?? "").trim();
}

export function takePendingSchoolQuery(): string {
  const q = pendingSchoolQuery;
  pendingSchoolQuery = "";
  return q;
}

export function setPendingListingQuery(q: string): void {
  pendingListingQuery = String(q ?? "").trim();
}

export function takePendingListingQuery(): string {
  const q = pendingListingQuery;
  pendingListingQuery = "";
  return q;
}

export function resolveHomeSearch(mode: HomeSearchMode, raw: string): HomeSearchResolve {
  const q = String(raw ?? "").trim();
  if (mode === "school") {
    if (!q) return { kind: "none", reason: "请输入学校关键字" };
    return { kind: "school", q };
  }
  if (mode === "listing") {
    return { kind: "listing", path: "/pages/listing-filter/listing-filter", q };
  }
  if (!q) return { kind: "none", reason: "请输入本页关键词，如 宏观 / 网签" };
  const lower = q.toLowerCase();
  for (const row of PAGE_KEYWORD_ROUTES) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()))) {
      if (row.resolve.kind === "school") {
        return { kind: "school", q: q || "学校" };
      }
      return row.resolve;
    }
  }
  return { kind: "none", reason: "未识别关键词，可试：宏观、网签、库存、70城、工具" };
}

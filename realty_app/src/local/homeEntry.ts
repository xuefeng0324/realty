/**
 * 总览首页多入口配置（F-ENTRY-01）
 * 对照：美团定位+搜索、淘宝/拼多多频道+金刚区；房价三轴不误标成交价。
 */

export type HomeSearchMode = "school" | "listing" | "page";

export type HomeChannelKey =
  | "price"
  | "wangqian"
  | "macro"
  | "supply"
  | "amenity"
  | "tools";

export type HomeEntryTone = "blue" | "green" | "red" | "amber" | "violet" | "rose" | "slate";

export type HomeKingkongAction =
  | { kind: "tab"; tab: "overview" | "price" | "school" | "transit" | "map" }
  | { kind: "switchTab"; path: string }
  | { kind: "navigate"; path: string }
  | { kind: "scroll"; anchor: string }
  | { kind: "city" }
  | { kind: "period" };

export interface HomeChannel {
  key: HomeChannelKey;
  label: string;
  anchor: string;
}

export interface HomeKingkongItem {
  key: string;
  icon: string;
  label: string;
  tone: HomeEntryTone;
  action: HomeKingkongAction;
}

export const HOME_SEARCH_MODES: { key: HomeSearchMode; label: string; placeholder: string }[] = [
  { key: "school", label: "学校", placeholder: "搜学校名，如 实验、外国语" },
  { key: "listing", label: "房源", placeholder: "去房源页按区/总价筛选" },
  { key: "page", label: "本页", placeholder: "宏观 / 网签 / 库存 / 70城…" }
];

export const HOME_CHANNELS: HomeChannel[] = [
  { key: "price", label: "房价", anchor: "entry-stats70" },
  { key: "wangqian", label: "网签", anchor: "overview-wangqian" },
  { key: "macro", label: "宏观", anchor: "entry-macro" },
  { key: "supply", label: "供需", anchor: "entry-supply" },
  { key: "amenity", label: "配套", anchor: "overview-school" },
  { key: "tools", label: "工具", anchor: "overview-lpr" }
];

export const HOME_KINGKONG: HomeKingkongItem[] = [
  { key: "listing", icon: "🏠", label: "房源", tone: "green", action: { kind: "switchTab", path: "/pages/listing-filter/listing-filter" } },
  { key: "school", icon: "🏫", label: "学校", tone: "amber", action: { kind: "switchTab", path: "/pages/school/school" } },
  { key: "map", icon: "🗺️", label: "地图", tone: "blue", action: { kind: "switchTab", path: "/pages/map-view/map-view" } },
  { key: "wangqian", icon: "📋", label: "网签", tone: "red", action: { kind: "navigate", path: "/pages/wangqian/wangqian" } },
  { key: "stats70", icon: "📈", label: "70城", tone: "violet", action: { kind: "navigate", path: "/pages/stats70/stats70" } },
  { key: "macro", icon: "🏛️", label: "宏观", tone: "slate", action: { kind: "navigate", path: "/pages/macro-region/macro-region" } },
  { key: "inventory", icon: "🏗️", label: "库存", tone: "amber", action: { kind: "scroll", anchor: "entry-supply" } },
  { key: "land", icon: "🗺️", label: "土地", tone: "green", action: { kind: "scroll", anchor: "entry-land" } },
  { key: "price-tab", icon: "💰", label: "价格", tone: "red", action: { kind: "tab", tab: "price" } },
  { key: "settings", icon: "⚙️", label: "设置", tone: "rose", action: { kind: "switchTab", path: "/pages/settings/settings" } }
];

/** 本页搜索关键词 → 锚点（小写匹配） */
const PAGE_KEYWORD_ANCHORS: Array<{ keys: string[]; anchor: string }> = [
  { keys: ["宏观", "gdp", "经济", "固投", "建筑"], anchor: "entry-macro" },
  { keys: ["70", "七十", "指数", "stats"], anchor: "entry-stats70" },
  { keys: ["网签", "成交量"], anchor: "overview-wangqian" },
  { keys: ["库存", "可售", "供需", "计划入市", "保障房"], anchor: "entry-supply" },
  { keys: ["土地", "地块"], anchor: "entry-land" },
  { keys: ["利率", "lpr", "房贷"], anchor: "overview-lpr" },
  { keys: ["学校", "学区", "教育"], anchor: "overview-school" },
  { keys: ["通勤", "地铁"], anchor: "overview-transit" }
];

export type HomeSearchResolve =
  | { kind: "school"; q: string }
  | { kind: "listing"; path: string; q: string }
  | { kind: "scroll"; anchor: string }
  | { kind: "none"; reason: string };

let pendingSchoolQuery = "";
let pendingListingQuery = "";

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
  for (const row of PAGE_KEYWORD_ANCHORS) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()))) {
      return { kind: "scroll", anchor: row.anchor };
    }
  }
  return { kind: "none", reason: "未识别关键词，可试：宏观、网签、库存、70城" };
}

export function homeKingkongCount(): number {
  return HOME_KINGKONG.length;
}

/** 首页滚动锚点在当前城市下的可达性（库存/土地按城挂 id） */
export type HomeScrollAvailability = {
  hasGzInventory: boolean;
  hasSzPlannedSupply: boolean;
  hasGzHousingPlan: boolean;
  hasZhAffordable: boolean;
  /** 珠海不动产登记季报（日更网签备选量能） */
  hasZhBdcRegistration: boolean;
  /** 当前城有深广式日更网签 */
  hasDailyWangqian: boolean;
  hasGzLand: boolean;
  hasSzLand: boolean;
};

export type HomeScrollResolve =
  | { kind: "ok"; id: string }
  | { kind: "missing"; reason: string };

/**
 * 将配置锚点解析为实际 DOM id。
 * entry-supply / entry-land 在深圳原先只绑广州卡，导致金刚区「库存」「土地」空点。
 */
export function resolveHomeScrollAnchor(
  anchor: string,
  avail: HomeScrollAvailability
): HomeScrollResolve {
  if (anchor === "entry-supply") {
    if (
      avail.hasGzInventory ||
      avail.hasSzPlannedSupply ||
      avail.hasGzHousingPlan ||
      avail.hasZhAffordable
    ) {
      return { kind: "ok", id: "entry-supply" };
    }
    return { kind: "missing", reason: "当前城市暂无库存/供应数据卡" };
  }
  if (anchor === "entry-land") {
    if (avail.hasGzLand || avail.hasSzLand) {
      return { kind: "ok", id: "entry-land" };
    }
    return { kind: "missing", reason: "当前城市暂无土地成交卡" };
  }
  // 珠海无日更网签时，「网签」频道滚到不动产登记季报（对照：竞品量能入口不空跳）
  if (anchor === "overview-wangqian" || anchor === "entry-zh-bdc-registration") {
    if (avail.hasDailyWangqian) {
      return { kind: "ok", id: "overview-wangqian" };
    }
    if (avail.hasZhBdcRegistration) {
      return { kind: "ok", id: "entry-zh-bdc-registration" };
    }
    if (anchor === "entry-zh-bdc-registration") {
      return { kind: "missing", reason: "当前城市暂无网签日更或登记季报" };
    }
    return { kind: "ok", id: "overview-wangqian" };
  }
  return { kind: "ok", id: anchor };
}

/** 哪张卡挂 entry-supply（互斥，避免重复 id） */
export function homeSupplyEntryOwner(
  avail: HomeScrollAvailability
): "gz" | "sz" | "gz-plan" | "zh" | null {
  if (avail.hasGzInventory) return "gz";
  if (avail.hasSzPlannedSupply) return "sz";
  if (avail.hasGzHousingPlan) return "gz-plan";
  if (avail.hasZhAffordable) return "zh";
  return null;
}

/** 哪张卡挂 entry-land */
export function homeLandEntryOwner(avail: HomeScrollAvailability): "gz" | "sz" | null {
  if (avail.hasGzLand) return "gz";
  if (avail.hasSzLand) return "sz";
  return null;
}

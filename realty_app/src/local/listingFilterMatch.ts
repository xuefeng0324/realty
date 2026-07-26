/**
 * 房源筛选语义对齐：UI 文案 ↔ 种子/爬取字段实际取值。
 * 房屋类型主轴：二手房 / 新房；成交为可选样本（种子通常很少）。
 */

/** 装修筛选项（须覆盖样本库高频值） */
export const DECORATE_FILTER_OPTIONS = ["不限", "精装", "豪装", "普装", "简装", "毛坯"] as const;

/** 房屋类型 UI 选项（贝壳式：二手 / 新房；另保留成交样本） */
export const LISTING_TYPE_FILTER_OPTIONS = ["全部", "二手房", "新房", "成交"] as const;

const USED = new Set(["二手房", "二手", "在售", "挂牌在售", "挂牌"]);
const NEW_HOME = new Set(["新房", "新盘", "期房", "楼盘"]);
const SOLD = new Set(["成交", "成交样本", "已成交", "成交房", "网签成交"]);

/**
 * 二手房 / 新房按字段精确+别名；「在售」兼容旧调用=二手+新房挂牌；成交走成交别名。
 */
export function matchesListingTypeFilter(
  actual: string | null | undefined,
  filter: string | undefined
): boolean {
  if (!filter || filter === "all" || filter === "全部") return true;
  const a = String(actual ?? "").trim();
  if (!a) return false;
  if (a === filter) return true;
  if (filter === "二手房" || filter === "二手") return USED.has(a);
  if (filter === "新房") return NEW_HOME.has(a);
  if (filter === "在售" || filter === "挂牌在售") return USED.has(a) || NEW_HOME.has(a);
  if (filter === "成交" || filter === "成交样本") return SOLD.has(a);
  return false;
}

export function matchesDecorateTypeFilter(
  actual: string | null | undefined,
  filter: string | undefined
): boolean {
  if (!filter || filter === "不限") return true;
  const a = String(actual ?? "").trim();
  return a === filter;
}

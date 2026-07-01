/**
 * 本地数据层的数据模型。
 * 与 backend SQLAlchemy 模型保持字段同名，但用 camelCase 风格。
 */

export interface LocalCity {
  cityId: number;
  cityCode: string;
  cityName: string;
}

export interface LocalCommunity {
  communityId: number;
  cityId: number;
  districtName: string | null;
  communityName: string;
}

export interface LocalSchool {
  schoolId: number;
  cityId: number;
  officialName: string;
  displayName: string | null;
  schoolType: string | null;
  provinceKeyFlag: boolean | null;
  cityKeyFlag: boolean | null;
}

export interface LocalSchoolIndicator {
  schoolId: number;
  /** Latest snapshot for that school. */
  latestLevelScoreRaw: number | null;
  groupSchoolFlagRaw: boolean | null;
  groupSchoolStrengthRaw: number | null;
  districtBalanceLevelRaw: number | null;
  trendDeltaRaw: number | null;
}

export interface LocalListing {
  listingId: number;
  cityId: number;
  communityId: number;
  title: string;
  source: string | null;
  sourceListingId: string | null;
  sourceUrl: string | null;
  totalPrice10k: number | null;
  unitPrice: number | null;
  areaSqm: number | null;
  listingType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  orientation: string | null;
  floorNumber: string | null;
  hasElevator: boolean | null;
  decorateType: string | null;
  buildYear: number | null;
  nearestMetroDistanceM: number | null;
  schoolIdsJson: string | null;
  tagsJson: string | null;
  crawlDate: string | null;
}

export interface LocalWeekRange {
  weekStartDate: string;
  weekEndDate: string;
}

/**
 * 国家统计局 70 城价格指数的单条记录。
 * 字段对齐 `realty_app/scripts/crawl_stats_70.py` 输出的窄表格式。
 *
 * date         YYYY/M/D      数据月份（每月 1 号）
 * city                        城市名（按统计局当前口径，无"市"后缀）
 * fixed_base   同比 / 环比    指数类型
 * new_idx      number | null  新建商品住宅指数
 * second_idx   number | null  二手住宅指数
 */
export interface LocalStats70Row {
  date: string;
  city: string;
  fixed_base: "同比" | "环比";
  new_idx: number | null;
  second_idx: number | null;
}

/** 政府网签日更（`scripts/crawl_daily_wangqian.py` 输出）。 */
export interface LocalDailyWangqianRow {
  date: string;
  city: string;
  category: "新房" | "二手";
  district: string;
  units: number;
  area_sqm: number;
  granularity: "city" | "district";
  source_url: string;
}

export interface DataSnapshot {
  importedAt: string;
  source: string;
  cities: LocalCity[];
  communities: LocalCommunity[];
  schools: LocalSchool[];
  schoolIndicators: LocalSchoolIndicator[];
  listings: LocalListing[];
  /** Available weeks that have at least one listing. */
  availableWeeks: LocalWeekRange[];
}
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
  /**
   * 统计口径：
   * - 住宅：走势页 getFjzsInfoData（商品住房，可回溯 90 天）
   * - 全部：分区公示 getEsf/YsfCjxxGsDataNew（含非住宅二手，仅最新日）
   */
  scope: "住宅" | "全部";
  district: string;
  units: number;
  area_sqm: number;
  /** city/district = 日更；month/month_district = 最近完整月累计 */
  granularity: "city" | "district" | "month" | "month_district";
  source_url: string;
}

/**
 * 高德周边 POI（`scripts/crawl_amap_poi.py` 输出）。
 * 字段对齐 poi_seed.csv；category ∈ {subway, school, hospital, mall, park}
 */
export interface LocalPoi {
  communityId: number;
  poiCategory: "subway" | "school" | "hospital" | "mall" | "park";
  poiRank: number;
  poiName: string;
  poiType: string;
  distanceM: number;
  lat: number;
  lng: number;
  address: string;
}

/**
 * 医院清单（`scripts/seed_hospitals.py` + `crawl_amap_hospital.py`）。
 * 与 schools.csv 类似的扁平表，用于：
 *  - 城市/区/医院等级/类型的筛选
 *  - listing/community 详情展示"周边医院 Top N"
 */
export interface LocalHospital {
  hospitalId: number;
  cityId: number;
  officialName: string;
  displayName: string | null;
  hospitalType: string | null;
  hospitalLevel: "三甲" | "三级" | "二甲" | "二级" | "其他" | null;
  districtName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  keyFlag: boolean | null;
}

/**
 * 规划/在建地铁线路（`scripts/seed_metro_planning.py`）。
 * 用于 listing/community 详情展示"未来周边地铁"，
 * 帮用户评估"地铁规划受益度"。
 */
/**
 * 板块级周维度网签热度（`scripts/build_wangqian_heatmap.py`）。
 * 由 daily_wangqian.csv (granularity=district) 按 (城市/区/类别/周) 聚合，
 * 用于 dashboard 展示"近 N 天网签热度榜"。
 */
export interface LocalWangqianDistrictWeekly {
  city: string;            // "深圳" / "广州"
  district: string;        // "南山区"
  category: "新房" | "二手" | "其他";
  weekEnd: string;         // YYYY-MM-DD (周日)
  days: number;            // 该周实际有数据的天数 (3-7)
  totalUnits: number;      // 累计成交套数
  totalAreaSqm: number;    // 累计成交面积 (㎡)
  avgDailyUnits: number;
  avgDailyAreaSqm: number;
}

/**
 * 板块级学区溢价（`scripts/compute_school_premium.py`）。
 * 由 listings + schools + school_indicators 聚合得到。
 * 用于 dashboard "学区溢价榜" 卡片。
 */
export interface LocalSchoolPremiumDistrict {
  cityId: number;
  districtName: string;
  schoolCount: number;
  avgSchoolScore: number;
  listingCount: number;
  medianUnitPrice: number;
  cityMedianUnitPrice: number;
  /** (区均价 / 全市均价 - 1), e.g. 0.27 = +27% */
  premiumRatio: number;
}

export interface LocalSchoolPremiumCommunity {
  communityId: number;
  cityId: number;
  districtName: string;
  communityName: string;
  schoolCount: number;
  avgSchoolScore: number;
  listingCount: number;
  medianUnitPrice: number;
}

export interface LocalMetroLine {
  lineId: number;
  cityId: number;
  lineName: string;
  phase: string | null;
  status: "规划" | "在建" | "即将开通" | null;
  lengthKm: number | null;
  stationCount: number | null;
  startStation: string | null;
  endStation: string | null;
  maxSpeedKmh: number | null;
  openYearExpected: number | null;
  /** 用 `;` 分隔的区名列表（与 LocalCommunity.districtName 匹配） */
  districts: string[];
  notes: string | null;
}

/**
 * 地铁规划线的站点坐标（v0.15.0）。
 * 用于在 map-view 画 polyline（起点 → 终点直线连接）。
 */
export interface LocalMetroLineGeo {
  lineId: number;
  lineName: string;
  cityId: number;
  startStation: string;
  endStation: string;
  startLat: number | null;
  startLng: number | null;
  startConfidence: "high" | "medium" | "low" | "manual" | "missing";
  endLat: number | null;
  endLng: number | null;
  endConfidence: "high" | "medium" | "low" | "manual" | "missing";
}

/**
 * 天气预报条目（v0.16.0）。
 * report_type=live 时, weather/temperature/winddirection/windpower/humidity 有值,
 * forecast_json 为空。report_type=forecast 时, forecast_json 存 4 天 JSON 数组。
 */
export interface LocalWeather {
  cityId: number;
  cityName: string;
  adcode: string;
  reportType: "live" | "forecast";
  reportTime: string;
  weather: string;
  temperature: string;
  winddirection: string;
  windpower: string;
  humidity: string;
  forecastJson: string;
}

/**
 * 预报日条目（解析 forecast_json 后用）。
 */
export interface LocalWeatherForecastDay {
  date: string;
  week: string;
  dayweather: string;
  nightweather: string;
  daytemp: string;
  nighttemp: string;
  daywind: string;
  nightwind: string;
  daypower: string;
  nightpower: string;
}

/**
 * 单个 listing 的学区评分 + 溢价率（v0.17.0 trend-6）。
 * 由 `scripts/compute_listing_school_premium.py` 生成。
 */
export interface LocalListingSchoolPremium {
  listingId: number;
  cityId: number;
  districtName: string;
  communityId: number;
  schoolCount: number;
  avgSchoolScore: number;
  premiumRatioEst: number;
}

/**
 * 小区商业热度评分（v0.19.0 new-2）。
 * 由 `scripts/seed_commercial_poi.py` + `compute_commercial_density.py` 生成。
 * 餐饮 + 银行 + 便利店 3 类 POI 加权，0..100 整数。
 */
export interface LocalCommunityCommercial {
  communityId: number;
  cityId: number;
  districtName: string;
  communityName: string;
  restaurantCount: number;
  bankCount: number;
  convenienceCount: number;
  nearestRestaurantM: number | null;
  nearestBankM: number | null;
  nearestConvenienceM: number | null;
  commercialScore: number;
}

/**
 * 通勤时长（v0.24.0 new-5）。
 * community → 城市 CBD (深圳福田CBD / 广州珠江新城) 公交通勤方案。
 * 由 `scripts/crawl_amap_commute.py` 生成。
 */
export interface LocalCommute {
  communityId: number;
  cityId: number;
  cityName: string;
  cbdName: string;
  cbdLat: number;
  cbdLng: number;
  /** 第一方案的预期时长 (分钟)，可能为 null (API 失败) */
  transitMinutes: number | null;
  /** 总距离 (米) */
  transitDistanceM: number | null;
}

/**
 * v0.25.0: 户型/面积/朝向/装修分布
 * (scripts/compute_layout_distribution.py)
 * 每个 row 是 (city_id, dimension, bucket) 一个聚合桶
 */
export interface LocalLayoutDistribution {
  cityId: number;
  cityName: string;
  /** 维度：bedrooms / area_sqm / orientation / decorate */
  dimension: "bedrooms" | "area_sqm" | "orientation" | "decorate";
  /** bucket 名 (如 "3室", "80-110", "南北通透", "精装") */
  bucket: string;
  count: number;
  share: number;
  medianUnitPrice: number | null;
  avgAreaSqm: number | null;
}

/**
 * v0.28.0: 房源标签 (scripts/compute_listing_tags.py)
 * 每个 row 是 (listing_id, tag) 一对。
 */
export interface LocalListingTag {
  listingId: number;
  cityId: number;
  districtName: string;
  tag: string;
}

/**
 * v0.29.0: 区级房价指数 (scripts/compute_district_index.py)
 * index_value = 该区 baseline 中位价对应 100 基准
 */
export interface LocalDistrictIndex {
  cityId: number;
  districtName: string;
  weekEnd: string;
  medianUnitPrice: number;
  /** 指数 (>= 100 表示高于 baseline) */
  indexValue: number;
  /** 周环比变化 % (空 = 无前一周期数据) */
  momChange: number | null;
  /** 同比变化 % (空 = 无去年同期数据) */
  yoyChange: number | null;
  listingCount: number;
}

/**
 * v0.32.0: 生活便利度综合分 (scripts/compute_life_convenience.py)
 * 满分 110, 6 维度 (mall/park/subway/school/hospital/market) 加权
 */
export interface LocalLifeConvenience {
  communityId: number;
  cityId: number;
  districtName: string;
  communityName: string;
  mallNear: number;
  parkNear: number;
  subwayNear: number;
  schoolNear: number;
  hospitalNear: number;
  marketNear: number;
  /** 综合分 (0-110) */
  score: number;
  /** 归一化 (0-100)，score / 110 * 100 */
  score100: number;
}

/**
 * v0.33.0: 小区综合评分 v2 (scripts/compute_community_score.py)
 * 满分 100, 3 维度加权: 生活(50%) + 学区(30%) + 通勤(20%)
 */
export interface LocalCommunityScore {
  communityId: number;
  cityId: number;
  districtName: string;
  communityName: string;
  /** 生活便利度 (0-100) */
  lifeScore: number;
  /** 学区评分 (0-100) */
  schoolScore: number;
  /** 最近 CBD 通勤分钟 (无则 null) */
  commuteMinutes: number | null;
  /** 通勤分 (0-100, 由 minutes 换算) */
  commuteScore: number;
  /** 综合分 (0-100) */
  totalScore: number;
  /** 该城市内排名 (1-based) */
  rankCity: number;
}

/**
 * v0.35.0: 步行到最近地铁站 (scripts/crawl_amap_metro_walk.py)
 * source: AMAP_API (高德实际) 或 ESTIMATED (启发式: 直线×1.45/80m·min⁻¹)
 */
export interface LocalMetroWalk {
  communityId: number;
  cityId: number;
  communityName: string;
  stationName: string;
  stationLat: number;
  stationLng: number;
  straightM: number;
  walkDistanceM: number;
  walkMinutes: number;
  source: "AMAP_API" | "ESTIMATED" | "";
}

/**
 * v0.36.0: 地铁规划受益 (scripts/compute_metro_benefit.py)
 * 取每小区到最近规划/在建地铁站 (start or end) 的距离，按 status 权重算 0-100 受益分
 */
export interface LocalMetroBenefit {
  communityId: number;
  cityId: number;
  districtName: string;
  communityName: string;
  nearestLineId: number;
  nearestLineName: string;
  nearestLineStatus: "规划" | "在建" | "即将开通" | "";
  nearestStationName: string;
  nearestDistanceM: number;
  openYearExpected: number | null;
  /** 0-100, 综合距离 + status 权重 */
  benefitScore: number;
}

/**
 * v0.38.0: 区情画像 (scripts/compute_district_metadata.py)
 * join 4 类 csv, 每 (city, district) 一行画像
 */
export interface LocalDistrictMeta {
  cityId: number;
  districtName: string;
  adminCode: string;
  areaCode: string;
  communityCount: number;
  listingCount: number;
  medianBuildYear: number | null;
  medianUnitPrice: number | null;
  indexValue: number | null;
  momChangePct: number | null;
  yoyChangePct: number | null;
  avgSchoolScore: number | null;
  premiumRatioPct: number | null;
  schoolCount: number;
}

/**
 * v0.39.0: 特征画像溢价 (scripts/compute_feature_premium.py)
 * 每 (city, dimension, bucket) 算 (bucket median / city median - 1) * 100
 */
export interface LocalFeaturePremium {
  cityId: number;
  cityName: string;
  dimension: "bedrooms" | "area_sqm" | "orientation" | "decorate";
  bucket: string;
  count: number;
  share: number;
  medianUnitPrice: number;
  cityMedianUnitPrice: number;
  premiumPct: number;
}

/**
 * 板块级周维度价格序列（`scripts/compute_district_trend.py`）。
 * 由 listings.csv 按 (city_id, district_name, week_end) 聚合，
 * 用于 dashboard 展示"区级近 N 周房价趋势"。
 */
export interface LocalDistrictTrend {
  cityId: number;
  districtName: string;
  weekEnd: string;
  listingCount: number;
  avgUnitPrice: number;
  medianUnitPrice: number;
  minUnitPrice: number;
  maxUnitPrice: number;
}

export interface DataSnapshot {
  importedAt: string;
  source: string;
  cities: LocalCity[];
  communities: LocalCommunity[];
  schools: LocalSchool[];
  schoolIndicators: LocalSchoolIndicator[];
  listings: LocalListing[];
  /** v0.4.2: 高德周边 POI (community_id × poi_category) */
  pois: LocalPoi[];
  /** v0.6.0: 医院清单 */
  hospitals: LocalHospital[];
  /** v0.7.0: 规划/在建地铁线路 */
  metroLines: LocalMetroLine[];
  metroLineGeos: LocalMetroLineGeo[];
  /** v0.8.0: 板块级周维度价格序列 */
  districtTrends: LocalDistrictTrend[];
  /** v0.10.0: 板块级周维度网签热度 (深广政府网签) */
  wangqianDistrictWeekly: LocalWangqianDistrictWeekly[];
  /** v0.11.0: 板块级学区溢价 (按区聚合) */
  schoolPremiumDistricts: LocalSchoolPremiumDistrict[];
  /** v0.11.0: 小区级学区评分 (按小区聚合) */
  schoolPremiumCommunities: LocalSchoolPremiumCommunity[];
  /** v0.16.0: 实时天气 + 4 天预报 (高德 weather API) */
  weather: LocalWeather[];
  /** v0.17.0: listing 维度学区评分 + 溢价率 (scripts/compute_listing_school_premium.py) */
  listingSchoolPremia: LocalListingSchoolPremium[];
  /** v0.19.0: 小区商业热度评分 (scripts/compute_commercial_density.py) */
  communityCommercials: LocalCommunityCommercial[];
  /** v0.24.0: 通勤时长 (community → 城市 CBD 公交通勤) (scripts/crawl_amap_commute.py) */
  commutes: LocalCommute[];
  /** v0.25.0: 户型/面积/朝向/装修分布 (scripts/compute_layout_distribution.py) */
  layoutDistributions: LocalLayoutDistribution[];
  /** v0.28.0: 房源 tags 列表 (scripts/compute_listing_tags.py) */
  listingTags: LocalListingTag[];
  /** v0.29.0: 区级房价指数 (scripts/compute_district_index.py) */
  districtIndices: LocalDistrictIndex[];
  /** v0.31.0: 生活便利度 (scripts/compute_life_convenience.py) */
  lifeConveniences: LocalLifeConvenience[];
  /** v0.33.0: 小区综合评分 (scripts/compute_community_score.py) */
  communityScores: LocalCommunityScore[];
  /** v0.35.0: 步行到最近地铁站 (scripts/crawl_amap_metro_walk.py) */
  metroWalks: LocalMetroWalk[];
  /** v0.36.0: 地铁规划受益 (scripts/compute_metro_benefit.py) */
  metroBenefits: LocalMetroBenefit[];
  /** v0.38.0: 区情画像 (scripts/compute_district_metadata.py) */
  districtMeta: LocalDistrictMeta[];
  /** v0.39.0: 特征画像溢价 (scripts/compute_feature_premium.py) */
  featurePremia: LocalFeaturePremium[];
  /** Available weeks that have at least one listing. */
  availableWeeks: LocalWeekRange[];
}
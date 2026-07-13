/**
 * 应用默认启动时使用的"真数据快照"。
 *
 * 默认值（基于公开政策 & 国家统计局 70 城指数派生）从 `static/seed/` 加载。
 * 这一组 CSV 是 `scripts/seed_real_data.py` 跑出来的，
 * 包含 532 条 listings（来自 10 个南山/福田/龙岗/龙华 的公开楼盘），
 * 价格基于 70 城月度同比指数做时间序列波动。
 *
 * 用户首次启动会落到这里，而非程序生成的伪随机 demo 数据。
 * 后续切到"下载 CSV"或"HTTP 后端"模式会覆盖。
 */
import { parseCSV, rowsToObjects } from "./csv";
import { importSnapshot } from "./importer";
import type { DataSnapshot } from "./types";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vite ?raw 注入
import citiesCSV from "../../static/seed/cities.csv?raw";
// @ts-ignore
import communitiesCSV from "../../static/seed/communities.csv?raw";
// @ts-ignore
import schoolsCSV from "../../static/seed/schools.csv?raw";
// @ts-ignore
import schoolIndicatorsCSV from "../../static/seed/school_indicators.csv?raw";
// @ts-ignore
import listingsCSV from "../../static/seed/listings.csv?raw";
// v0.4.2 POI
// @ts-ignore
import poisCSV from "../../static/seed/poi_seed.csv?raw";
// v0.6.0 医院清单
// @ts-ignore
import hospitalsCSV from "../../static/seed/hospitals.csv?raw";
// v0.7.0 地铁规划
// @ts-ignore
import metroPlanningCSV from "../../static/seed/metro_planning.csv?raw";
// v0.8.0 板块级房价序列
// @ts-ignore
import districtTrendCSV from "../../static/seed/district_trend.csv?raw";
// v0.10.0 板块级网签热度
// @ts-ignore
import wangqianDistrictWeeklyCSV from "../../static/seed/wangqian_district_weekly.csv?raw";
// v0.11.0 板块级学区溢价
// @ts-ignore
import schoolPremiumDistrictCSV from "../../static/seed/school_premium_district.csv?raw";
// v0.11.0 小区级学区评分
// @ts-ignore
import schoolPremiumCommunityCSV from "../../static/seed/school_premium_community.csv?raw";
// v0.15.0 地铁规划线坐标
// @ts-ignore
import metroPlanningGeoCSV from "../../static/seed/metro_planning_geo.csv?raw";
// v0.16.0 实时天气 + 4 天预报 (高德 weather API)
// @ts-ignore
import weatherCSV from "../../static/seed/weather.csv?raw";
// v0.17.0 listing 维度学区评分 + 溢价率
// @ts-ignore
import listingSchoolPremiumCSV from "../../static/seed/listing_school_premium.csv?raw";
// v0.19.0 小区商业热度评分 (高德 POI 餐饮/银行/便利店)
// @ts-ignore
import communityCommercialCSV from "../../static/seed/community_commercial.csv?raw";
// v0.24.0 通勤时长 (高德 direction/transit API)
// @ts-ignore
import commuteCSV from "../../static/seed/commute.csv?raw";

// v0.25.0 户型分布 (scripts/compute_layout_distribution.py)
// @ts-ignore
import layoutDistributionCSV from "../../static/seed/layout_distribution.csv?raw";

// v0.28.0 房源 tags (scripts/compute_listing_tags.py)
// @ts-ignore
import listingTagsCSV from "../../static/seed/listing_tags.csv?raw";

// v0.29.0 区级房价指数 (scripts/compute_district_index.py)
// @ts-ignore
import districtIndexCSV from "../../static/seed/district_index.csv?raw";

// v0.31.0 生活便利度 (scripts/compute_life_convenience.py)
// @ts-ignore
import lifeConvenienceCSV from "../../static/seed/life_convenience.csv?raw";

// v0.33.0 小区综合评分 (scripts/compute_community_score.py)
// @ts-ignore
import communityScoreCSV from "../../static/seed/community_score.csv?raw";

// v0.35.0 步行到最近地铁站 (scripts/crawl_amap_metro_walk.py)
// @ts-ignore
import metroWalkCSV from "../../static/seed/metro_walk.csv?raw";

// v0.36.0 地铁规划受益 (scripts/compute_metro_benefit.py)
// @ts-ignore
import metroBenefitCSV from "../../static/seed/metro_benefit.csv?raw";
import districtMetaCSV from "../../static/seed/district_meta.csv?raw";
import featurePremiumCSV from "../../static/seed/feature_premium.csv?raw";
import tagCombinationCSV from "../../static/seed/tag_combination.csv?raw";
import listingFreshnessCSV from "../../static/seed/listing_freshness.csv?raw";
import bedroomAreaCSV from "../../static/seed/bedroom_area.csv?raw";
import orientationFloorCSV from "../../static/seed/orientation_floor.csv?raw";
import decorateAgeCSV from "../../static/seed/decorate_age.csv?raw";
import communityScatterCSV from "../../static/seed/community_scatter.csv?raw";

let cached: DataSnapshot | null = null;

/** 拿默认快照。第一次解析后缓存。 */
export function buildSeedSnapshot(): DataSnapshot {
  if (cached) return cached;
  const snap = importSnapshot(
    {
      citiesCSV: String(citiesCSV ?? ""),
      communitiesCSV: String(communitiesCSV ?? ""),
      schoolsCSV: String(schoolsCSV ?? ""),
      schoolIndicatorsCSV: String(schoolIndicatorsCSV ?? ""),
      listingsCSV: String(listingsCSV ?? ""),
      poisCSV: String(poisCSV ?? ""),
      hospitalsCSV: String(hospitalsCSV ?? ""),
      metroPlanningCSV: String(metroPlanningCSV ?? ""),
      districtTrendCSV: String(districtTrendCSV ?? ""),
      wangqianDistrictWeeklyCSV: String(wangqianDistrictWeeklyCSV ?? ""),
      schoolPremiumDistrictCSV: String(schoolPremiumDistrictCSV ?? ""),
      schoolPremiumCommunityCSV: String(schoolPremiumCommunityCSV ?? ""),
      metroPlanningGeoCSV: String(metroPlanningGeoCSV ?? ""),
      weatherCSV: String(weatherCSV ?? ""),
      listingSchoolPremiumCSV: String(listingSchoolPremiumCSV ?? ""),
      communityCommercialCSV: String(communityCommercialCSV ?? ""),
      commuteCSV: String(commuteCSV ?? ""),
      layoutDistributionCSV: String(layoutDistributionCSV ?? ""),
      listingTagsCSV: String(listingTagsCSV ?? ""),
      districtIndexCSV: String(districtIndexCSV ?? ""),
      lifeConvenienceCSV: String(lifeConvenienceCSV ?? ""),
      communityScoreCSV: String(communityScoreCSV ?? ""),
      metroWalkCSV: String(metroWalkCSV ?? ""),
      metroBenefitCSV: String(metroBenefitCSV ?? ""),
      districtMetaCSV: String(districtMetaCSV ?? ""),
      featurePremiumCSV: String(featurePremiumCSV ?? ""),
      tagCombinationCSV: String(tagCombinationCSV ?? ""),
      listingFreshnessCSV: String(listingFreshnessCSV ?? ""),
      bedroomAreaCSV: String(bedroomAreaCSV ?? ""),
      orientationFloorCSV: String(orientationFloorCSV ?? ""),
      decorateAgeCSV: String(decorateAgeCSV ?? ""),
      communityScatterCSV: String(communityScatterCSV ?? "")
    },
    "seed:public-derived"
  );
  cached = snap;
  return snap;
}

/** 用于设置页中"重置到种子真数据"按钮。 */
export function resetSeedSnapshotCache() {
  cached = null;
}

// 把 csv 解析器显式引入，避免 tree-shake 误删
void parseCSV;
void rowsToObjects;

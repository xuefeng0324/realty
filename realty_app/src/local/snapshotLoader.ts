import { importSnapshot, type SnapshotInputs } from "./importer";
import { downloadText } from "./remoteFetch";
import type { DataSnapshot } from "./types";

const REQUIRED_FILES: Array<[keyof SnapshotInputs, string]> = [
  ["citiesCSV", "cities.csv"],
  ["communitiesCSV", "communities.csv"],
  ["schoolsCSV", "schools.csv"],
  ["schoolIndicatorsCSV", "school_indicators.csv"],
  ["listingsCSV", "listings.csv"]
];

const OPTIONAL_FILES: Array<[keyof SnapshotInputs, string]> = [
  ["poisCSV", "poi_seed.csv"],
  ["hospitalsCSV", "hospitals.csv"],
  ["metroPlanningCSV", "metro_planning.csv"],
  ["districtTrendCSV", "district_trend.csv"],
  ["wangqianDistrictWeeklyCSV", "wangqian_district_weekly.csv"],
  ["schoolPremiumDistrictCSV", "school_premium_district.csv"],
  ["schoolPremiumCommunityCSV", "school_premium_community.csv"],
  ["metroPlanningGeoCSV", "metro_planning_geo.csv"],
  ["weatherCSV", "weather.csv"],
  ["listingSchoolPremiumCSV", "listing_school_premium.csv"],
  ["communityCommercialCSV", "community_commercial.csv"],
  ["commuteCSV", "commute.csv"],
  ["layoutDistributionCSV", "layout_distribution.csv"],
  ["listingTagsCSV", "listing_tags.csv"],
  ["districtIndexCSV", "district_index.csv"],
  ["lifeConvenienceCSV", "life_convenience.csv"],
  ["communityScoreCSV", "community_score.csv"],
  ["metroWalkCSV", "metro_walk.csv"],
  ["metroBenefitCSV", "metro_benefit.csv"],
  ["districtMetaCSV", "district_meta.csv"],
  ["featurePremiumCSV", "feature_premium.csv"],
  ["tagCombinationCSV", "tag_combination.csv"],
  ["listingFreshnessCSV", "listing_freshness.csv"],
  ["bedroomAreaCSV", "bedroom_area.csv"],
  ["orientationFloorCSV", "orientation_floor.csv"],
  ["decorateAgeCSV", "decorate_age.csv"],
  ["communityScatterCSV", "community_scatter.csv"],
  ["districtPolygonCSV", "district_polygon.csv"],
  ["communityGeoCSV", "communities_geo.csv"],
  ["schoolDimensionsCSV", "school_dimensions.csv"],
  ["lprHistoryCSV", "lpr_history.csv"]
];

function normalizedRoot(base: string): string {
  return base.trim().replace(/\/+$/, "");
}

async function fetchFile(root: string, filename: string, required: boolean): Promise<string> {
  const text = await downloadText(`${root}/${filename}`, required ? 20000 : 12000);
  if (text != null && text.length > 0) return text;
  if (required) throw new Error(`完整快照缺少必需文件：${filename}`);
  return "";
}

export async function loadSnapshotFromBase(base: string, source: string): Promise<DataSnapshot> {
  const root = normalizedRoot(base);
  if (!/^https?:\/\//i.test(root)) throw new Error("CSV 地址必须以 http(s):// 开头");

  const entries = await Promise.all(
    [...REQUIRED_FILES, ...OPTIONAL_FILES].map(async ([key, filename], index) => [
      key,
      await fetchFile(root, filename, index < REQUIRED_FILES.length)
    ] as const)
  );
  const inputs = Object.fromEntries(entries) as unknown as SnapshotInputs;
  const snapshot = importSnapshot(inputs, source);

  if (snapshot.cities.length === 0 || snapshot.communities.length === 0 || snapshot.listings.length === 0) {
    throw new Error("完整快照解析后缺少城市、小区或房源数据");
  }
  const communityIds = new Set(snapshot.communities.map((c) => c.communityId));
  const orphanCount = snapshot.listings.filter((l) => !communityIds.has(l.communityId)).length;
  if (orphanCount > 0) throw new Error(`完整快照存在 ${orphanCount} 条无法关联小区的房源`);

  return snapshot;
}

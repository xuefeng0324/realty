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
      schoolPremiumCommunityCSV: String(schoolPremiumCommunityCSV ?? "")
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

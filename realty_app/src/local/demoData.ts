/**
 * 程序化生成的 demo 数据。
 *
 * 作用：
 * - 不依赖外部 CSV，app 安装后第一次打开就有数据可看
 * - 数据是"真实形状"的：城市、小区、学校、房源、关联关系全齐
 * - 房源字段足够丰富（朝向/楼层/装修/电梯/地铁/学校），能触发评分规则的所有分支
 */

import type { DataSnapshot, LocalListing, LocalSchool, LocalSchoolIndicator } from "./types";
import { computeSchoolFutureScoreV1 } from "../rules/schoolScoring";
import { computeListingQualityScoreV1 } from "../rules/listingScoring";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

export function buildDemoSnapshot(cityName: string = "示例城市"): DataSnapshot {
  const cityId = 1;
  const today = new Date();
  const weekEndDate = new Date(today);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() - weekEndDate.getUTCDay()); // nearest past Sunday

  // 5 个小区
  const communityNames = ["星河湾", "翠湖天地", "翰林院", "云栖谷", "锦绣城"];
  const districts = ["福田区", "南山区", "宝安区", "龙岗区", "龙华区"];
  const communities = communityNames.map((name, i) => ({
    communityId: i + 1,
    cityId,
    districtName: districts[i],
    communityName: name
  }));

  // 3 个学校
  const schoolSpecs: Array<{
    id: number;
    name: string;
    level: number;
    group: boolean;
    strength: number;
    district: number;
    trend: number;
    province: boolean;
    city: boolean;
  }> = [
    { id: 101, name: "实验小学", level: 92, group: true, strength: 88, district: 82, trend: 0.06, province: true, city: true },
    { id: 102, name: "外国语学校", level: 78, group: false, strength: 60, district: 70, trend: 0.02, province: false, city: true },
    { id: 103, name: "新希望小学", level: 58, group: false, strength: 40, district: 55, trend: -0.03, province: false, city: false }
  ];
  const schools: LocalSchool[] = schoolSpecs.map((s) => ({
    schoolId: s.id,
    cityId,
    officialName: s.name,
    displayName: s.name,
    schoolType: "小学",
    provinceKeyFlag: s.province,
    cityKeyFlag: s.city
  }));
  const schoolIndicators: LocalSchoolIndicator[] = schoolSpecs.map((s) => ({
    schoolId: s.id,
    latestLevelScoreRaw: s.level,
    groupSchoolFlagRaw: s.group,
    groupSchoolStrengthRaw: s.strength,
    districtBalanceLevelRaw: s.district,
    trendDeltaRaw: s.trend
  }));

  // 给每个小区生成 6 套房源（共 30 套）
  const orientations = ["南", "南北", "南", "南", "东", "西", "北"];
  const decorateTypes = ["精装", "精装", "简装", "毛坯"];
  const crawlDates: string[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(weekEndDate);
    d.setUTCDate(d.getUTCDate() - i * 7);
    crawlDates.push(isoDate(d));
  }

  let listingId = 1000;
  const listings: LocalListing[] = [];
  for (const c of communities) {
    const basePrice = 50000 + communities.indexOf(c) * 15000;
    for (let i = 0; i < 6; i++) {
      const year = 2005 + randInt(0, 18); // 2005~2023
      const orientation = pick(orientations);
      const decorateType = pick(decorateTypes);
      const hasElevator = year > 2010 ? true : Math.random() > 0.4;
      const floor = randInt(2, 28);
      const bedrooms = randInt(1, 4);
      const bathrooms = bedrooms >= 3 ? randInt(1, 2) : 1;
      const area = 60 + randInt(0, 120);
      const unitPrice = Math.round(basePrice + rand(-8000, 8000));
      const metro = randInt(200, 4500);
      const schoolIds = schoolSpecs.filter(() => Math.random() > 0.6).map((s) => s.id).slice(0, 2);
      listings.push({
        listingId: listingId++,
        cityId,
        communityId: c.communityId,
        title: `${c.communityName} ${bedrooms}室${bathrooms}厅 ${area}㎡`,
        source: Math.random() > 0.5 ? "lianjia_csv" : "demo",
        sourceListingId: String(listingId),
        sourceUrl: "https://example.com/listing/" + listingId,
        totalPrice10k: Math.round((unitPrice * area) / 10000 / 10) * 10, // 保留 1 位万
        unitPrice,
        areaSqm: area,
        listingType: "在售",
        bedrooms,
        bathrooms,
        orientation,
        floorNumber: `${floor}楼`,
        hasElevator,
        decorateType,
        buildYear: year,
        nearestMetroDistanceM: metro,
        schoolIdsJson: JSON.stringify(schoolIds),
        tagsJson: null,
        crawlDate: pick(crawlDates)
      });
    }
  }

  // 计算每周可用周
  const weekEnds = new Set<string>();
  for (const l of listings) {
    if (l.crawlDate) weekEnds.add(weekEndFromDate(l.crawlDate));
  }
  const sortedWeekEnds = [...weekEnds].sort();
  const availableWeeks = sortedWeekEnds.map((we) => ({
    weekStartDate: addDays(we, -6),
    weekEndDate: we
  }));

  return {
    importedAt: new Date().toISOString(),
    source: "demo-programmatic",
    cities: [{ cityId, cityCode: "demo", cityName }],
    communities,
    schools,
    schoolIndicators,
    listings,
    availableWeeks
  };
}

function weekEndFromDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
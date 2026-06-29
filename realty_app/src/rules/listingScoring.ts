/**
 * listing_quality_score_v1 规则，对应 Python 端 `realty/backend/app/services/listing_scoring.py`。
 */

import { clamp, parseFloorNumber, type MissingFallback } from "./scoreUtils";

export interface ListingInput {
  listingId: number;
  communityId: number;
  orientation: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floorNumber: string | null;
  hasElevator: boolean | null;
  decorateType: string | null;
  buildYear: number | null;
  unitPrice: number | null;
  nearestMetroDistanceM: number | null;
}

export interface SchoolFutureForListing {
  trendScore0_100: number | null;
  provinceKeyFlag: boolean | null;
  cityKeyFlag: boolean | null;
}

export interface ListingQualityScoreResult {
  overallScore: number;
  dimensionScores: Record<string, number>;
  advantages: Array<{ label: string; confidence: number; evidence: Record<string, any> }>;
  disadvantages: Array<{ label: string; confidence: number; evidence: Record<string, any> }>;
  explainJson: Record<string, any>;
  schoolFutureScoreMax: number | null;
  schoolProvinceKeyFlagAny: boolean | null;
  schoolCityKeyFlagAny: boolean | null;
}

const ORIENTATION_MAP: Record<string, number> = {
  南: 40.0,
  南北: 36.0,
  东西: 34.0,
  东: 34.0,
  西: 28.0,
  "东/西": 34.0,
  北: 18.0,
  其他: 25.0
};

function orientationScoreV1(orientation: string | null): { score: number; used: number | null } {
  if (!orientation) return { score: 20.0, used: null };
  const o = orientation.trim();
  if (o in ORIENTATION_MAP) {
    const v = ORIENTATION_MAP[o];
    return { score: v, used: v };
  }
  if (o === "南北通透") return { score: 36.0, used: 36.0 };
  return { score: 25.0, used: 25.0 };
}

function layoutScoreV1(
  bedrooms: number | null,
  bathrooms: number | null
): { score: number; reason: string | null } {
  if (bedrooms == null) return { score: 15.0, reason: "bedrooms_missing" };
  const bdr = bedrooms;
  const bth = bathrooms != null ? bathrooms : 0;
  if (bdr >= 3 && bth >= 2) return { score: 30.0, reason: "bedrooms>=3 & bathrooms>=2" };
  if (bdr === 3) {
    if (bth === 1) return { score: 23.0, reason: "bedrooms==3 & bathrooms==1" };
    if (bth >= 2) return { score: 30.0, reason: "bedrooms==3 & bathrooms>=2" };
    return { score: 23.0, reason: "bedrooms==3 & bathrooms_unknown_or_0" };
  }
  if (bdr === 2) return { score: 20.0, reason: "bedrooms==2" };
  return { score: 10.0, reason: "bedrooms<=1" };
}

function floorScoreV1(floorNumber: string | null): { score: number; parsed: number | null } {
  if (!floorNumber) return { score: 15.0, parsed: null };
  const f = parseFloorNumber(floorNumber);
  if (f == null) return { score: 15.0, parsed: null };
  if (f >= 3 && f <= 10) return { score: 30.0, parsed: f };
  if (f >= 11 && f <= 15) return { score: 24.0, parsed: f };
  if (f >= 16 && f <= 25) return { score: 18.0, parsed: f };
  if (f > 25) return { score: 12.0, parsed: f };
  return { score: 10.0, parsed: f };
}

export function computeListingQualityScoreV1(
  listing: ListingInput,
  communityAvgUnitPrice: number | null,
  schoolsFuture: SchoolFutureForListing[],
  ruleVersion: string = "listing_quality_score_v1",
  nowDate: Date | null = null
): ListingQualityScoreResult {
  const now = nowDate ?? new Date();
  const nowYear = now.getFullYear();
  const missingFallbacks: MissingFallback[] = [];

  // --- location_score ---
  const metro = listing.nearestMetroDistanceM;
  let metroSubscore: number;
  if (metro == null) {
    metroSubscore = 30.0;
    missingFallbacks.push({ field: "nearest_metro_distance_m", policy: "set_to_30", reason: "NULL" });
  } else if (metro < 500) {
    metroSubscore = 60.0;
  } else if (metro < 1000) {
    metroSubscore = 50.0;
  } else if (metro < 2000) {
    metroSubscore = 35.0;
  } else {
    metroSubscore = 20.0;
  }

  const schoolScores = schoolsFuture
    .map((s) => (s != null ? s.trendScore0_100 : null))
    .filter((s): s is number => s != null);
  const schoolFutureScoreMax = schoolScores.length > 0 ? Math.max(...schoolScores) : null;

  let schoolSubscore: number;
  if (schoolFutureScoreMax == null) {
    schoolSubscore = 20.0;
    missingFallbacks.push({ field: "school_future_scores", policy: "set_to_20", reason: "EMPTY" });
  } else {
    schoolSubscore = clamp(Math.round((0.8 * schoolFutureScoreMax + 8) * 100) / 100, 0.0, 40.0);
  }
  const locationScore = clamp(metroSubscore + schoolSubscore, 0.0, 100.0);

  // --- house_quality_score ---
  const orientationSc = orientationScoreV1(listing.orientation).score;
  if (listing.orientation == null) {
    missingFallbacks.push({ field: "orientation", policy: "set_to_20", reason: "NULL" });
  }

  const layoutRes = layoutScoreV1(listing.bedrooms, listing.bathrooms);
  if (listing.bedrooms == null) {
    missingFallbacks.push({ field: "bedrooms", policy: "set_layout_to_15", reason: "NULL" });
  }

  const floorRes = floorScoreV1(listing.floorNumber);
  if (listing.floorNumber == null || floorRes.parsed == null) {
    missingFallbacks.push({
      field: "floor_number",
      policy: "set_to_15",
      reason: "NULL_OR_UNPARSEABLE"
    });
  }
  const houseQualityScore = clamp(orientationSc + layoutRes.score + floorRes.score, 0.0, 100.0);

  // --- building_age_score ---
  let buildingAgeScore: number;
  if (listing.buildYear == null) {
    buildingAgeScore = 50.0;
    missingFallbacks.push({ field: "build_year", policy: "set_to_50", reason: "NULL" });
  } else {
    const age = nowYear - Number(listing.buildYear);
    if (age < 5) buildingAgeScore = 95.0;
    else if (age < 10) buildingAgeScore = 85.0;
    else if (age < 15) buildingAgeScore = 75.0;
    else if (age < 20) buildingAgeScore = 60.0;
    else buildingAgeScore = 40.0;
  }
  buildingAgeScore = clamp(buildingAgeScore, 0.0, 100.0);

  // --- amenity_score ---
  let elevatorSubscore: number;
  if (listing.hasElevator == null) {
    elevatorSubscore = 30.0;
    missingFallbacks.push({ field: "has_elevator", policy: "set_to_30", reason: "NULL" });
  } else {
    elevatorSubscore = listing.hasElevator ? 60.0 : 25.0;
  }

  let decorateSubscore: number;
  if (!listing.decorateType) {
    decorateSubscore = 20.0;
    missingFallbacks.push({ field: "decorate_type", policy: "set_to_20", reason: "NULL" });
  } else {
    const dt = listing.decorateType.trim();
    const decorateMap: Record<string, number> = { 精装: 40.0, 简装: 28.0, 毛坯: 18.0 };
    decorateSubscore = decorateMap[dt] != null ? decorateMap[dt] : 22.0;
  }
  const amenityScore = clamp(elevatorSubscore + decorateSubscore, 0.0, 100.0);

  // --- price_value_score ---
  let priceValueScore: number;
  const up = listing.unitPrice;
  if (up == null || communityAvgUnitPrice == null || communityAvgUnitPrice <= 0) {
    priceValueScore = 50.0;
    missingFallbacks.push({
      field: "unit_price_or_community_avg_unit_price",
      policy: "set_to_50",
      reason: "NULL_OR_BAD"
    });
  } else {
    const ratio = Number(up) / Number(communityAvgUnitPrice);
    if (ratio < 0.9) priceValueScore = 95.0;
    else if (ratio < 0.95) priceValueScore = 85.0;
    else if (ratio <= 1.05) priceValueScore = 70.0;
    else if (ratio <= 1.15) priceValueScore = 55.0;
    else priceValueScore = 40.0;
  }
  priceValueScore = clamp(priceValueScore, 0.0, 100.0);

  // --- overall ---
  const wLocation = 0.3;
  const wHouse = 0.25;
  const wAge = 0.15;
  const wAmenity = 0.15;
  const wPrice = 0.15;

  const overallRaw =
    wLocation * locationScore +
    wHouse * houseQualityScore +
    wAge * buildingAgeScore +
    wAmenity * amenityScore +
    wPrice * priceValueScore;
  const overall = Math.round(clamp(overallRaw, 0.0, 100.0) * 100) / 100;

  // --- tags ---
  const metroDist = listing.nearestMetroDistanceM;
  const advantages: Array<{ label: string; confidence: number; evidence: Record<string, any> }> = [];
  const disadvantages: Array<{ label: string; confidence: number; evidence: Record<string, any> }> = [];

  const addAdv = (label: string, confidence: number, evidenceRule: string, evidence: Record<string, any> = {}) => {
    advantages.push({ label, confidence, evidence: { rule: evidenceRule, ...evidence } });
  };
  const addDis = (label: string, confidence: number, evidenceRule: string, evidence: Record<string, any> = {}) => {
    disadvantages.push({ label, confidence, evidence: { rule: evidenceRule, ...evidence } });
  };

  if (metroDist != null && metroDist < 1000 && locationScore >= 70) {
    addAdv("近地铁优", 0.92, "nearest_metro_distance_m<1000 & location_score>=70", { metro: metroDist });
  }
  if (schoolFutureScoreMax != null && schoolFutureScoreMax >= 80) {
    addAdv("强学区优", 0.9, "max_school_future_score>=80", { max_school_future_score: schoolFutureScoreMax });
  }
  if (listing.bedrooms != null && listing.bedrooms >= 3 && layoutRes.score >= 25) {
    addAdv("户型佳", 0.86, "bedrooms>=3 & layout_score>=25", {
      bedrooms: listing.bedrooms,
      layout_score: layoutRes.score
    });
  }
  if ((listing.orientation === "南" || listing.orientation === "南北") && orientationSc >= 36) {
    addAdv("采光朝向优", 0.84, "orientation in ['南','南北'] & orientation_score>=36", {
      orientation_score: orientationSc
    });
  }
  if (listing.hasElevator === true && amenityScore >= 70) {
    addAdv("电梯优", 0.88, "has_elevator=true & amenity_score>=70", { amenity_score: amenityScore });
  }
  if (listing.decorateType === "精装") {
    addAdv("精装修优", 0.82, "decorate_type='精装'");
  }
  if (priceValueScore >= 85) {
    addAdv("性价比高", 0.9, "price_value_score>=85", { price_value_score: priceValueScore });
  }

  if (metroDist != null && metroDist > 2000 && locationScore <= 45) {
    addDis("距地铁远", 0.88, "nearest_metro_distance_m>2000 & location_score<=45", { metro: metroDist });
  }
  if (schoolFutureScoreMax != null && schoolFutureScoreMax < 60) {
    addDis("学区弱", 0.82, "max_school_future_score<60", { max_school_future_score: schoolFutureScoreMax });
  }
  if (buildingAgeScore <= 50) {
    addDis("房龄偏老", 0.86, "building_age_score<=50");
  }
  if (listing.hasElevator === false && amenityScore <= 45) {
    addDis("无电梯/设施差", 0.85, "has_elevator=false & amenity_score<=45", { amenity_score: amenityScore });
  }
  if (listing.decorateType === "毛坯") {
    addDis("装修偏差", 0.75, "decorate_type='毛坯'");
  }
  if (priceValueScore <= 55) {
    addDis("性价比偏低", 0.8, "price_value_score<=55", { price_value_score: priceValueScore });
  }

  // clamp topK tags
  advantages.sort((a, b) => b.confidence - a.confidence);
  advantages.splice(3);
  disadvantages.sort((a, b) => b.confidence - a.confidence);
  disadvantages.splice(3);

  const schoolProvinceKeyFlagAny = schoolsFuture.some((s) => s.provinceKeyFlag === true);
  const schoolCityKeyFlagAny = schoolsFuture.some((s) => s.cityKeyFlag === true);

  const dimensionScores = {
    location_score: Math.round(locationScore * 100) / 100,
    house_quality_score: Math.round(houseQualityScore * 100) / 100,
    building_age_score: Math.round(buildingAgeScore * 100) / 100,
    amenity_score: Math.round(amenityScore * 100) / 100,
    price_value_score: Math.round(priceValueScore * 100) / 100
  };

  const dimensionContrib = {
    location_contrib: Math.round(wLocation * locationScore * 100) / 100,
    house_quality_contrib: Math.round(wHouse * houseQualityScore * 100) / 100,
    building_age_contrib: Math.round(wAge * buildingAgeScore * 100) / 100,
    amenity_contrib: Math.round(wAmenity * amenityScore * 100) / 100,
    price_value_contrib: Math.round(wPrice * priceValueScore * 100) / 100
  };

  const explainJson = {
    rule_version: ruleVersion,
    inputs_snapshot: {
      nearest_metro_distance_m: listing.nearestMetroDistanceM,
      orientation: listing.orientation,
      bedroom_count: listing.bedrooms,
      bathroom_count: listing.bathrooms,
      floor_number: listing.floorNumber,
      has_elevator: listing.hasElevator,
      decorate_type: listing.decorateType,
      build_year: listing.buildYear,
      unit_price: listing.unitPrice,
      community_avg_unit_price: communityAvgUnitPrice,
      school_future_scores: schoolsFuture.map((s) => s.trendScore0_100)
    },
    dimension_scores: dimensionScores,
    overall_score: overall,
    dimension_contributions: dimensionContrib,
    label_evidence: { advantages, disadvantages },
    missing_fallbacks: missingFallbacks
  };

  return {
    overallScore: overall,
    dimensionScores,
    advantages,
    disadvantages,
    explainJson,
    schoolFutureScoreMax,
    schoolProvinceKeyFlagAny: schoolProvinceKeyFlagAny || null,
    schoolCityKeyFlagAny: schoolCityKeyFlagAny || null
  };
}
/**
 * 复用电脑端的 API 契约（与 `realty/frontend/src/api/contracts.ts` 一致）。
 * 这里只列出手机端会用到的部分。
 */

export interface CityItem {
  city_id: number;
  city_code: string;
  city_name: string;
}

export interface CommunityRankingItem {
  rank: number;
  community_id: number;
  community_name: string;
  avg_unit_price: number | null;
  median_unit_price: number | null;
  listing_count: number;
  coverage_score: number | null;
  data_policy: string | null;
}

export interface CommunityRankingResponse {
  cityId: number;
  periodType: string;
  weekEnd: string;
  metric: string;
  top?: number;
  page?: number;
  pageSize?: number;
  total?: number;
  data: CommunityRankingItem[];
}

export interface DistrictCompareItem {
  district_name: string;
  avg_unit_price: number | null;
  median_unit_price: number | null;
  listing_count: number;
  coverage_score: number | null;
}

export interface DistrictCompareResponse {
  cityId: number;
  periodType: string;
  weekEnd: string;
  items: DistrictCompareItem[];
}

export interface PriceTrendItem {
  period_start: string;
  period_end: string;
  avg_unit_price: number | null;
  median_unit_price: number | null;
  listing_count: number;
  coverage_score: number | null;
  data_policy: string | null;
  missingFlag: boolean;
}

export interface CommunityPriceTrendResponse {
  communityId: number;
  community_name: string;
  periodType: string;
  data: PriceTrendItem[];
}

export interface QualitySummaryBin {
  bin: string;
  count: number;
}

export interface QualitySummaryResponse {
  communityId: number;
  periodType: string;
  days: number;
  bins: QualitySummaryBin[];
  scoreStats: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
  rule_version: string | null;
  radar: null | {
    rule_version: string;
    dimensions: string[];
    values: Record<string, { avg: number; min: number; max: number }>;
  };
}

export interface TagItem {
  label: string;
  count: number;
  scoreHint?: number | null;
}

export interface TopTagsResponse {
  communityId: number;
  advantages: TagItem[];
  disadvantages: TagItem[];
}

export interface ListingItem {
  listing_id: number;
  title: string;
  listing_type: string | null;
  price_total: number | null;
  unit_price: number | null;
  area_sqm: number | null;
  orientation: string | null;
  floor_number: string | null;
  decorate_type: string | null;
  has_elevator: boolean | null;
  build_year: number | null;
  quality_score: number;
  advantages: { label: string; confidence: number; evidence?: any }[];
  disadvantages: { label: string; confidence: number; evidence?: any }[];
  url: string | null;
  explain_preview?: { overall_score: number; dimension_scores: Record<string, number> };
}

export interface ListingFilterResponse {
  communityId: number | null;
  total: number;
  page: number;
  pageSize: number;
  rule_version: string;
  items: ListingItem[];
}

export interface ListingFilterFilters {
  priceRange?: [number, number]; // 总价万元 [lo, hi]
  areaRange?: [number, number]; // 面积 ㎡
  orientation?: string;
  decorateType?: string;
  listingType?: string; // "all" / 在售 / 二手 ...
  hasElevator?: boolean;
  minQualityScore?: number;
  minSchoolFutureScore?: number;
}

export interface ListingFilterRequest {
  cityId: number;
  communityId?: number;
  page?: number;
  pageSize?: number;
  filters?: ListingFilterFilters;
  sort?: { field?: "overall_score" | "unit_price" | "area_sqm"; direction?: "asc" | "desc" };
}

export interface ListingDetailResponse {
  listing: {
    listing_id: number;
    city_id: number;
    community_id: number;
    title: string;
    source: string | null;
    source_kind: "REAL" | "DERIVED" | "ESTIMATED" | "UNKNOWN";
    source_listing_id: string | null;
    source_url: string | null;
    total_price_10k: number | null;
    unit_price: number | null;
    area_sqm: number | null;
    listing_type: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    orientation: string | null;
    floor_number: string | null;
    has_elevator: boolean | null;
    decorate_type: string | null;
    build_year: number | null;
    nearest_metro_distance_m: number | null;
    school_ids_json: any;
    tags_json: any;
    crawl_date: string | null;
  };
  score: {
    rule_version: string;
    computed_week_end_date: string | null;
    overall_score_0_100: number;
    dimension_scores_json: Record<string, number>;
    advantages_json: { label: string; confidence: number; evidence?: any }[];
    disadvantages_json: { label: string; confidence: number; evidence?: any }[];
    explain_json: any;
    school_future_score_max: number | null;
    school_province_key_flag_any: boolean | null;
    school_city_key_flag_any: boolean | null;
  };
}

export interface SchoolItem {
  school_id: number;
  official_name: string;
  display_name: string | null;
  school_type: string | null;
  province_key_flag: boolean | null;
  city_key_flag: boolean | null;
}

export interface SchoolSearchResponse {
  cityId: number;
  q: string;
  items: SchoolItem[];
}

export interface SchoolFutureScoreResponse {
  school_id: number;
  rule_version: string;
  trend_score_0_100: number;
  confidence_score: number | null;
  feature_contrib_json: any;
  explain_text: string | null;
}

export interface SourceStatItem {
  source: string;
  listing_count: number;
}

export interface RuntimeMetaResponse {
  database_url: string;
  database_file: string | null;
  rule_version_listing: string;
  rule_version_school: string;
  data_counts: { cities: number; communities: number; listings: number };
  server_date: string;
}

export interface CoverageResponse {
  cityId: number;
  source_used: string;
  total_districts: number;
  covered_districts: number;
  coverage_ratio: number;
  empty_districts: string[];
  district_listing_counts: { district_name: string; listing_count: number }[];
  district_community_gaps: {
    district_name: string;
    community_total: number;
    community_with_listing: number;
    community_missing_listing: number;
    community_coverage_ratio: number;
  }[];
  server_date: string;
}

export type PeriodType = "weekly" | "monthly";

export interface CityItem {
  city_id: number;
  city_code: string;
  city_name: string;
}

export interface PriceTrendSeriesItem {
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
  periodType: PeriodType;
  data: PriceTrendSeriesItem[];
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
  periodType: PeriodType;
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
  periodType: PeriodType;
  weekEnd: string;
  items: DistrictCompareItem[];
}

export interface QualitySummaryBin {
  bin: string;
  count: number;
}

export interface QualitySummaryResponse {
  communityId: number;
  periodType: PeriodType;
  days: number;
  bins: QualitySummaryBin[];
  scoreStats: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
  rule_version: string | null;
  radar: {
    rule_version: string;
    dimensions: string[];
    values: Record<
      string,
      {
        avg: number;
        min: number;
        max: number;
      }
    >;
  } | null;
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
  listing_type?: string | null;
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
  explain_preview: { overall_score: number; dimension_scores: Record<string, number> } | undefined;
}

export interface RuntimeMetaResponse {
  database_url: string;
  database_file: string | null;
  rule_version_listing: string;
  rule_version_school: string;
  data_counts: {
    cities: number;
    communities: number;
    listings: number;
  };
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

export interface SourceStatItem {
  source: string;
  listing_count: number;
}

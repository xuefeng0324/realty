import { apiGet } from "./http";
import type {
  CommunityPriceTrendResponse,
  CommunityRankingResponse,
  DistrictCompareResponse
} from "./contracts";

export async function getCommunityRanking(params: {
  cityId: number;
  periodType: "weekly" | "monthly";
  weekEnd: string;
  metric: "avg_unit_price" | "listing_count";
  top?: number;
  page?: number;
  pageSize?: number;
  source?: string;
}): Promise<CommunityRankingResponse> {
  return apiGet("/api/v1/stats/community-ranking", params);
}

export async function getDistrictCompare(params: {
  cityId: number;
  periodType: "weekly" | "monthly";
  weekEnd: string;
  source?: string;
}): Promise<DistrictCompareResponse> {
  return apiGet("/api/v1/stats/district-compare", params);
}

export async function getCommunityPriceTrend(params: {
  communityId: number;
  periodType: "weekly" | "monthly";
  startDate?: string;
  endDate?: string;
  weekEnd?: string;
}): Promise<CommunityPriceTrendResponse> {
  const { communityId, ...rest } = params;
  return apiGet(`/api/v1/communities/${communityId}/price-trend`, rest as any);
}

export async function getCommunityPriceTrendFiltered(params: {
  communityId: number;
  periodType: "weekly" | "monthly";
  weekEnd: string;
  minQualityScore: number;
  maxQualityScore?: number;
  listingType?: string;
  startDate?: string;
  endDate?: string;
}): Promise<CommunityPriceTrendResponse> {
  const { communityId, ...rest } = params;
  return apiGet(`/api/v1/communities/${communityId}/price-trend-filtered`, rest as any);
}
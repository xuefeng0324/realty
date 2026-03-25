import { apiGet } from "./http";
import type { QualitySummaryResponse, TopTagsResponse } from "./contracts";

export async function getQualitySummary(params: {
  communityId: number;
  days: number;
  periodType: "weekly" | "monthly";
  includeRadar?: boolean;
}): Promise<QualitySummaryResponse> {
  const { communityId, ...rest } = params;
  return apiGet(`/api/v1/communities/${communityId}/quality-summary`, rest as any);
}

export async function getQualitySummaryFiltered(params: {
  communityId: number;
  weekEnd: string;
  minQualityScore: number;
  maxQualityScore?: number;
  listingType?: string;
  includeRadar?: boolean;
  periodType?: "weekly" | "monthly";
}): Promise<QualitySummaryResponse> {
  const { communityId, ...rest } = params;
  return apiGet(`/api/v1/communities/${communityId}/quality-summary-filtered`, rest as any);
}

export async function getTopTags(params: { communityId: number; limit: number }): Promise<TopTagsResponse> {
  return apiGet(`/api/v1/communities/${params.communityId}/top-tags`, { limit: params.limit });
}

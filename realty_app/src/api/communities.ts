import { apiGet } from "./http";
import type { QualitySummaryResponse, TopTagsResponse } from "./contracts";

export async function getQualitySummary(params: {
  communityId: number;
  days?: number;
  periodType?: "weekly" | "monthly";
  includeRadar?: boolean;
}): Promise<QualitySummaryResponse> {
  return apiGet(`/api/v1/communities/${params.communityId}/quality-summary`, {
    days: params.days ?? 30,
    periodType: params.periodType ?? "weekly",
    includeRadar: params.includeRadar ?? false
  });
}

export async function getTopTags(params: {
  communityId: number;
  limit?: number;
}): Promise<TopTagsResponse> {
  return apiGet(`/api/v1/communities/${params.communityId}/top-tags`, {
    limit: params.limit ?? 20
  });
}
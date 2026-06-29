import { apiGet } from "./http";
import type { SchoolFutureScoreResponse, SchoolSearchResponse } from "./contracts";

export async function searchSchools(params: {
  cityId: number;
  q: string;
}): Promise<SchoolSearchResponse> {
  return apiGet("/api/v1/schools/search", params);
}

export async function getSchoolFutureScore(params: {
  schoolId: number;
  ruleVersion?: string;
}): Promise<SchoolFutureScoreResponse> {
  return apiGet(`/api/v1/schools/${params.schoolId}/future-score`, {
    ruleVersion: params.ruleVersion
  });
}
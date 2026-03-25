import { apiGet } from "./http";
import type { CityItem, CoverageResponse, RuntimeMetaResponse, SourceStatItem } from "./contracts";

export async function getCities(): Promise<{ items: CityItem[] }> {
  return apiGet("/api/v1/cities");
}

export async function getPeriods(params: { type: "weekly" | "monthly"; cityId?: number; limit?: number }): Promise<{ type: string; items: string[] }> {
  return apiGet("/api/v1/periods", params as any);
}

export async function getRuntimeMeta(): Promise<RuntimeMetaResponse> {
  return apiGet("/api/v1/runtime");
}

export async function getCoverage(params: { cityId: number; source?: string }): Promise<CoverageResponse> {
  return apiGet("/api/v1/coverage", params as any);
}

export async function getSources(params: { cityId: number }): Promise<{ cityId: number; items: SourceStatItem[] }> {
  return apiGet("/api/v1/sources", params as any);
}

import { apiGet, apiPost } from "./http";
import type { ListingDetailResponse, ListingFilterResponse } from "./contracts";

export async function filterListings(body: any): Promise<ListingFilterResponse> {
  return apiPost("/api/v1/listings/filter", body);
}

export async function getListingDetail(
  listingId: number,
  weekEnd?: string
): Promise<ListingDetailResponse> {
  return apiGet(`/api/v1/listings/${listingId}`, weekEnd ? { weekEnd } : undefined);
}
import { apiGet, apiPost } from "./http";
import type {
  ListingDetailResponse,
  ListingFilterRequest,
  ListingFilterResponse
} from "./contracts";

export async function filterListings(body: ListingFilterRequest): Promise<ListingFilterResponse> {
  return apiPost<ListingFilterResponse>("/api/v1/listings/filter", body);
}

export async function getListingDetail(
  listingId: number,
  weekEnd?: string
): Promise<ListingDetailResponse> {
  return apiGet(`/api/v1/listings/${listingId}`, weekEnd ? { weekEnd } : undefined);
}
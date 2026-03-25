import { apiPost } from "./http";
import { apiGet } from "./http";

export async function filterListings(body: any): Promise<any> {
  return apiPost("/api/v1/listings/filter", body);
}

export async function getListingDetail(listingId: number, weekEnd?: string): Promise<any> {
  return apiGet(`/api/v1/listings/${listingId}`, { weekEnd });
}

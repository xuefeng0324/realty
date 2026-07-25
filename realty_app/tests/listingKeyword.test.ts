import { describe, expect, it } from "vitest";
import {
  getListingKeywordsByCity,
  getListingKeywordsCrossCity
} from "../src/local/listingKeyword";

describe("listingKeyword", () => {
  it("各城有关键词且 share ∈ (0,1]", () => {
    for (const cityId of [1, 2, 3]) {
      const rows = getListingKeywordsByCity(cityId);
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.share).toBeGreaterThan(0);
        expect(r.share).toBeLessThanOrEqual(1);
        expect(r.count).toBeGreaterThan(0);
      }
    }
  });

  it("南北通透跨城可比", () => {
    const rows = getListingKeywordsCrossCity("南北通透");
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});

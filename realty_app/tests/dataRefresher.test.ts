import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * dataRefresher.ts 单测。
 *
 * 因为模块只在 uni 环境下跑（用了 uni.request / uni.getStorageSync），
 * 这里 mock 一个最小 uni runtime，然后测：
 *   - 空 csv 时不去 setSnapshot
 *   - 有效 csv 时把 listings 注入 store
 *   - sha 一致时跳过 reload
 */

// 在 import 之前 mock
(globalThis as any).uni = {
  request: vi.fn(),
  getStorageSync: vi.fn(() => ""),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn()
};

import { refreshFromRemote, getLastRefreshInfo, clearRemoteCache } from "../src/local/dataRefresher";
import { getSnapshot, setSnapshot } from "../src/local/store";
import type { DataSnapshot } from "../src/local/types";

const CSV = `listing_id,city_id,community_id,title,source,source_listing_id,source_url,total_price_10k,unit_price,area_sqm,listing_type,bedrooms,bathrooms,orientation,floor_number,has_elevator,decorate_type,build_year,nearest_metro_distance_m,school_ids_json,tags_json,crawl_date
200001,2,1,真实挂牌-A,深圳安居客,A001,https://m.anjuke.com/sz/sale/200001.html,820,75000,109.3,二手房,3,1,南向,中层,True,精装,2015,800,[],[],2026-07-01
200002,2,1,真实挂牌-B,深圳安居客,A002,https://m.anjuke.com/sz/sale/200002.html,1500,90000,166.7,二手房,4,2,南北,高楼层,True,豪装,2012,300,[],[],2026-06-30
`;

const META = JSON.stringify({
  csv_url: "https://cdn.jsdelivr.net/gh/test/repo@main/realty_app/static/seed/listings.csv",
  meta_url: "https://cdn.jsdelivr.net/gh/test/repo@main/realty_app/static/seed/crawl_meta.json",
  sha256: "abc1234567890def",
  row_count: 2,
  generated_at: "2026-07-01T00:00:00Z",
  source: "anjuke"
});

function mockUniRequestSequence(responses: Array<{ data: string }>) {
  let i = 0;
  (globalThis as any).uni.request = vi.fn((opts: any) => {
    const r = responses[i++] ?? responses[responses.length - 1];
    setTimeout(() => opts.success({ statusCode: 200, data: r.data }), 0);
    return {} as any;
  });
}

describe("dataRefresher", () => {
  beforeEach(() => {
    setSnapshot({
      importedAt: "2026-01-01T00:00:00Z",
      source: "test",
      cities: [],
      communities: [],
      schools: [],
      schoolIndicators: [],
      listings: [],
      availableWeeks: []
    } satisfies DataSnapshot);
    (globalThis as any).uni.getStorageSync = vi.fn(() => "");
    (globalThis as any).uni.setStorageSync = vi.fn();
    (globalThis as any).uni.removeStorageSync = vi.fn();
    vi.clearAllMocks();
  });

  it("拉远端成功 → setSnapshot + cache sha", async () => {
    mockUniRequestSequence([{ data: META }, { data: CSV }]);
    const r = await refreshFromRemote();
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(true);
    expect(r.rowCount).toBe(2);
    const snap = getSnapshot();
    expect(snap?.listings.length).toBe(2);
    expect(snap?.listings[0].sourceUrl).toBe("https://m.anjuke.com/sz/sale/200001.html");
  });

  it("sha 一致 → 跳过 reload，不重新拉 CSV", async () => {
    (globalThis as any).uni.getStorageSync = vi.fn((key: string) =>
      key === "realty:lastRemoteSha" ? "abc1234567890def" : ""
    );
    mockUniRequestSequence([{ data: META }]);
    const r = await refreshFromRemote();
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(false);
    expect(r.rowCount).toBe(2); // 来自 meta.row_count
  });

  it("meta 拉不到 → 报错", async () => {
    mockUniRequestSequence([{ data: "" }]); // 空 string
    const r = await refreshFromRemote();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/jsDelivr|无法连接/);
  });

  it("CSV 拉不到 → 报错", async () => {
    mockUniRequestSequence([{ data: META }, { data: "" }]);
    const r = await refreshFromRemote();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/CSV|远端/);
  });

  it("CSV 解析失败 → 报错", async () => {
    // 一行 200+ 字符，无换行 → CSV parse 出 1 行（header）→ rowsToObjects 返回 [] → 0 listings
    const garbled = "garbage,no,header," + "x,".repeat(50) + "end";
    mockUniRequestSequence([{ data: META }, { data: garbled }]);
    const r = await refreshFromRemote();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/解析|无 listings/);
  });
});

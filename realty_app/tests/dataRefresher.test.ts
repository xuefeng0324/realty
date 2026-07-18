import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as any).uni = {
  request: vi.fn(),
  getStorageSync: vi.fn(() => ""),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn()
};

import { clearRemoteCache, refreshFromRemote } from "../src/local/dataRefresher";
import { getSnapshot, setSnapshot } from "../src/local/store";
import type { DataSnapshot } from "../src/local/types";

const FILES: Record<string, string> = {
  "cities.csv": "city_id,city_code,city_name\n2,440300,深圳\n",
  "communities.csv": "community_id,city_id,district_name,community_name\n1,2,南山区,测试小区\n",
  "schools.csv": "school_id,city_id,official_name,display_name,school_type,province_key_flag,city_key_flag\n1,2,测试学校,,小学,False,False\n",
  "school_indicators.csv": "school_id,latest_level_score_raw,group_school_flag_raw,group_school_strength_raw,district_balance_level_raw,trend_delta_raw\n1,60,False,50,50,0\n",
  "listings.csv": `listing_id,city_id,community_id,title,source,source_kind,source_listing_id,source_url,total_price_10k,unit_price,area_sqm,listing_type,bedrooms,bathrooms,orientation,floor_number,has_elevator,decorate_type,build_year,nearest_metro_distance_m,school_ids_json,tags_json,crawl_date
200001,2,1,真实挂牌-A,深圳安居客,REAL,A001,https://example.com/1,820,75000,109.3,二手房,3,1,南向,中层,True,精装,2015,800,[],[],2026-07-01
200002,2,1,真实挂牌-B,深圳安居客,REAL,A002,https://example.com/2,1500,90000,166.7,二手房,4,2,南北,高楼层,True,豪装,2012,300,[],[],2026-06-30
`
};

const META = {
  csv_url: "https://cdn.example/seed/listings.csv",
  meta_url: "https://cdn.example/seed/crawl_meta.json",
  sha256: "listings12345678",
  snapshot_sha256: "snapshot1234567",
  schema_version: 2,
  row_count: 2,
  generated_at: "2026-07-18T00:00:00Z",
  source: "full-snapshot"
};

function mockRemote(options: { meta?: object | null; missing?: string } = {}) {
  const meta = options.meta === undefined ? META : options.meta;
  (globalThis as any).uni.request = vi.fn((opts: any) => {
    const filename = opts.url.split("/").pop();
    let data: string | null = null;
    if (filename === "crawl_meta.json" && meta) data = JSON.stringify(meta);
    else if (filename && filename !== options.missing) data = FILES[filename] ?? null;
    setTimeout(() => opts.success({ statusCode: data == null ? 404 : 200, data: data ?? "" }), 0);
    return {};
  });
}

function seedSnapshot(source = "seed:public-derived"): DataSnapshot {
  return {
    importedAt: "2026-01-01T00:00:00Z",
    source,
    cities: [],
    communities: [],
    schools: [],
    schoolIndicators: [],
    listings: [],
    availableWeeks: []
  };
}

describe("dataRefresher full snapshot", () => {
  beforeEach(() => {
    setSnapshot(seedSnapshot());
    (globalThis as any).uni.getStorageSync = vi.fn(() => "");
    (globalThis as any).uni.setStorageSync = vi.fn();
    (globalThis as any).uni.removeStorageSync = vi.fn();
    vi.clearAllMocks();
  });

  it("成功后原子替换完整 snapshot 并缓存 snapshot 指纹", async () => {
    mockRemote();
    const result = await refreshFromRemote();
    expect(result).toMatchObject({ ok: true, changed: true, rowCount: 2 });
    expect(getSnapshot()?.source).toBe("remote:snapshot1234567");
    expect(getSnapshot()?.listings).toHaveLength(2);
    expect(getSnapshot()?.listings[0].sourceKind).toBe("REAL");
    expect((globalThis as any).uni.setStorageSync).toHaveBeenCalledWith(
      "realty:lastRemoteSha",
      "snapshot1234567"
    );
  });

  it("当前内存已经是同一远端快照时跳过 CSV", async () => {
    setSnapshot(seedSnapshot("remote:snapshot1234567"));
    mockRemote();
    const result = await refreshFromRemote();
    expect(result).toMatchObject({ ok: true, changed: false, rowCount: 2 });
    expect((globalThis as any).uni.request).toHaveBeenCalledTimes(1);
  });

  it("storage sha 相同但当前是内置包时仍重新下载", async () => {
    (globalThis as any).uni.getStorageSync = vi.fn((key: string) =>
      key === "realty:lastRemoteSha" ? "snapshot1234567" : ""
    );
    mockRemote();
    const result = await refreshFromRemote();
    expect(result.changed).toBe(true);
    expect(getSnapshot()?.source).toBe("remote:snapshot1234567");
  });

  it("meta 行数与 CSV 不一致时拒绝覆盖", async () => {
    mockRemote({ meta: { ...META, row_count: 3 } });
    const result = await refreshFromRemote();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/行数不一致/);
    expect(getSnapshot()?.source).toBe("seed:public-derived");
  });

  it("缺少必需 CSV 时保留现有快照", async () => {
    mockRemote({ missing: "communities.csv" });
    const result = await refreshFromRemote();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/communities\.csv/);
    expect(getSnapshot()?.source).toBe("seed:public-derived");
  });

  it("meta 拉不到时返回网络错误", async () => {
    mockRemote({ meta: null });
    const result = await refreshFromRemote();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/CDN|网络/);
  });

  it("clearRemoteCache 清理刷新记录", () => {
    clearRemoteCache();
    expect((globalThis as any).uni.removeStorageSync).toHaveBeenCalledWith("realty:lastRemoteSha");
    expect((globalThis as any).uni.removeStorageSync).toHaveBeenCalledWith("realty:lastRemoteAt");
  });
});

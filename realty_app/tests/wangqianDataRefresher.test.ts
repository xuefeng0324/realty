import { describe, expect, it, vi, beforeEach } from "vitest";

(globalThis as any).uni = {
  request: vi.fn(),
  getStorageSync: vi.fn(() => ""),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn()
};

import {
  refreshWangqianFromRemote,
  getLastWangqianRefreshInfo,
  clearWangqianRemoteCache
} from "../src/local/wangqianDataRefresher";
import { hasDailyWangqian, setDailyWangqian } from "../src/local/store";
import { loadDailyWangqianFromCSV } from "../src/local/dailyWangqian";

const CSV = `date,city,category,district,units,area_sqm,granularity,source_url
2026-06-30,深圳,新房,全市,120,15000.5,city,http://example/
2026-06-30,深圳,二手,全市,80,9000.2,city,http://example/
`;

const META = JSON.stringify({
  csv_url: "https://cdn.jsdelivr.net/gh/test/repo@main/realty_app/static/daily_wangqian.csv",
  meta_url: "https://cdn.jsdelivr.net/gh/test/repo@main/realty_app/static/wangqian_meta.json",
  sha256: "wangqiansha123456",
  row_count: 2,
  generated_at: "2026-07-01T00:00:00Z",
  source: "wangqian"
});

function mockUniRequestSequence(responses: Array<{ data: string }>) {
  let i = 0;
  (globalThis as any).uni.request = vi.fn((opts: any) => {
    const r = responses[i++] ?? responses[responses.length - 1];
    setTimeout(() => opts.success({ statusCode: 200, data: r.data }), 0);
    return {} as any;
  });
}

describe("wangqianDataRefresher", () => {
  beforeEach(() => {
    setDailyWangqian([]);
    (globalThis as any).uni.getStorageSync = vi.fn(() => "");
    (globalThis as any).uni.setStorageSync = vi.fn();
    (globalThis as any).uni.removeStorageSync = vi.fn();
    vi.clearAllMocks();
  });

  it("拉远端成功 → 注入网签 store + cache sha", async () => {
    mockUniRequestSequence([{ data: META }, { data: CSV }]);
    const r = await refreshWangqianFromRemote();
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(true);
    expect(r.rowCount).toBe(2);
    expect(hasDailyWangqian()).toBe(true);
  });

  it("sha 一致且已有数据 → 跳过 reload", async () => {
    loadDailyWangqianFromCSV(CSV);
    (globalThis as any).uni.getStorageSync = vi.fn((key: string) =>
      key === "realty:lastWangqianSha" ? "wangqiansha123456" : ""
    );
    mockUniRequestSequence([{ data: META }]);
    const r = await refreshWangqianFromRemote();
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(false);
    expect(r.rowCount).toBe(2);
  });

  it("meta 拉不到 → 报错", async () => {
    mockUniRequestSequence([{ data: "" }]);
    const r = await refreshWangqianFromRemote();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/jsDelivr|网签 meta/);
  });

  it("CSV 拉不到 → 报错", async () => {
    mockUniRequestSequence([{ data: META }, { data: "" }]);
    const r = await refreshWangqianFromRemote();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/daily_wangqian/);
  });

  it("clearWangqianRemoteCache 清除 storage", () => {
    clearWangqianRemoteCache();
    expect((globalThis as any).uni.removeStorageSync).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

// mock importer（让 buildSeedSnapshot 不依赖 37 个 seed CSV）
vi.mock("../src/local/importer", () => ({
  importSnapshot: vi.fn(() => ({
    cities: [{ cityId: 1, cityName: "深圳" }],
    communities: [{ communityId: 1, cityId: 1, name: "test" }],
    listings: [],
    schools: [],
    schoolIndicators: []
  }))
}));

// mock seedSnapshot 依赖的 raw CSV（37 个全部 mock 为空字符串）
vi.mock("../src/local/seedSnapshot", () => ({
  __esModule: true,
  // 实际上 import 这个文件本身就会运行 import CSV；只能让 vitest 的 module loader
  // 把 ?raw 视为已 mock。但 vitest 不支持 ?raw 直接 mock，需要绕开：
  // 我们改测 seedSnapshot 的 buildSeedSnapshot 是不可能的，只能测 snapshotLoader。
}));

import { loadSnapshotFromBase } from "../src/local/snapshotLoader";
import { importSnapshot } from "../src/local/importer";
import { downloadText } from "../src/local/remoteFetch";

vi.mock("../src/local/remoteFetch", () => ({
  downloadText: vi.fn()
}));

/**
 * snapshotLoader 单测 + 部分 seedSnapshot 集成测试。
 *
 * snapshotLoader.ts (84 行) 提供：
 *  - normalizedRoot：trim + 去尾斜杠（私有，但可间接测）
 *  - fetchFile：私有，依赖 downloadText
 *  - loadSnapshotFromBase(base, source)：
 *    1. 验证 base 是 http(s):// 开头
 *    2. 并行 fetch 5 个必需 + 37 个可选文件
 *    3. 调用 importSnapshot
 *    4. 验证 snapshot.cities / communities / listings 非空
 *    5. 验证所有 listings 都能关联到 community
 *
 * seedSnapshot.ts (176 行) 主体是 import 37 个 seed CSV + buildSeedSnapshot
 * 缓存（首次构建后复用）。缓存机制通过 resetSeedSnapshotCache 重建。
 * 注：seedSnapshot 的 vite ?raw import 无法 vitest 直接 mock，本测试只覆盖
 * snapshotLoader 的纯逻辑分支（4 个错误分支 + 1 个 happy path）。
 */
describe("local/snapshotLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMocks(opts: {
    csvBody?: string;
    cities?: any[];
    communities?: any[];
    listings?: any[];
    throwOnRequired?: boolean;
  }) {
    const cities = opts.cities ?? [{ cityId: 1, cityName: "深圳" }];
    const communities = opts.communities ?? [{ communityId: 1, cityId: 1, name: "test" }];
    const listings = opts.listings ?? [{ listingId: 1, communityId: 1 }];
    vi.mocked(downloadText).mockImplementation(async (url: string, _timeout?: number) => {
      if (opts.throwOnRequired && /cities\.csv|communities\.csv|listings\.csv|schools\.csv|school_indicators\.csv/.test(url)) {
        throw new Error(`完整快照缺少必需文件：${url.split("/").pop()}`);
      }
      return opts.csvBody ?? "mock";
    });
    vi.mocked(importSnapshot).mockReturnValue({
      cities,
      communities,
      listings,
      schools: [],
      schoolIndicators: []
    } as any);
  }

  describe("URL 协议验证", () => {
    it("base 非 http(s):// → throw", async () => {
      setupMocks({});
      await expect(loadSnapshotFromBase("ftp://example.com", "test")).rejects.toThrow("CSV 地址必须以 http(s):// 开头");
    });

    it("base 是 http:// → ok", async () => {
      setupMocks({});
      await expect(loadSnapshotFromBase("http://example.com", "test")).resolves.toBeDefined();
    });

    it("base 是 https:// → ok", async () => {
      setupMocks({});
      await expect(loadSnapshotFromBase("https://example.com", "test")).resolves.toBeDefined();
    });

    it("base 含尾随斜杠 → normalized 后正确", async () => {
      setupMocks({});
      await loadSnapshotFromBase("https://example.com/", "test");
      // downloadText 应被调 5+37=42 次，每次 url 都是 https://example.com/xxx.csv
      const calls = vi.mocked(downloadText).mock.calls;
      for (const call of calls) {
        expect(call[0]).toMatch(/^https:\/\/example\.com\/[^/]+\.csv$/);
      }
    });

    it("base 含多个尾随斜杠 → 尾随全部去掉", async () => {
      setupMocks({});
      await loadSnapshotFromBase("https://example.com///", "test");
      const calls = vi.mocked(downloadText).mock.calls;
      for (const call of calls) {
        // url 应是 https://example.com/xxx.csv，没有连续多个斜杠
        expect(call[0]).toMatch(/^https:\/\/example\.com\/[^/]+\.csv$/);
      }
    });

    it("base 含前后空格 → trim 后正确", async () => {
      setupMocks({});
      await loadSnapshotFromBase("  https://example.com  ", "test");
      const calls = vi.mocked(downloadText).mock.calls;
      for (const call of calls) {
        expect(call[0]).toMatch(/^https:\/\/example\.com\//);
      }
    });
  });

  describe("必需文件 validation", () => {
    it("必需文件 fetch 失败 → throw", async () => {
      setupMocks({ throwOnRequired: true });
      await expect(loadSnapshotFromBase("https://example.com", "test"))
        .rejects.toThrow(/完整快照缺少必需文件/);
    });
  });

  describe("snapshot 非空 validation", () => {
    it("cities 空 → throw", async () => {
      setupMocks({ cities: [] });
      await expect(loadSnapshotFromBase("https://example.com", "test"))
        .rejects.toThrow(/缺少城市、小区或房源数据/);
    });

    it("communities 空 → throw", async () => {
      setupMocks({ communities: [] });
      await expect(loadSnapshotFromBase("https://example.com", "test"))
        .rejects.toThrow(/缺少城市、小区或房源数据/);
    });

    it("listings 空 → throw", async () => {
      setupMocks({ listings: [] });
      await expect(loadSnapshotFromBase("https://example.com", "test"))
        .rejects.toThrow(/缺少城市、小区或房源数据/);
    });
  });

  describe("orphan listing validation", () => {
    it("listing 的 communityId 不在 communities → throw", async () => {
      setupMocks({
        communities: [{ communityId: 1, cityId: 1, name: "test" }],
        listings: [{ listingId: 1, communityId: 999 }, { listingId: 2, communityId: 1 }]
      });
      await expect(loadSnapshotFromBase("https://example.com", "test"))
        .rejects.toThrow(/存在 1 条无法关联小区的房源/);
    });

    it("全部 listings 都能关联 → ok", async () => {
      setupMocks({
        communities: [{ communityId: 1 }, { communityId: 2 }],
        listings: [{ communityId: 1 }, { communityId: 2 }, { communityId: 1 }]
      });
      await expect(loadSnapshotFromBase("https://example.com", "test")).resolves.toBeDefined();
    });
  });

  describe("happy path", () => {
    it("41 次 downloadText（5 必需 + 36 可选）", async () => {
      setupMocks({});
      await loadSnapshotFromBase("https://example.com", "user-csv");
      expect(downloadText).toHaveBeenCalledTimes(41);
    });

    it("必需文件 timeout=20000；可选 timeout=12000", async () => {
      setupMocks({});
      await loadSnapshotFromBase("https://example.com", "test");
      const calls = vi.mocked(downloadText).mock.calls;
      // 前 5 个必需 → timeout 20000；后 36 个可选 → timeout 12000
      for (let i = 0; i < 5; i++) {
        expect(calls[i][1]).toBe(20000);
      }
      for (let i = 5; i < 41; i++) {
        expect(calls[i][1]).toBe(12000);
      }
    });

    it("source 参数透传给 importSnapshot", async () => {
      setupMocks({});
      await loadSnapshotFromBase("https://example.com", "my-custom-source");
      expect(importSnapshot).toHaveBeenCalledWith(expect.any(Object), "my-custom-source");
    });
  });
});
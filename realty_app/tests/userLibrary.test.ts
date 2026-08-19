import { afterEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { STORAGE_KEYS } from "../src/config";
import { useUserLibraryStore } from "../src/store/userLibrary";
import {
  USER_LIBRARY_HISTORY_LIMIT,
  USER_LIBRARY_HISTORY_MAX_AGE_MS,
  buildUserLibraryUrl,
  createEmptyUserLibrary,
  isUserLibraryFavorite,
  parseUserLibrary,
  recordUserLibraryHistory,
  serializeUserLibrary,
  setUserLibraryFavorite,
  type UserLibraryEntityInput
} from "../src/local/userLibrary";

const NOW = Date.UTC(2026, 7, 18, 12, 0, 0);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function entity(
  type: UserLibraryEntityInput["type"],
  id: string | number,
  title: string = `${type}-${id}`
): UserLibraryEntityInput {
  const route = type === "listing"
    ? "/pages/listing-detail/listing-detail"
    : type === "community"
      ? "/pages/community/community"
      : "/pages/school-detail/school-detail";
  return {
    type,
    id,
    title,
    city: "深圳",
    route,
    query: { id }
  };
}

describe("userLibrary", () => {
  it("损坏 JSON、未知版本和损坏结构均安全回空", () => {
    expect(parseUserLibrary("{bad-json", NOW)).toEqual(createEmptyUserLibrary());
    expect(parseUserLibrary({ version: 2, favorites: [], history: [] }, NOW)).toEqual(createEmptyUserLibrary());
    expect(parseUserLibrary({ version: 1, favorites: "bad", history: [] }, NOW)).toEqual(createEmptyUserLibrary());
    expect(parseUserLibrary({
      version: 1,
      favorites: [{ type: "listing", id: "1" }],
      history: []
    }, NOW)).toEqual(createEmptyUserLibrary());
    expect(parseUserLibrary({
      version: 1,
      favorites: [{
        type: "listing",
        id: "1",
        title: "缺跳转参数",
        city: "深圳",
        route: "/pages/listing-detail/listing-detail",
        updatedAt: NOW
      }],
      history: []
    }, NOW)).toEqual(createEmptyUserLibrary());
  });

  it("收藏按 type:id 去重，同 ID 的不同类型互不覆盖", () => {
    let library = createEmptyUserLibrary();
    library = setUserLibraryFavorite(library, entity("listing", 7, "旧标题"), true, NOW - 10);
    library = setUserLibraryFavorite(library, entity("community", 7), true, NOW - 5);
    library = setUserLibraryFavorite(library, entity("listing", 7, "新标题"), true, NOW);

    expect(library.favorites).toHaveLength(2);
    expect(library.favorites[0]).toMatchObject({ type: "listing", id: "7", title: "新标题" });
    expect(isUserLibraryFavorite(library, "listing", 7)).toBe(true);
    expect(isUserLibraryFavorite(library, "school", 7)).toBe(false);

    library = setUserLibraryFavorite(library, entity("listing", 7), false, NOW + 1);
    expect(library.favorites).toEqual([
      expect.objectContaining({ type: "community", id: "7" })
    ]);
  });

  it("浏览历史同一实体只保留最近一次并更新摘要", () => {
    let library = createEmptyUserLibrary();
    library = recordUserLibraryHistory(library, entity("school", 3, "第一次"), NOW - 1000);
    library = recordUserLibraryHistory(library, entity("listing", 8), NOW - 500);
    library = recordUserLibraryHistory(library, entity("school", 3, "最近一次"), NOW);

    expect(library.history).toHaveLength(2);
    expect(library.history[0]).toMatchObject({ type: "school", id: "3", title: "最近一次", updatedAt: NOW });
  });

  it("浏览历史最多保留 100 条", () => {
    let library = createEmptyUserLibrary();
    for (let id = 0; id < USER_LIBRARY_HISTORY_LIMIT + 20; id += 1) {
      library = recordUserLibraryHistory(library, entity("listing", id), NOW + id);
    }

    expect(library.history).toHaveLength(USER_LIBRARY_HISTORY_LIMIT);
    expect(library.history[0].id).toBe("119");
    expect(library.history.at(-1)?.id).toBe("20");
  });

  it("读取时清理超过 90 天的足迹，同时保留边界当天", () => {
    let library = createEmptyUserLibrary();
    library = recordUserLibraryHistory(
      library,
      entity("listing", 1),
      NOW - USER_LIBRARY_HISTORY_MAX_AGE_MS - 1
    );
    library = recordUserLibraryHistory(
      library,
      entity("listing", 2),
      NOW - USER_LIBRARY_HISTORY_MAX_AGE_MS
    );

    const parsed = parseUserLibrary(serializeUserLibrary(library), NOW);
    expect(parsed.history.map((item) => item.id)).toEqual(["2"]);
  });

  it("只序列化最小摘要并正确生成编码后的详情地址", () => {
    const library = recordUserLibraryHistory(
      createEmptyUserLibrary(),
      {
        ...entity("community", "A 1"),
        coverUrl: "https://example.com/cover.jpg",
        query: { id: "A 1", from: "我的收藏" }
      },
      NOW
    );
    const item = library.history[0];

    expect(Object.keys(item).sort()).toEqual([
      "city", "coverUrl", "id", "query", "route", "title", "type", "updatedAt"
    ]);
    expect(buildUserLibraryUrl(item)).toBe(
      "/pages/community/community?id=A%201&from=%E6%88%91%E7%9A%84%E6%94%B6%E8%97%8F"
    );
  });

  it("Pinia store 从坏存储安全启动，并在变更后写回版本化 JSON", () => {
    const setStorageSync = vi.fn();
    vi.stubGlobal("uni", {
      getStorageSync: vi.fn(() => "{bad-json"),
      setStorageSync
    });
    setActivePinia(createPinia());

    const store = useUserLibraryStore();
    expect(store.favorites).toEqual([]);
    expect(store.history).toEqual([]);

    store.recordHistory(entity("listing", 42));
    expect(store.history).toHaveLength(1);
    expect(setStorageSync).toHaveBeenCalledWith(
      STORAGE_KEYS.userLibrary,
      expect.any(String)
    );
    const stored = JSON.parse(setStorageSync.mock.calls[0][1]);
    expect(stored).toMatchObject({
      version: 1,
      history: [expect.objectContaining({ type: "listing", id: "42" })]
    });
  });
});

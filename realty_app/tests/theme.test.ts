import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getStoredThemeMode,
  initializeTheme,
  normalizeThemeMode,
  resolveTheme,
  setThemeMode
} from "../src/utils/theme";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("theme", () => {
  it("非法存储值回退到跟随系统", () => {
    expect(normalizeThemeMode("sepia")).toBe("system");
    expect(normalizeThemeMode(null)).toBe("system");
  });

  it("显式主题不受系统主题影响", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("跟随系统时解析当前系统主题", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("读取、保存并应用主题到 H5 根节点", () => {
    const storage = new Map([[THEME_STORAGE_KEY, "dark"]]);
    const html = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    const body = { setAttribute: vi.fn() };
    vi.stubGlobal("uni", {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: string) => storage.set(key, value)
    });
    vi.stubGlobal("document", { documentElement: html, body });

    expect(getStoredThemeMode()).toBe("dark");
    expect(setThemeMode("light")).toBe("light");
    expect(storage.get(THEME_STORAGE_KEY)).toBe("light");
    expect(html.dataset.realtyTheme).toBe("light");
    expect(html.style.colorScheme).toBe("light");
    expect(body.setAttribute).toHaveBeenCalledWith("data-realty-theme", "light");
  });

  it("原生端同步导航栏与 TabBar 配色", () => {
    const setNavigationBarColor = vi.fn();
    const setTabBarStyle = vi.fn();
    vi.stubGlobal("uni", { setNavigationBarColor, setTabBarStyle });

    expect(applyTheme("dark")).toBe("dark");
    expect(setNavigationBarColor).toHaveBeenCalledWith(expect.objectContaining({ frontColor: "#ffffff" }));
    expect(setTabBarStyle).toHaveBeenCalledWith(expect.objectContaining({ selectedColor: "#4ade80" }));
  });

  it("跟随系统时监听变化并只在仍为 system 时重应用", () => {
    const listener = vi.fn();
    const media = { matches: true, addEventListener: vi.fn((_type: string, cb: () => void) => listener.mockImplementation(cb)) };
    vi.stubGlobal("window", { matchMedia: vi.fn(() => media) });
    vi.stubGlobal("document", {
      documentElement: { dataset: {}, style: {} },
      body: { setAttribute: vi.fn() }
    });
    vi.stubGlobal("uni", { getStorageSync: vi.fn(() => "system") });

    initializeTheme();
    expect(media.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    listener();
    expect(document.documentElement.dataset.realtyTheme).toBe("dark");
  });
});

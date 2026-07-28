import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getStoredThemeMode,
  getSystemPrefersDark,
  initializeTheme,
  normalizeThemeMode,
  refreshThemeChrome,
  resolveTheme,
  resolvedThemeRef,
  setThemeMode
} from "../src/utils/theme";
import { THEME_CSS_VARS } from "../src/utils/themeTokens";

function makeStyleBag() {
  const props = new Map<string, string>();
  return {
    colorScheme: "",
    backgroundColor: "",
    color: "",
    backgroundImage: "",
    setProperty(key: string, value: string) {
      props.set(key, value);
      if (key === "color-scheme") this.colorScheme = value;
    },
    getPropertyValue(key: string) {
      return props.get(key) ?? "";
    },
    _props: props
  };
}

function makeDomStub() {
  const htmlStyle = makeStyleBag();
  const bodyStyle = makeStyleBag();
  const html = {
    dataset: {} as Record<string, string>,
    style: htmlStyle,
    classList: { remove: vi.fn(), add: vi.fn() },
    setAttribute: vi.fn(),
    tagName: "HTML"
  };
  const body = {
    setAttribute: vi.fn(),
    style: bodyStyle,
    classList: { remove: vi.fn(), add: vi.fn() },
    tagName: "BODY"
  };
  return { html, body, htmlStyle, bodyStyle };
}

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

  it("系统主题优先读 uni.getSystemInfoSync().theme", () => {
    vi.stubGlobal("uni", {
      getSystemInfoSync: () => ({ theme: "dark" })
    });
    expect(getSystemPrefersDark()).toBe(true);
    vi.stubGlobal("uni", {
      getSystemInfoSync: () => ({ theme: "light" })
    });
    expect(getSystemPrefersDark()).toBe(false);
  });

  it("读取、保存并应用主题到 H5 根节点（含内联 CSS 变量）", () => {
    const storage = new Map([[THEME_STORAGE_KEY, "dark"]]);
    const { html, body, htmlStyle } = makeDomStub();
    vi.stubGlobal("uni", {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: string) => storage.set(key, value),
      getSystemInfoSync: () => ({ theme: "dark" })
    });
    vi.stubGlobal("document", {
      documentElement: html,
      body,
      querySelectorAll: () => []
    });

    expect(getStoredThemeMode()).toBe("dark");
    expect(setThemeMode("light")).toBe("light");
    expect(storage.get(THEME_STORAGE_KEY)).toBe("light");
    expect(html.dataset.realtyTheme).toBe("light");
    expect(html.style.colorScheme).toBe("light");
    expect(body.setAttribute).toHaveBeenCalledWith("data-realty-theme", "light");
    expect(htmlStyle.getPropertyValue("--color-bg")).toBe(THEME_CSS_VARS.light["--color-bg"]);
    expect(htmlStyle.getPropertyValue("--color-text")).toBe(THEME_CSS_VARS.light["--color-text"]);
    expect(htmlStyle.backgroundColor).toBe(THEME_CSS_VARS.light["--color-bg"]);
    expect(html.classList.add).toHaveBeenCalledWith("realty-theme-light");
  });

  it("原生端 setUIStyle + 同步导航栏与 TabBar", () => {
    const setNavigationBarColor = vi.fn();
    const setTabBarStyle = vi.fn();
    const setUIStyle = vi.fn();
    const { html, body } = makeDomStub();
    vi.stubGlobal("plus", { nativeUI: { setUIStyle } });
    vi.stubGlobal("uni", {
      setNavigationBarColor,
      setTabBarStyle,
      getSystemInfoSync: () => ({ theme: "dark" })
    });
    vi.stubGlobal("document", {
      documentElement: html,
      body,
      querySelectorAll: () => []
    });

    expect(applyTheme("dark")).toBe("dark");
    expect(setUIStyle).toHaveBeenCalledWith("dark");
    expect(setNavigationBarColor).toHaveBeenCalledWith(
      expect.objectContaining({ frontColor: "#ffffff", backgroundColor: "#0b1020" })
    );
    expect(setTabBarStyle).toHaveBeenCalledWith(
      expect.objectContaining({ selectedColor: "#4ade80", backgroundColor: "#0b1020" })
    );

    expect(applyTheme("light")).toBe("light");
    expect(setUIStyle).toHaveBeenCalledWith("light");
    expect(setNavigationBarColor).toHaveBeenCalledWith(
      expect.objectContaining({ frontColor: "#000000", backgroundColor: "#f2f4f7" })
    );

    expect(applyTheme("system")).toBe("dark");
    expect(setUIStyle).toHaveBeenCalledWith("auto");
  });

  it("跟随系统时绑定 uni.onThemeChange", () => {
    const onThemeChange = vi.fn();
    const { html, body } = makeDomStub();
    vi.stubGlobal("uni", {
      getStorageSync: vi.fn(() => "system"),
      getSystemInfoSync: () => ({ theme: "dark" }),
      onThemeChange,
      setNavigationBarColor: vi.fn(),
      setTabBarStyle: vi.fn()
    });
    vi.stubGlobal("document", {
      documentElement: html,
      body,
      querySelectorAll: () => []
    });
    vi.stubGlobal("window", {
      matchMedia: vi.fn(() => ({ matches: true, addEventListener: vi.fn() }))
    });

    initializeTheme();
    expect(onThemeChange).toHaveBeenCalledWith(expect.any(Function));
    expect(html.dataset.realtyTheme).toBe("dark");
  });

  it("applyTheme 同步更新响应式 resolvedThemeRef（App 页面换肤主路径）", () => {
    const { html, body } = makeDomStub();
    vi.stubGlobal("uni", {
      getSystemInfoSync: () => ({ theme: "dark" }),
      setNavigationBarColor: vi.fn(),
      setTabBarStyle: vi.fn()
    });
    vi.stubGlobal("document", { documentElement: html, body, querySelectorAll: () => [] });
    applyTheme("light");
    expect(resolvedThemeRef.value).toBe("light");
    applyTheme("dark");
    expect(resolvedThemeRef.value).toBe("dark");
    // 跟随系统时按系统解析
    applyTheme("system");
    expect(resolvedThemeRef.value).toBe("dark");
  });

  it("refreshThemeChrome 按存储值重刷", () => {
    const storage = new Map([[THEME_STORAGE_KEY, "light"]]);
    const { html, body, htmlStyle } = makeDomStub();
    vi.stubGlobal("uni", {
      getStorageSync: (key: string) => storage.get(key),
      getSystemInfoSync: () => ({ theme: "dark" }),
      setNavigationBarColor: vi.fn(),
      setTabBarStyle: vi.fn()
    });
    vi.stubGlobal("document", {
      documentElement: html,
      body,
      querySelectorAll: () => []
    });
    expect(refreshThemeChrome()).toBeUndefined();
    expect(html.dataset.realtyTheme).toBe("light");
    expect(htmlStyle.getPropertyValue("--color-bg")).toBe(THEME_CSS_VARS.light["--color-bg"]);
  });
});

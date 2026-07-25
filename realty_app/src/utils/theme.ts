/**
 * 外观主题（浅色 / 深色 / 跟随系统）
 *
 * 对齐 uni-app 官方 DarkMode 指南：
 * https://uniapp.dcloud.net.cn/tutorial/darkmode.html
 *
 * 分层：
 * 1) manifest darkmode + theme.json + pages.json @变量 → 导航栏 / TabBar 原生壳
 * 2) 本模块解析用户偏好 → CSS 变量（data-realty-theme）→ 页面内容
 * 3) App 端 plus.nativeUI.setUIStyle + uni.onThemeChange → 真正跟随系统
 *
 * 禁止：仅用 window.matchMedia 当 App 主路径（Android WebView 常不可靠）。
 */

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemeMode, "system">;

export const THEME_STORAGE_KEY = "realty:themeMode";

const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

let themeChangeBound = false;

export function normalizeThemeMode(value: unknown): ThemeMode {
  return THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : "system";
}

/**
 * 读取系统当前是深色还是浅色。
 * 优先 uni.getSystemInfoSync().theme（需 manifest darkmode:true），
 * 其次 H5 matchMedia，再兜底 false（浅色）。
 */
export function getSystemPrefersDark(): boolean {
  if (typeof uni !== "undefined" && typeof uni.getSystemInfoSync === "function") {
    try {
      const info = uni.getSystemInfoSync() as { theme?: string; osTheme?: string };
      const t = info.theme || info.osTheme;
      if (t === "dark") return true;
      if (t === "light") return false;
    } catch {
      /* ignore */
    }
  }
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export function resolveTheme(
  mode: ThemeMode,
  prefersDark: boolean = getSystemPrefersDark()
): ResolvedTheme {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof uni === "undefined") return "system";
  return normalizeThemeMode(uni.getStorageSync(THEME_STORAGE_KEY));
}

/** App 原生 UI 风格：auto | light | dark（官方要求跟随系统前先开 auto） */
function applyNativeUiStyle(mode: ThemeMode): void {
  if (typeof plus === "undefined") return;
  const nativeUI = (plus as { nativeUI?: { setUIStyle?: (s: string) => void } }).nativeUI;
  if (!nativeUI?.setUIStyle) return;
  try {
    if (mode === "system") nativeUI.setUIStyle("auto");
    else nativeUI.setUIStyle(mode);
  } catch {
    /* ignore */
  }
}

function paintDom(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.realtyTheme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.body?.setAttribute("data-realty-theme", resolved);
  document.querySelectorAll?.("page, uni-page-body, .uni-page-body, uni-app").forEach((el) => {
    el.setAttribute("data-realty-theme", resolved);
  });
}

function paintChrome(resolved: ResolvedTheme): void {
  if (typeof uni === "undefined") return;
  const dark = resolved === "dark";
  try {
    uni.setNavigationBarColor?.({
      frontColor: dark ? "#ffffff" : "#000000",
      backgroundColor: dark ? "#0b1020" : "#f8fafc",
      animation: { duration: 0, timingFunc: "linear" }
    });
  } catch {
    /* ignore */
  }
  try {
    uni.setTabBarStyle?.({
      color: dark ? "#94a3b8" : "#64748b",
      selectedColor: dark ? "#4ade80" : "#15803d",
      backgroundColor: dark ? "#0b1020" : "#ffffff",
      borderStyle: dark ? "black" : "black"
    });
  } catch {
    /* ignore */
  }
}

export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const normalized = normalizeThemeMode(mode);
  applyNativeUiStyle(normalized);
  const resolved = resolveTheme(normalized);
  paintDom(resolved);
  paintChrome(resolved);
  return resolved;
}

export function setThemeMode(mode: ThemeMode): ResolvedTheme {
  const normalized = normalizeThemeMode(mode);
  if (typeof uni !== "undefined") uni.setStorageSync(THEME_STORAGE_KEY, normalized);
  return applyTheme(normalized);
}

function bindSystemThemeListener(): void {
  if (themeChangeBound) return;
  themeChangeBound = true;

  if (typeof uni !== "undefined" && typeof uni.onThemeChange === "function") {
    uni.onThemeChange(() => {
      if (getStoredThemeMode() === "system") applyTheme("system");
    });
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
        if (getStoredThemeMode() === "system") applyTheme("system");
      });
    } catch {
      /* ignore */
    }
  }
}

export function initializeTheme(): void {
  const mode = getStoredThemeMode();
  applyTheme(mode);
  bindSystemThemeListener();
}

/** 页面 onShow / 切回前台时再刷一次壳层颜色（防 Tab 残留） */
export function refreshThemeChrome(): void {
  applyTheme(getStoredThemeMode());
}

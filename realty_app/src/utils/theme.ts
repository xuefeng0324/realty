export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemeMode, "system">;

export const THEME_STORAGE_KEY = "realty:themeMode";

const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

export function normalizeThemeMode(value: unknown): ThemeMode {
  return THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : "system";
}

export function resolveTheme(
  mode: ThemeMode,
  prefersDark = typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
): ResolvedTheme {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof uni === "undefined") return "system";
  return normalizeThemeMode(uni.getStorageSync(THEME_STORAGE_KEY));
}

export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode);

  if (typeof document !== "undefined") {
    document.documentElement.dataset.realtyTheme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document.body?.setAttribute("data-realty-theme", resolved);
    // App WebView / uni-app 页面根节点也打标，避免只有 html 时 page 变量不切换
    document.querySelectorAll?.("page, uni-page-body, .uni-page-body, uni-app").forEach((el) => {
      el.setAttribute("data-realty-theme", resolved);
    });
  }

  // 原生 App：同步导航栏 / TabBar；H5 由 CSS 管，避免无意义的 rejected Promise
  const isNativeApp =
    typeof plus !== "undefined" ||
    (typeof navigator !== "undefined" && /uni-app/i.test(navigator.userAgent || ""));
  if (typeof uni !== "undefined" && isNativeApp) {
    const dark = resolved === "dark";
    try {
      uni.setNavigationBarColor?.({
        frontColor: dark ? "#ffffff" : "#111827",
        backgroundColor: dark ? "#0b1020" : "#f8fafc"
      });
    } catch {
      /* ignore */
    }
    try {
      uni.setTabBarStyle?.({
        color: dark ? "#94a3b8" : "#64748b",
        selectedColor: dark ? "#4ade80" : "#15803d",
        backgroundColor: dark ? "#0b1020" : "#ffffff",
        borderStyle: dark ? "black" : "white"
      });
    } catch {
      /* ignore */
    }
  }

  return resolved;
}

export function setThemeMode(mode: ThemeMode): ResolvedTheme {
  const normalized = normalizeThemeMode(mode);
  if (typeof uni !== "undefined") uni.setStorageSync(THEME_STORAGE_KEY, normalized);
  return applyTheme(normalized);
}

export function initializeTheme(): void {
  const mode = getStoredThemeMode();
  applyTheme(mode);

  if (mode === "system" && typeof window !== "undefined" && typeof window.matchMedia === "function") {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
      if (getStoredThemeMode() === "system") applyTheme("system");
    });
  }
}

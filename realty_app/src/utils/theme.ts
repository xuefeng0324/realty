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
  }

  // H5 的导航栏和 TabBar 已由全局 CSS 跟随主题；跨端 API 在部分 H5
  // 运行时会返回 rejected Promise，导致无意义的 pageerror，因此只在原生端调用。
  if (typeof uni !== "undefined" && typeof document === "undefined") {
    const dark = resolved === "dark";
    uni.setNavigationBarColor?.({
      frontColor: dark ? "#ffffff" : "#111827",
      backgroundColor: dark ? "#0b1020" : "#f8fafc"
    });
    uni.setTabBarStyle?.({
      color: dark ? "#94a3b8" : "#64748b",
      selectedColor: dark ? "#4ade80" : "#15803d",
      backgroundColor: dark ? "#0b1020" : "#ffffff",
      borderStyle: dark ? "black" : "white"
    });
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

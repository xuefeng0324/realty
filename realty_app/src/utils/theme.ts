/**
 * 外观主题（浅色 / 深色 / 跟随系统）
 *
 * 对齐 uni-app 官方 DarkMode 指南：
 * https://uniapp.dcloud.net.cn/tutorial/darkmode.html
 *
 * 分层：
 * 1) manifest darkmode + theme.json + pages.json @变量 → 导航栏 / TabBar 原生壳
 * 2) 本模块解析用户偏好 → CSS 变量（data-realty-theme + 内联 setProperty）→ 页面内容
 * 3) App 端 plus.nativeUI.setUIStyle + uni.onThemeChange → 真正跟随系统
 *
 * 禁止：仅用 window.matchMedia 当 App 主路径（Android WebView 常不可靠）。
 * 禁止：浅色只改 data 属性、不写 CSS 变量（App 上 page 选择器经常不级联）。
 */

import { ref, type Ref } from "vue";
import { THEME_CSS_VARS, type ResolvedTheme } from "./themeTokens";

export type ThemeMode = "system" | "light" | "dark";
export type { ResolvedTheme };

/**
 * 响应式「已解析主题」——App(app-plus) 逻辑层没有可写的页面 document，
 * paintDom 的 setAttribute 到不了真正渲染页面的 WebView（这正是「只有导航栏
 * 变白、页面内容不变」的根因）。因此改由每个页面把根节点
 * `<view class="page" :data-realty-theme="realtyTheme">` 绑定到本 ref，
 * 让 Vue 跨逻辑层/渲染层把属性同步到真实 DOM，CSS 变量随之级联到全部内容。
 */
export const resolvedThemeRef: Ref<ResolvedTheme> = ref<ResolvedTheme>("dark");

export const THEME_STORAGE_KEY = "realty:themeMode";

const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

let themeChangeBound = false;

export function normalizeThemeMode(value: unknown): ThemeMode {
  return THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : "system";
}

/**
 * 上次成功读到的系统深/浅偏好。冷启动时 `uni.getSystemInfoSync().theme`
 * 常短暂为空；若此时兜底成浅色，paintChrome 会把导航栏刷成近白，
 * 启动页关掉后上半截必闪一下白（浅色模式改造后更明显，因壳层 API 可靠生效）。
 */
let lastKnownSystemPrefersDark: boolean | null = null;

/** 仅单测：清空系统主题缓存与 listener 绑定标记 */
export function resetSystemThemeCacheForTest(): void {
  lastKnownSystemPrefersDark = null;
  themeChangeBound = false;
}

/**
 * 读取系统当前是深色还是浅色。
 * 优先 uni.getSystemInfoSync().theme（需 manifest darkmode:true），
 * 其次 H5 matchMedia；
 * 未知时：用上次成功值，再兜底 true（深色）——本 App 默认深色体系，避免启动白闪。
 */
export function getSystemPrefersDark(): boolean {
  if (typeof uni !== "undefined" && typeof uni.getSystemInfoSync === "function") {
    try {
      const info = uni.getSystemInfoSync() as { theme?: string; osTheme?: string };
      const t = info.theme || info.osTheme;
      if (t === "dark") {
        lastKnownSystemPrefersDark = true;
        return true;
      }
      if (t === "light") {
        lastKnownSystemPrefersDark = false;
        return false;
      }
    } catch {
      /* ignore */
    }
  }
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    try {
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      lastKnownSystemPrefersDark = dark;
      return dark;
    } catch {
      /* ignore */
    }
  }
  if (lastKnownSystemPrefersDark != null) return lastKnownSystemPrefersDark;
  return true;
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

function applyCssVarsToElement(el: Element, resolved: ResolvedTheme): void {
  const style = (el as HTMLElement).style;
  if (!style?.setProperty) return;
  const vars = THEME_CSS_VARS[resolved];
  for (const [key, value] of Object.entries(vars)) {
    style.setProperty(key, value);
  }
  style.setProperty("color-scheme", resolved);
  // 根节点直接刷底色，避免透明 body 读到系统默认深底
  if (keyIsRoot(el)) {
    style.backgroundColor = vars["--color-bg"];
    style.color = vars["--color-text"];
    if (resolved === "light") style.backgroundImage = "none";
  }
}

function keyIsRoot(el: Element): boolean {
  const tag = el.tagName?.toLowerCase?.() ?? "";
  return (
    el === document.documentElement ||
    el === document.body ||
    tag === "page" ||
    tag === "uni-page-body" ||
    tag === "uni-app" ||
    (el as HTMLElement).classList?.contains?.("uni-page-body")
  );
}

function paintDom(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const mark = (el: Element | null | undefined) => {
    if (!el) return;
    el.setAttribute("data-realty-theme", resolved);
    if ((el as HTMLElement).dataset) {
      (el as HTMLElement).dataset.realtyTheme = resolved;
    }
    el.classList?.remove?.("realty-theme-light", "realty-theme-dark");
    el.classList?.add?.(`realty-theme-${resolved}`);
    applyCssVarsToElement(el, resolved);
  };

  mark(document.documentElement);
  mark(document.body);
  document
    .querySelectorAll?.("page, uni-page-body, .uni-page-body, uni-app, uni-page, .uni-page")
    .forEach((el) => mark(el));
}

function paintChrome(resolved: ResolvedTheme): void {
  if (typeof uni === "undefined") return;
  const dark = resolved === "dark";
  try {
    uni.setNavigationBarColor?.({
      frontColor: dark ? "#ffffff" : "#000000",
      backgroundColor: dark ? "#0b1020" : "#f2f4f7",
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
  // 先更新响应式 ref：这是 App 端页面内容真正换肤的主路径（模板绑定 data-realty-theme）
  resolvedThemeRef.value = resolved;
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
  // 启动瞬间先按「深色壳」落一笔：冷启动 theme 未就绪时，若直接解析成 light，
  // 导航栏/状态栏会先近白再被纠正，上半截必闪。显式浅色用户仍由紧随其后的 applyTheme 刷回。
  if (mode !== "light") {
    paintChrome("dark");
  }
  applyTheme(mode);
  bindSystemThemeListener();
}

/** 页面 onShow / 切回前台时再刷一次壳层颜色（防 Tab 残留） */
export function refreshThemeChrome(): void {
  applyTheme(getStoredThemeMode());
}

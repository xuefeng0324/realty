/**
 * 主题 CSS 变量单一来源。
 * paintDom 会把这些写到 documentElement / page，避免 App WebView
 * 仅靠 `page[data-realty-theme]` 选择器时变量不级联、浅色「看起来没变」。
 *
 * 对照：
 * - Material Design 3 Surface：浅底近白、正文高对比深灰
 * - Apple HIG：systemGroupedBackground 浅灰分组 + label 深色
 * - 微信 / 支付宝 / 贝壳：强制浅色 = 白底深字，不是「略提亮的深色」
 */

export type ResolvedTheme = "light" | "dark";
export type ThemeCssVars = Record<string, string>;

export interface ThemeChromeTokens {
  navigationBackground: string;
  navigationFront: "#ffffff" | "#000000";
  pageBackground: string;
  tabBackground: string;
  tabText: string;
  tabSelected: string;
}

/** 相对亮度（sRGB，与 smoke_theme_visual 同公式） */
export function relativeLuminance(hex: string): number {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return 0;
  const rgb = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export const THEME_CSS_VARS: Record<ResolvedTheme, ThemeCssVars> = {
  dark: {
    "--color-bg": "#080d18",
    "--color-surface": "#111827",
    "--color-surface-raised": "#182235",
    "--color-border": "rgba(148, 163, 184, 0.16)",
    "--color-border-soft": "rgba(148, 163, 184, 0.1)",
    "--color-text": "#e2e8f0",
    "--color-text-secondary": "#cbd5e1",
    "--color-heading": "#f3f4f6",
    "--color-muted": "#94a3b8",
    "--color-primary": "#22c55e",
    "--color-primary-strong": "#16a34a",
    "--color-primary-contrast": "#4ade80",
    "--color-primary-text": "#052e16",
    "--color-primary-soft": "rgba(34, 197, 94, 0.16)",
    "--color-danger": "#ef4444",
    "--color-danger-text": "#ffffff",
    "--color-success": "#22c55e",
    "--color-warning": "#f59e0b",
    "--color-accent": "#1d4ed8",
    "--color-accent-text": "#ffffff",
    "--color-soft": "#1e293b",
    "--color-soft-strong": "#334155",
    "--color-panel": "#0f172a",
    "--color-panel-soft": "#162033",
    "--color-card": "#111827",
    "--color-chip-text": "#cbd5e1",
    "--color-overlay": "rgba(2, 6, 23, 0.72)",
    "--color-focus": "#38bdf8",
    "--color-trend-up": "#f87171",
    "--color-trend-down": "#4ade80",
    "--color-trend-flat": "#94a3b8",
    "--color-success-soft": "rgba(34, 197, 94, 0.16)",
    "--color-danger-soft": "rgba(239, 68, 68, 0.16)",
    "--color-warn-soft": "rgba(234, 179, 8, 0.16)",
    "--color-info-soft": "rgba(56, 189, 248, 0.16)",
    "--color-violet-soft": "rgba(139, 92, 246, 0.18)",
    "--color-on-success-soft": "#86efac",
    "--color-on-danger-soft": "#fca5a5",
    "--color-on-warn-soft": "#fde68a",
    "--shadow-card": "0 12rpx 34rpx rgba(0, 0, 0, 0.2)",
    "--shadow-sheet": "0 -20rpx 56rpx rgba(0, 0, 0, 0.32)"
  },
  light: {
    "--color-bg": "#f2f4f7",
    "--color-surface": "#ffffff",
    "--color-surface-raised": "#ffffff",
    "--color-border": "#d8dee8",
    "--color-border-soft": "#e8edf3",
    "--color-text": "#1e293b",
    "--color-text-secondary": "#475569",
    "--color-heading": "#0f172a",
    "--color-muted": "#64748b",
    "--color-primary": "#16a34a",
    "--color-primary-strong": "#15803d",
    "--color-primary-contrast": "#15803d",
    "--color-primary-text": "#ffffff",
    "--color-primary-soft": "#e9f7ee",
    "--color-danger": "#dc2626",
    "--color-danger-text": "#ffffff",
    "--color-success": "#15803d",
    "--color-warning": "#b45309",
    "--color-accent": "#2563eb",
    "--color-accent-text": "#ffffff",
    "--color-soft": "#eef2f7",
    "--color-soft-strong": "#e2e8f0",
    "--color-panel": "#f8fafc",
    "--color-panel-soft": "#f1f5f9",
    "--color-card": "#ffffff",
    "--color-chip-text": "#334155",
    "--color-overlay": "rgba(15, 23, 42, 0.42)",
    "--color-focus": "#2563eb",
    "--color-trend-up": "#dc2626",
    "--color-trend-down": "#15803d",
    "--color-trend-flat": "#64748b",
    "--color-success-soft": "#ecfdf5",
    "--color-danger-soft": "#fef2f2",
    "--color-warn-soft": "#fef3c7",
    "--color-info-soft": "#e0f2fe",
    "--color-violet-soft": "#ede9fe",
    "--color-on-success-soft": "#166534",
    "--color-on-danger-soft": "#991b1b",
    "--color-on-warn-soft": "#92400e",
    "--shadow-card": "0 8rpx 24rpx rgba(15, 23, 42, 0.08)",
    "--shadow-sheet": "0 -18rpx 48rpx rgba(15, 23, 42, 0.14)"
  }
};

/** 原生导航栏 / TabBar / WebView 壳层 token；theme.ts 与 theme.json 必须保持一致。 */
export const THEME_CHROME_TOKENS: Record<ResolvedTheme, ThemeChromeTokens> = {
  dark: {
    navigationBackground: "#0b1020",
    navigationFront: "#ffffff",
    pageBackground: THEME_CSS_VARS.dark["--color-bg"],
    tabBackground: "#0b1020",
    tabText: THEME_CSS_VARS.dark["--color-muted"],
    tabSelected: THEME_CSS_VARS.dark["--color-primary-contrast"]
  },
  light: {
    navigationBackground: THEME_CSS_VARS.light["--color-bg"],
    navigationFront: "#000000",
    pageBackground: THEME_CSS_VARS.light["--color-bg"],
    tabBackground: THEME_CSS_VARS.light["--color-surface"],
    tabText: THEME_CSS_VARS.light["--color-muted"],
    tabSelected: THEME_CSS_VARS.light["--color-primary-strong"]
  }
};

/** A1 门禁：浅色底必须足够亮，深色底必须足够暗（相对亮度） */
export const THEME_LUMINANCE_GATES = {
  lightBgMin: 0.85,
  darkBgMax: 0.12,
  lightTextMax: 0.25,
  darkTextMin: 0.65
} as const;

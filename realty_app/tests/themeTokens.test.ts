import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  THEME_CHROME_TOKENS,
  THEME_CSS_VARS,
  THEME_LUMINANCE_GATES,
  relativeLuminance
} from "../src/utils/themeTokens";

describe("themeTokens 亮度门禁（对照 MD3 / 大厂浅色）", () => {
  it("浅色底足够亮、正文足够深、卡片近白", () => {
    const light = THEME_CSS_VARS.light;
    expect(relativeLuminance(light["--color-bg"])).toBeGreaterThanOrEqual(
      THEME_LUMINANCE_GATES.lightBgMin
    );
    expect(relativeLuminance(light["--color-surface"])).toBeGreaterThanOrEqual(0.9);
    expect(relativeLuminance(light["--color-text"])).toBeLessThanOrEqual(
      THEME_LUMINANCE_GATES.lightTextMax
    );
    expect(relativeLuminance(light["--color-heading"])).toBeLessThanOrEqual(
      THEME_LUMINANCE_GATES.lightTextMax
    );
  });

  it("深色底足够暗、正文足够浅", () => {
    const dark = THEME_CSS_VARS.dark;
    expect(relativeLuminance(dark["--color-bg"])).toBeLessThanOrEqual(
      THEME_LUMINANCE_GATES.darkBgMax
    );
    expect(relativeLuminance(dark["--color-text"])).toBeGreaterThanOrEqual(
      THEME_LUMINANCE_GATES.darkTextMin
    );
  });

  it("浅色与深色背景亮度差足够大（肉眼可辨）", () => {
    const gap =
      relativeLuminance(THEME_CSS_VARS.light["--color-bg"]) -
      relativeLuminance(THEME_CSS_VARS.dark["--color-bg"]);
    expect(gap).toBeGreaterThan(0.7);
  });

  it("两套主题具备共享组件所需的完整语义 token", () => {
    const required = [
      "--color-border-soft",
      "--color-text-secondary",
      "--color-primary-soft",
      "--color-panel-soft",
      "--color-overlay",
      "--color-focus",
      "--color-trend-up",
      "--color-trend-down",
      "--color-trend-flat",
      "--shadow-sheet"
    ];
    for (const theme of ["light", "dark"] as const) {
      for (const key of required) expect(THEME_CSS_VARS[theme][key], `${theme}:${key}`).toBeTruthy();
    }
    expect(Object.keys(THEME_CSS_VARS.light).sort()).toEqual(
      Object.keys(THEME_CSS_VARS.dark).sort()
    );
  });

  it("theme.json 原生壳颜色与运行时 chrome token 同步", () => {
    const themeJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "src/theme.json"), "utf8")
    ) as Record<string, Record<string, string>>;
    for (const theme of ["light", "dark"] as const) {
      const chrome = THEME_CHROME_TOKENS[theme];
      expect(themeJson[theme].navBgColor).toBe(chrome.navigationBackground);
      expect(themeJson[theme].bgColor).toBe(chrome.pageBackground);
      expect(themeJson[theme].tabBgColor).toBe(chrome.tabBackground);
      expect(themeJson[theme].tabFontColor).toBe(chrome.tabText);
      expect(themeJson[theme].tabSelectedColor).toBe(chrome.tabSelected);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
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
});

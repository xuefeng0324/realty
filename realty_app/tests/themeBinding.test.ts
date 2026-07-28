import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 浅色模式回归护栏（对应用户「只有导航栏变白、内容不变」的根因修复）：
 *  - App 逻辑层 document 到不了页面 WebView，故每个页面根节点必须由 Vue 响应式
 *    绑定 :data-realty-theme（跨层可靠同步），CSS 变量才会级联到全部内容。
 *  - App.vue 必须提供「属性在任意节点」的通用浅/深选择器，保证从 .page 根级联。
 */
describe("theme binding guard", () => {
  const pagesDir = resolve(__dirname, "../src/pages");
  const pageFiles = readdirSync(pagesDir)
    .map((name) => resolve(pagesDir, name, `${name}.vue`))
    .filter((p) => {
      try {
        readFileSync(p, "utf8");
        return true;
      } catch {
        return false;
      }
    });

  it("发现全部页面 SFC（数量合理）", () => {
    expect(pageFiles.length).toBeGreaterThanOrEqual(15);
  });

  it("每个页面根节点都绑定 :data-realty-theme 与 realty-theme-* class", () => {
    const missing: string[] = [];
    for (const file of pageFiles) {
      const src = readFileSync(file, "utf8");
      if (!src.includes(':data-realty-theme="realtyTheme"')) missing.push(file);
      if (!src.includes("'realty-theme-' + realtyTheme")) missing.push(file);
      if (!src.includes('resolvedThemeRef as realtyTheme')) missing.push(file);
    }
    expect(missing).toEqual([]);
  });

  it("App.vue 提供通用属性选择器让浅/深变量从 .page 级联", () => {
    const app = readFileSync(resolve(__dirname, "../src/App.vue"), "utf8");
    expect(app).toMatch(/\[data-realty-theme="light"\]\s*\{/);
    expect(app).toMatch(/\[data-realty-theme="dark"\]\s*\{/);
  });

  it("theme.ts 导出响应式 resolvedThemeRef 并在 applyTheme 中更新", () => {
    const theme = readFileSync(resolve(__dirname, "../src/utils/theme.ts"), "utf8");
    expect(theme).toContain("export const resolvedThemeRef");
    expect(theme).toMatch(/resolvedThemeRef\.value\s*=\s*resolved/);
  });
});

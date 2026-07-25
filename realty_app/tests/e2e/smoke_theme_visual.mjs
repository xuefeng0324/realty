import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const OUT_DIR = resolve(process.cwd(), "tests/e2e/artifacts/theme");
mkdirSync(OUT_DIR, { recursive: true });

const pages = [
  { name: "dashboard", path: "/#/pages/dashboard/dashboard" },
  { name: "settings", path: "/#/pages/settings/settings" },
  { name: "listings", path: "/#/pages/listing-filter/listing-filter" },
  { name: "map", path: "/#/pages/map-view/map-view" },
  { name: "listing-detail", path: "/#/pages/listing-detail/listing-detail?id=1227" },
  { name: "community", path: "/#/pages/community/community?id=24" },
  { name: "school", path: "/#/pages/school/school" },
  { name: "school-detail", path: "/#/pages/school-detail/school-detail?id=1" },
  { name: "stats70", path: "/#/pages/stats70/stats70" }
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();
const issues = [];
const snapshots = new Map();

const parseRgb = (value, backdrop = null) => {
  const match = value?.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?/i);
  if (!match) return null;
  const rgb = match.slice(1, 4).map(Number);
  const alpha = match[4] == null ? 1 : Number(match[4]);
  if (alpha >= 1 || !backdrop) return rgb;
  return rgb.map((channel, index) => Math.round(channel * alpha + backdrop[index] * (1 - alpha)));
};

const luminance = (rgb) => {
  const values = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
};

const contrast = (foreground, background) => {
  const bright = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (bright + 0.05) / (dark + 0.05);
};

try {
  for (const mode of ["light", "dark"]) {
    for (const target of pages) {
      await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "domcontentloaded" });
      await page.evaluate((theme) => localStorage.setItem("realty:themeMode", theme), mode);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(target.name === "dashboard" ? 1800 : 1000);

      const audit = await page.evaluate(() => {
        const firstVisible = (selector) => Array.from(document.querySelectorAll(selector)).find((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        });
        const describe = (element) => {
          if (!element) return null;
          const style = getComputedStyle(element);
          return {
            text: element.textContent?.trim().slice(0, 40) ?? "",
            color: style.color,
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            disabled: element.matches(":disabled") || element.hasAttribute("disabled")
          };
        };
        return {
          theme: document.documentElement.dataset.realtyTheme,
          page: describe(document.body),
          card: describe(firstVisible(".card, [class$='-card'], [class*='-card ']")),
          title: describe(firstVisible(".card-title, [class$='-title'], [class*='-title ']")),
          muted: describe(firstVisible(".muted, [class$='-sub'], [class*='-hint'], [class*='-meta']")),
          buttons: Array.from(document.querySelectorAll("button, .btn, .theme-option, .map-mode-btn"))
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
            })
            .map(describe),
          input: describe(firstVisible("input, .input, .form-row"))
        };
      });

      const key = `${target.name}:${mode}`;
      snapshots.set(key, audit);
      if (audit.theme !== mode) issues.push(`${key} 主题未生效: ${audit.theme}`);

      const pageBg = parseRgb(audit.page?.backgroundColor);
      if (!pageBg) {
        issues.push(`${key} 页面背景色无法解析: ${audit.page?.backgroundColor}`);
      } else {
        const pageLum = luminance(pageBg);
        if (mode === "light" && pageLum < 0.75) issues.push(`${key} 浅色页面过暗: ${pageLum.toFixed(3)}`);
        if (mode === "dark" && pageLum > 0.2) issues.push(`${key} 深色页面过亮: ${pageLum.toFixed(3)}`);
      }

      for (const role of ["card", "title", "muted", "input"]) {
        const sample = audit[role];
        if (!sample) continue;
        const fg = parseRgb(sample.color);
        const bg = parseRgb(sample.backgroundColor, pageBg);
        if (fg && bg && sample.backgroundColor !== "rgba(0, 0, 0, 0)") {
          const ratio = contrast(fg, bg);
          const minimum = role === "muted" ? 3 : 4.5;
          if (ratio < minimum) issues.push(`${key} ${role} 对比度 ${ratio.toFixed(2)} < ${minimum}`);
        }
      }

      for (const button of audit.buttons) {
        if (button.disabled) continue;
        const fg = parseRgb(button.color);
        const bg = parseRgb(button.backgroundColor, pageBg);
        if (!fg || !bg || button.backgroundColor === "rgba(0, 0, 0, 0)") continue;
        const ratio = contrast(fg, bg);
        if (ratio < 4.5) issues.push(`${key} 按钮“${button.text}”对比度 ${ratio.toFixed(2)} < 4.5`);
      }

      await page.screenshot({ path: resolve(OUT_DIR, `${target.name}-${mode}.png`), fullPage: false });
    }
  }

  for (const target of pages) {
    const light = parseRgb(snapshots.get(`${target.name}:light`)?.page?.backgroundColor);
    const dark = parseRgb(snapshots.get(`${target.name}:dark`)?.page?.backgroundColor);
    if (light && dark && luminance(light) - luminance(dark) < 0.55) {
      issues.push(`${target.name} 浅色/深色页面背景区分不足`);
    }
  }

  await page.setViewportSize({ width: 320, height: 800 });
  for (const mode of ["light", "dark"]) {
    for (const target of pages) {
      await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "domcontentloaded" });
      await page.evaluate((theme) => localStorage.setItem("realty:themeMode", theme), mode);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(target.name === "dashboard" ? 1800 : 900);
      const compact = await page.evaluate(() => {
        const width = window.innerWidth;
        const documentWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0
        );
        const clippedButtons = Array.from(document.querySelectorAll("button, .btn, .theme-option"))
          .filter((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            if (style.display === "none" || style.visibility === "hidden" || rect.width === 0) return false;
            if (element.closest("scroll-view, .uni-scroll-view, .map-mode-scroll")) return false;
            return rect.left < -1 || rect.right > width + 1;
          })
          .map((element) => element.textContent?.trim().slice(0, 30) ?? "");
        return { width, documentWidth, clippedButtons };
      });
      const key = `${target.name}:${mode}:320px`;
      if (compact.documentWidth > compact.width + 2) {
        issues.push(`${key} 页面横向溢出 ${compact.documentWidth - compact.width}px`);
      }
      for (const text of compact.clippedButtons) issues.push(`${key} 按钮被裁切：“${text}”`);
    }
  }

  if (issues.length > 0) {
    console.error(`主题视觉审计失败：${issues.length} 项`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(`主题视觉审计通过：${pages.length} 页面 × 2 主题，${pages.length * 2} 张截图；320px 小屏无横向溢出`);
  }
} finally {
  await browser.close();
}

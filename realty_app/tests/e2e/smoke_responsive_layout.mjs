import { chromium } from "playwright";

const BASE_URL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const pages = [
  { name: "dashboard", path: "/#/pages/dashboard/dashboard", wait: 1800 },
  { name: "settings", path: "/#/pages/settings/settings" },
  { name: "listings", path: "/#/pages/listing-filter/listing-filter" },
  { name: "map", path: "/#/pages/map-view/map-view" },
  { name: "listing-detail", path: "/#/pages/listing-detail/listing-detail?id=1227" },
  { name: "community", path: "/#/pages/community/community?id=24" },
  { name: "school", path: "/#/pages/school/school" },
  { name: "school-detail", path: "/#/pages/school-detail/school-detail?id=1" },
  { name: "stats70", path: "/#/pages/stats70/stats70" }
];
const viewports = [
  { name: "phone-320", width: 320, height: 800 },
  { name: "landscape", width: 844, height: 390 },
  { name: "tablet", width: 768, height: 1024 }
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: viewports[0] });
const page = await context.newPage();
const issues = [];

try {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const target of pages) {
      await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(target.wait ?? 900);
      const result = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const documentWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0
        );
        const isVisible = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const isScrollable = (element) => Boolean(
          element.closest("scroll-view, .uni-scroll-view, .map-mode-scroll, .dash-tabs-scroll")
        );
        const interactive = Array.from(document.querySelectorAll(
          "button, .btn, .theme-option, .map-mode-btn, .tap-row, [role='button']"
        )).filter(isVisible);
        const clipped = interactive
          .filter((element) => {
            if (isScrollable(element)) return false;
            const rect = element.getBoundingClientRect();
            return rect.left < -1 || rect.right > viewportWidth + 1;
          })
          .map((element) => element.textContent?.trim().slice(0, 30) ?? "");
        const tooNarrow = interactive
          .filter((element) => {
            if (isScrollable(element)) return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.width < 24;
          })
          .map((element) => element.textContent?.trim().slice(0, 30) ?? "");
        return { viewportWidth, documentWidth, clipped, tooNarrow };
      });

      const key = `${target.name}:${viewport.name}`;
      if (result.documentWidth > result.viewportWidth + 2) {
        issues.push(`${key} 页面横向溢出 ${result.documentWidth - result.viewportWidth}px`);
      }
      for (const text of result.clipped) issues.push(`${key} 交互区域被裁切：“${text}”`);
      for (const text of result.tooNarrow) issues.push(`${key} 交互区域宽度不足24px：“${text}”`);
    }
  }

  if (issues.length > 0) {
    console.error(`响应式布局审计失败：${issues.length} 项`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(`响应式布局审计通过：${pages.length} 页面 × ${viewports.length} 视口`);
  }
} finally {
  await browser.close();
}

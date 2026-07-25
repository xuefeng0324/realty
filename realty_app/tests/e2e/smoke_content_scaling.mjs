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
const scales = [1.25, 1.5];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();
const issues = [];

try {
  for (const scale of scales) {
    for (const target of pages) {
      await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(target.wait ?? 900);
      const result = await page.evaluate((zoomScale) => {
        document.documentElement.style.zoom = String(zoomScale);
        const viewportWidth = window.innerWidth;
        const isVisible = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const isScrollable = (element) => Boolean(
          element.closest("scroll-view, .uni-scroll-view, .map-mode-scroll, .dash-tabs-scroll")
        );
        const interactive = Array.from(document.querySelectorAll(
          "button, .btn, .theme-option, .map-mode-btn, [role='button']"
        )).filter(isVisible);
        const clipped = interactive
          .filter((element) => {
            if (isScrollable(element)) return false;
            const rect = element.getBoundingClientRect();
            return rect.left < -1 || rect.right > viewportWidth + 1;
          })
          .map((element) => element.textContent?.trim().slice(0, 30) ?? "");
        const truncated = interactive
          .filter((element) => {
            if (isScrollable(element)) return false;
            const style = getComputedStyle(element);
            return style.whiteSpace === "nowrap" && element.scrollWidth > element.clientWidth + 1;
          })
          .map((element) => element.textContent?.trim().slice(0, 30) ?? "");
        const rootWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
        return { viewportWidth, rootWidth, clipped, truncated };
      }, scale);

      const key = `${target.name}:${Math.round(scale * 100)}%`;
      if (result.rootWidth > result.viewportWidth + 2) {
        issues.push(`${key} 页面横向溢出 ${Math.round(result.rootWidth - result.viewportWidth)}px`);
      }
      for (const text of result.clipped) issues.push(`${key} 交互控件被裁切：“${text}”`);
      for (const text of result.truncated) issues.push(`${key} 交互文字被截断：“${text}”`);
    }
  }

  if (issues.length > 0) {
    console.error(`内容缩放审计失败：${issues.length} 项`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(`内容缩放审计通过：${pages.length} 页面 × ${scales.length} 缩放级别`);
  }
} finally {
  await browser.close();
}

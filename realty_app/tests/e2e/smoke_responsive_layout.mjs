import { chromium } from "playwright";

const BASE_URL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const UPGRADE_PATH = "/#/pages/upgrade-popup/upgrade-popup";
const UPGRADE_PENDING_KEY = "realty_app.update.pendingManifest";
const UPGRADE_MANIFEST = {
  versionName: "1.122.0",
  versionCode: 279,
  notes: "移动端五栏改版验收。",
  force: false
};
const pages = [
  { name: "dashboard", path: "/#/pages/dashboard/dashboard", wait: 1400 },
  { name: "listings", path: "/#/pages/listing-filter/listing-filter" },
  { name: "listing-detail", path: "/#/pages/listing-detail/listing-detail?id=1227" },
  { name: "community", path: "/#/pages/community/community?id=24" },
  { name: "school", path: "/#/pages/school/school" },
  { name: "school-detail", path: "/#/pages/school-detail/school-detail?id=1" },
  { name: "stats70", path: "/#/pages/stats70/stats70" },
  { name: "wangqian", path: "/#/pages/wangqian/wangqian" },
  { name: "profile", path: "/#/pages/settings/settings" },
  { name: "gov-webview", path: "/#/pages/gov-webview/gov-webview" },
  { name: "map", path: "/#/pages/map-view/map-view" },
  { name: "market", path: "/#/pages/market/market" },
  { name: "upgrade", path: "/#/pages/upgrade-popup/upgrade-popup" },
  { name: "macro-rates", path: "/#/pages/macro-rates/macro-rates" },
  { name: "macro-fx", path: "/#/pages/macro-fx/macro-fx" },
  { name: "macro-industry", path: "/#/pages/macro-industry/macro-industry" },
  { name: "macro-region", path: "/#/pages/macro-region/macro-region" },
  { name: "macro-trade", path: "/#/pages/macro-trade/macro-trade" },
  { name: "data-tools", path: "/#/pages/data-tools/data-tools" },
  { name: "supply", path: "/#/pages/supply/supply" },
  { name: "trend-analysis", path: "/#/pages/trend-analysis/trend-analysis" },
  { name: "map-analysis", path: "/#/pages/map-analysis/map-analysis" }
];
const viewports = [
  { name: "phone-320", width: 320, height: 800 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 }
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: viewports[0] });
const page = await context.newPage();
const issues = [];
const consoleErrors = [];
const pageErrors = [];
let activeAuditKey = "bootstrap";

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(`${activeAuditKey}: ${message.text()}`);
  }
});
page.on("pageerror", (error) => {
  pageErrors.push(`${activeAuditKey}: ${error.message}`);
});

try {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const target of pages) {
      const key = `${target.name}:${viewport.name}`;
      activeAuditKey = key;
      if (target.path === UPGRADE_PATH) {
        await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded" });
        await page.evaluate(
          ({ key, manifest }) => localStorage.setItem(key, JSON.stringify(manifest)),
          { key: UPGRADE_PENDING_KEY, manifest: UPGRADE_MANIFEST }
        );
      }
      await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(target.wait ?? 600);
      if (!page.url().includes(target.path.split("?")[0])) {
        issues.push(`${target.name}:${viewport.name} 路由被重定向到 ${page.url()}`);
        continue;
      }
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

      if (result.documentWidth > result.viewportWidth + 2) {
        issues.push(`${key} 页面横向溢出 ${result.documentWidth - result.viewportWidth}px`);
      }
      for (const text of result.clipped) issues.push(`${key} 交互区域被裁切：“${text}”`);
      for (const text of result.tooNarrow) issues.push(`${key} 交互区域宽度不足24px：“${text}”`);
    }
  }

  for (const error of consoleErrors) issues.push(`console.error ${error}`);
  for (const error of pageErrors) issues.push(`pageerror ${error}`);

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

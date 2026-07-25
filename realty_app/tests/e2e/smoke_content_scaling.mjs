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
          element.closest("scroll-view, .uni-scroll-view, .map-mode-scroll, .dash-tabs")
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
        const overflowing = Array.from(document.querySelectorAll("*"))
          .filter(isVisible)
          // swiper 会把未激活页横向放在视口外，属于轮播内部轨道，不是页面溢出。
          .filter((element) => !element.closest("swiper, .uni-swiper, .hero-scroll"))
          // 横向页签和模式条本来就允许滚动；浏览器调试高亮层也不属于应用布局。
          .filter((element) => !isScrollable(element) && !String(element.className).includes("luna-dom-highlighter"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              className: typeof element.className === "string" ? element.className.slice(0, 80) : element.tagName,
              text: element.textContent?.trim().slice(0, 40) ?? "",
              left: Math.round(rect.left),
              width: Math.round(rect.width),
              right: Math.round(rect.right)
            };
          })
          .filter((item) => item.right > viewportWidth + 2)
          .sort((a, b) => b.right - a.right)
          .slice(0, 3);
        return { viewportWidth, rootWidth, clipped, truncated, overflowing };
      }, scale);

      const key = `${target.name}:${Math.round(scale * 100)}%`;
      if (result.rootWidth > result.viewportWidth + 2 && result.overflowing.length > 0) {
        const detail = result.overflowing.map((item) => `${item.className}(${item.left}+${item.width}=${item.right})“${item.text}”`).join("；");
        issues.push(`${key} 页面横向溢出 ${Math.round(result.rootWidth - result.viewportWidth)}px${detail ? `：${detail}` : ""}`);
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

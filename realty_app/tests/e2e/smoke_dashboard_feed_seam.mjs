/**
 * 1.122 首页信息流连续性：新版壳层区块间距统一、无横向溢出或异常大沟。
 */
import { chromium } from "playwright";

const BASE_URL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const MAX_SECTION_GAP_PX = 16;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();
const issues = [];

try {
  for (const mode of ["light", "dark"]) {
    await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded" });
    await page.evaluate((theme) => localStorage.setItem("realty:themeMode", theme), mode);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const report = await page.evaluate(() => {
      const shell = document.querySelector(".home-v122-shell");
      if (!shell) return null;
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.height > 4;
      };
      const shellRect = shell.getBoundingClientRect();
      const children = Array.from(shell.children).filter(visible);
      const gaps = children.slice(0, -1).map((element, index) => {
        const next = children[index + 1];
        return Math.round((next.getBoundingClientRect().top - element.getBoundingClientRect().bottom) * 100) / 100;
      });
      const overflow = children
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < shellRect.left - 1 || rect.right > shellRect.right + 1;
        })
        .map((element) => element.className.toString());
      const transparent = children
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.backgroundColor === "rgba(0, 0, 0, 0)" && style.backgroundImage === "none";
        })
        .map((element) => element.className.toString());
      return { childCount: children.length, gaps, overflow, transparent };
    });

    if (!report) {
      issues.push(`${mode}: 缺少 .home-v122-shell`);
      continue;
    }
    if (report.childCount < 5) issues.push(`${mode}: 首页可见区块过少 (${report.childCount})`);
    for (const gap of report.gaps) {
      if (gap < -1 || gap > MAX_SECTION_GAP_PX) {
        issues.push(`${mode}: 首页区块间距 ${gap}px 超出 -1..${MAX_SECTION_GAP_PX}px`);
      }
    }
    if (report.overflow.length) issues.push(`${mode}: 首页区块横向溢出 ${report.overflow.join(", ")}`);
    if (report.transparent.length) issues.push(`${mode}: 首页区块缺少可辨识表面 ${report.transparent.join(", ")}`);

    console.log(`[${mode}] sections=${report.childCount} gaps=${report.gaps.join(",")}`);
  }
} finally {
  await browser.close();
}

if (issues.length) {
  console.error("FAIL smoke_dashboard_feed_seam:");
  for (const issue of issues) console.error(" -", issue);
  process.exit(1);
}
console.log("PASS smoke_dashboard_feed_seam");

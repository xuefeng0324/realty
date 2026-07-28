/**
 * test-entry-1：金刚区「库存」→ navigate 供需独立页（非本页滚动）
 * 需本地 H5：E2E_BASE_URL 默认 http://127.0.0.1:5174
 */
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const issues = [];

try {
  await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1800);

  const inv = page.locator(".home-king-tile, [data-home-king]").filter({ hasText: "库存" }).first();
  if ((await inv.count()) < 1) {
    issues.push("找不到金刚区「库存」入口");
  } else {
    await inv.click();
    await page.waitForTimeout(1500);
    const url = page.url();
    if (!url.includes("pages/supply/supply")) {
      issues.push(`点击库存后未进入供需页，当前 URL=${url}`);
    } else {
      const header = page.locator("[data-supply-header]");
      if ((await header.count()) < 1) {
        issues.push("供需页缺少 data-supply-header");
      }
    }
  }

  // 频道「工具」也应跳数据工具页，而不是本页滚动
  await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1200);
  const tools = page.locator("[data-home-channel=\"tools\"]").first();
  if ((await tools.count()) < 1) {
    issues.push("找不到频道「工具」");
  } else {
    await tools.click();
    await page.waitForTimeout(1500);
    const url = page.url();
    if (!url.includes("pages/data-tools/data-tools")) {
      issues.push(`点击工具后未进入数据工具页，当前 URL=${url}`);
    }
  }

  if (issues.length) {
    console.error(`${issues.length} 失败`);
    issues.forEach((i) => console.error(`- ${i}`));
    process.exitCode = 1;
  } else {
    console.log("总计: entry-supply 独立页跳转通过");
  }
} catch (e) {
  console.error("E2E 失败（是否已起 npm run dev:h5？）:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await browser.close();
}

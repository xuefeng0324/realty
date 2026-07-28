/**
 * 概览不再默认折叠分组；进阶入口改为跳独立页。
 * 需本地 H5：E2E_BASE_URL 默认 http://127.0.0.1:5174
 */
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();
const issues = [];

try {
  await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);

  const collapsed = await page.locator(".overview-card--collapsed").count();
  if (collapsed !== 0) issues.push(`概览不应再折叠分组，实际 ${collapsed}`);

  const toggleAll = page.locator(".overview-toggle-all");
  if ((await toggleAll.count()) > 0) issues.push("不应再出现「全部展开/收起」");

  const jump = page.locator(".overview-jump");
  if ((await jump.count()) > 0) issues.push("不应再出现滚锚点快捷按钮 overview-jump");

  const tools = page.locator("[data-dash-advanced-tools]");
  const trend = page.locator("[data-dash-advanced-trend]");
  if ((await tools.count()) < 1) issues.push("缺少进阶→数据工具入口");
  if ((await trend.count()) < 1) issues.push("缺少进阶→深度可视化入口");

  await tools.first().click();
  await page.waitForTimeout(1200);
  if (!page.url().includes("pages/data-tools/data-tools")) {
    issues.push(`点数据工具未进独立页，URL=${page.url()}`);
  }

  if (issues.length) {
    console.error(`${issues.length} 失败`);
    issues.forEach((i) => console.error(`- ${i}`));
    process.exitCode = 1;
  } else {
    console.log("总计: dashboard 去折叠+进阶跳页 通过");
  }
} catch (e) {
  console.error("E2E 失败（是否已起 npm run dev:h5？）:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await browser.close();
}

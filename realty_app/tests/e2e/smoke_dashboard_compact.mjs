/**
 * 总览首屏精简：无指南/无个人化三按钮/无进阶占位；频道跳页。
 */
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const issues = [];

try {
  await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);

  if ((await page.locator("[data-dash-guide]").count()) > 0) issues.push("首屏不应再有指南 banner");
  if ((await page.locator("[data-dash-personalize]").count()) > 0) issues.push("首屏不应再有卡片管理按钮");
  if ((await page.locator("[data-dash-advanced-section]").count()) > 0) issues.push("首屏不应再有进阶分析占位");
  if ((await page.locator(".overview-card--collapsed").count()) > 0) issues.push("概览不应折叠");
  if ((await page.locator("[data-home-entry]").count()) < 1) issues.push("缺少首页入口壳");
  if ((await page.locator("[data-home-channels]").count()) < 1) issues.push("缺少频道条");

  const tools = page.locator('[data-home-channel="tools"]').first();
  if ((await tools.count()) < 1) issues.push("缺少频道工具");
  else {
    await tools.click();
    await page.waitForTimeout(1200);
    if (!page.url().includes("pages/data-tools/data-tools")) {
      issues.push(`工具未跳页 URL=${page.url()}`);
    }
  }

  if (issues.length) {
    console.error(`${issues.length} 失败`);
    issues.forEach((i) => console.error(`- ${i}`));
    process.exitCode = 1;
  } else {
    console.log("总计: 首屏精简通过");
  }
} catch (e) {
  console.error("E2E 失败:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await browser.close();
}

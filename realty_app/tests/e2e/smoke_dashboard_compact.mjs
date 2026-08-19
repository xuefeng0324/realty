/**
 * 1.122 首页首屏：核心指标、五入口与推荐内容；旧专业工具迁入行情。
 */
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const issues = [];

try {
  await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);

  if ((await page.locator("[data-dash-guide]:visible").count()) > 0) issues.push("首屏不应再有指南 banner");
  if ((await page.locator("[data-dash-personalize]:visible").count()) > 0) issues.push("首屏不应再有卡片管理按钮");
  if ((await page.locator("[data-dash-advanced-section]:visible").count()) > 0) issues.push("首屏不应再有进阶分析占位");
  if ((await page.locator(".overview-card--collapsed:visible").count()) > 0) issues.push("概览不应折叠");
  if ((await page.locator(".home-v122-shell:visible").count()) !== 1) issues.push("缺少新版首页壳");
  if ((await page.locator("[data-home-market-pulse]:visible .home-v122-metric").count()) !== 3) {
    issues.push("首页核心市场指标不是 3 项");
  }
  if ((await page.locator("[data-home-kingkong]:visible [data-home-king]").count()) !== 5) {
    issues.push("首页核心入口不是 5 项");
  }
  if ((await page.locator("[data-home-recommendations]:visible").count()) !== 1) {
    issues.push("首页缺少推荐内容");
  }

  const market = page.locator('[data-home-king="market"]:visible');
  await market.click();
  await page.waitForURL((url) => url.toString().includes("/pages/market/market"));
  await page.locator(".segmented-tabs__item:visible").filter({ hasText: "工具" }).click();
  const dataTools = page.locator(".entity-list-item:visible").filter({ hasText: "数据工具" });
  if ((await dataTools.count()) !== 1) issues.push("旧首页工具迁移后在行情中不可达");
  else {
    await dataTools.click();
    await page.waitForURL((url) => url.toString().includes("/pages/data-tools/data-tools"));
  }

  if (issues.length) {
    console.error(`${issues.length} 失败`);
    issues.forEach((i) => console.error(`- ${i}`));
    process.exitCode = 1;
  } else {
    console.log("总计: 1.122 首页精简与工具迁移通过");
  }
} catch (e) {
  console.error("E2E 失败:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await browser.close();
}

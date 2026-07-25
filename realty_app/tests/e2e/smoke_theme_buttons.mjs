import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();
const issues = [];

try {
  await page.goto(`${BASE_URL}/#/pages/settings/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  await page.locator(".theme-option").filter({ hasText: "浅色" }).click({ force: true });
  const lightTheme = await page.evaluate(() => document.documentElement.dataset.realtyTheme);
  if (lightTheme !== "light") issues.push(`浅色按钮未生效: ${lightTheme}`);

  await page.locator(".theme-option").filter({ hasText: "深色" }).click({ force: true });
  const darkTheme = await page.evaluate(() => document.documentElement.dataset.realtyTheme);
  if (darkTheme !== "dark") issues.push(`深色按钮未生效: ${darkTheme}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const persistedTheme = await page.evaluate(() => document.documentElement.dataset.realtyTheme);
  if (persistedTheme !== "dark") issues.push(`主题未持久化: ${persistedTheme}`);

  const healthRows = await page.locator("[data-source-health-row]").count();
  if (healthRows !== 5) issues.push(`官方数据新鲜度应显示 5 个来源，实际 ${healthRows}`);

  const healthBadges = await page.locator(".source-health-badge").count();
  if (healthBadges !== 5) issues.push(`官方数据新鲜度状态应有 5 个，实际 ${healthBadges}`);

  const lprHealthText = await page.locator("[data-source-health-row]").filter({ hasText: "贷款市场报价利率 LPR" }).count();
  if (lprHealthText !== 1) issues.push(`LPR 官方来源状态应显示 1 行，实际 ${lprHealthText}`);

  await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByText("数据设置", { exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  if (!page.url().includes("#/pages/settings/settings")) {
    issues.push(`数据设置按钮跳转错误: ${page.url()}`);
  }

  await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  const nextButton = page.getByText("下一周 ›", { exact: true });
  const nextDisabled = await nextButton.evaluate((el) =>
    el.hasAttribute("disabled") || el.closest("[disabled]") !== null
  );
  if (!nextDisabled) issues.push("最新周期的下一周按钮应禁用");

  if (issues.length > 0) {
    console.error(`${issues.length} 失败 / 0 通过`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log("总计: 8 通过 / 0 失败");
  }
} finally {
  await browser.close();
}

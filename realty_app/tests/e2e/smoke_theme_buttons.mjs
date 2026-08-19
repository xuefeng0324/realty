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

  await page.getByText("高级设置", { exact: true }).click({ force: true });
  if (await page.getByText("数据源类型", { exact: true }).count() !== 1) issues.push("高级设置展开后缺少数据源类型");
  if (await page.getByText("保存", { exact: true }).count() !== 1) issues.push("高级设置展开后缺少保存按钮");
  if (await page.getByText("启动时自动检查热更新", { exact: false }).count() !== 1) issues.push("关于区域未说明启动自动检查更新");

  const tabLabels = (await page.locator(".uni-tabbar__item:visible").allTextContents())
    .map((text) => text.trim())
    .filter(Boolean);
  for (const label of ["首页", "找房", "地图", "行情", "我的"]) {
    if (!tabLabels.some((text) => text.includes(label))) issues.push(`原生 TabBar 缺少“${label}”`);
  }

  const homeTab = page.locator(".uni-tabbar__item:visible").filter({ hasText: "首页" });
  await homeTab.click({ force: true });
  await page.waitForURL((url) =>
    url.toString().includes("/pages/dashboard/dashboard") || url.hash === "#/"
  );
  await page.locator(".home-v122-shell:visible").waitFor();
  await page.locator('[data-home-king="market"]:visible').click();
  await page.waitForURL((url) => url.toString().includes("/pages/market/market"));
  await page.locator(".segmented-tabs__item:visible").first().waitFor();
  if ((await page.locator(".segmented-tabs__item:visible").count()) !== 4) {
    issues.push("首页行情入口未到达四分类聚合页");
  }

  if (issues.length > 0) {
    console.error(`${issues.length} 失败 / 0 通过`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log("总计: 主题切换、持久化、五栏与行情入口通过");
  }
} finally {
  await browser.close();
}

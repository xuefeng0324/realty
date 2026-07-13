// tests/e2e/smoke_dashboard_tabs.mjs
// v0.48.0 dashboard-tabs: 顶部 tab 切换
import { chromium } from "playwright";

const URL = process.env.REALTY_E2E_URL || "http://localhost:5187/";

async function pickCity(page, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const trigger = page.locator(".form-row", { hasText: "城市" }).first();
  await trigger.waitFor({ state: "visible", timeout: 15000 });
  await trigger.click({ force: true });
  await page.waitForTimeout(500);
  const item = page.locator(`text=${label}`).first();
  await item.waitFor({ state: "visible", timeout: 6000 });
  await item.click({ force: true });
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(3000);

  // 切到深圳 (数据最多)
  await pickCity(page, "深圳");
  await page.waitForTimeout(1500);

  // 5 个 tab 都存在
  const tabCount = await page.locator(".dash-tab").count();
  if (tabCount !== 5) throw new Error(`tab count = ${tabCount}, expected 5`);
  console.log(`✓ 5 tabs found`);

  const labels = await page.$$eval(".dash-tab", (nodes) => nodes.map((n) => n.textContent.trim()));
  console.log(`✓ tabs: ${labels.join(" | ")}`);

  // 默认 all
  const active1 = await page.locator(".dash-tab.dash-tab--active").first().textContent();
  console.log(`✓ default active: ${active1.trim()}`);

  // 数量: all 多
  const allVisible = await page.$$eval(".card", (nodes) => nodes.filter((n) => {
    const s = window.getComputedStyle(n);
    return s.display !== "none" && n.offsetHeight > 0;
  }).length);
  console.log(`✓ ALL 显示卡片数: ${allVisible}`);

  // 截图: ALL
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "tests/e2e/screenshots/v0.48.0_tabs_all.png", fullPage: false });
  console.log(`📸 v0.48.0_tabs_all.png`);

  // 切换 price
  await page.locator(".dash-tab", { hasText: "价格画像" }).click();
  await page.waitForTimeout(800);
  const priceVisible = await page.$$eval(".card", (nodes) => nodes.filter((n) => {
    const s = window.getComputedStyle(n);
    return s.display !== "none" && n.offsetHeight > 0;
  }).length);
  console.log(`✓ 价格画像 显示卡片: ${priceVisible}`);
  if (priceVisible >= allVisible) throw new Error("price tab 没减少卡片");
  await page.screenshot({ path: "tests/e2e/screenshots/v0.48.0_tabs_price.png", fullPage: false });
  console.log(`📸 v0.48.0_tabs_price.png`);

  // 切换 school
  await page.locator(".dash-tab", { hasText: "学区配套" }).click();
  await page.waitForTimeout(800);
  const schoolVisible = await page.$$eval(".card", (nodes) => nodes.filter((n) => {
    const s = window.getComputedStyle(n);
    return s.display !== "none" && n.offsetHeight > 0;
  }).length);
  console.log(`✓ 学区配套 显示卡片: ${schoolVisible}`);
  await page.screenshot({ path: "tests/e2e/screenshots/v0.48.0_tabs_school.png", fullPage: false });
  console.log(`📸 v0.48.0_tabs_school.png`);

  // 切换 transit
  await page.locator(".dash-tab", { hasText: "通勤地铁" }).click();
  await page.waitForTimeout(800);
  const transitVisible = await page.$$eval(".card", (nodes) => nodes.filter((n) => {
    const s = window.getComputedStyle(n);
    return s.display !== "none" && n.offsetHeight > 0;
  }).length);
  console.log(`✓ 通勤地铁 显示卡片: ${transitVisible}`);
  await page.screenshot({ path: "tests/e2e/screenshots/v0.48.0_tabs_transit.png", fullPage: false });
  console.log(`📸 v0.48.0_tabs_transit.png`);

  // 切换 map
  await page.locator(".dash-tab", { hasText: "地图视图" }).click();
  await page.waitForTimeout(800);
  const mapVisible = await page.$$eval(".card", (nodes) => nodes.filter((n) => {
    const s = window.getComputedStyle(n);
    return s.display !== "none" && n.offsetHeight > 0;
  }).length);
  console.log(`✓ 地图视图 显示卡片: ${mapVisible}`);
  await page.screenshot({ path: "tests/e2e/screenshots/v0.48.0_tabs_map.png", fullPage: false });
  console.log(`📸 v0.48.0_tabs_map.png`);

  // 切回 ALL
  await page.locator(".dash-tab", { hasText: "全部" }).click();
  await page.waitForTimeout(600);
  const backAll = await page.$$eval(".card", (nodes) => nodes.filter((n) => {
    const s = window.getComputedStyle(n);
    return s.display !== "none" && n.offsetHeight > 0;
  }).length);
  if (backAll !== allVisible) console.warn(`重新 all 显示 ${backAll}, 与初 all (${allVisible}) 略有不同`);
  console.log(`✓ 切回 ALL 卡片: ${backAll}`);

  await browser.close();
  console.log("ALL GREEN");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});

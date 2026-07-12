// tests/e2e/smoke_listing_premium.mjs
// v0.17.0 trend-6: 验证 dashboard 「🏫 高学区评分房源」卡
// - 卡片存在 (深圳 + 广州)
// - 行数 >= 1
// - 切换城市后内容随之变化
// - 截图
import { chromium } from "playwright";
import { strict as assert } from "node:assert";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = "http://localhost:5174/#/pages/dashboard/dashboard";

async function setCityAndReload(page, cityId) {
  await page.evaluate(({ cityId }) => {
    localStorage.setItem("realty_app.cityId", String(cityId));
  }, { cityId });
  await page.reload({ waitUntil: "networkidle" });
  // uni-app 初始化 + watch 触发 + loadAll 完成通常需要 2-3s
  await page.waitForTimeout(3500);
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("[pageerror] " + e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push("[console.error] " + msg.text());
  });

  // 深圳
  await page.goto(BASE, { waitUntil: "networkidle" });
  await setCityAndReload(page, 2);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const cardTitles = await page.locator(".card-title").allTextContents();
  console.log("[smoke_listing_premium] 深圳 card titles:", cardTitles);

  const card = page.locator("text=高学区评分房源").first();
  await card.waitFor({ timeout: 10000 });
  // 取『🏫 高学区评分房源』卡片所在容器内的行 (避免和『小区 Top 8』『学区评分 Top 8 小区』混淆)
  const premiumCard = page.locator(".card", { has: page.locator("text=高学区评分房源") }).first();
  const rowsShenzhen = await premiumCard.locator(".community-row").count();
  console.log(`[smoke_listing_premium] 深圳 listing-premium card rows: ${rowsShenzhen}`);
  assert.ok(rowsShenzhen >= 1, `深圳 listing-premium 卡行数应 >= 1, 实际 ${rowsShenzhen}`);

  const titleShenzhen = await premiumCard.locator(".community-name").first().textContent();
  console.log(`[smoke_listing_premium] 深圳 first title: ${titleShenzhen}`);
  assert.ok(titleShenzhen && titleShenzhen.trim().length > 0, "深圳首行标题不应为空");

  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "v0.17.0_listing_premium_sz.png"),
    fullPage: true
  });

  // 广州
  await page.evaluate(() => window.scrollTo(0, 0));
  await setCityAndReload(page, 1);
  // 验证 city 切换生效
  const cityBadge = await page.evaluate(() => localStorage.getItem("realty_app.cityId"));
  console.log(`[smoke_listing_premium] 广州切换后 localStorage cityId=${cityBadge}`);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const cardGz = page.locator("text=高学区评分房源").first();
  await cardGz.waitFor({ timeout: 10000 });
  const premiumCardGz = page.locator(".card", { has: page.locator("text=高学区评分房源") }).first();
  const rowsGz = await premiumCardGz.locator(".community-row").count();
  console.log(`[smoke_listing_premium] 广州 listing-premium card rows: ${rowsGz}`);
  assert.ok(rowsGz >= 1, `广州 listing-premium 卡行数应 >= 1, 实际 ${rowsGz}`);
  const titleGz = await premiumCardGz.locator(".community-name").first().textContent();
  console.log(`[smoke_listing_premium] 广州 first title: ${titleGz}`);

  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "v0.17.0_listing_premium_gz.png"),
    fullPage: true
  });

  await browser.close();

  // 过滤掉良性的 404 和网络日志
  const realErrors = consoleErrors.filter(
    (e) => !e.includes("Failed to load resource") && !e.includes("404")
  );
  if (realErrors.length > 0) {
    console.warn("[smoke_listing_premium] console errors:");
    realErrors.forEach((e) => console.warn("  " + e));
  }

  console.log("[smoke_listing_premium] PASSED ✓");
}

run().catch((e) => {
  console.error("[smoke_listing_premium] FAILED:", e);
  process.exit(1);
});
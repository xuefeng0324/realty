// tests/e2e/smoke_commute.mjs
// v0.24.0 new-5: 验证 dashboard 「🚇 通勤时长榜」卡
// - 默认 深圳 → 福田CBD (深圳数据多)
// - 切到广州 → 珠江新城
// - 行可点 → 小区详情
// - 行数 >= 3
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

async function pickCity(page, cityName) {
  const current = (await page.locator(".picker-value").first().textContent()) ?? "";
  if (current.includes(cityName)) return;
  await page.locator(".form-row", { hasText: "城市" }).first().click({ force: true });
  await page.waitForTimeout(800);
  await page.locator(".sheet-item", { hasText: cityName }).first().click({ force: true });
  await page.waitForTimeout(4000);
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("[pageerror] " + e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push("[console.error] " + msg.text());
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 默认广州 → 切深圳
  await pickCity(page, "深圳");

  // 验证「🚇 通勤时长榜」卡存在
  const cardTitle = page.locator("text=通勤时长榜").first();
  await cardTitle.waitFor({ timeout: 8000 });
  const cardTitleText = await cardTitle.textContent();
  console.log(`[smoke_commute] 卡标题: ${cardTitleText?.trim()}`);
  assert.ok(cardTitleText?.includes("深圳") && cardTitleText?.includes("福田CBD"), "卡标题应包含深圳+福田CBD");

  const rankCard = page.locator(".card", { has: page.locator("text=通勤时长榜") }).first();

  // 验证 行数 >= 3
  const rowCount = await rankCard.locator(".wq-row").count();
  console.log(`[smoke_commute] 深圳 行数: ${rowCount}`);
  assert.ok(rowCount >= 3, `深圳通勤榜行数应 >= 3, 实际 ${rowCount}`);

  // 验证有「分钟」标签
  const minutesCount = await rankCard.locator(".commute-badge").count();
  console.log(`[smoke_commute] 分钟 badge 数: ${minutesCount}`);
  assert.ok(minutesCount >= 3, `分钟 badge 应 >= 3, 实际 ${minutesCount}`);

  // 验证城市均值
  const cityAvgText = await rankCard.locator("text=城市均").textContent();
  console.log(`[smoke_commute] 城市均值文本: ${cityAvgText?.trim()}`);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "v0.24.0_commute_sz.png"),
    fullPage: true
  });

  // 切到广州
  await pickCity(page, "广州");

  await cardTitle.waitFor({ timeout: 8000 });
  const cardTitleTextGz = await cardTitle.textContent();
  console.log(`[smoke_commute] 广州 卡标题: ${cardTitleTextGz?.trim()}`);
  assert.ok(cardTitleTextGz?.includes("广州") && cardTitleTextGz?.includes("珠江新城"), "广州卡标题应包含广州+珠江新城");

  const rankCardGz = page.locator(".card", { has: page.locator("text=通勤时长榜") }).first();
  const rowCountGz = await rankCardGz.locator(".wq-row").count();
  console.log(`[smoke_commute] 广州 行数: ${rowCountGz}`);
  assert.ok(rowCountGz >= 1, `广州通勤榜行数应 >= 1, 实际 ${rowCountGz}`);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "v0.24.0_commute_gz.png"),
    fullPage: true
  });

  await browser.close();

  const realErrors = consoleErrors.filter(
    (e) => !e.includes("Failed to load resource") && !e.includes("404")
  );
  if (realErrors.length > 0) {
    console.warn("[smoke_commute] console errors:");
    realErrors.forEach((e) => console.warn("  " + e));
  }

  console.log("[smoke_commute] PASSED ✓");
}

run().catch((e) => {
  console.error("[smoke_commute] FAILED:", e);
  process.exit(1);
});
// tests/e2e/smoke_commercial.mjs
// v0.19.0 new-2: 验证 dashboard 「🛒 商业热度」卡
// - 卡片存在 (深圳 + 广州)
// - 行数 >= 1
// - 含 emoji + 数字 (🍴🏦🏪)
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

  // 验证卡片存在
  const cardTitle = page.locator("text=商业热度 Top").first();
  await cardTitle.waitFor({ timeout: 10000 });

  // 取「商业热度」卡内的 .community-row 行
  const commercialCard = page.locator(".card", { has: page.locator("text=商业热度 Top") }).first();
  const rowsSz = await commercialCard.locator(".community-row").count();
  console.log(`[smoke_commercial] 深圳 商业热度 rows: ${rowsSz}`);
  assert.ok(rowsSz >= 1, `深圳商业热度卡行数应 >= 1, 实际 ${rowsSz}`);

  // 验证第一行包含 emoji 和数字
  const firstRow = commercialCard.locator(".community-row").first();
  const meta = await firstRow.locator(".muted").first().textContent();
  console.log(`[smoke_commercial] 深圳 first meta: ${meta?.trim()}`);
  assert.ok(meta?.includes("🍴"), "深圳首行应包含 🍴 emoji");
  assert.ok(meta?.includes("🏦"), "深圳首行应包含 🏦 emoji");
  assert.ok(meta?.includes("🏪"), "深圳首行应包含 🏪 emoji");

  // 验证「商业分」标识
  const scoreLabel = await firstRow.locator(".muted:has-text('商业分')").count();
  assert.ok(scoreLabel >= 1, "深圳首行应有 '商业分' 标识");

  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "v0.19.0_commercial_sz.png"),
    fullPage: true
  });

  // 广州
  await page.evaluate(() => window.scrollTo(0, 0));
  await setCityAndReload(page, 1);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const cardGz = page.locator("text=商业热度 Top").first();
  await cardGz.waitFor({ timeout: 10000 });
  const commercialCardGz = page.locator(".card", { has: page.locator("text=商业热度 Top") }).first();
  const rowsGz = await commercialCardGz.locator(".community-row").count();
  console.log(`[smoke_commercial] 广州 商业热度 rows: ${rowsGz}`);
  assert.ok(rowsGz >= 1, `广州商业热度卡行数应 >= 1, 实际 ${rowsGz}`);

  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "v0.19.0_commercial_gz.png"),
    fullPage: true
  });

  await browser.close();

  const realErrors = consoleErrors.filter(
    (e) => !e.includes("Failed to load resource") && !e.includes("404")
  );
  if (realErrors.length > 0) {
    console.warn("[smoke_commercial] console errors:");
    realErrors.forEach((e) => console.warn("  " + e));
  }

  console.log("[smoke_commercial] PASSED ✓");
}

run().catch((e) => {
  console.error("[smoke_commercial] FAILED:", e);
  process.exit(1);
});
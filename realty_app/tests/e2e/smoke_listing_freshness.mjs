// smoke_listing_freshness.mjs — v0.41.0 trend-21 房源新鲜度 E2E
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = process.env.REALTY_E2E_BASE_URL || "http://127.0.0.1:5175";

async function scrollCardIntoView(page, cardTitle) {
  for (let i = 0; i < 8; i++) {
    const vis = await page
      .locator(".card-title", { hasText: new RegExp(cardTitle) })
      .first()
      .isVisible()
      .catch(() => false);
    if (vis) return;
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(300);
  }
}

async function pickCity(page, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const trigger = page.locator(".form-row", { hasText: "城市" }).first();
  await trigger.waitFor({ state: "visible", timeout: 8000 });
  await trigger.click({ force: true });
  await page.waitForTimeout(600);
  const item = page.locator(".sheet-item", { hasText: new RegExp(label) }).first();
  await item.waitFor({ state: "visible", timeout: 8000 });
  await item.click({ force: true });
  await page.waitForTimeout(2500);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

  console.log(`navigate ${BASE}`);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 广州
  await scrollCardIntoView(page, "房源新鲜度");
  const gzVisible = await page
    .locator(".card-title", { hasText: /房源新鲜度/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!gzVisible) {
    console.error("FAIL: 广州 房源新鲜度 not visible");
    await browser.close();
    process.exit(1);
  }
  console.log("OK: 广州 房源新鲜度 visible");

  // 2 section title
  const sectionCount = await page.locator(".lf-section-title").count();
  console.log(`广州 .lf-section-title count = ${sectionCount}`);
  if (sectionCount !== 2) {
    console.error("FAIL: 应有 2 个 section title (新挂牌/滞销)");
    await browser.close();
    process.exit(1);
  }

  // 行数 (active + stale)
  const lfRowCount = await page.locator(".lf-row").count();
  console.log(`广州 .lf-row count = ${lfRowCount}`);
  if (lfRowCount < 5) {
    console.error("FAIL: 广州 lf-row < 5");
    await browser.close();
    process.exit(1);
  }

  // section title 文本
  const freshTitle = await page.locator(".lf-section-title").first().textContent();
  const staleTitle = await page.locator(".lf-section-title").nth(1).textContent();
  console.log(`fresh section: ${freshTitle}`);
  console.log(`stale section: ${staleTitle}`);
  if (!freshTitle.includes("新挂牌") || !staleTitle.includes("滞销")) {
    console.error("FAIL: section 标题不对");
    await browser.close();
    process.exit(1);
  }

  // 验证有 score 圆
  const scoreCount = await page.locator(".lf-score").count();
  console.log(`.lf-score count = ${scoreCount}`);
  if (scoreCount < 3) {
    console.error("FAIL: lf-score < 3");
    await browser.close();
    process.exit(1);
  }

  await scrollCardIntoView(page, "房源新鲜度");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.41.0_listing_freshness_gz.png`, fullPage: true });
  console.log("screenshot: v0.41.0_listing_freshness_gz.png");

  // 切到深圳
  await pickCity(page, "深圳");
  await page.waitForTimeout(2000);
  await scrollCardIntoView(page, "房源新鲜度");
  const szVisible = await page
    .locator(".card-title", { hasText: /房源新鲜度/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!szVisible) {
    console.error("FAIL: 深圳 房源新鲜度 not visible");
    await browser.close();
    process.exit(1);
  }
  const szRowCount = await page.locator(".lf-row").count();
  console.log(`深圳 .lf-row count = ${szRowCount}`);

  await scrollCardIntoView(page, "房源新鲜度");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.41.0_listing_freshness_sz.png`, fullPage: true });
  console.log("screenshot: v0.41.0_listing_freshness_sz.png");

  console.log("\nALL PASS");
  await browser.close();
}

main().catch((e) => {
  console.error("e2e error:", e);
  process.exit(1);
});
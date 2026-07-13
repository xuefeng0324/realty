// smoke_tag_combination.mjs — v0.40.0 trend-20 标签组合热度 E2E
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
  await scrollCardIntoView(page, "标签组合热度");
  const gzVisible = await page
    .locator(".card-title", { hasText: /标签组合热度/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!gzVisible) {
    console.error("FAIL: 广州 标签组合热度 not visible");
    await browser.close();
    process.exit(1);
  }
  console.log("OK: 广州 标签组合热度 visible");

  // 行数
  const gzRowCount = await page.locator(".tc-row").count();
  console.log(`广州 .tc-row count = ${gzRowCount}`);
  if (gzRowCount < 5) {
    console.error("FAIL: 广州 tc-row < 5");
    await browser.close();
    process.exit(1);
  }

  // 验证每行有 2 个 tc-tag
  const gzFirstRowTags = await page.locator(".tc-row").first().locator(".tc-tag").count();
  console.log(`首行 .tc-tag count = ${gzFirstRowTags}`);
  if (gzFirstRowTags !== 2) {
    console.error("FAIL: 每行应有 2 个 tag");
    await browser.close();
    process.exit(1);
  }

  // 验证 top 1 是 名校区+朝南 (from data)
  const top1Text = await page.locator(".tc-row").first().textContent();
  console.log(`top 1 内容: ${top1Text}`);
  if (!top1Text || !top1Text.includes("名校区") || !top1Text.includes("朝南")) {
    console.error(`FAIL: top 1 应包含 "名校区+朝南" (got: ${top1Text})`);
    await browser.close();
    process.exit(1);
  }

  await scrollCardIntoView(page, "标签组合热度");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.40.0_tag_combination_gz.png`, fullPage: true });
  console.log("screenshot: v0.40.0_tag_combination_gz.png");

  // 切到深圳
  await pickCity(page, "深圳");
  await page.waitForTimeout(2000);
  await scrollCardIntoView(page, "标签组合热度");
  const szVisible = await page
    .locator(".card-title", { hasText: /标签组合热度/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!szVisible) {
    console.error("FAIL: 深圳 标签组合热度 not visible");
    await browser.close();
    process.exit(1);
  }
  const szRowCount = await page.locator(".tc-row").count();
  console.log(`深圳 .tc-row count = ${szRowCount}`);
  if (szRowCount < 5) {
    console.error("FAIL: 深圳 tc-row < 5");
    await browser.close();
    process.exit(1);
  }

  await scrollCardIntoView(page, "标签组合热度");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.40.0_tag_combination_sz.png`, fullPage: true });
  console.log("screenshot: v0.40.0_tag_combination_sz.png");

  console.log("\nALL PASS");
  await browser.close();
}

main().catch((e) => {
  console.error("e2e error:", e);
  process.exit(1);
});
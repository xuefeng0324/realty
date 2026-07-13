// smoke_feature_premium.mjs — v0.39.0 trend-19 特征画像溢价 E2E
// 验证 dashboard 「💎 特征画像溢价 · {city}」卡, 4 个 dim block, bar / pct 渲染, 截图

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
  await scrollCardIntoView(page, "特征画像溢价");
  const gzVisible = await page
    .locator(".card-title", { hasText: /特征画像溢价/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!gzVisible) {
    console.error("FAIL: 广州 特征画像溢价 not visible");
    await browser.close();
    process.exit(1);
  }
  console.log("OK: 广州 特征画像溢价 visible");

  // 4 dim block (4 维度)
  const gzBlockCount = await page.locator(".fp-dim-block").count();
  console.log(`广州 .fp-dim-block count = ${gzBlockCount}`);
  if (gzBlockCount < 3) {
    console.error("FAIL: 广州 dim block < 3");
    await browser.close();
    process.exit(1);
  }

  // 行数
  const gzRowCount = await page.locator(".fp-row").count();
  console.log(`广州 .fp-row count = ${gzRowCount}`);
  if (gzRowCount < 6) {
    console.error("FAIL: 广州 fp-row < 6");
    await browser.close();
    process.exit(1);
  }

  // 验证有正负溢价
  const upPct = await page.locator(".fp-pct-up").count();
  const downPct = await page.locator(".fp-pct-down").count();
  console.log(`+ 溢价行数 = ${upPct}, - 折价行数 = ${downPct}`);
  if (upPct < 1 || downPct < 1) {
    console.error("FAIL: 应同时有 + / - 溢价");
    await browser.close();
    process.exit(1);
  }

  await scrollCardIntoView(page, "特征画像溢价");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.39.0_feature_premium_gz.png`, fullPage: true });
  console.log("screenshot: v0.39.0_feature_premium_gz.png");

  // 切到深圳
  await pickCity(page, "深圳");
  await page.waitForTimeout(2000);
  await scrollCardIntoView(page, "特征画像溢价");
  const szBlockCount = await page.locator(".fp-dim-block").count();
  console.log(`深圳 .fp-dim-block count = ${szBlockCount}`);
  if (szBlockCount !== 4) {
    console.error(`FAIL: 深圳 dim block != 4 (${szBlockCount})`);
    await browser.close();
    process.exit(1);
  }

  await scrollCardIntoView(page, "特征画像溢价");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.39.0_feature_premium_sz.png`, fullPage: true });
  console.log("screenshot: v0.39.0_feature_premium_sz.png");

  console.log("\nALL PASS");
  await browser.close();
}

main().catch((e) => {
  console.error("e2e error:", e);
  process.exit(1);
});
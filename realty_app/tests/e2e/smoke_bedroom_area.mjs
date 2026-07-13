// smoke_bedroom_area.mjs — v0.42.0 trend-22 户型 × 面积 联合热图 E2E
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
  await scrollCardIntoView(page, "户型 × 面积 分布");
  const gzVisible = await page
    .locator(".card-title", { hasText: /户型 × 面积 分布/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!gzVisible) {
    console.error("FAIL: 广州 热图 not visible");
    await browser.close();
    process.exit(1);
  }
  console.log("OK: 广州 户型 × 面积 分布 visible");

  // 行数 = bedrooms
  const gzRowCount = await page.locator(".ba-row").count();
  console.log(`广州 .ba-row count = ${gzRowCount} (1 header + N rows)`);
  if (gzRowCount < 3) {
    console.error("FAIL: ba-row < 3 (应至少有 header + 2 行)");
    await browser.close();
    process.exit(1);
  }

  // cell 数量
  const gzCellOn = await page.locator(".ba-cell-on").count();
  const gzCellOff = await page.locator(".ba-cell-off").count();
  console.log(`广州 .ba-cell-on = ${gzCellOn}, .ba-cell-off = ${gzCellOff}`);
  if (gzCellOn < 3) {
    console.error("FAIL: 应至少有 3 个 on cell");
    await browser.close();
    process.exit(1);
  }

  await scrollCardIntoView(page, "户型 × 面积 分布");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.42.0_bedroom_area_gz.png`, fullPage: true });
  console.log("screenshot: v0.42.0_bedroom_area_gz.png");

  // 切到深圳
  await pickCity(page, "深圳");
  await page.waitForTimeout(2000);
  await scrollCardIntoView(page, "户型 × 面积 分布");
  const szVisible = await page
    .locator(".card-title", { hasText: /户型 × 面积 分布/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!szVisible) {
    console.error("FAIL: 深圳 热图 not visible");
    await browser.close();
    process.exit(1);
  }
  const szCellOn = await page.locator(".ba-cell-on").count();
  console.log(`深圳 .ba-cell-on = ${szCellOn}`);

  await scrollCardIntoView(page, "户型 × 面积 分布");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.42.0_bedroom_area_sz.png`, fullPage: true });
  console.log("screenshot: v0.42.0_bedroom_area_sz.png");

  console.log("\nALL PASS");
  await browser.close();
}

main().catch((e) => {
  console.error("e2e error:", e);
  process.exit(1);
});
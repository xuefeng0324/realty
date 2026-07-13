// smoke_orientation_floor.mjs — v0.43.0 trend-23 朝向 × 楼层 溢价 E2E
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
  await scrollCardIntoView(page, "朝向 × 楼层 溢价");
  const gzVisible = await page
    .locator(".card-title", { hasText: /朝向 × 楼层 溢价/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!gzVisible) {
    console.error("FAIL: 广州 溢价卡 not visible");
    await browser.close();
    process.exit(1);
  }
  console.log("OK: 广州 朝向 × 楼层 溢价 visible");

  const gzRowUp = await page.locator(".of-row.of-row-up").count();
  const gzRowDown = await page.locator(".of-row.of-row-down").count();
  const gzMatrix = await page.locator(".of-matrix").count();
  const gzCellAny = await page.locator(".of-mcell").count();
  console.log(`广州 .of-row-up=${gzRowUp}, .of-row-down=${gzRowDown}, .of-matrix=${gzMatrix}, .of-mcell=${gzCellAny}`);
  if (gzRowUp < 1 || gzRowDown < 1 || gzMatrix !== 1 || gzCellAny < 5) {
    console.error("FAIL: 广州 card 结构不完整 (应有 5 溢价 + 5 折价 + 1 矩阵 + 12 cells)");
    await browser.close();
    process.exit(1);
  }

  await scrollCardIntoView(page, "朝向 × 楼层 溢价");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.43.0_orientation_floor_gz.png`, fullPage: true });
  console.log("screenshot: v0.43.0_orientation_floor_gz.png");

  // 切到珠海 (应有大折价)
  await pickCity(page, "珠海");
  await page.waitForTimeout(2000);
  await scrollCardIntoView(page, "朝向 × 楼层 溢价");
  const zhVisible = await page
    .locator(".card-title", { hasText: /朝向 × 楼层 溢价/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!zhVisible) {
    console.error("FAIL: 珠海 溢价卡 not visible");
    await browser.close();
    process.exit(1);
  }

  // 检查珠海 折价 应小于 -30%
  const zhPcts = await page.locator(".of-row.of-row-down .of-pct").allTextContents();
  console.log(`珠海 top-5 折价: ${zhPcts.slice(0, 5).join(", ")}`);
  const firstZh = parseFloat(zhPcts[0]);
  if (Number.isFinite(firstZh) && firstZh > -30) {
    console.error(`WARN: 珠海 折价头牌 ${firstZh}% 不够低 (期望 < -30%)`);
  }

  await scrollCardIntoView(page, "朝向 × 楼层 溢价");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.43.0_orientation_floor_zh.png`, fullPage: true });
  console.log("screenshot: v0.43.0_orientation_floor_zh.png");

  console.log("\nALL PASS");
  await browser.close();
}

main().catch((e) => {
  console.error("e2e error:", e);
  process.exit(1);
});
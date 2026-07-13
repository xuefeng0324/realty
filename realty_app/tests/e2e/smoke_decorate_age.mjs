// smoke_decorate_age.mjs — v0.44.0 trend-24 装修 × 楼龄 E2E
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = process.env.REALTY_E2E_BASE_URL || "http://127.0.0.1:5175";

async function scrollCardIntoView(page, cardTitle) {
  for (let i = 0; i < 10; i++) {
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
  await scrollCardIntoView(page, "装修 × 楼龄 溢价");
  const visible = await page
    .locator(".card-title", { hasText: /装修 × 楼龄 溢价/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!visible) {
    console.error("FAIL: 装修卡 not visible");
    await browser.close();
    process.exit(1);
  }
  console.log("OK: 装修 × 楼龄 溢价 visible");

  // 至少有 4 行 + 6 列 = 24 cells (card 内只有矩阵部分)
  // 区分: 我们限定 within the 装修 卡
  const cardCount = await page.locator(".card-title:has-text('装修 × 楼龄 溢价')").count();
  console.log(`装修卡数量: ${cardCount} (应 = 1)`);
  if (cardCount !== 1) {
    console.error("FAIL: 应有恰好 1 张装修卡");
    await browser.close();
    process.exit(1);
  }

  // 用 matrix 颜色计数 (针对 v0.44 装修卡)
  // 装修卡的 cell class: "of-mcell da-cell-xxx"
  // 用 selector 同时限定装修卡内 (因为 v0.43 用 of-cell-xxx)
  // 通过 class 包含 *da-cell 选择 (CSS attribute matcher)
  const v44Total = await page.locator('[class*="da-cell"]').count();
  const v44UpCount = await page.locator(".da-cell-up-strong").count();
  const v44DownCount = await page.locator(".da-cell-down-strong").count();
  console.log(`广州 v0.44 cell total=${v44Total} (strong-up=${v44UpCount}, strong-down=${v44DownCount})`);
  // 广州 4 装修 × 4 楼龄有数据 = 16 cells (因为 ≥ 2000 楼龄段空)
  if (v44Total < 10) {
    console.error(`FAIL: 装修卡 应至少 10 cells, got ${v44Total}`);
    await browser.close();
    process.exit(1);
  }

  await scrollCardIntoView(page, "装修 × 楼龄 溢价");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.44.0_decorate_age_gz.png`, fullPage: true });
  console.log("screenshot: v0.44.0_decorate_age_gz.png");

  // 切到珠海 (应有 strongest 折价)
  await pickCity(page, "珠海");
  await page.waitForTimeout(2000);
  await scrollCardIntoView(page, "装修 × 楼龄 溢价");
  const zhPcts = await page.locator(".of-row.of-row-down .of-pct").allTextContents();
  console.log(`珠海 top-5 折价: ${zhPcts.slice(0, 5).join(", ")}`);
  const worstZh = parseFloat(zhPcts[0]);
  if (worstZh > -30) {
    console.error(`FAIL: 珠海 折价头牌 ${worstZh}% > -30% (应有 stronger 折价)`);
    await browser.close();
    process.exit(1);
  }

  await scrollCardIntoView(page, "装修 × 楼龄 溢价");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.44.0_decorate_age_zh.png`, fullPage: true });
  console.log("screenshot: v0.44.0_decorate_age_zh.png");

  // 切到深圳 (应看豪装次新 2020+ 是否 +12.5%)
  await pickCity(page, "深圳");
  await page.waitForTimeout(2000);
  await scrollCardIntoView(page, "装修 × 楼龄 溢价");
  const szPcts = await page.locator(".of-row.of-row-up .of-pct").allTextContents();
  console.log(`深圳 top-5 溢价: ${szPcts.slice(0, 5).join(", ")}`);

  await scrollCardIntoView(page, "装修 × 楼龄 溢价");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.44.0_decorate_age_sz.png`, fullPage: true });
  console.log("screenshot: v0.44.0_decorate_age_sz.png");

  console.log("\nALL PASS");
  await browser.close();
}

main().catch((e) => {
  console.error("e2e error:", e);
  process.exit(1);
});
// smoke_scatter.mjs — v0.45.0 trend-25 社区 总价 × 单价 散点 E2E
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = process.env.REALTY_E2E_BASE_URL || "http://127.0.0.1:5175";

async function scrollCardIntoView(page, cardTitle) {
  for (let i = 0; i < 12; i++) {
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
  await scrollCardIntoView(page, "总价 × 单价 散点");
  const visible = await page
    .locator(".card-title", { hasText: /总价 × 单价 散点/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!visible) {
    console.error("FAIL: 散点卡 not visible");
    await browser.close();
    process.exit(1);
  }
  console.log("OK: 散点卡 visible");

  // SVG 是否渲染
  const svgCount = await page.locator("svg.scatter-svg").count();
  if (svgCount !== 1) {
    console.error(`FAIL: 应有 1 个 SVG, got ${svgCount}`);
    await browser.close();
    process.exit(1);
  }
  // 散点 circle 数量
  const circleCount = await page.locator("svg.scatter-svg circle").count();
  console.log(`广州 散点圆数量: ${circleCount} (排除虚线 line)`);
  if (circleCount < 3) {
    console.error(`FAIL: 应至少 3 个散点 (8 communities)`);
    await browser.close();
    process.exit(1);
  }

  // quadrant sections
  const qSections = await page.locator(".scatter-q-section").count();
  console.log(`quadrant sections: ${qSections} (应 = 4)`);
  if (qSections !== 4) {
    console.error(`FAIL: 应 4 quadrant, got ${qSections}`);
    await browser.close();
    process.exit(1);
  }

  await scrollCardIntoView(page, "总价 × 单价 散点");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.45.0_scatter_gz.png`, fullPage: true });
  console.log("screenshot: v0.45.0_scatter_gz.png");

  // 切到深圳
  await pickCity(page, "深圳");
  await page.waitForTimeout(2000);
  await scrollCardIntoView(page, "总价 × 单价 散点");
  const szCircles = await page.locator("svg.scatter-svg circle").count();
  console.log(`深圳 散点圆数量: ${szCircles}`);
  if (szCircles < 5) {
    console.error(`FAIL: 深圳 应 ≥ 5 散点, got ${szCircles}`);
    await browser.close();
    process.exit(1);
  }

  await scrollCardIntoView(page, "总价 × 单价 散点");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.45.0_scatter_sz.png`, fullPage: true });
  console.log("screenshot: v0.45.0_scatter_sz.png");

  console.log("\nALL PASS");
  await browser.close();
}

main().catch((e) => {
  console.error("e2e error:", e);
  process.exit(1);
});
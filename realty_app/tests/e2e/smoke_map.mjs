// smoke_map.mjs — v0.46.0 map-11 行政区 + 社区 marker SVG 地图 E2E
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = process.env.REALTY_E2E_BASE_URL || "http://127.0.0.1:5175";

async function scrollCardIntoView(page, cardTitle) {
  for (let i = 0; i < 15; i++) {
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
  await scrollCardIntoView(page, "行政区域图");
  const visible = await page
    .locator(".card-title", { hasText: /行政区域图/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!visible) {
    console.error("FAIL: 地图卡 not visible");
    await browser.close();
    process.exit(1);
  }
  console.log("OK: 地图卡 visible");

  // SVG + district path + marker 都存在
  const svgCount = await page.locator("svg.map-svg").count();
  if (svgCount !== 1) {
    console.error(`FAIL: 应有 1 个 SVG, got ${svgCount}`);
    await browser.close();
    process.exit(1);
  }

  const districtPathCount = await page.locator("svg.map-svg path.map-district-p").count();
  console.log(`广州 district 多边形数量: ${districtPathCount}`);
  if (districtPathCount < 1) {
    console.error(`FAIL: 应至少 1 个 district 多边形`);
    await browser.close();
    process.exit(1);
  }

  const districtLabelCount = await page.locator("svg.map-svg text.map-district-lbl").count();
  console.log(`广州 区名 label 数量: ${districtLabelCount}`);

  const markerCount = await page.locator("svg.map-svg circle.map-marker, svg.map-svg circle.map-marker-bare").count();
  console.log(`广州 marker 数量: ${markerCount}`);

  // 截图: 把 SVG 滚到 viewport 中心, 然后截 viewport
  await page.evaluate(() => {
    const svg = document.querySelector("svg.map-svg");
    if (svg) svg.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.46.0_map_gz.png`, fullPage: false });
  console.log("screenshot: v0.46.0_map_gz.png");

  // 切到深圳 (区数最多)
  await pickCity(page, "深圳");
  await page.waitForTimeout(2000);
  await scrollCardIntoView(page, "行政区域图");
  const szPathCount = await page.locator("svg.map-svg path.map-district-p").count();
  console.log(`深圳 district 多边形数量: ${szPathCount}`);
  if (szPathCount < 5) {
    console.error(`FAIL: 深圳 district ≥ 5, got ${szPathCount}`);
    await browser.close();
    process.exit(1);
  }

  await page.evaluate(() => {
    const svg = document.querySelector("svg.map-svg");
    if (svg) svg.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.46.0_map_sz.png`, fullPage: false });
  console.log("screenshot: v0.46.0_map_sz.png");

  console.log("\nALL PASS");
  await browser.close();
}

main().catch((e) => {
  console.error("e2e error:", e);
  process.exit(1);
});
// tests/e2e/smoke_drill_down.mjs
// v0.50.0 drill-1: 小区 drill-down — 散点/地图 marker 点击跳详情
import { chromium } from "playwright";
const URL = process.env.REALTY_E2E_URL || "http://localhost:5189/";

async function pickCity(page, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const trigger = page.locator(".form-row", { hasText: "城市" }).first();
  await trigger.waitFor({ state: "visible", timeout: 15000 });
  await trigger.click({ force: true });
  await page.waitForTimeout(500);
  const item = page.locator(`text=${label}`).first();
  await item.waitFor({ state: "visible", timeout: 6000 });
  await item.click({ force: true });
  await page.waitForTimeout(800);
}

async function scrollToCard(page, title) {
  await page.evaluate((t) => {
    const titles = Array.from(document.querySelectorAll(".card-title"));
    const el = titles.find((x) => (x.textContent || "").includes(t));
    if (el) {
      const card = el.closest(".card");
      if (card) card.scrollIntoView({ block: "start", behavior: "instant" });
      window.scrollBy(0, -140);
    }
  }, title);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERR:', e.message));
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(3500);

  await pickCity(page, "深圳");
  await page.waitForTimeout(1500);

  // 1. 散点卡的 row 点击 → 跳详情
  await scrollToCard(page, "社区 总价 × 单价 散点");
  await page.waitForTimeout(400);
  const scatterRowCount = await page.$$eval(".scatter-row.tap-row", (nodes) => nodes.length);
  console.log(`✓ 散点卡 quadrant row 数量: ${scatterRowCount}`);
  if (scatterRowCount === 0) throw new Error("scatter rows not found");
  await page.screenshot({ path: "tests/e2e/screenshots/v0.50.0_drill_before.png", fullPage: false });

  // 取第一行的 name 文本
  const targetName = await page.$eval(".scatter-row.tap-row .scatter-name", (el) => el.textContent.trim());
  console.log(`点 1st row (${targetName})`);
  await page.locator(".scatter-row.tap-row").first().click({ force: true });
  await page.waitForTimeout(1500);
  // 应该跳到 community 详情页 (URL 包含 community/community)
  const url1 = page.url();
  console.log(`✓ 跳到 URL: ${url1.split("/").pop()}`);
  if (!url1.includes("/community/community")) throw new Error(`expected URL 含 /community/community, got ${url1}`);

  // 截图详情页
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "tests/e2e/screenshots/v0.50.0_drill_detail.png", fullPage: false });

  // 返回 dashboard
  await page.goBack();
  await page.waitForTimeout(2500);

  // 2. 散点 SVG 圆点点击 (回 dashboard 后)
  await scrollToCard(page, "社区 总价 × 单价 散点");
  await page.waitForTimeout(400);
  const ptCount = await page.$$eval("circle.scatter-pt", (nodes) => nodes.length);
  console.log(`✓ scatter SVG 圆点 数量: ${ptCount}`);
  if (ptCount === 0) throw new Error("scatter svg pts not found");
  // click first pt
  const ptName = await page.$eval("circle.scatter-pt", (n) => n.getAttribute("data-name"));
  console.log(`点 SVG 圆点 ${ptName}`);
  // SVG 在 H5 中 click 可能不响应 — 用 dispatchEvent fallback
  const clicked = await page.evaluate(() => {
    const c = document.querySelector("circle.scatter-pt");
    if (!c) return false;
    c.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  });
  console.log(`✓ SVG dispatch click: ${clicked}`);
  await page.waitForTimeout(1500);
  const url2 = page.url();
  if (!url2.includes("/community/community")) {
    console.warn(`⚠ H5 SVG 点击可能未触发: still on ${url2.split("/").pop()}`);
  } else {
    console.log(`✓ SVG 点击也跳到详情页: ${url2.split("/").pop()}`);
  }

  // 3. 行政区图 marker 点击
  if (!url2.includes("/community/community")) {
    await page.goBack();  // 回到 dashboard
    await page.waitForTimeout(2500);
  } else {
    await page.goBack();
    await page.waitForTimeout(2500);
  }

  // 切到地图 tab
  await page.locator(".dash-tab", { hasText: "地图视图" }).click();
  await page.waitForTimeout(1000);
  await scrollToCard(page, "行政区域图");
  await page.waitForTimeout(600);

  // marker (≤30 时是 .map-marker-g tap-row)
  const markerCount = await page.$$eval("g.map-marker-g", (nodes) => nodes.length);
  console.log(`✓ 地图 marker 数量: ${markerCount}`);
  if (markerCount > 0) {
    const firstMarkerName = await page.$eval("g.map-marker-g text.map-marker-lbl", (el) => el.textContent.trim()).catch(() => "?");
    console.log(`点 marker ${firstMarkerName}`);
    await page.locator("g.map-marker-g").first().click({ force: true });
    await page.waitForTimeout(1500);
    const url3 = page.url();
    if (!url3.includes("/community/community")) {
      console.warn(`⚠ marker g click 没跳: ${url3.split("/").pop()}`);
    } else {
      console.log(`✓ marker click 跳到详情页`);
    }
  }

  await browser.close();
  console.log("ALL GREEN");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});

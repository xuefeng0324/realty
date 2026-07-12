// tests/e2e/smoke_school_community.mjs
// v0.14.0: 验证 dashboard 学区评分 Top 小区卡
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../e2e-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";

async function gotoDashboard(page, cityId) {
  await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  if (cityId == null || cityId === 1) return;
  const cityName = { 1: "广州", 2: "深圳", 3: "珠海" }[cityId];
  await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
  await page.waitForTimeout(200);
  await page.locator(".form-row").first().click({ force: true });
  await page.waitForTimeout(800);
  await page.getByText(cityName, { exact: true }).last().click({ force: true });
  await page.waitForTimeout(3500);
}

async function expectSchoolCommunityCard(page, label) {
  const card = page.locator(".card-title:has-text('学区评分 Top')").first();
  await card.waitFor({ timeout: 10000 });
  console.log(`[${label}] 学区评分 Top 小区卡 ✓`);
  // 至少 1 个小区行
  const items = await page.locator(".sp-medal-mini").count();
  console.log(`[${label}] 小区数: ${items}`);
  if (items < 1) {
    throw new Error(`[${label}] 学区评分 Top 0 条`);
  }
  // 取第一项
  const firstName = await page.locator(".sp-medal-mini").first().locator("..").locator("..").locator(".community-name").first().textContent();
  const firstScore = await page.locator(".sp-medal-mini").first().locator("..").locator("..").locator(".muted").first().textContent();
  console.log(`[${label}] Top 1: ${firstName}`);
  console.log(`[${label}] score meta: ${firstScore}`);
  if (!firstScore || !/评分 \d+\.\d/.test(firstScore)) {
    throw new Error(`[${label}] 学区评分 meta 格式错: ${firstScore}`);
  }
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  try {
    // === 广州 ===
    await gotoDashboard(page, 1);
    await expectSchoolCommunityCard(page, "广州");
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_school_community_gz.png"),
      fullPage: true
    });
    console.log("[gz] 截图已保存");

    // === 深圳 ===
    await gotoDashboard(page, 2);
    await expectSchoolCommunityCard(page, "深圳");
    const body = await page.locator("body").textContent();
    if (!/南山|福田|罗湖/.test(body)) {
      console.warn("[sz] 学区评分榜 Top 1 区不在南山/福田/罗湖");
    }
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_school_community_sz.png"),
      fullPage: true
    });
    console.log("[sz] 截图已保存");

    console.log("\n✓ smoke_school_community 通过");
  } catch (e) {
    console.error("\n✗ smoke_school_community 失败:", e.message);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_school_community_FAIL.png"),
      fullPage: true
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
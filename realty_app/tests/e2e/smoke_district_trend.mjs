/**
 * smoke_district_trend.mjs
 * ===========================
 * Playwright E2E 测试：
 *   1. 打开 dashboard（默认 Guangzhou）
 *   2. 验证存在「区级近 8 周房价趋势」卡片
 *   3. 至少渲染 1 个区
 *   4. 截图保存
 *   5. 切到 Shenzhen，验证 cards 仍可见
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, "../../e2e-screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";

async function gotoDashboard(page, cityId) {
  // 直接 goto dashboard root（默认 cityId=1 广州）
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".trend-row", { timeout: 15000 });
  if (cityId == null || cityId === 1) return;

  // 切到目标城市：通过设置 pinia 的 cityId + 重新触发 loadAll
  // dashboard 的 watch 只在 setCityId 后触发；这里用 evaluate 直接调 store
  // 但 dashboard 的 cityId 由 pinia store 持有，且 storage 用 uni API。
  // 最稳妥：用 dashboard 自己的 action sheet（点击 "城市" 按钮 + 选项）
  const cityName = await page.evaluate((cid) => {
    return { 1: "广州", 2: "深圳", 3: "珠海" }[cid] ?? "";
  }, cityId);

  // 当前显示的城市
  const current = (await page.locator(".picker-value").first().textContent()) ?? "";
  if (current.includes(cityName)) return;

  // uni-page-head 可能遮挡：把 head 隐藏
  await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
  await page.waitForTimeout(200);

  // 点城市按钮
  await page.locator("text=城市").first().click({ force: true });
  await page.waitForTimeout(800);

  // 在 sheet 中点目标城市
  await page.locator(`text=${cityName}`).first().click({ force: true });
  // 等 loadAll 完成
  await page.waitForTimeout(4000);
}

async function expectTrendCard(page, label) {
  // 等到卡片出现
  const card = page.locator("text=区级近 8 周房价趋势").first();
  await card.waitFor({ timeout: 15000 });
  console.log(`[${label}] 卡片存在 ✓`);

  // 验证至少 1 个 trend-row
  const rows = await page.locator(".trend-row").count();
  if (rows < 1) {
    throw new Error(`[${label}] 期望 ≥1 个区行, 实际 ${rows}`);
  }
  console.log(`[${label}] 区数: ${rows} ✓`);

  // 验证区名非空
  const firstName = await page.locator(".trend-name").first().textContent();
  if (!firstName || firstName.trim().length === 0) {
    throw new Error(`[${label}] 第一个区名为空`);
  }
  console.log(`[${label}] 首个区: ${firstName} ✓`);

  // 验证变化率显示
  const change = await page.locator(".trend-change").first().textContent();
  if (!change) {
    throw new Error(`[${label}] 变化率为空`);
  }
  console.log(`[${label}] 变化率: ${change.trim()} ✓`);
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  try {
    // Guangzhou (city_id=1)
    await gotoDashboard(page, 1);
    await expectTrendCard(page, "广州");
    await page.screenshot({
      path: path.join(OUT_DIR, "smoke_district_trend_gz.png"),
      fullPage: true
    });
    console.log("  截图已保存 → smoke_district_trend_gz.png");

    // Shenzhen (city_id=2)
    await gotoDashboard(page, 2);
    await expectTrendCard(page, "深圳");
    await page.screenshot({
      path: path.join(OUT_DIR, "smoke_district_trend_sz.png"),
      fullPage: true
    });
    console.log("  截图已保存 → smoke_district_trend_sz.png");

    console.log("\n✓ smoke_district_trend 通过");
  } catch (e) {
    console.error("\n✗ smoke_district_trend 失败:", e.message);
    await page.screenshot({
      path: path.join(OUT_DIR, "smoke_district_trend_FAIL.png"),
      fullPage: true
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
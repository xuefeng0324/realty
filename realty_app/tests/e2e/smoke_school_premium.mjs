// tests/e2e/smoke_school_premium.mjs
// v0.11.0: 验证 dashboard 学区溢价榜卡片
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../e2e-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  try {
    // === Guangzhou (默认 cityId=1) ===
    await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".sp-row", { timeout: 15000 });
    const gzCard = page.locator(".card-title:has-text('学区溢价榜')").first();
    await gzCard.waitFor({ timeout: 10000 });
    console.log("[gz] 卡片存在 ✓");
    const gzRows = await page.locator(".sp-row").count();
    if (gzRows < 1) throw new Error(`广州期望 ≥1 个区, 实际 ${gzRows}`);
    console.log(`[gz] 学区溢价区数: ${gzRows} ✓`);
    const gzTitle = await gzCard.textContent();
    if (!gzTitle.includes("广州")) throw new Error(`广州标题错: ${gzTitle}`);
    const gzFirst = await page.locator(".sp-district").first().textContent();
    const gzPremium = await page.locator(".sp-premium").first().textContent();
    console.log(`[gz] 第一名: ${gzFirst} / ${gzPremium}`);
    const gzMedal = await page.locator(".medal-gold").count();
    console.log(`[gz] 金牌: ${gzMedal}`);
    if (gzMedal < 1) throw new Error("广州缺金牌");
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_school_premium_gz.png"),
      fullPage: true
    });
    console.log("[gz] 截图已保存");

    // === Shenzhen ===
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    await page.waitForTimeout(300);
    // 点 dashboard 顶部"城市"按钮 (form-row)
    await page.locator(".form-row").first().click({ force: true });
    await page.waitForTimeout(800);
    // sheet 用 .last() 拿真正的 sheet 里的"深圳"
    await page.getByText("深圳", { exact: true }).last().click({ force: true });
    await page.waitForTimeout(4000);

    const szCard = page.locator(".card-title:has-text('学区溢价榜')").first();
    await szCard.waitFor({ timeout: 10000 });
    console.log("[sz] 卡片存在 ✓");
    const szTitle = await szCard.textContent();
    if (!szTitle.includes("深圳")) throw new Error(`深圳标题错: ${szTitle}`);
    const szRows = await page.locator(".sp-row").count();
    if (szRows < 1) throw new Error(`深圳期望 ≥1 个区, 实际 ${szRows}`);
    console.log(`[sz] 学区溢价区数: ${szRows} ✓`);
    const szFirst = await page.locator(".sp-district").first().textContent();
    const szPremium = await page.locator(".sp-premium").first().textContent();
    console.log(`[sz] 第一名: ${szFirst} / ${szPremium}`);
    if (!/南山|福田|龙华|罗湖/.test(szFirst)) {
      throw new Error(`深圳 Top 1 应为深圳区, 实际: ${szFirst}`);
    }
    const szMedal = await page.locator(".medal-gold").count();
    console.log(`[sz] 金牌: ${szMedal}`);
    if (szMedal < 1) throw new Error("深圳缺金牌");
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_school_premium_sz.png"),
      fullPage: true
    });
    console.log("[sz] 截图已保存");

    console.log("\n✓ smoke_school_premium 通过");
  } catch (e) {
    console.error("\n✗ smoke_school_premium 失败:", e.message);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_school_premium_FAIL.png"),
      fullPage: true
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
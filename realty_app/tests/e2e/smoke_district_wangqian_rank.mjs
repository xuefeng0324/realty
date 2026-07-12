// tests/e2e/smoke_district_wangqian_rank.mjs
// v0.23.0 trend-9: 验证 dashboard 「🔥 全品类区级网签热度榜」卡
// - 默认「全部」 tab
// - 切到「新房」 tab → 数据切换
// - 切到「二手」 tab → 数据切换 (深圳有二手)
// - 行数 >= 1
// - 截图
import { chromium } from "playwright";
import { strict as assert } from "node:assert";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = "http://localhost:5174/#/pages/dashboard/dashboard";

async function pickCity(page, cityName) {
  const current = (await page.locator(".picker-value").first().textContent()) ?? "";
  console.log(`[pickCity] 当前 picker 显示: "${current.trim()}"`);
  if (current.includes(cityName)) {
    console.log(`[pickCity] 已是 ${cityName}, 跳过`);
    return;
  }
  await page.locator(".form-row", { hasText: "城市" }).first().click({ force: true });
  await page.waitForTimeout(800);
  // sheet 中点目标城市 (用 .sheet-item 避免匹配到 picker-value)
  await page.locator(".sheet-item", { hasText: cityName }).first().click({ force: true });
  await page.waitForTimeout(4000);
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("[pageerror] " + e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push("[console.error] " + msg.text());
  });

  // 默认 cityId=1 (广州)
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 切到深圳 (深圳有「二手」数据)
  await pickCity(page, "深圳");

  // 验证「🔥 全品类区级网签热度榜」卡存在
  const cardTitle = page.locator("text=全品类区级网签热度榜").first();
  await cardTitle.waitFor({ timeout: 8000 });
  console.log(`[smoke_district_wangqian_rank] 卡标题 ✓`);

  const rankCard = page.locator(".card", { has: page.locator("text=全品类区级网签热度榜") }).first();

  // 验证 tab 数: 新房/二手/全部 (3 个)
  const tabs = await rankCard.locator(".wq-cat-tab").count();
  console.log(`[smoke_district_wangqian_rank] tab 数: ${tabs}`);
  assert.strictEqual(tabs, 3, `期望 3 个 tab, 实际 ${tabs}`);

  // 验证默认 tab 是「全部」
  const onTabText = await rankCard.locator(".wq-cat-tab-on").textContent();
  console.log(`[smoke_district_wangqian_rank] 默认 tab: ${onTabText?.trim()}`);
  assert.strictEqual(onTabText?.trim(), "全部", "默认 tab 应为「全部」");

  const rowCountAll = await rankCard.locator(".wq-row").count();
  console.log(`[smoke_district_wangqian_rank] 深圳「全部」tab 行数: ${rowCountAll}`);
  assert.ok(rowCountAll >= 1, `深圳「全部」tab 行数应 >= 1, 实际 ${rowCountAll}`);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "v0.23.0_district_wangqian_rank_sz_all.png"),
    fullPage: true
  });

  // 切到「新房」 tab (index 0)
  const newHouseTab = rankCard.locator(".wq-cat-tab").nth(0);
  await newHouseTab.click();
  await page.waitForTimeout(800);
  const onTabText2 = await rankCard.locator(".wq-cat-tab-on").textContent();
  console.log(`[smoke_district_wangqian_rank] 切后 tab: ${onTabText2?.trim()}`);
  assert.strictEqual(onTabText2?.trim(), "新房", "切到新房 tab 后高亮应为「新房」");

  const rowCountNew = await rankCard.locator(".wq-row").count();
  console.log(`[smoke_district_wangqian_rank] 深圳「新房」tab 行数: ${rowCountNew}`);
  assert.ok(rowCountNew >= 1, `深圳「新房」tab 行数应 >= 1, 实际 ${rowCountNew}`);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "v0.23.0_district_wangqian_rank_sz_newhouse.png"),
    fullPage: true
  });

  // 切到「二手」 tab (index 1)
  const resaleTab = rankCard.locator(".wq-cat-tab").nth(1);
  await resaleTab.click();
  await page.waitForTimeout(800);
  const rowCountUsed = await rankCard.locator(".wq-row").count();
  console.log(`[smoke_district_wangqian_rank] 深圳「二手」tab 行数: ${rowCountUsed}`);
  assert.ok(rowCountUsed >= 1, `深圳「二手」tab 行数应 >= 1, 实际 ${rowCountUsed}`);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "v0.23.0_district_wangqian_rank_sz_resale.png"),
    fullPage: true
  });

  await browser.close();

  const realErrors = consoleErrors.filter(
    (e) => !e.includes("Failed to load resource") && !e.includes("404")
  );
  if (realErrors.length > 0) {
    console.warn("[smoke_district_wangqian_rank] console errors:");
    realErrors.forEach((e) => console.warn("  " + e));
  }

  console.log("[smoke_district_wangqian_rank] PASSED ✓");
}

run().catch((e) => {
  console.error("[smoke_district_wangqian_rank] FAILED:", e);
  process.exit(1);
});
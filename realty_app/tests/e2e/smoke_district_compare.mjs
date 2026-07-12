// tests/e2e/smoke_district_compare.mjs
// v0.20.0 trend-8: 验证 dashboard 「📊 同区多小区对比」卡
// - 默认不显示 (selectedDistrict 为空)
// - 点击「区/板块对比」卡中任一区 → 显示对应区的小区柱状图
// - 行数 >= 1 (深圳有多个 4-12 小区的区)
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

async function setCityAndReload(page, cityId) {
  await page.evaluate(({ cityId }) => {
    localStorage.setItem("realty_app.cityId", String(cityId));
  }, { cityId });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("[pageerror] " + e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push("[console.error] " + msg.text());
  });

  // 深圳
  await page.goto(BASE, { waitUntil: "networkidle" });
  await setCityAndReload(page, 2);

  // 验证「小区对比」卡默认不显示
  const initialCard = await page.locator("text=小区对比").count();
  console.log(`[smoke_district_compare] 初始小区对比卡数: ${initialCard}`);
  assert.strictEqual(initialCard, 0, "未选区时小区对比卡不应显示");

  // 滚动到「区/板块对比」卡
  await page.evaluate(() => window.scrollTo(0, 0));
  // 找到「区/板块对比」标题的 .bar-row 行 (区名) 并点击
  // 找第一条 bar-row (点击福田区, 12 个小区最多)
  const firstBarRow = page.locator(".bar-row").first();
  await firstBarRow.waitFor({ timeout: 5000 });
  const districtName = await firstBarRow.locator(".bar-name").textContent();
  console.log(`[smoke_district_compare] 点击区: ${districtName?.trim()}`);
  await firstBarRow.click();
  await page.waitForTimeout(2500);

  // 验证「小区对比」卡出现
  const cardTitle = page.locator("text=小区对比").first();
  await cardTitle.waitFor({ timeout: 8000 });
  const cardTitleText = await cardTitle.textContent();
  console.log(`[smoke_district_compare] 卡标题: ${cardTitleText?.trim()}`);
  assert.ok(cardTitleText?.includes(districtName?.trim() ?? "—"), "卡标题应包含区名");

  // 取小区对比卡内的 .bar-row 行数
  const compareCard = page.locator(".card", { has: page.locator("text=小区对比") }).first();
  const rowCount = await compareCard.locator(".bar-row").count();
  console.log(`[smoke_district_compare] 小区对比行数: ${rowCount}`);
  assert.ok(rowCount >= 1, `小区对比行数应 >= 1, 实际 ${rowCount}`);

  // 验证第一行有 bar-fill (柱状图)
  const firstBarFill = await compareCard.locator(".bar-fill").first().count();
  assert.ok(firstBarFill >= 1, "小区对比应有 bar-fill 柱条");

  // 验证第一行有元/㎡ 价格
  const firstValue = await compareCard.locator(".bar-value").first().textContent();
  console.log(`[smoke_district_compare] first bar value: ${firstValue?.trim()}`);
  assert.ok(firstValue?.includes("元/㎡") || firstValue?.includes("—"), "bar-value 应有元/㎡或—");

  // 验证「关闭」按钮存在
  const closeBtn = await compareCard.locator("text=关闭").count();
  assert.ok(closeBtn >= 1, "应有『关闭』按钮");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "v0.20.0_district_compare_sz.png"),
    fullPage: true
  });

  // 测试关闭
  await compareCard.locator("text=关闭").click();
  await page.waitForTimeout(800);
  const afterClose = await page.locator("text=小区对比").count();
  assert.strictEqual(afterClose, 0, "关闭后小区对比卡不应显示");

  await browser.close();

  const realErrors = consoleErrors.filter(
    (e) => !e.includes("Failed to load resource") && !e.includes("404")
  );
  if (realErrors.length > 0) {
    console.warn("[smoke_district_compare] console errors:");
    realErrors.forEach((e) => console.warn("  " + e));
  }

  console.log("[smoke_district_compare] PASSED ✓");
}

run().catch((e) => {
  console.error("[smoke_district_compare] FAILED:", e);
  process.exit(1);
});
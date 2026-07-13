// smoke_district_meta.mjs — v0.38.0 trend-18 区情画像卡 E2E 测试
// 验证 dashboard 上 "📋 区情画像 · {city}" 卡存在, 行数, 排序切换, 隐藏切换, 截图

import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = process.env.REALTY_E2E_BASE_URL || "http://127.0.0.1:5175";

async function pickCity(page, label) {
  // 滚回顶部
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  // 找到 city picker 然后点击目标城市
  const trigger = page.locator(".form-row", { hasText: "城市" }).first();
  await trigger.waitFor({ state: "visible", timeout: 8000 });
  await trigger.click({ force: true });
  await page.waitForTimeout(600);
  // sheet 选项
  const item = page.locator(".sheet-item", { hasText: new RegExp(label) }).first();
  await item.waitFor({ state: "visible", timeout: 8000 });
  await item.click({ force: true });
  await page.waitForTimeout(2500);
}

async function scrollCardIntoView(page, cardTitle) {
  // 找 "区情画像" 标题, 再滚到对应卡片顶部
  const ok = await page
    .locator(".card-title", { hasText: /区情画像/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (!ok) {
    // 滚动触发懒加载
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(300);
      const vis = await page
        .locator(".card-title", { hasText: /区情画像/ })
        .first()
        .isVisible()
        .catch(() => false);
      if (vis) return;
    }
  }
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console.error]", m.text());
  });

  console.log(`navigate ${BASE}`);
  await page.goto(BASE, { waitUntil: "networkidle" });

  // 等待首屏
  await page.waitForTimeout(1500);

  // 默认广州 -> 区情画像可见?
  await scrollCardIntoView(page, "区情画像");
  let gzVisible = await page.locator(".card-title", { hasText: /区情画像/ }).first().isVisible().catch(() => false);
  if (!gzVisible) {
    console.log("default city 区情画像 not visible, try waiting longer");
    await page.waitForTimeout(2000);
    await scrollCardIntoView(page, "区情画像");
    gzVisible = await page.locator(".card-title", { hasText: /区情画像/ }).first().isVisible().catch(() => false);
  }
  if (!gzVisible) {
    console.error("FAIL: 广州 区情画像 not visible");
    await browser.close();
    process.exit(1);
  }
  console.log("OK: 广州 区情画像 visible");

  // 行数
  const gzRowCount = await page.locator(".dm-row").count();
  console.log(`广州 .dm-row count = ${gzRowCount}`);
  if (gzRowCount < 3) {
    console.error("FAIL: 广州 区情画像行数 < 3");
    await browser.close();
    process.exit(1);
  }

  // chips 排序
  const schoolChip = page.locator(".dm-chip", { hasText: "按学区" }).first();
  if (await schoolChip.isVisible().catch(() => false)) {
    await schoolChip.click();
    await page.waitForTimeout(600);
    console.log("clicked 按学区 chip");
  }

  await scrollCardIntoView(page, "区情画像");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.38.0_district_meta_gz.png`, fullPage: true });
  console.log("screenshot: v0.38.0_district_meta_gz.png");

  // 隐藏切换
  const hideChip = page.locator(".dm-chip", { hasText: "仅显示有数据" }).first();
  if (await hideChip.isVisible().catch(() => false)) {
    await hideChip.click();
    await page.waitForTimeout(500);
    const gzRowCountAfter = await page.locator(".dm-row").count();
    console.log(`after hide-empty: .dm-row count = ${gzRowCountAfter} (was ${gzRowCount})`);
    if (gzRowCountAfter > gzRowCount) {
      console.error("FAIL: 隐藏切换后行数不应增加");
      await browser.close();
      process.exit(1);
    }
    // 再点一次恢复
    await hideChip.click();
    await page.waitForTimeout(500);
  }

  // 切换到深圳
  console.log("switch to 深圳");
  await pickCity(page, "深圳");
  await page.waitForTimeout(2000);
  await scrollCardIntoView(page, "区情画像");
  const szVisible = await page.locator(".card-title", { hasText: /区情画像/ }).first().isVisible().catch(() => false);
  if (!szVisible) {
    console.log("深圳 区情画像 not visible, try waiting");
    await page.waitForTimeout(1500);
  }
  const szRowCount = await page.locator(".dm-row").count();
  console.log(`深圳 .dm-row count = ${szRowCount}`);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v0.38.0_district_meta_sz.png`, fullPage: true });
  console.log("screenshot: v0.38.0_district_meta_sz.png");

  // 验证 "区码 4403" 出现
  const adminCodeTxt = await page.locator(".dm-row").filter({ hasText: /区码 4403/ }).count();
  console.log(`含 "区码 4403" 行数 = ${adminCodeTxt}`);
  if (adminCodeTxt < 5) {
    console.error("FAIL: 深圳应有 >= 5 行展示 4403xx 区码");
    await browser.close();
    process.exit(1);
  }

  console.log("OK: 深圳 区情画像渲染正常");

  await browser.close();
  console.log("\nALL PASS");
}

main().catch((e) => {
  console.error("e2e error:", e);
  process.exit(1);
});
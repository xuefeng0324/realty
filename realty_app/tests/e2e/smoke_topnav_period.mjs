// tests/e2e/smoke_topnav_period.mjs
// v0.49.0 topnav-1: 周期 sticky 切换
import { chromium } from "playwright";
const URL = process.env.REALTY_E2E_URL || "http://localhost:5188/";

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

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(3500);

  await pickCity(page, "深圳");
  await page.waitForTimeout(1500);

  // topnav 应可见
  await page.waitForSelector(".topnav-period", { timeout: 8000 });
  console.log(`✓ .topnav-period 渲染`);

  // 截图初始状态
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tests/e2e/screenshots/v0.49.0_topnav_initial.png", fullPage: false });
  console.log(`📸 v0.49.0_topnav_initial.png`);

  // 读到当前周次
  const weekText0 = (await page.locator(".topnav-p-week").textContent()).trim();
  console.log(`✓ 初始: ${weekText0}`);
  const m0 = weekText0.match(/第\s*(\d+)\s*\/\s*(\d+)/);
  if (!m0) throw new Error(`can't parse ${weekText0}`);
  const idx0 = parseInt(m0[1]);
  const total = parseInt(m0[2]);
  console.log(`✓ 当前周期 ${idx0}/${total}`);

  // 读初始 weekEnd 文本中的日期
  const dateMatch0 = weekText0.match(/(\d{4}-\d{2}-\d{2})/);
  const date0 = dateMatch0 ? dateMatch0[1] : "?";

  // 默认在最尾 (最新), "下一周" 应该 disabled
  const nextBtn = page.locator(".topnav-p-btn", { hasText: "下一周" });
  const nextDisabled = await nextBtn.getAttribute("disabled");
  console.log(`✓ 在最新周期 → 下一周 disabled=${nextDisabled !== null}`);
  if (nextDisabled === null) {
    console.warn(`预期 disabled (默认在最新)`);
  }

  // 点 "上一周"
  const prevBtn = page.locator(".topnav-p-btn", { hasText: "上一周" });
  await prevBtn.click({ force: true });
  await page.waitForTimeout(1200);

  const weekText1 = (await page.locator(".topnav-p-week").textContent()).trim();
  const m1 = weekText1.match(/第\s*(\d+)\s*\/\s*(\d+)/);
  const idx1 = parseInt(m1[1]);
  const date1 = weekText1.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "?";
  console.log(`✓ 点上一周: 第 ${idx1}/${total} (${date1})`);
  if (idx1 !== idx0 - 1) throw new Error(`expected idx=${idx0 - 1}, got ${idx1}`);
  if (date1 === date0) throw new Error(`日期应变化`);

  await page.screenshot({ path: "tests/e2e/screenshots/v0.49.0_topnav_prev.png", fullPage: false });
  console.log(`📸 v0.49.0_topnav_prev.png`);

  // 连续点 3 次上一周
  for (let i = 0; i < 3; i++) {
    await page.locator(".topnav-p-btn", { hasText: "上一周" }).click({ force: true });
    await page.waitForTimeout(800);
  }
  const weekText2 = (await page.locator(".topnav-p-week").textContent()).trim();
  const m2 = weekText2.match(/第\s*(\d+)\s*\/\s*(\d+)/);
  const idx2 = parseInt(m2[1]);
  console.log(`✓ 连续 3 次上一周: 第 ${idx2}/${total}`);
  if (idx2 !== idx1 - 3) throw new Error(`expected idx=${idx1 - 3}, got ${idx2}`);

  // 点 "下一周" 回到中间
  await page.locator(".topnav-p-btn", { hasText: "下一周" }).click({ force: true });
  await page.waitForTimeout(800);
  await page.locator(".topnav-p-btn", { hasText: "下一周" }).click({ force: true });
  await page.waitForTimeout(800);
  const weekText3 = (await page.locator(".topnav-p-week").textContent()).trim();
  const m3 = weekText3.match(/第\s*(\d+)\s*\/\s*(\d+)/);
  const idx3 = parseInt(m3[1]);
  console.log(`✓ 回退 2 步: 第 ${idx3}/${total}`);
  if (idx3 !== idx2 + 2) throw new Error(`expected idx=${idx2 + 2}, got ${idx3}`);

  // 滚到底, 顶栏应仍 visible (sticky)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tests/e2e/screenshots/v0.49.0_topnav_sticky.png", fullPage: false });
  console.log(`📸 v0.49.0_topnav_sticky.png`);

  await browser.close();
  console.log("ALL GREEN");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});

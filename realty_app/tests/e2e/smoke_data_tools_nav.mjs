// smoke_data_tools_nav.mjs — v1.123.3 数据工具页锚点分组导航 E2E（F-DTOOLS-01）
// 验证：
//   1) [data-dt-nav] 可见，含 18 个 chip（16 迁移卡 + 行政区划卡 + ⚙️ 卡片管理）+ 4 个组名
//   2) 滚到页底后导航仍吸顶（top ≈ uni-page-head 高度，不丢不被盖）
//   3) 点「网签热度」chip 真实滚动，[data-dt-wangqian-rank] 卡顶不被吸顶导航遮挡，且该 chip 高亮
//   4) 点「步行通勤」chip（交通组）同样生效
//   5) 点 ⚙️ 卡片管理回到页顶
//   6) v1.123.4 滚动反选：不点 chip，纯 window.scrollTo 到「区情画像」卡，
//      [data-dt-nav-item="district-meta"] 自动获得 dt-nav-chip--active 且唯一
// 切城模式与 smoke_metro_walk 相同：dashboard pickCity → hash 导航 → reload。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = (process.env.REALTY_E2E_BASE_URL || process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/$/, "");
const DASH_URL = `${BASE}/#/pages/dashboard/dashboard`;
const DASH_HASH = "#/pages/dashboard/dashboard";
const DT_HASH = "#/pages/data-tools/data-tools";
const NAV = "[data-dt-nav]";

function fail(msg) {
  console.log("❌ " + msg);
  process.exit(1);
}

async function pickCity(page, cityName) {
  const cur = (await page.locator("[data-home-city]").first().textContent()) ?? "";
  if (cur.includes(cityName)) return;
  await page.locator("[data-home-city]").first().click({ force: true });
  await page.locator(".sheet-mask").waitFor({ state: "visible", timeout: 8000 });
  await page.locator(".sheet-item", { hasText: cityName }).first().click({ force: true });
  await page.locator(".sheet-mask").waitFor({ state: "hidden", timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(1200);
}

async function gotoDataTools(page, cityName) {
  await page.locator("[data-home-city]").first().waitFor({ state: "visible", timeout: 20000 });
  await pickCity(page, cityName);
  await page.evaluate((h) => { location.hash = h; }, DT_HASH);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(NAV).waitFor({ state: "visible", timeout: 20000 });
}

// smooth scroll 是异步的：轮询 scrollY 直到连续两次采样不变（或超时）
async function waitScrollSettled(page, timeoutMs = 6000) {
  const start = Date.now();
  let last = await page.evaluate(() => window.scrollY);
  while (Date.now() - start < timeoutMs) {
    await page.waitForTimeout(250);
    const cur = await page.evaluate(() => window.scrollY);
    if (Math.abs(cur - last) < 1) return cur;
    last = cur;
  }
  return last;
}

async function clickChipAndAssert(page, anchor, cardSel) {
  const before = await page.evaluate(() => window.scrollY);
  await page.locator(`[data-dt-nav-item="${anchor}"]`).click({ force: true });
  const after = await waitScrollSettled(page);
  if (Math.abs(after - before) < 80) {
    fail(`点 chip[${anchor}] 后页面未明显滚动（${before} → ${after}）`);
  }
  // 卡顶不被吸顶导航遮挡：cardRect.top >= navRect.bottom - 1，且卡在视口内
  const geo = await page.evaluate(({ cardSel2 }) => {
    const card = document.querySelector(cardSel2);
    const nav = document.querySelector("[data-dt-nav]");
    if (!card || !nav) return null;
    const c = card.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    return { cardTop: c.top, navBottom: n.bottom, vh: window.innerHeight };
  }, { cardSel2: cardSel });
  if (!geo) fail(`点 chip[${anchor}] 后找不到卡 ${cardSel} 或导航`);
  console.log(`[dt_nav] chip[${anchor}] scrollY ${before} → ${after}，卡顶 ${geo.cardTop.toFixed(1)} / 导航底 ${geo.navBottom.toFixed(1)}`);
  if (geo.cardTop < geo.navBottom - 1) {
    fail(`卡 ${cardSel} 顶部被吸顶导航遮挡（cardTop=${geo.cardTop.toFixed(1)} < navBottom=${geo.navBottom.toFixed(1)}）`);
  }
  if (geo.cardTop >= geo.vh) {
    fail(`卡 ${cardSel} 未进入视口（cardTop=${geo.cardTop.toFixed(1)} >= vh=${geo.vh}）`);
  }
  // v1.123.4：点击 chip 后该 chip 应持 active class（rAF 反选已随滚动完成）
  await page.waitForTimeout(350);
  const activeOk = await page.evaluate((a) => {
    const chip = document.querySelector(`[data-dt-nav-item="${a}"]`);
    return chip ? chip.classList.contains("dt-nav-chip--active") : false;
  }, anchor);
  if (!activeOk) fail(`点 chip[${anchor}] 滚动到位后该 chip 未高亮（无 dt-nav-chip--active）`);
  console.log(`[dt_nav] chip[${anchor}] 高亮 ✓`);
}

// v1.123.4 纯滚动反选：不点任何 chip，直接 scrollTo 到某卡，对应 chip 应自动高亮且唯一
async function assertScrollSpy(page, anchor, cardSel) {
  await page.evaluate(({ cardSel2 }) => {
    const el = document.querySelector(cardSel2);
    if (!el) return;
    const head = document.querySelector("uni-page-head");
    const nav = document.querySelector("[data-dt-nav]");
    const top =
      el.getBoundingClientRect().top +
      window.pageYOffset -
      (head ? head.offsetHeight : 0) -
      (nav ? nav.offsetHeight : 0) -
      8;
    window.scrollTo({ top: Math.max(0, top) });
  }, { cardSel2: cardSel });
  await waitScrollSettled(page);
  await page.waitForTimeout(350); // 等 rAF 反选跑完
  const res = await page.evaluate(() => {
    const actives = [...document.querySelectorAll(".dt-nav-chip--active")].map((el) =>
      el.getAttribute("data-dt-nav-item")
    );
    return actives;
  });
  console.log(`[dt_nav] 纯滚动至 ${cardSel} 后 active chips: ${res.join(",") || "(无)"}`);
  if (res.length !== 1 || res[0] !== anchor) {
    fail(`纯滚动反选应为唯一 [${anchor}]，实际 ${JSON.stringify(res)}`);
  }
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("[pageerror] " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push("[console.error] " + m.text());
  });

  try {
    await page.goto(DASH_URL, { waitUntil: "networkidle", timeout: 20000 });
    await gotoDataTools(page, "深圳");

    // 1) 导航结构：18 chip + 4 组名
    const chipCount = await page.locator("[data-dt-nav-item]").count();
    console.log(`[dt_nav] chip 数: ${chipCount}`);
    if (chipCount !== 18) fail(`chip 数应为 18（17 卡 + 卡片管理），实际 ${chipCount}`);
    const groups = await page.locator(".dt-nav-group").allTextContents();
    console.log(`[dt_nav] 分组: ${groups.join("/")}`);
    if (groups.length !== 4) fail(`应有 4 个分组，实际 ${groups.length}`);

    // 2) 滚到页底，导航仍吸顶（top ≈ uni-page-head 高度）
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await waitScrollSettled(page);
    const stick = await page.evaluate(() => {
      const nav = document.querySelector("[data-dt-nav]");
      const head = document.querySelector("uni-page-head");
      if (!nav) return null;
      return {
        navTop: nav.getBoundingClientRect().top,
        headH: head ? head.offsetHeight : 0
      };
    });
    if (!stick) fail("滚到页底后导航不存在");
    console.log(`[dt_nav] 页底吸顶: navTop=${stick.navTop.toFixed(1)} headH=${stick.headH}`);
    if (Math.abs(stick.navTop - stick.headH) > 4) {
      fail(`导航未吸顶在 page-head 下方（navTop=${stick.navTop.toFixed(1)}, headH=${stick.headH}）`);
    }
    const navVisible = await page.locator(NAV).isVisible();
    if (!navVisible) fail("滚到页底后导航不可见");
    console.log("[dt_nav] 吸顶保持 ✓");

    // 3) 市场组深卡：网签热度
    await clickChipAndAssert(page, "wangqian-rank", "[data-dt-wangqian-rank]");
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, "data-tools-nav-wangqian.png") });

    // 4) 交通组：步行通勤
    await clickChipAndAssert(page, "commute-walk", "[data-dt-commute-walk]");

    // 5) v1.123.4 纯滚动反选：不点 chip，scrollTo 到「区情画像」卡 → district-meta chip 自动唯一高亮
    await assertScrollSpy(page, "district-meta", "[data-dt-district-meta]");

    // 6) ⚙️ 卡片管理 → 回页顶
    await page.locator('[data-dt-nav-item="card-manager"]').click({ force: true });
    const top = await waitScrollSettled(page);
    console.log(`[dt_nav] 卡片管理 chip → scrollY=${top}`);
    if (top > 120) fail(`点卡片管理后未回到页顶（scrollY=${top}）`);

    await page.screenshot({ path: resolve(SCREENSHOT_DIR, "data-tools-nav.png") });

    if (consoleErrors.length) {
      console.log("❌ console 错误:\n" + consoleErrors.join("\n"));
      process.exit(1);
    }
    console.log("✅ 数据工具页锚点分组导航全部通过");
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.log("❌ 异常: " + (e && e.message ? e.message : e));
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, "data-tools-nav-fail.png") }).catch(() => null);
    await browser.close();
    process.exit(1);
  }
}

run();

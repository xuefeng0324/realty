// smoke_school_community.mjs — v0.14.0 学区评分 Top 小区卡 E2E
// v1.122+ 改写：dashboard 改版为纯壳层（.home-v122 .container > :not(.home-v122-shell) 全部 display:none），
// 「学区评分 Top 小区」卡仍在 DOM 中渲染但默认不可见（待迁移，见 data-tools「剩余派生数据」）。
// 因此本测试：
//   1) 用 attached 断言验证数据层渲染（行数 / Top1 / 评分格式）；
//   2) 用真实 pickCity 交互（[data-home-city] → sheet-item）切城验证数据联动；
//   3) 注入样式临时取消隐藏后对卡片元素截图（视觉回归存档）。
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE = (process.env.REALTY_E2E_BASE_URL || process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/$/, "");
const PAGE_URL = `${BASE}/#/pages/dashboard/dashboard`;
const CARD = "[data-card-key='school-top-community']";
// scoped CSS 会给隐藏规则追加 [data-v-hash] 提高优先级；
// 样式表覆盖不稳，直接写内联 display:block !important（优先级最高）。
async function unhideCard(page) {
  await page.evaluate((sel) => {
    document.querySelector(sel)?.style.setProperty("display", "block", "important");
  }, CARD);
}

async function gotoDashboard(page) {
  await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 20000 });
  await page.locator(CARD).waitFor({ state: "attached", timeout: 20000 });
}

async function pickCity(page, cityName) {
  // v122 壳层里 [data-home-city] 可见（hero 顶部）；旧 entry-card 里的同名按钮被 CSS 隐藏
  await page.locator("[data-home-city]").first().click({ force: true });
  await page.locator(".sheet-mask").waitFor({ state: "visible", timeout: 8000 });
  await page.locator(".sheet-item", { hasText: cityName }).first().click({ force: true });
  await page.locator(".sheet-mask").waitFor({ state: "hidden", timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(3500);
}

async function expectSchoolCommunityCard(page, label) {
  const card = page.locator(CARD);
  await card.waitFor({ state: "attached", timeout: 15000 });
  const title = (await card.locator(".card-title").first().textContent()) ?? "";
  if (!title.includes("学区评分 Top")) {
    throw new Error(`[${label}] 卡标题异常: ${title}`);
  }
  console.log(`[${label}] 学区评分 Top 小区卡 ✓ (${title.trim()})`);
  // 至少 1 个小区行
  const items = await card.locator(".sp-medal-mini").count();
  console.log(`[${label}] 小区数: ${items}`);
  if (items < 1) {
    throw new Error(`[${label}] 学区评分 Top 0 条`);
  }
  // 取第一行
  const firstRow = card.locator(".community-row").first();
  const firstName = (await firstRow.locator(".community-name").textContent())?.trim();
  const firstScore = (await firstRow.locator(".muted").first().textContent())?.trim();
  console.log(`[${label}] Top 1: ${firstName}`);
  console.log(`[${label}] score meta: ${firstScore}`);
  if (!firstScore || !/评分 \d+\.\d/.test(firstScore)) {
    throw new Error(`[${label}] 学区评分 meta 格式错: ${firstScore}`);
  }
  return firstName;
}

async function screenshotCard(page, label, filename) {
  await unhideCard(page);
  const card = page.locator(CARD);
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await card.screenshot({ path: resolve(OUT_DIR, filename) });
  console.log(`[${label}] 截图已保存 ${filename}`);
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  try {
    // === 广州（默认 cityId=1）===
    await gotoDashboard(page);
    await expectSchoolCommunityCard(page, "广州");
    await screenshotCard(page, "gz", "smoke_school_community_gz.png");

    // === 深圳（真实 pickCity 交互）===
    await pickCity(page, "深圳");
    await expectSchoolCommunityCard(page, "深圳");
    const cardText = await page.locator(CARD).textContent();
    if (!/南山|福田|罗湖/.test(cardText ?? "")) {
      console.warn("[sz] 学区评分榜 Top 区不在南山/福田/罗湖");
    }
    await screenshotCard(page, "sz", "smoke_school_community_sz.png");

    console.log("\nALL PASS");
  } catch (e) {
    console.error("\nFAIL smoke_school_community:", e.message);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_school_community_FAIL.png"),
      fullPage: true
    }).catch(() => null);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();

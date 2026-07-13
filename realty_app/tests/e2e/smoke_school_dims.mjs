// tests/e2e/smoke_school_dims.mjs
// v0.47.0 school-4: 学区 5 维评分 Top 卡片 E2E
import { chromium } from "playwright";

const URL = process.env.REALTY_E2E_URL || "http://localhost:5186/";

async function pickCity(page, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const trigger = page.locator(".form-row", { hasText: "城市" }).first();
  await trigger.waitFor({ state: "visible", timeout: 8000 });
  await trigger.click({ force: true });
  await page.waitForTimeout(500);
  // 列表项
  const items = await page.locator(".picker-item, .uni-picker__action-text, li, .picker-view__item, text=" + label).first().waitFor({ timeout: 4000 }).catch(() => null);
  if (items === null) {
    // try generic
    const fallback = page.locator(`text=${label}`).first();
    await fallback.click({ force: true });
  } else {
    await items.click({ force: true });
  }
  await page.waitForTimeout(400);
  return true;
}

async function waitCard(page, title, ms = 12000) {
  await page.waitForFunction(
    (t) => Array.from(document.querySelectorAll(".card-title")).some((x) => (x.textContent || "").includes(t)),
    title,
    { timeout: ms }
  );
}

async function scrollCardIntoView(page, title) {
  await page.evaluate((t) => {
    const titles = Array.from(document.querySelectorAll(".card-title"));
    const el = titles.find((x) => (x.textContent || "").includes(t));
    if (el) {
      const card = el.closest(".card");
      if (card) card.scrollIntoView({ block: "start", behavior: "instant" });
      else el.scrollIntoView({ block: "start", behavior: "instant" });
      window.scrollBy(0, -120);
    }
  }, title);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(1500);

  for (const city of ["广州", "深圳", "珠海"]) {
    const ok = await pickCity(page, city);
    if (!ok) throw new Error(`picker miss ${city}`);
    await page.waitForTimeout(1200);

    await waitCard(page, "学区 5 维评分");

    // 综合 Top 5 区块
    const overallRows = await page.$$eval(".sd-ovr-row", (nodes) => nodes.length);
    if (overallRows < 1) throw new Error(`${city}: overall rows = 0`);
    console.log(`✓ ${city} 综合 Top rows=${overallRows}`);

    // 各维度 Top 3 cells (2x2 grid)
    const cells = await page.$$eval(".sd-cell", (nodes) => nodes.length);
    if (cells < 4) throw new Error(`${city}: dim cells = ${cells}`);
    console.log(`✓ ${city} 4 dim cells`);
    const cellRows = await page.$$eval(".sd-cell .sd-row", (nodes) => nodes.length);
    if (cellRows < 8) throw new Error(`${city}: cell rows = ${cellRows}`);
    console.log(`✓ ${city} cell rows=${cellRows}`);

    // 综合 score >= 综合 topN 末位
    const scores = await page.$$eval(".sd-ovr-row .sd-score-num", (nodes) => nodes.map((n) => Number(n.textContent)));
    if (scores.length < 2) throw new Error(`${city}: score nums = ${scores.length}`);
    if (scores[0] < scores[scores.length - 1]) throw new Error(`${city}: 综合 Top 排序异常`);
    console.log(`✓ ${city} 综合 Top 有序 [${scores[0]}, ..., ${scores[scores.length - 1]}]`);

    await scrollCardIntoView(page, "学区 5 维评分");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `tests/e2e/screenshots/v0.47.0_school_dims_${city}.png`, fullPage: false, clip: await page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll(".card-title"));
      const el = titles.find((x) => (x.textContent || "").includes("学区 5 维评分"));
      if (!el) return null;
      const card = el.closest(".card");
      if (!card) return null;
      const r = card.getBoundingClientRect();
      return { x: 0, y: Math.max(0, r.top - 20), width: window.innerWidth, height: Math.min(window.innerHeight - Math.max(0, r.top - 20) + 40, window.innerHeight) };
    }) });
    console.log(`📸 v0.47.0_school_dims_${city}.png`);
  }

  await browser.close();
  console.log("ALL GREEN");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});

/**
 * smoke_layout.mjs — v0.25.0 户型分布卡片 E2E
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const OUT = "./screenshots/v0.25.0";

async function pickCity(page, cityName) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".form-row")].find((el) =>
      el.textContent && el.textContent.includes("城市")
    );
    if (btn) btn.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate((cn) => {
    const item = [...document.querySelectorAll(".sheet-item")].find((el) =>
      el.textContent && el.textContent.includes(cn)
    );
    if (item) item.click();
  }, cityName);
  await page.waitForTimeout(700);
}

async function verifyCity(page, cityName, fileSuffix) {
  await pickCity(page, cityName);
  await page.waitForTimeout(1200);

  const result = await page.evaluate(() => {
    const titleNode = [...document.querySelectorAll(".card-title")].find((el) =>
      el.textContent && el.textContent.includes("户型分布")
    );
    if (!titleNode) return { ok: false, reason: "no-card" };
    const card = titleNode.closest(".card");
    if (!card) return { ok: false, reason: "no-card-root" };
    const dimTitles = card.querySelectorAll(".ld-dim-title");
    const rows = card.querySelectorAll(".ld-row");
    const bars = card.querySelectorAll(".ld-bar");
    const text = card.textContent || "";
    return {
      ok: true,
      dimCount: dimTitles.length,
      rowCount: rows.length,
      barCount: bars.length,
      has3shi: text.includes("3室"),
      has80to110: text.includes("80-110"),
      hasNantong: text.includes("南") || text.includes("东南") || text.includes("南北通透"),
      hasJingzhuang: text.includes("精装") || text.includes("豪装"),
      totalText: [...card.querySelectorAll(".muted")].map((n) => n.textContent || "").join(" | ")
    };
  });

  const ok = result.ok
    && result.dimCount === 4
    && result.rowCount >= 5
    && result.barCount >= 5
    && result.has3shi
    && result.has80to110;
  console.log(
    `  [${cityName}] dim=${result.dimCount} rows=${result.rowCount} bars=${result.barCount} ` +
    `3室=${result.has3shi} 80-110=${result.has80to110} 朝向=${result.hasNantong} 装修=${result.hasJingzhuang}`
  );
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/layout_${fileSuffix}.png`, fullPage: true });
  return ok;
}

async function main() {
  console.log("[smoke_layout] start v0.25.0");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });

  await page.goto(`${BASE}/#/pages/dashboard/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  let pass = true;
  // Default city is 广州(1)
  if (!(await verifyCity(page, "深圳", "sz"))) pass = false;
  if (!(await verifyCity(page, "广州", "gz"))) pass = false;
  if (!(await verifyCity(page, "珠海", "zh"))) pass = false;

  await browser.close();
  console.log(pass ? "[smoke_layout] PASSED" : "[smoke_layout] FAILED");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("[smoke_layout] CRASH", e);
  process.exit(2);
});
/**
 * smoke_district_index.mjs — v0.29.0 区房价指数卡片 E2E
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const OUT = "./screenshots/v0.29.0";

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
  await page.waitForTimeout(900);
}

async function inspect(page) {
  return await page.evaluate(() => {
    const titleNode = [...document.querySelectorAll(".card-title")].find((el) =>
      el.textContent && el.textContent.includes("区房价指数")
    );
    if (!titleNode) return { ok: false };
    const card = titleNode.closest(".card");
    if (!card) return { ok: false };
    const rows = card.querySelectorAll(".di-row");
    const sparkBars = card.querySelectorAll(".di-spark-bar");
    const names = [...rows].map((r) => (r.querySelector(".di-name")?.textContent || "").trim());
    const indices = [...rows].map((r) => {
      const t = r.querySelector(".di-index");
      return t ? Number((t.textContent || "0").trim()) : 0;
    });
    return {
      ok: true,
      rowCount: rows.length,
      sparkBarCount: sparkBars.length,
      names,
      indices,
      muted: [...card.querySelectorAll(".muted")].map((m) => (m.textContent || "").trim())
    };
  });
}

async function main() {
  console.log("[smoke_district_index] start v0.29.0");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 2200 } });

  await page.goto(`${BASE}/#/pages/dashboard/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  await pickCity(page, "深圳");
  await page.waitForTimeout(900);
  const sz = await inspect(page);
  console.log(
    `  [深圳] rows=${sz.rowCount} sparks=${sz.sparkBarCount} names=${sz.names.join(",")} indices=${sz.indices.map((n) => n.toFixed(1)).join(",")}`
  );
  await page.screenshot({ path: `${OUT}/district_index_sz.png`, fullPage: true });

  await pickCity(page, "广州");
  await page.waitForTimeout(900);
  const gz = await inspect(page);
  console.log(`  [广州] rows=${gz.rowCount} indices=${gz.indices.map((n) => n.toFixed(1)).join(",")}`);
  await page.screenshot({ path: `${OUT}/district_index_gz.png`, fullPage: true });

  await pickCity(page, "珠海");
  await page.waitForTimeout(900);
  const zh = await inspect(page);
  console.log(`  [珠海] rows=${zh.rowCount}`);
  await page.screenshot({ path: `${OUT}/district_index_zh.png`, fullPage: true });

  await browser.close();

  // 验证: 深圳/广州/珠海 都有行, sparkBars > 0
  const pass =
    sz.ok &&
    sz.rowCount >= 2 &&
    sz.sparkBarCount > sz.rowCount && // 每行有 spark bar
    sz.indices.length > 0 &&
    sz.indices.every((v) => v >= 10 && v <= 200) &&
    gz.rowCount >= 1 &&
    zh.rowCount >= 1;
  console.log(pass ? "[smoke_district_index] PASSED" : "[smoke_district_index] FAILED");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("[smoke_district_index] CRASH", e);
  process.exit(2);
});
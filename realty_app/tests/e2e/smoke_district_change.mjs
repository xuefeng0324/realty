/**
 * smoke_district_change.mjs — v0.30.0 区涨幅榜卡片 E2E
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const OUT = "./screenshots/v0.30.0";

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
      el.textContent && el.textContent.includes("区涨幅榜")
    );
    if (!titleNode) return { ok: false };
    const card = titleNode.closest(".card");
    if (!card) return { ok: false };
    const rows = card.querySelectorAll(".dc-row");
    const names = [...rows].map((r) => (r.querySelector(".dc-name")?.textContent || "").trim());
    const changes = [...rows].map((r) => {
      const c = r.querySelector(".dc-4w");
      return c ? (c.textContent || "").trim() : "";
    });
    return {
      ok: true,
      rowCount: rows.length,
      names,
      changes
    };
  });
}

async function main() {
  console.log("[smoke_district_change] start v0.30.0");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 2200 } });

  await page.goto(`${BASE}/#/pages/dashboard/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  await pickCity(page, "深圳");
  await page.waitForTimeout(900);
  const sz = await inspect(page);
  console.log(`  [深圳] rows=${sz.rowCount} first3=${sz.names.slice(0, 3).join(" / ")} changes=${sz.changes.slice(0, 3).join(" / ")}`);
  await page.screenshot({ path: `${OUT}/district_change_sz.png`, fullPage: true });

  await pickCity(page, "广州");
  await page.waitForTimeout(900);
  const gz = await inspect(page);
  console.log(`  [广州] rows=${gz.rowCount} changes=${gz.changes.slice(0, 3).join(" / ")}`);
  await page.screenshot({ path: `${OUT}/district_change_gz.png`, fullPage: true });

  await pickCity(page, "珠海");
  await page.waitForTimeout(900);
  const zh = await inspect(page);
  console.log(`  [珠海] rows=${zh.rowCount}`);

  await browser.close();

  const pass = sz.ok && sz.rowCount >= 1 && gz.rowCount >= 1;
  console.log(pass ? "[smoke_district_change] PASSED" : "[smoke_district_change] FAILED");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("[smoke_district_change] CRASH", e);
  process.exit(2);
});
/**
 * smoke_tagcloud.mjs — v0.28.0 房源 tags 标签云卡片 E2E
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const OUT = "./screenshots/v0.28.0";

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
      el.textContent && el.textContent.includes("房源标签云")
    );
    if (!titleNode) return { ok: false };
    const card = titleNode.closest(".card");
    if (!card) return { ok: false };
    const chips = card.querySelectorAll(".tag-chip");
    const sizes = [1, 2, 3, 4, 5].map((n) => card.querySelectorAll(`.tag-size-${n}`).length);
    const muted = [...card.querySelectorAll(".muted")].map((n) => (n.textContent || "").trim()).join(" | ");
    return {
      ok: true,
      chipCount: chips.length,
      sizes,
      chipTexts: [...chips].map((c) => (c.textContent || "").trim()).slice(0, 8),
      muted
    };
  });
}

async function main() {
  console.log("[smoke_tagcloud] start v0.28.0");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 2400 } });

  await page.goto(`${BASE}/#/pages/dashboard/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  await pickCity(page, "深圳");
  await page.waitForTimeout(900);

  const sz = await inspect(page);
  console.log(
    `  [深圳] chips=${sz.chipCount} sizes=[${sz.sizes.join(",")}] first3=${sz.chipTexts.slice(0, 3).join(" / ")}`
  );
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/tagcloud_sz.png`, fullPage: true });

  // 点击第一个 tag, 验证提示
  await page.evaluate(() => {
    const card = [...document.querySelectorAll(".card")].find((el) =>
      el.textContent && el.textContent.includes("房源标签云")
    );
    if (!card) return;
    const firstChip = card.querySelector(".tag-chip");
    if (firstChip) firstChip.click();
  });
  await page.waitForTimeout(500);
  const hint = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".card")].find((el) =>
      el.textContent && el.textContent.includes("房源标签云")
    );
    if (!card) return null;
    return card.textContent || "";
  });
  const hasHint = (hint || "").includes("已点击标签");
  console.log(`  [深圳 hint] hasClickHint=${hasHint}`);
  await page.screenshot({ path: `${OUT}/tagcloud_sz_click.png`, fullPage: true });

  await pickCity(page, "广州");
  await page.waitForTimeout(900);
  const gz = await inspect(page);
  console.log(`  [广州] chips=${gz.chipCount} sizes=[${gz.sizes.join(",")}]`);
  await page.screenshot({ path: `${OUT}/tagcloud_gz.png`, fullPage: true });

  await pickCity(page, "珠海");
  await page.waitForTimeout(900);
  const zh = await inspect(page);
  console.log(`  [珠海] chips=${zh.chipCount}`);
  await page.screenshot({ path: `${OUT}/tagcloud_zh.png`, fullPage: true });

  await browser.close();

  const pass =
    sz.ok &&
    sz.chipCount >= 10 &&
    sz.sizes.reduce((a, b) => a + b, 0) === sz.chipCount &&
    gz.chipCount >= 5 &&
    zh.chipCount >= 5 &&
    hasHint;
  console.log(pass ? "[smoke_tagcloud] PASSED" : "[smoke_tagcloud] FAILED");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("[smoke_tagcloud] CRASH", e);
  process.exit(2);
});
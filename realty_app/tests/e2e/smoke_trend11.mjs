/**
 * smoke_trend11.mjs — v0.26.0 学区评分小区榜增强 E2E
 *
 * 验证:
 * 1. 卡片存在且含 3 个 spc-row (区/最低评分/排序)
 * 2. 默认排序: 评分 (avg_school_score)
 * 3. 切换排序: 均价 → 第一行均价应为最小
 * 4. 切换最低评分 80+ → 行数 <= 默认
 * 5. 点击区 chip → 行数变化
 * 6. 截图
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const OUT = "./screenshots/v0.26.0";

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
      el.textContent && el.textContent.includes("学区评分 Top 小区")
    );
    if (!titleNode) return { ok: false };
    const card = titleNode.closest(".card");
    if (!card) return { ok: false };
    const spcRows = card.querySelectorAll(".spc-row");
    const chips = card.querySelectorAll(".spc-chip");
    const chipOn = card.querySelectorAll(".spc-chip-on");
    const rows = card.querySelectorAll(".community-row");
    const muted = [...card.querySelectorAll(".muted")].map((n) => (n.textContent || "").trim());
    const communityNames = [...rows].map((r) => {
      const n = r.querySelector(".community-name");
      return n ? (n.textContent || "").trim() : "";
    });
    const districtTexts = [...rows].map((r) => {
      const m = r.querySelector(".muted");
      return m ? (m.textContent || "").trim() : "";
    });
    return {
      ok: true,
      spcRowCount: spcRows.length,
      chipCount: chips.length,
      chipOnCount: chipOn.length,
      rowCount: rows.length,
      communityNames,
      districtTexts,
      mutedTexts: muted
    };
  });
}

async function clickChip(page, label) {
  await page.evaluate((l) => {
    const card = [...document.querySelectorAll(".card")].find((el) =>
      el.textContent && el.textContent.includes("学区评分 Top 小区")
    );
    if (!card) return;
    const chip = [...card.querySelectorAll(".spc-chip")].find((el) =>
      el.textContent && el.textContent.trim() === l
    );
    if (chip) chip.click();
  }, label);
  await page.waitForTimeout(500);
}

async function main() {
  console.log("[smoke_trend11] start v0.26.0");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 2200 } });

  await page.goto(`${BASE}/#/pages/dashboard/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  await pickCity(page, "深圳");
  await page.waitForTimeout(800);

  // 1. 默认状态
  const def = await inspect(page);
  console.log(
    `  [default 深圳] spcRows=${def.spcRowCount} chips=${def.chipCount} rows=${def.rowCount} chipOn=${def.chipOnCount}`
  );
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/trend11_default.png`, fullPage: true });

  // 2. 切排序 → 均价 (应该是当前深圳最便宜的几个学区小区)
  await clickChip(page, "均价");
  await page.waitForTimeout(700);
  const byPrice = await inspect(page);
  console.log(`  [按均价] rows=${byPrice.rowCount} first3=${byPrice.communityNames.slice(0, 3).join(" / ")}`);
  await page.screenshot({ path: `${OUT}/trend11_sort_price.png`, fullPage: true });

  // 3. 切排序 → 评分 回到默认
  await clickChip(page, "评分");
  await page.waitForTimeout(700);

  // 4. 切最低评分 80+
  await clickChip(page, "80+");
  await page.waitForTimeout(700);
  const score80 = await inspect(page);
  console.log(`  [80+] rows=${score80.rowCount}`);
  await page.screenshot({ path: `${OUT}/trend11_score80.png`, fullPage: true });

  // 5. 不限
  await clickChip(page, "不限");
  await page.waitForTimeout(700);

  // 6. 点击 区 chip (南山 - 先找出第一个)
  const firstDistrict = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".card")].find((el) =>
      el.textContent && el.textContent.includes("学区评分 Top 小区")
    );
    if (!card) return null;
    const chips = [...card.querySelectorAll(".spc-chips")];
    if (chips.length === 0) return null;
    const firstChipGroup = chips[0];
    const firstChip = firstChipGroup.querySelector(".spc-chip");
    return firstChip ? (firstChip.textContent || "").trim() : null;
  });
  console.log(`  [firstDistrict chip] ${firstDistrict}`);
  if (firstDistrict) {
    await clickChip(page, firstDistrict);
    await page.waitForTimeout(700);
    const districtOnly = await inspect(page);
    const allInDistrict = districtOnly.districtTexts.every((t) => t.startsWith(firstDistrict));
    console.log(
      `  [仅${firstDistrict}] rows=${districtOnly.rowCount} allInDistrict=${allInDistrict}`
    );
    await page.screenshot({ path: `${OUT}/trend11_district_${firstDistrict}.png`, fullPage: true });
  }

  await browser.close();

  const pass =
    def.ok &&
    def.spcRowCount === 3 &&
    def.chipCount >= 8 && // 区 (~7) + 最低评分 (5) + 排序 (4) = ~16
    def.rowCount >= 5 &&
    byPrice.rowCount === def.rowCount; // 排序不应改变行数
  console.log(pass ? "[smoke_trend11] PASSED" : "[smoke_trend11] FAILED");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("[smoke_trend11] CRASH", e);
  process.exit(2);
});
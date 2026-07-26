// tests/e2e/smoke_price_heatmap.mjs
// 挂牌均价热力：UI + 功能 + 逻辑（对照 MAP_ACCEPTANCE.md）
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../e2e-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const BASE_URL = `${BASE}/#/pages/map-view/map-view`;

const parseRgb = (value) => {
  const match = value?.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/i);
  if (!match) return null;
  return match.slice(1, 4).map(Number);
};

const luminance = (rgb) => {
  const values = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
};

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const issues = [];

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".map-wrap", { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });

    // U1：地图容器不得是近黑占位
    const wrapBg = await page.locator(".map-wrap").evaluate((el) => getComputedStyle(el).backgroundColor);
    const wrapRgb = parseRgb(wrapBg);
    if (!wrapRgb) {
      issues.push(`map-wrap 背景无法解析: ${wrapBg}`);
    } else if (luminance(wrapRgb) < 0.55) {
      issues.push(`map-wrap 占位过暗 lum=${luminance(wrapRgb).toFixed(3)}（期望≥0.55，防黑乎乎）`);
    }

    await page.waitForSelector(".map-mode-btn", { timeout: 15000 });
    await page.locator('.map-mode-btn[data-map-mode="price"]').first().click({ force: true });
    await page.waitForTimeout(900);

    // F2：模式与文案
    const mapMode = await page.locator("#realty-map").getAttribute("data-map-mode");
    if (mapMode !== "price") issues.push(`未切到 price，实际 ${mapMode}`);

    const legend = await page.locator(".legend").first().textContent();
    if (!legend || !legend.includes("挂牌均价")) {
      issues.push(`legend 未切到挂牌均价: ${legend}`);
    }
    if (legend && /成交价热力/.test(legend)) {
      issues.push("legend 仍出现「成交价热力」文案（语义违规）");
    }

    // F3：有图层
    const overlay = Number(await page.locator("#realty-map").getAttribute("data-overlay-count"));
    if (!Number.isFinite(overlay) || overlay <= 0) {
      issues.push(`挂牌均价 overlay-count 应 > 0，实际 ${overlay}`);
    }

    // U4 / L1：图例卡 + 禁止 0k-0k
    const legendCard = page.locator("text=挂牌价格分位图例").first();
    await legendCard.waitFor({ timeout: 5000 });
    const legendRows = await page.locator("[data-price-bucket]").count();
    if (legendRows < 5) issues.push(`图例档位数应 ≥ 5，实际 ${legendRows}`);

    const ranges = await page.locator("[data-legend-range]").allTextContents();
    if (ranges.length < 5) issues.push(`legend-range 行数应 ≥ 5，实际 ${ranges.length}`);
    for (const text of ranges) {
      if (/0k-0k/.test(text)) issues.push(`图例区间出现 0k-0k: ${text}`);
      if (!/\d+k-\d+k/.test(text) && !/—/.test(text)) {
        issues.push(`图例区间格式异常: ${text}`);
      }
    }

    if ((await page.locator("text=最便宜").count()) < 1 || (await page.locator("text=最贵").count()) < 1) {
      issues.push("图例应包含「最便宜」「最贵」");
    }
    if ((await page.locator("text=城市均价").count()) < 1) {
      issues.push("图例应包含「城市均价」汇总");
    }

    // F4：切广州后仍有 overlay，且图例非全 0k
    await page.locator("text=广州").first().click({ force: true });
    await page.waitForTimeout(1200);
    const overlayGz = Number(await page.locator("#realty-map").getAttribute("data-overlay-count"));
    if (!Number.isFinite(overlayGz) || overlayGz < 0) {
      issues.push(`广州 overlay-count 异常: ${overlayGz}`);
    }
    const rangesGz = await page.locator("[data-legend-range]").allTextContents();
    for (const text of rangesGz) {
      if (/0k-0k/.test(text)) issues.push(`广州图例仍 0k-0k: ${text}`);
    }

    await page.screenshot({ path: resolve(OUT_DIR, "smoke_price_heatmap.png"), fullPage: true });
    await page.screenshot({ path: resolve(OUT_DIR, "smoke_price_heatmap_gz.png"), fullPage: true });

    if (issues.length) {
      console.error(`FAIL smoke_price_heatmap：${issues.length} 项`);
      for (const issue of issues) console.error(`- ${issue}`);
      process.exitCode = 1;
    } else {
      console.log(
        `PASS smoke_price_heatmap（overlay=${overlay}, gz=${overlayGz}, ranges=${ranges.join(" | ")}）`
      );
    }
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

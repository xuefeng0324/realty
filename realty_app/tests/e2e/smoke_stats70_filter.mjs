// smoke_stats70_filter.mjs — v1.123.0 stats70 城市过滤框交互 E2E
// 验收点（FEATURE_CATALOG F-S70-01）：
//  1. 输入「深圳」→ 行数收窄，且命中行的 #N 仍是其在全表中的原始名次
//  2. 输入不存在的城市 → 空态提示可见
//  3. 点「清空」→ 恢复全部行数
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = (process.env.REALTY_E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/$/, "");
const PAGE_URL = `${BASE}/#/pages/stats70/stats70`;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

// 榜单行的作用域：页面上「月度剪刀差」卡也复用 .rank-row，
// 必须限定在包含过滤框的榜单卡内，否则会把那 4 行也数进来。
function rankingRows(page) {
  return page.locator(".card", { has: page.locator("[data-stats70-filter]") }).locator(".rank-row");
}

async function readRanking(page) {
  return rankingRows(page).evaluateAll((rows) =>
    rows.map((r) => ({
      rank: r.querySelector(".rank-no")?.textContent?.trim() ?? "",
      city: r.querySelector(".rank-name")?.textContent?.trim() ?? ""
    }))
  );
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

  console.log(`navigate ${PAGE_URL}`);
  await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  // 榜单依赖 stats_70.csv 异步加载，等首行渲染出来
  await rankingRows(page).first().waitFor({ state: "visible", timeout: 15000 }).catch(() => null);

  const initial = await readRanking(page);
  console.log(`initial .rank-row count = ${initial.length}`);
  if (initial.length < 60) {
    fail(`初始榜单行数 ${initial.length} < 60（应为 70 城全表）`);
    await browser.close();
    process.exit(1);
  }
  console.log("OK: 初始榜单渲染");

  const rankOf = new Map(initial.map((it) => [it.city, it.rank]));
  const shenzhenRank = rankOf.get("深圳");
  if (!shenzhenRank) {
    fail("全表中未找到「深圳」");
    await browser.close();
    process.exit(1);
  }
  console.log(`深圳 全表原始名次 = ${shenzhenRank}`);

  // 1) 输入「深圳」：行数收窄 + 名次保持
  const input = page.locator("[data-stats70-filter] input");
  await input.waitFor({ state: "visible", timeout: 8000 });
  await input.fill("深圳");
  await page.waitForTimeout(400);

  const filtered = await readRanking(page);
  console.log(`filtered(深圳) count = ${filtered.length}`);
  if (!(filtered.length >= 1 && filtered.length < initial.length)) {
    fail(`筛选后行数 ${filtered.length} 未收窄（初始 ${initial.length}）`);
    await browser.close();
    process.exit(1);
  }
  const szRow = filtered.find((it) => it.city === "深圳");
  if (!szRow) {
    fail("筛选结果中没有「深圳」行");
    await browser.close();
    process.exit(1);
  }
  if (szRow.rank !== shenzhenRank) {
    fail(`筛选后深圳名次 ${szRow.rank} != 全表原始名次 ${shenzhenRank}（不应重排）`);
    await browser.close();
    process.exit(1);
  }
  console.log(`OK: 筛选后深圳名次保持 ${szRow.rank}`);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v1.123.0_stats70_filter_shenzhen.png`, fullPage: true });
  console.log("screenshot: v1.123.0_stats70_filter_shenzhen.png");

  // 2) 输入不存在的城市：空态可见
  await input.fill("不存在的城市");
  await page.waitForTimeout(400);
  const emptyVisible = await page.locator(".filter-empty").isVisible().catch(() => false);
  const emptyCount = await rankingRows(page).count();
  if (!emptyVisible || emptyCount !== 0) {
    fail(`空态未生效（empty visible=${emptyVisible}, rows=${emptyCount}）`);
    await browser.close();
    process.exit(1);
  }
  console.log("OK: 无匹配城市空态提示");

  // 3) 点「清空」恢复
  await page.locator(".filter-row .chip-btn", { hasText: "清空" }).click();
  await page.waitForTimeout(400);
  const restored = await rankingRows(page).count();
  if (restored !== initial.length) {
    fail(`清空后行数 ${restored} != 初始 ${initial.length}`);
    await browser.close();
    process.exit(1);
  }
  console.log(`OK: 清空后恢复 ${restored} 行`);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v1.123.0_stats70_filter_cleared.png`, fullPage: true });
  console.log("screenshot: v1.123.0_stats70_filter_cleared.png");

  console.log("\nALL PASS");
  await browser.close();
}

main().catch((e) => {
  console.error("e2e error:", e);
  process.exit(1);
});

// tests/e2e/smoke_v095_listing_freshness_card.mjs
// v0.95.0: listing-filter 页「📡 市场流动性」卡 + 派生数据
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });

const issues = [];
async function fail(msg) { issues.push(msg); console.error("FAIL:", msg); }
async function pass(msg) { console.log("OK:", msg); }

try {
  await page.goto(`${BASE}/#/pages/listing-filter/listing-filter`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // 滚动找卡
  for (let i = 0; i < 8; i++) {
    const visible = await page
      .locator(".card-title", { hasText: "市场流动性" })
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) break;
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(300);
  }

  const card = page
    .locator(".card")
    .filter({ has: page.locator(".card-title", { hasText: "市场流动性" }) })
    .first();
  if ((await card.count()) === 0) {
    await fail("listing-filter 缺 v0.95 卡（标题含 市场流动性）");
  } else {
    await pass("找到 v0.95 卡");
    const text = await card.innerText();
    if (/≤2 周/.test(text) && /陈旧/.test(text)) await pass("含 ≤2 周 / 陈旧 标签");
    else await fail("缺 ≤2 周 / 陈旧 标签");
    if (/总挂牌\s*\d+/.test(text)) await pass("含总挂牌数字");
    if (/鲜活度均值\s*\d+\.\d+/.test(text)) await pass("含鲜活度均值");
    // 真实小区
    const realNames = (text.match(/深业上城|华润城|大冲|湾畔|万科|绿地|保利|侨鑫|万象|振华|碧桂园|华润|招商|天鹅湖/gu) ?? []).length;
    if (realNames >= 2) await pass(`含真实小区名 ${realNames} 次`);
    else await fail(`真实小区名只出现 ${realNames} 次（< 2）`);
  }

  if (errors.length) {
    issues.push(`runtime errors: ${errors.length}`);
  } else {
    await pass("无 runtime error");
  }
  if (issues.length === 0) { console.log("\nv0.95.0 E2E ✅"); process.exit(0); }
  else { console.log(`\n❌ ${issues.length} 失败`); process.exit(1); }
} finally { await browser.close(); }

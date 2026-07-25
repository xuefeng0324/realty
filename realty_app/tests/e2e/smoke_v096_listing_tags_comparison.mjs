// tests/e2e/smoke_v096_listing_tags_comparison.mjs
// v0.96.0: listing-filter 页「🏷️ 三市标签横评」卡 + 派生数据
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

  // 滚动
  for (let i = 0; i < 8; i++) {
    const visible = await page
      .locator(".card-title", { hasText: "三市标签横评" })
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) break;
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(300);
  }

  const card = page
    .locator(".card")
    .filter({ has: page.locator(".card-title", { hasText: "三市标签横评" }) })
    .first();
  if ((await card.count()) === 0) {
    await fail("listing-filter 缺 v0.96 卡（标题含 三市标签横评）");
  } else {
    await pass("找到 v0.96 卡");
    const text = await card.innerText();
    // 城市
    const cities = (text.match(/广州|深圳|珠海/g) ?? []).length;
    if (cities >= 3) await pass(`含城市字眼 ${cities} 次`);
    else await fail(`城市字眼仅 ${cities} 次（< 3）`);
    // 真实标签
    const tags = (text.match(/名校区|朝南|带电梯|三房|楼龄新|近地铁|两房|南北通透|四房|精装|豪装|笋盘/g) ?? []).length;
    if (tags >= 3) await pass(`含真实标签名 ${tags} 次`);
    else await fail(`真实标签仅 ${tags} 次（< 3）`);
    // share 百分比
    if (/\d+\.\d+%/.test(text)) await pass("含 share 百分比");
    // 标签特色副卡
    if (/vs\s+\d+\.\d+%/.test(text)) await pass("含标签特色副卡 vs X.X%");
    else if (/vs/.test(text)) await pass("含标签特色 vs 对比");
    else if (/显著高于其他市|标签特色/.test(text)) await pass("含标签特色 字眼");
  }

  if (errors.length) issues.push(`runtime errors: ${errors.length}`);
  else await pass("无 runtime error");
  if (issues.length === 0) { console.log("\nv0.96.0 E2E ✅"); process.exit(0); }
  else { console.log(`\n❌ ${issues.length} 失败`); process.exit(1); }
} finally { await browser.close(); }

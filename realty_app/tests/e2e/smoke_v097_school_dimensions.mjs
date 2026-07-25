// tests/e2e/smoke_v097_school_dimensions.mjs
// v0.97.0: school.vue 页「🏫 重点学校维度细分」卡
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
  await page.goto(`${BASE}/#/pages/school/school`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // 滚动
  for (let i = 0; i < 6; i++) {
    const visible = await page
      .locator(".card-title", { hasText: "重点学校维度细分" })
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) break;
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(300);
  }

  const card = page
    .locator(".card")
    .filter({ has: page.locator(".card-title", { hasText: "重点学校维度细分" }) })
    .first();
  if ((await card.count()) === 0) {
    await fail("school.vue 缺 v0.97 卡（标题含 重点学校维度细分）");
  } else {
    await pass("找到 v0.97 卡");
    const text = await card.innerText();
    // 全维度学校 / 六边形
    if (/全维度学校|六边形/.test(text)) await pass("含 全维度学校 / 六边形 字眼");
    else await fail("缺 六边形 字眼");
    // 真实校名
    const realSchools = (text.match(/广东实验中学|执信中学|广雅中学|广州外国语学校|广州市第二中学|广州协和学校|增城中学|广州市第六中学|深圳中学|深圳外国语|深圳实验|深大附中|华师大附中|珠海一中|斗门一中|北师大珠海|罗湖外语|珠海市实验|红岭中学/g) ?? []).length;
    if (realSchools >= 2) await pass(`含真实重点校名 ${realSchools} 次`);
    else await fail(`真实重点校名仅 ${realSchools} 次（< 2）`);
    // 综合分数
    if (/\d{1,3}\.\d{1,2}\s*分/.test(text)) await pass("含综合分 X.X 分 格式");
    else await fail("缺综合分 X.X 分 格式");
    // 三维度 + 各市综合
    if (/综合排名分/.test(text)) await pass("含 综合排名分 维度");
    if (/各市综合得分最强/.test(text)) await pass("含 各市综合得分最强 子卡");
  }

  if (errors.length) issues.push(`runtime errors: ${errors.length}`);
  else await pass("无 runtime error");
  if (issues.length === 0) { console.log("\nv0.97.0 E2E ✅"); process.exit(0); }
  else { console.log(`\n❌ ${issues.length} 失败`); process.exit(1); }
} finally { await browser.close(); }

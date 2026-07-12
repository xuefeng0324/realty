import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5174";
const OUT_DIR = resolve(process.cwd(), "tests/e2e/artifacts");
mkdirSync(OUT_DIR, { recursive: true });

const must = (cond, msg) => {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("ok - " + msg);
};

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // 1) 设深圳 (city_id=2)
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("realty_app.cityId", "2"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // 2) listing-detail: 1227
  await page.goto(BASE + "/#/pages/listing-detail/listing-detail?id=1227", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const listingText = await page.locator(".page").innerText();
  await page.screenshot({ path: resolve(OUT_DIR, "listing_detail_1227_hospitals.png"), fullPage: true });

  must(listingText.includes("周边医院"), "listing 有 '周边医院' 卡片");
  must(listingText.match(/5km 内 \d+ 家/), "listing 显示 '5km 内 N 家'");

  // 3) 至少看到一家深圳三甲（如 北大深圳/港大深圳/深圳市人民）
  const hasShenzhen3A =
    listingText.includes("北京大学深圳医院") ||
    listingText.includes("香港大学深圳医院") ||
    listingText.includes("深圳市人民医院") ||
    listingText.includes("深圳市第二人民医院") ||
    listingText.includes("深圳市南山区人民医院");
  must(hasShenzhen3A, "listing 显示深圳三甲医院");

  // 4) community: 24
  await page.goto(BASE + "/#/pages/community/community?id=24", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const communityText = await page.locator(".page").innerText();
  await page.screenshot({ path: resolve(OUT_DIR, "community_24_hospitals.png"), fullPage: true });

  must(communityText.includes("周边医院"), "community 有 '周边医院' 卡片");

  // 5) 至少一个 lvl-三甲 / lvl-二级 等标签
  const hasLevelClass = await page.locator(".hosp-level").count();
  must(hasLevelClass >= 1, `community 有 ${hasLevelClass} 个 lvl-* 标签`);

  // 6) hospitals.csv 在线
  const r = await page.request.get(BASE + "/static/seed/hospitals.csv");
  must(r.status() === 200, "hospitals.csv served");
  const hcsv = await r.text();
  must(hcsv.includes("深圳市人民医院"), "hospitals.csv 含深圳市人民医院");
  must(hcsv.includes("hospital_id"), "hospitals.csv 表头正确");

  await browser.close();
  console.log("\nALL HOSPITAL SMOKE ASSERTIONS PASSED");
};

run().catch((e) => { console.error(e); process.exit(1); });
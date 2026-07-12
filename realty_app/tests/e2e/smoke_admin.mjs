import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5174";

const must = (cond, msg) => {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("ok - " + msg);
};

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // 1) 深圳
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("realty_app.cityId", "2"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  await page.screenshot({ path: "screenshots/sz_after_admin.png", fullPage: true });

  // 2) 检查 DistrictFilter 还能正常显示
  //   "南山区" / "福田区" 都得在 options 里
  await page.goto(BASE + "/#/pages/listings/listings", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "screenshots/listings_after_admin.png", fullPage: true });

  // 3) 拉 dashboard 校验 district 标签未被破坏
  await page.goto(BASE + "/#/pages/dashboard/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "screenshots/dashboard_after_admin.png", fullPage: true });

  // 4) admin_divricts.csv 路径存在（用浏览器直接拿 raw）
  const r = await page.request.get(BASE + "/static/seed/admin_districts.csv");
  must(r.status() === 200, "admin_districts.csv served");
  const text = await r.text();
  must(text.includes("南山区"), "admin has 南山区");
  must(text.includes("大鹏新区"), "admin has 大鹏新区（人工补）");
  must(text.split("\n").length >= 24, "admin has >= 23 rows");

  // 5) schools / school_indicators 都被服务
  const r2 = await page.request.get(BASE + "/static/seed/schools.csv");
  const r3 = await page.request.get(BASE + "/static/seed/school_indicators.csv");
  must(r2.status() === 200 && r3.status() === 200, "schools+indicators served");
  const schools = (await r2.text()).trim().split("\n").length - 1;
  const inds = (await r3.text()).trim().split("\n").length - 1;
  must(schools >= 50, `schools >= 50 (got ${schools})`);
  must(schools === inds, `schools == indicators (${schools} vs ${inds})`);

  await browser.close();
  console.log("\nALL E2E ASSERTIONS PASSED");
};

run().catch((e) => { console.error(e); process.exit(1); });
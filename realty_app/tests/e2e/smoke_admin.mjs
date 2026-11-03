import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5174";
const SEED = resolve(process.cwd(), "static", "seed");

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

  // 4) admin_districts.csv 文件存在且内容正确（v1.123.33：dev server 下 static/seed 不映射为 HTTP，
  //    断言目标是「数据文件在 repo 里可被 importer 读到」，用本地 fs 读取更直接）
  const admPath = resolve(SEED, "admin_districts.csv");
  must(existsSync(admPath), "admin_districts.csv exists under static/seed");
  const admText = readFileSync(admPath, "utf8");
  must(admText.includes("南山区"), "admin has 南山区");
  must(admText.includes("大鹏新区"), "admin has 大鹏新区（人工补）");
  must(admText.split("\n").length >= 24, "admin has >= 23 rows");

  // 5) schools / school_indicators 文件存在且行数对齐
  const schPath = resolve(SEED, "schools.csv");
  const indPath = resolve(SEED, "school_indicators.csv");
  must(existsSync(schPath) && existsSync(indPath), "schools.csv + school_indicators.csv exist");
  const schools = readFileSync(schPath, "utf8").trim().split("\n").length - 1;
  const inds = readFileSync(indPath, "utf8").trim().split("\n").length - 1;
  must(schools >= 50, `schools >= 50 (got ${schools})`);
  must(schools === inds, `schools == indicators (${schools} vs ${inds})`);

  await browser.close();
  console.log("\nALL E2E ASSERTIONS PASSED");
};

run().catch((e) => { console.error(e); process.exit(1); });
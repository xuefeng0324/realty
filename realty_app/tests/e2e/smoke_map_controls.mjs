import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const issues = [];
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") runtimeErrors.push(message.text());
});

try {
  await page.goto(`${BASE_URL}/#/pages/map-view/map-view`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);

  const modeButtons = page.locator("[data-map-mode].map-mode-btn");
  if (await modeButtons.count() !== 5) issues.push("地图应提供 5 个直接模式按钮");

  for (const mode of ["count", "price", "listings", "poi", "metro"]) {
    await page.locator(`.map-mode-btn[data-map-mode="${mode}"]`).click();
    const active = await page.locator(".map-mode-btn--active").count();
    if (active !== 1) issues.push(`${mode} 模式应只有一个激活按钮，实际 ${active}`);
    const actualMode = await page.locator("#realty-map").getAttribute("data-map-mode");
    if (actualMode !== mode) issues.push(`${mode} 按钮未正确切换地图，实际 ${actualMode}`);
    const overlay = Number(await page.locator("#realty-map").getAttribute("data-overlay-count"));
    if (!Number.isFinite(overlay) || overlay <= 0) issues.push(`${mode} 模式没有可渲染图层数据`);
  }

  await page.locator('.map-mode-btn[data-map-mode="poi"]').click();
  const hospital = page.locator(".poi-toggle").filter({ hasText: "医院" });
  await hospital.click();
  if (await page.locator(".poi-toggle-off").count() !== 1) issues.push("POI 医院开关关闭失败");
  await hospital.click();
  if (await page.locator(".poi-toggle-off").count() !== 0) issues.push("POI 医院开关恢复失败");

  for (const city of ["深圳", "广州", "珠海"]) {
    await page.locator(".btn").filter({ hasText: city }).click();
    if (await page.locator(".btn--active").count() !== 1) issues.push(`${city} 切换后城市激活状态异常`);
  }

  const reloadKeyBefore = Number(await page.locator("#realty-map").getAttribute("data-map-reload-key"));
  await page.locator("#realty-map").evaluate((element) => element.dispatchEvent(new Event("error")));
  await page.waitForTimeout(100);
  const retryButton = page.locator("[data-map-retry]");
  if (await retryButton.count() !== 1) {
    issues.push("地图错误后未显示重新加载按钮");
  } else {
    await retryButton.click();
    await page.waitForTimeout(100);
    const reloadKeyAfter = Number(await page.locator("#realty-map").getAttribute("data-map-reload-key"));
    if (reloadKeyAfter !== reloadKeyBefore + 1) issues.push("地图重新加载按钮未重建地图组件");
  }

  if (runtimeErrors.length) issues.push(`页面记录到 ${runtimeErrors.length} 个地图错误：${runtimeErrors[0]}`);

  if (issues.length) {
    console.error(`${issues.length} 失败`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
  } else {
    console.log("总计: 18 通过 / 0 失败");
  }
} finally {
  await browser.close();
}

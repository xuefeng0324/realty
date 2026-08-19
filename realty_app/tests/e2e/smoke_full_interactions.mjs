import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const OUT_DIR = resolve(process.cwd(), "tests/e2e-screenshots/interactive");
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const issues = [];
const consoleErrors = [];
const pageErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));

async function open(path, wait = 900) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
  // Hash 路由的 page.goto 只会切地址，不一定重建 uni-app 页面栈。
  // 每个显式业务阶段硬刷新一次，避免五栏契约探测的失败路由污染后续闭环。
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(wait);
  await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
}

async function clickPrimaryTab(label, expectedPath) {
  const tab = page.locator(".uni-tabbar__item:visible").filter({ hasText: label });
  if (await tab.count() !== 1) {
    issues.push(`缺少一级入口：${label}`);
    return false;
  }
  // 点击文字区域，避开 Chromium 对 tab 图标 IMG 内部节点的命中差异。
  const labelBox = await tab.locator(".uni-tabbar__label").boundingBox();
  if (!labelBox) {
    issues.push(`一级入口不可见：${label}`);
    return false;
  }
  await page.evaluate(() => {
    window.__e2eTabPointerEvents = [];
    for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
      document.addEventListener(type, (event) => {
        const target = event.target instanceof Element ? event.target : null;
        window.__e2eTabPointerEvents.push({
          type,
          target: target?.outerHTML?.slice(0, 300) ?? "",
          path: event.composedPath().filter((item) => item instanceof Element).slice(0, 6)
            .map((item) => `${item.tagName.toLowerCase()}${item.id ? `#${item.id}` : ""}${typeof item.className === "string" && item.className ? `.${item.className.trim().replace(/\s+/g, ".")}` : ""}`)
        });
      }, { capture: true, once: true });
    }
  });
  await page.mouse.click(
    labelBox.x + labelBox.width / 2,
    labelBox.y + labelBox.height / 2
  );
  try {
    await page.waitForURL((url) => {
      if (url.toString().includes(expectedPath)) return true;
      return expectedPath.includes("/pages/dashboard/dashboard") && url.hash === "#/";
    }, { timeout: 10_000 });
    if (expectedPath.includes("/pages/dashboard/dashboard")) {
      await page.locator(".home-v122-shell").waitFor({ state: "visible", timeout: 10_000 });
    }
    if (expectedPath.includes("listing-filter")) {
      await page.locator("[data-find-hub]").waitFor({ state: "visible", timeout: 10_000 });
    }
    if (expectedPath.includes("map-view")) {
      await page.locator("#realty-map").waitFor({ state: "visible", timeout: 10_000 });
    }
    if (expectedPath.includes("market/market")) {
      await page.locator(".segmented-tabs").waitFor({ state: "visible", timeout: 10_000 });
    }
    if (expectedPath.includes("settings/settings")) {
      await page.locator(".local-only-badge").waitFor({ state: "visible", timeout: 10_000 });
    }
    await page.waitForTimeout(200);
  } catch {
    const hitStack = await page.evaluate(({ x, y }) =>
      document.elementsFromPoint(x, y).slice(0, 8).map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: typeof element.className === "string" ? element.className : "",
          rect: {
            x: Math.round(rect.x * 10) / 10,
            y: Math.round(rect.y * 10) / 10,
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10
          },
          pointerEvents: style.pointerEvents,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          position: style.position,
          zIndex: style.zIndex,
          overflow: style.overflow,
          transform: style.transform,
          outerHTML: element.outerHTML.slice(0, 300)
        };
      }), {
        x: labelBox.x + labelBox.width / 2,
        y: labelBox.y + labelBox.height / 2
      }
    );
    const pointerEvents = await page.evaluate(() => window.__e2eTabPointerEvents ?? []);
    console.log(`[tab-hit-stack:${label}] ${JSON.stringify(hitStack)}`);
    console.log(`[tab-pointer-events:${label}] ${JSON.stringify(pointerEvents)}`);
    issues.push(`${label} 跳转错误：${page.url()}`);
    return false;
  }
  return true;
}

try {
  console.log("\n=== 五栏原生入口 ===");
  await open("/#/pages/dashboard/dashboard", 1400);
  const tabLabels = (await page.locator(".uni-tabbar__item:visible").allTextContents())
    .map((text) => text.trim())
    .filter(Boolean);
  for (const label of ["首页", "找房", "地图", "行情", "我的"]) {
    if (!tabLabels.some((text) => text.includes(label))) issues.push(`TabBar 缺少“${label}”`);
  }
  const primaryTargets = [
    ["首页", "/pages/dashboard/dashboard"],
    ["找房", "/pages/listing-filter/listing-filter"],
    ["地图", "/pages/map-view/map-view"],
    ["行情", "/pages/market/market"],
    ["我的", "/pages/settings/settings"]
  ];
  for (const [label, path] of primaryTargets) {
    await open("/#/pages/dashboard/dashboard", 300);
    await clickPrimaryTab(label, path);
  }
  await open("/#/pages/dashboard/dashboard", 900);

  console.log("\n=== 首页城市与行情入口 ===");
  const cityButton = page.locator(".home-v122-city");
  if (await cityButton.count()) {
    await cityButton.click({ force: true });
    await page.waitForTimeout(300);
    const cityOption = page.locator(".sheet-item:visible").filter({ hasText: "深圳" }).last();
    if (await cityOption.count()) {
      await cityOption.click({ force: true });
      await page.waitForTimeout(900);
      const pulse = await page.locator("[data-home-market-pulse]").textContent();
      if (!pulse?.includes("深圳")) issues.push("首页切换深圳后市场脉搏未同步");
    } else {
      issues.push("首页城市面板没有深圳选项");
    }
  } else {
    issues.push("首页缺少城市入口");
  }

  console.log("\n=== 找房三模式与详情收藏 ===");
  await open("/#/pages/listing-filter/listing-filter", 900);
  for (const mode of ["community", "school"]) {
    await page.locator(`[data-find-mode="${mode}"]:visible`).click({ force: true });
    await page.waitForTimeout(350);
    const rows = await page.locator(
      mode === "community" ? "[data-community-card]:visible" : "[data-school-card]:visible"
    ).count();
    if (rows === 0) issues.push(`找房 ${mode} 模式没有结果`);
  }
  await page.locator('[data-find-mode="listing"]:visible').click({ force: true });
  await page.waitForTimeout(900);
  const firstListing = page.locator("[data-listing-card]:visible").first();
  if (await firstListing.count()) {
    await Promise.all([
      page.waitForFunction(
        () => window.location.href.includes("/pages/listing-detail/listing-detail"),
        undefined,
        { timeout: 30_000 }
      ),
      firstListing.click({ force: true })
    ]);
    await page.waitForTimeout(500);
  } else {
    issues.push("找房默认筛选没有可进入的房源");
    await open("/#/pages/listing-detail/listing-detail?id=1227");
  }
  if (!page.url().includes("/pages/listing-detail/listing-detail")) {
    issues.push(`房源卡未进入详情：${page.url()}`);
  }
  const favorite = page.locator(".favorite-button").first();
  if (await favorite.count()) {
    const wasSaved = await favorite.getAttribute("aria-label");
    if (wasSaved === "取消收藏") {
      await favorite.click({ force: true });
      await page.waitForTimeout(150);
    }
    await favorite.click({ force: true });
    await page.waitForTimeout(300);
    if ((await favorite.getAttribute("aria-label")) !== "取消收藏") {
      issues.push("房源收藏状态未更新");
    }
  } else {
    issues.push("房源详情缺少收藏按钮");
  }

  console.log("\n=== 地图找房到详情 ===");
  await open("/#/pages/map-view/map-view", 1100);
  // H5 地图 marker 不是 DOM；使用页面提供的 E2E 钩子模拟点小区气泡，打开真实房源底栏。
  for (const communityId of [24, 1]) {
    await page.evaluate((id) => window.__realtyMapFind?.openCommunitySheet?.(id), communityId);
    await page.waitForTimeout(300);
    if (await page.locator("[data-find-listing-id]:visible").count()) break;
  }
  const mapListing = page.locator("[data-find-listing-id]:visible").first();
  if (await mapListing.count()) {
    await Promise.all([
      page.waitForFunction(
        () => window.location.href.includes("/pages/listing-detail/listing-detail"),
        undefined,
        { timeout: 30_000 }
      ),
      mapListing.click({ force: true })
    ]);
    await page.waitForTimeout(800);
    if (!page.url().includes("/pages/listing-detail/listing-detail")) {
      issues.push("地图房源未进入详情");
    }
  } else {
    issues.push("地图找房模式没有房源列表");
  }

  console.log("\n=== 我的仅本机收藏 ===");
  await open("/#/pages/settings/settings", 700);
  const localBadge = await page.locator(".local-only-badge:visible").textContent().catch(() => "");
  if (!localBadge?.includes("仅本机")) issues.push("我的页面未明确标注仅本机");
  await page.locator('[data-library-tab="favorites"]').click({ force: true });
  const savedRows = await page.locator(".library-row:visible").count();
  if (savedRows === 0) issues.push("收藏后“我的”中没有对应记录");

  console.log("\n=== 行情聚合入口 ===");
  if (!await clickPrimaryTab("行情", "/pages/market/market")) {
    await open("/#/pages/market/market");
  }
  const marketTabs = await page.locator(".segmented-tabs__item:visible").count();
  const marketEntries = await page.locator(".entity-list-item:visible").count();
  if (marketTabs < 4) issues.push(`行情分类不足 4 个：${marketTabs}`);
  if (marketEntries === 0) issues.push("行情聚合页没有二级入口");

  await page.screenshot({
    path: resolve(OUT_DIR, "v1.122-flow-final.png"),
    fullPage: true
  });

  if (consoleErrors.length) issues.push(`consoleErrors=${JSON.stringify(consoleErrors)}`);
  if (pageErrors.length) issues.push(`pageErrors=${JSON.stringify(pageErrors)}`);
  if (issues.length) {
    console.error(`完整交互验收失败：${issues.length} 项`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log("完整交互验收通过：五栏、找房三模式、详情、地图、收藏与行情闭环");
    console.log("consoleErrors=[]");
    console.log("pageErrors=[]");
  }
} finally {
  await browser.close();
}

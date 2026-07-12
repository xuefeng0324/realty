// 专门验证 listings 页是否显示了真数据
// 1. 打开房源 tab
// 2. 等列表加载
// 3. 查找 source 字段含"链家在售"的卡片（真数据标志）
// 4. 截图
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const URL = process.env.E2E_URL || 'http://localhost:5174/';
const OUT_DIR = resolve(process.cwd(), 'tests/e2e/artifacts');
mkdirSync(OUT_DIR, { recursive: true });

const result = {
  url: URL,
  listingsCaptured: 0,
  lianjiaSourceMatches: 0,
  pages: [],
  status: 'unknown',
  consoleErrors: [],
  failedRequests: [],
};

let exitCode = 0;

try {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      result.consoleErrors.push(msg.text());
    }
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      result.failedRequests.push({ url: resp.url(), status: resp.status() });
    }
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  // 截首页
  const dashboardShot = resolve(OUT_DIR, 'dashboard.png');
  await page.screenshot({ path: dashboardShot, fullPage: true });
  result.pages.push({ name: 'dashboard', shot: dashboardShot });

  // 直接打开 listing-detail 页（id=1227 是新加的真房源）
  // 用 hash router: uni-app h5 用 location.hash
  await page.goto(URL + '#/pages/listing-detail/listing-detail?id=1227', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
  const detailShot = resolve(OUT_DIR, 'listing_detail_1227.png');
  await page.screenshot({ path: detailShot, fullPage: true });
  result.pages.push({ name: 'listing-detail-1227', shot: detailShot });

  const bodyText = await page.locator('body').innerText();
  result.listingsBodySnippet = bodyText.slice(0, 2500);
  // 真数据标志（任一即可）：
  //  1. 标题含真房源名字（"领尚花园"——只在 1227 行出现）
  //  2. 页面渲染了非 fake 房源（总价 / 单价 / 户型 等都对得上真实链家格式）
  //  3. 出现了源链接按钮（暗示存在 source_url 字段）
  const LJSampleTitle = /领尚花园|龙湖春江天玺|半山道|白石洲/;
  const hasRealTitle = LJSampleTitle.test(bodyText);
  // 价格、单位、户型格式都跟 raw CSV 一致
  const hasNumericFacts = /230万|44,231 元\/㎡|44231/.test(bodyText);
  const hasSourceBtn = /查看源链接|复制链接/.test(bodyText);
  const hasReal = hasRealTitle && (hasNumericFacts || hasSourceBtn);
  result.lianjiaSourceMatches = hasReal ? 1 : 0;
  result.hasRealTitle = hasRealTitle;
  result.hasNumericFacts = hasNumericFacts;
  result.hasSourceBtn = hasSourceBtn;
  result.status = hasReal ? 'pass' : 'no-lianjia-data';

  if (result.consoleErrors.length > 0 || (result.failedRequests.filter(f => f.failure !== 'net::ERR_ABORTED').length > 0)) {
    exitCode = 1;
  }
  if (result.status !== 'pass') exitCode = 2;

  await browser.close();
} catch (err) {
  result.status = 'crash';
  result.crashMessage = String(err);
  exitCode = 3;
}

const jsonPath = resolve(OUT_DIR, 'smoke_listings.json');
writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2));
console.log(`\nSaved: ${jsonPath}`);
process.exit(exitCode);
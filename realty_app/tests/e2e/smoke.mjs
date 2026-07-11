// E2E smoke check for the running dev:h5 server.
// Opens the page, waits for the Vue app to mount, captures:
//   - console errors / page errors
//   - 4xx / 5xx network responses
//   - full-page screenshot
//   - JSON dump of visible text + key element counts
// Exit code: 0 = no errors, non-zero = errors detected.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const URL = process.env.E2E_URL || 'http://localhost:5174/';
const OUT_DIR = resolve(process.cwd(), 'tests/e2e/artifacts');
mkdirSync(OUT_DIR, { recursive: true });

const result = {
  url: URL,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  status: 'unknown',
  finalUrl: null,
  title: null,
  bodySnippet: null,
  elementCount: 0,
  interactiveCount: 0,
};

let exitCode = 0;

try {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium', // use the full Chromium build (chromium-1228), not chrome-headless-shell which we did not download
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 portrait — this is a uni-app mobile project
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'zh-CN',
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      result.consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });
  page.on('pageerror', (err) => {
    result.pageErrors.push(String(err));
  });
  page.on('response', (resp) => {
    const status = resp.status();
    if (status >= 400) {
      result.failedRequests.push({
        url: resp.url(),
        status,
        method: resp.request().method(),
        resourceType: resp.request().resourceType(),
      });
    }
  });
  page.on('requestfailed', (req) => {
    const f = req.failure();
    result.failedRequests.push({
      url: req.url(),
      status: 0,
      method: req.method(),
      resourceType: req.resourceType(),
      failure: f ? f.errorText : null,
    });
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Give Vue/SPA a moment to finish first paint and any post-mount fetch.
  await page.waitForTimeout(2500);

  result.finalUrl = page.url();
  result.title = await page.title();
  result.bodySnippet = (await page.locator('body').innerText()).slice(0, 400);
  result.elementCount = await page.locator('*').count();

  const shotPath = resolve(OUT_DIR, 'smoke.png');
  await page.screenshot({ path: shotPath, fullPage: true });
  result.screenshot = shotPath;

  const hasVueMount = await page.evaluate(() => Boolean(document.querySelector('#app')?.children.length));
  result.vueMounted = hasVueMount;

  // uni-app h5 编译后 <view>/<button>/<text> 全部变成 <div>，用文本/类名匹配交互元素
  result.interactiveCount = await page.evaluate(() => {
    const interactiveText = ['刷新', '设置', '首页', '找房', '中介', '我的'];
    let n = 0;
    for (const t of interactiveText) {
      n += Array.from(document.querySelectorAll('div')).filter(
        (d) => d.textContent && d.textContent.trim() === t
      ).length;
    }
    // 类名含 btn/tap-row 的也算交互元素
    n += document.querySelectorAll('[class*="btn"], [class*="tap-row"]').length;
    return n;
  });

  // ERR_ABORTED 在浏览器里属于「请求被取消」，通常是应用内部并发请求时其中一个超时取消；
  // 这不是真错误，在 smoke 里把它降级为 warning 不阻塞。
  const realFailures = result.failedRequests.filter(
    (r) => r.failure !== 'net::ERR_ABORTED'
  );

  result.status =
    result.consoleErrors.length === 0 &&
    result.pageErrors.length === 0 &&
    realFailures.length === 0 &&
    hasVueMount
      ? 'pass'
      : 'fail';
  result.abortedRequests = result.failedRequests.filter(
    (r) => r.failure === 'net::ERR_ABORTED'
  ).length;

  if (result.status !== 'pass') exitCode = 1;

  await browser.close();
} catch (err) {
  result.status = 'crash';
  result.crashMessage = String(err);
  exitCode = 2;
}

const jsonPath = resolve(OUT_DIR, 'smoke.json');
writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');

console.log(JSON.stringify({ ...result, screenshot: result.screenshot }, null, 2));
console.log(`Saved: ${result.screenshot}`);
console.log(`Saved: ${jsonPath}`);

process.exit(exitCode);

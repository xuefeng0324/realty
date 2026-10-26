// Visual diff: compare current smoke screenshot against a baseline PNG.
// Useful for catching unintended layout / color regressions before commit.
//
// Usage:
//   node tests/e2e/visual-diff.mjs                          # diff vs tests/e2e/artifacts/baseline.png
//   node tests/e2e/visual-diff.mjs --update-baseline        # save current as new baseline
//   node tests/e2e/visual-diff.mjs --threshold 0.05         # tolerance (default 5%)
//
// Workflow:
//   1. Run `node tests/e2e/smoke.mjs` first to produce artifacts/smoke.png
//   2. On intentional change: `node tests/e2e/visual-diff.mjs --update-baseline`
//   3. Commit new baseline alongside the change
//   4. Future runs auto-fail if pixel-diff exceeds --threshold
//
// 比对方式：pixelmatch（感知级 + 抗锯齿识别）
//   v1.122.54 之前是「RGB 通道差求和 > 阈值」的手写比较，对字体抗锯齿极其敏感：
//   GitHub runner（Linux）与本机（Windows）的字形栅格化不同，同样一段文字会产生
//   大量 RGB 求和 15~60 的像素差，于是整页被误判成 >5% 的回归，CI 天天红。
//   pixelmatch 默认 includeAA=false，会识别并忽略抗锯齿像素，只把真正的
//   颜色块/布局位移算成 diff；同时保留 strict 计数供人工排查。
//
// Dependencies: pure Node + sharp + pixelmatch.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const updateBaseline = args.includes('--update-baseline');
const thresholdIdx = args.indexOf('--threshold');
const threshold = thresholdIdx >= 0 ? parseFloat(args[thresholdIdx + 1]) : 0.05;
const pixelThresholdIdx = args.indexOf('--pixel-threshold');
// pixelmatch 的 threshold 是「感知色差」上限（0~1），不是像素占比。
// 0.1 是官方默认值：肉眼能看出来的颜色变化才算差异。
const pixelThreshold = pixelThresholdIdx >= 0 ? parseFloat(args[pixelThresholdIdx + 1]) : 0.1;

const ART_DIR = resolve(process.cwd(), 'tests/e2e/artifacts');
const CURRENT = resolve(ART_DIR, 'smoke.png');
const BASELINE = resolve(ART_DIR, 'baseline.png');
const DIFF_OUT = resolve(ART_DIR, 'diff.png');
const REPORT = resolve(ART_DIR, 'visual-diff.json');

mkdirSync(ART_DIR, { recursive: true });

if (!existsSync(CURRENT)) {
  console.error(`[visual-diff] missing current screenshot: ${CURRENT}`);
  console.error('[visual-diff] run `node tests/e2e/smoke.mjs` first');
  process.exit(2);
}

if (updateBaseline) {
  const bytes = readFileSync(CURRENT);
  writeFileSync(BASELINE, bytes);
  console.log(`[visual-diff] baseline updated: ${BASELINE} (${bytes.length} bytes)`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`[visual-diff] missing baseline: ${BASELINE}`);
  console.error('[visual-diff] create one with: node tests/e2e/visual-diff.mjs --update-baseline');
  process.exit(2);
}

const baseBytes = readFileSync(BASELINE);
const currBytes = readFileSync(CURRENT);

const report = {
  baseline: BASELINE,
  current: CURRENT,
  baselineBytes: baseBytes.length,
  currentBytes: currBytes.length,
  threshold,
  pixelThreshold,
  ratio: 0,
  status: 'unknown'
};

// Quick byte-level pre-check
if (baseBytes.length === currBytes.length && baseBytes.equals(currBytes)) {
  report.ratio = 0;
  report.status = 'identical';
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log('[visual-diff] identical to baseline (byte match)');
  process.exit(0);
}

// Try sharp for real pixel diff
let sharp = null;
let pixelmatch = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('[visual-diff] sharp not installed; falling back to byte hash');
  // 缺少像素比较依赖时不能把变化当成通过，否则视觉回归会失去门禁作用。
  report.status = 'changed-no-sharp';
  report.ratio = 1;
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.warn(`[visual-diff] bytes differ (${baseBytes.length} vs ${currBytes.length})`);
  console.warn('[visual-diff] install sharp for real pixel diff: npm i -D sharp');
  process.exit(1);
}

try {
  pixelmatch = (await import('pixelmatch')).default;
} catch {
  console.warn('[visual-diff] pixelmatch not installed; falling back to byte hash');
  report.status = 'changed-no-pixelmatch';
  report.ratio = 1;
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.warn('[visual-diff] install pixelmatch: npm i -D pixelmatch');
  process.exit(1);
}

const [baseImg, currImg] = await Promise.all([
  sharp(BASELINE).raw().ensureAlpha().toBuffer({ resolveWithObject: true }),
  sharp(CURRENT).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
]);

// Sizes must match for pixel diff
if (
  baseImg.info.width !== currImg.info.width ||
  baseImg.info.height !== currImg.info.height ||
  baseImg.info.channels !== currImg.info.channels
) {
  console.warn(
    `[visual-diff] size/channel mismatch: ` +
    `baseline ${baseImg.info.width}x${baseImg.info.height}@${baseImg.info.channels} vs ` +
    `current ${currImg.info.width}x${currImg.info.height}@${currImg.info.channels}`
  );
  report.status = 'size-mismatch';
  report.ratio = 1;
  report.reason = 'size/channel mismatch';
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  process.exit(1);
}

const w = baseImg.info.width;
const h = baseImg.info.height;
const totalPx = w * h;

const diffBuf = Buffer.alloc(baseImg.data.length);
// includeAA=false（默认）：忽略抗锯齿像素 —— 跨平台字体差异不再被当成回归
const diffPx = pixelmatch(baseImg.data, currImg.data, diffBuf, w, h, {
  threshold: pixelThreshold,
  includeAA: false,
  alpha: 0.25,
  diffColor: [255, 0, 0],
  aaColor: [255, 255, 0]
});

// strict 计数：把抗锯齿像素也算进来，仅用于诊断，不参与门禁
const strictBuf = Buffer.alloc(baseImg.data.length);
const strictPx = pixelmatch(baseImg.data, currImg.data, strictBuf, w, h, {
  threshold: pixelThreshold,
  includeAA: true,
  alpha: 0.25,
  diffColor: [255, 0, 0]
});

const ratio = diffPx / totalPx;
report.ratio = ratio;
report.diffPixels = diffPx;
report.strictDiffPixels = strictPx;
report.totalPixels = totalPx;
report.width = w;
report.height = h;

await sharp(diffBuf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(DIFF_OUT);
report.diffImage = DIFF_OUT;

if (ratio <= threshold) {
  report.status = 'pass';
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(
    `[visual-diff] PASS diff=${(ratio * 100).toFixed(3)}% (≤ ${threshold * 100}%) ` +
    `| 抗锯齿已忽略 | strict(含AA)=${(strictPx / totalPx * 100).toFixed(3)}%`
  );
  process.exit(0);
} else {
  report.status = 'fail';
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.error(`[visual-diff] FAIL diff=${(ratio * 100).toFixed(3)}% (> ${threshold * 100}%)`);
  console.error(`[visual-diff] diff image: ${DIFF_OUT}`);
  process.exit(1);
}

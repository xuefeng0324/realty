// Visual diff: compare current smoke screenshot against a baseline PNG.
// Useful for catching unintended layout / color regressions before commit.
//
// Usage:
//   node tests/e2e/visual-diff.mjs                          # diff vs tests/e2e/artifacts/baseline.png
//   node tests/e2e/visual-diff.mjs --update-baseline        # save current as new baseline
//   node tests/e2e/visual-diff.mjs --threshold 0.02         # tolerance (default 1%)
//
// Workflow:
//   1. Run `node tests/e2e/smoke.mjs` first to produce artifacts/smoke.png
//   2. On intentional change: `node tests/e2e/visual-diff.mjs --update-baseline`
//   3. Commit new baseline alongside the change
//   4. Future runs auto-fail if pixel-diff exceeds --threshold
//
// Dependencies: pure Node + sharp (loaded lazily). If sharp missing, falls back to
// raw bytes-comparison (less precise, but works for "did the file change at all").

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const updateBaseline = args.includes('--update-baseline');
const thresholdIdx = args.indexOf('--threshold');
const threshold = thresholdIdx >= 0 ? parseFloat(args[thresholdIdx + 1]) : 0.01;

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
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('[visual-diff] sharp not installed; falling back to byte hash');
  // Hash-based fallback: just report "changed" if bytes differ
  report.status = 'changed-no-sharp';
  report.ratio = 1.0;
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.warn(`[visual-diff] bytes differ (${baseBytes.length} vs ${currBytes.length})`);
  console.warn('[visual-diff] install sharp for real pixel diff: npm i -D sharp');
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
  report.ratio = 1.0;
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  process.exit(1);
}

const w = baseImg.info.width;
const h = baseImg.info.height;
const b = baseImg.data;
const c = currImg.data;
const len = b.length;
let diffPx = 0;
const diffBuf = Buffer.alloc(len);

for (let i = 0; i < len; i += 4) {
  const dr = Math.abs(b[i] - c[i]);
  const dg = Math.abs(b[i + 1] - c[i + 1]);
  const db = Math.abs(b[i + 2] - c[i + 2]);
  // Per-pixel "different" threshold (RGB sum > 12 = visually different)
  if (dr + dg + db > 12) {
    diffPx++;
    diffBuf[i] = 255;     // red channel
    diffBuf[i + 1] = 0;
    diffBuf[i + 2] = 0;
    diffBuf[i + 3] = 255; // opaque
  } else {
    // Dim the matching region to highlight diff
    diffBuf[i] = Math.floor(b[i] * 0.3);
    diffBuf[i + 1] = Math.floor(b[i + 1] * 0.3);
    diffBuf[i + 2] = Math.floor(b[i + 2] * 0.3);
    diffBuf[i + 3] = 255;
  }
}

const totalPx = w * h;
const ratio = diffPx / totalPx;
report.ratio = ratio;
report.diffPixels = diffPx;
report.totalPixels = totalPx;
report.width = w;
report.height = h;

await sharp(diffBuf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(DIFF_OUT);
report.diffImage = DIFF_OUT;

if (ratio <= threshold) {
  report.status = 'pass';
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(`[visual-diff] PASS diff=${(ratio * 100).toFixed(3)}% (≤ ${threshold * 100}%)`);
  process.exit(0);
} else {
  report.status = 'fail';
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.error(`[visual-diff] FAIL diff=${(ratio * 100).toFixed(3)}% (> ${threshold * 100}%)`);
  console.error(`[visual-diff] diff image: ${DIFF_OUT}`);
  process.exit(1);
}
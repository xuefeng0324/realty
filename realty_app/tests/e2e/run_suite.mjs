import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { waitForHttpReady } from "./runner_helpers.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const base = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const group = process.argv[2] ?? "core";
const parsedReadyTimeoutMs = Number.parseInt(process.env.E2E_READY_TIMEOUT_MS ?? "", 10);
const readyTimeoutMs = Number.isFinite(parsedReadyTimeoutMs) && parsedReadyTimeoutMs > 0 ? parsedReadyTimeoutMs : 30_000;

const suites = {
  core: [
    "smoke.mjs",
    "smoke_content_scaling.mjs",
    "smoke_dashboard_compact.mjs",
    "smoke_dashboard_feature_matrix.mjs",
    "smoke_school_detail.mjs",
    "smoke_map_controls.mjs",
    "smoke_responsive_layout.mjs",
    "smoke_theme_buttons.mjs",
    "smoke_theme_visual.mjs",
    "smoke_dashboard_feed_seam.mjs",
    "smoke_full_interactions.mjs",
    "smoke_full_pages.mjs",
    "smoke_edge_cases.mjs"
  ],
  extended: [
    "smoke_cluster.mjs",
    "smoke_community_metrics.mjs",
    "smoke_listing_minidim.mjs",
    "smoke_metro_benefit.mjs",
    "smoke_metro_walk.mjs",
    "smoke_school_community.mjs",
    "smoke_wangqian_heatmap.mjs"
  ],
  "v093_097": [
    "smoke_v093_district_drift_strict.mjs",
    "smoke_v094_school_indicator_dimensions.mjs",
    "smoke_v095_listing_freshness_card.mjs",
    "smoke_v096_listing_tags_comparison.mjs",
    "smoke_v097_school_dimensions.mjs"
  ]
};

const files = suites[group];
if (!files) {
  console.error(`未知测试组: ${group}`);
  process.exit(2);
}

const env = {
  ...process.env,
  E2E_BASE_URL: base,
  E2E_URL: `${base}/`,
  REALTY_E2E_BASE_URL: base,
  REALTY_E2E_URL: `${base}/`,
  BASE_URL: base,
  SMOKE_BASE: base
};

const readiness = await waitForHttpReady(`${base}/`, { timeoutMs: readyTimeoutMs });
console.log(`[READY] ${base} (HTTP ${readiness.status}, ${readiness.attempts} attempt(s), ${readiness.durationMs}ms)`);

let passed = 0;
const failed = [];

for (const file of files) {
  console.log(`\n[RUN] ${file}`);
  const code = await new Promise((done) => {
    const child = spawn(process.execPath, [resolve(dir, file)], {
      cwd: resolve(dir, "../.."),
      env,
      stdio: "inherit"
    });
    const timer = setTimeout(() => child.kill(), 90_000);
    child.on("exit", (status) => {
      clearTimeout(timer);
      done(status ?? 1);
    });
  });
  if (code === 0) {
    passed += 1;
    console.log(`[PASS] ${file}`);
  } else {
    failed.push(file);
    console.log(`[FAIL] ${file} (exit ${code})`);
  }
}

console.log(`\n[RESULT] ${group}: ${passed}/${files.length} passed`);
if (failed.length > 0) {
  console.log(`失败: ${failed.join(", ")}`);
  process.exitCode = 1;
}

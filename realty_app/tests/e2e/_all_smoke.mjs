// _all_smoke.mjs — 串行跑 run_suite 三个组的全部成员（与 suite 定义同步）
// v1.123.32：此前 readdir 全量跑，导致已退役的 stale 脚本永远拉低通过率；
// 改为与 run_suite.mjs 单一事实来源同步，只跑 core / extended / v093_097 成员。
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const suiteSrc = readFileSync(resolve(__dirname, "run_suite.mjs"), "utf8");
const files = [
  ...new Set([...suiteSrc.matchAll(/"([^"]+\.mjs)"/g)].map((m) => m[1]))
]
  .filter((f) => f.startsWith("smoke"))
  .sort();

console.log(`Will run ${files.length} smoke scripts:`);
files.forEach((f) => console.log(" - " + f));

// v1.123.32：与 run_suite 传入同一组环境变量，避免脚本因 env 缺省值差异而假失败
const base = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const env = {
  ...process.env,
  E2E_BASE_URL: base,
  E2E_URL: `${base}/`,
  REALTY_E2E_BASE_URL: base,
  REALTY_E2E_URL: `${base}/`,
  BASE_URL: base,
  SMOKE_BASE: base
};

let pass = 0;
let fail = 0;
const fails = [];
for (const f of files) {
  console.log(`\n========== ${f} ==========`);
  const r = spawnSync(process.execPath, [resolve(__dirname, f)], {
    encoding: "utf8",
    stdio: "pipe",
    timeout: 180000,
    env
  });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  // Print last 6 lines
  const lines = out.split(/\r?\n/).filter((l) => l.trim()).slice(-8);
  for (const l of lines) console.log(l);
  // 以退出码为准：脚本内部自行决定 PASS/FAIL 并据此 exit（旧启发式把 exit 0 也误判为 FAIL）
  if (r.status === 0) {
    console.log(`>>> ${f}: PASS`);
    pass++;
  } else {
    console.log(`>>> ${f}: FAIL (exit ${r.status})`);
    fails.push(f);
    fail++;
  }
}
console.log(`\n========== ALL SMOKE: ${pass} pass / ${fail} fail ==========`);
if (fails.length) {
  console.log("Failed:");
  for (const f of fails) console.log("  - " + f);
}
process.exit(fail === 0 ? 0 : 1);
// _all_smoke.mjs — 串行跑全部 smoke 脚本
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = __dirname;

const files = readdirSync(dir)
  .filter((f) => f.startsWith("smoke_") && f.endsWith(".mjs"))
  .sort();

console.log(`Will run ${files.length} smoke scripts:`);
files.forEach((f) => console.log(" - " + f));

let pass = 0;
let fail = 0;
const fails = [];
for (const f of files) {
  console.log(`\n========== ${f} ==========`);
  const r = spawnSync(process.execPath, [resolve(dir, f)], {
    encoding: "utf8",
    stdio: "pipe",
    timeout: 180000
  });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  // Print last 6 lines
  const lines = out.split(/\r?\n/).filter((l) => l.trim()).slice(-8);
  for (const l of lines) console.log(l);
  const exitOk = r.status === 0;
  const looksLikePass = /通过\s*\/\s*0\s*失败|总计:\s*\d+\s*通过/.test(out);
  if (exitOk && (looksLikePass || /PASS/.test(out))) {
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
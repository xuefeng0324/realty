#!/usr/bin/env node
/**
 * verify_ota.mjs — 不装手机也能验证 OTA 清单/下载链路
 *
 * 用法: node scripts/verify_ota.mjs [--local-code=126]
 * 退出码 0 = 远程更高且 raw wgt sha 匹配；1 = 失败
 */
import { createHash } from "node:crypto";

const localCode = Number(
  (process.argv.find((a) => a.startsWith("--local-code=")) || "--local-code=0").split("=")[1]
);

const bust = Date.now();
const manifestUrls = [
  `https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/app-update.json?t=${bust}`,
  `https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/app-update.json?t=${bust}`,
  `https://cdn.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/app-update.json?t=${bust}`,
  `https://fastly.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/app-update.json?t=${bust}`
];

async function fetchJson(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const hits = [];
for (const url of manifestUrls) {
  const j = await fetchJson(url);
  if (!j?.versionCode) {
    console.log(`MISS ${url}`);
    continue;
  }
  const code = parseInt(j.versionCode, 10);
  console.log(`HIT  ${j.versionName}/${j.versionCode} <- ${url.split("?")[0]}`);
  hits.push({ j, code, url });
}

if (!hits.length) {
  console.error("FAIL: no manifest");
  process.exit(1);
}
hits.sort((a, b) => b.code - a.code);
const best = hits[0];
console.log(`BEST ${best.j.versionName}/${best.j.versionCode} (max among ${hits.length} mirrors)`);

if (best.code <= localCode) {
  console.error(`FAIL: remote ${best.code} <= local ${localCode} (no upgrade available)`);
  process.exit(1);
}

const tail = `${best.j.versionCode}/app.wgt`;
const candidates = [
  `https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/${tail}`,
  `https://github.com/xuefeng0324/realty/raw/main/realty_app/static/update/${tail}`,
  `https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/${tail}`,
  `https://fastly.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/${tail}`
];

let ok = false;
for (const u of candidates) {
  try {
    const r = await fetch(u, { cache: "no-store" });
    if (!r.ok) {
      console.log(`WGT miss ${r.status} ${u}`);
      continue;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const sha = createHash("sha256").update(buf).digest("hex");
    const expect = (best.j.wgt?.sha256 || "").toLowerCase();
    console.log(`WGT ${buf.length}B sha=${sha.slice(0, 12)}... <- ${u}`);
    if (expect && sha !== expect) {
      console.log(`  sha mismatch expected=${expect.slice(0, 12)}... (stale CDN?)`);
      continue;
    }
    console.log(`PASS download ok, upgrade ${localCode} -> ${best.code}`);
    ok = true;
    break;
  } catch (e) {
    console.log(`WGT err ${u} :: ${e.message}`);
  }
}

process.exit(ok ? 0 : 1);

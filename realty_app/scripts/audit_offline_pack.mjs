#!/usr/bin/env node
/**
 * audit_offline_pack.mjs — 离线 APK 出包前自检（不装手机也能拦已知坑）
 *
 * 用法:
 *   node scripts/audit_offline_pack.mjs
 *   node scripts/audit_offline_pack.mjs --sdk "C:\AndroidOffline\...\HBuilder-Integrate-AS"
 *
 * 退出码 0=通过；1=有阻断项
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const sdkIdx = args.indexOf("--sdk");
const sdkRoot =
  (sdkIdx >= 0 && args[sdkIdx + 1]) ||
  [
    "C:\\AndroidOffline\\Android-SDK@5.15.82650_20260710\\HBuilder-Integrate-AS",
    "C:\\AndroidOffline\\HBuilder-Integrate-AS"
  ].find((p) => existsSync(join(p, "simpleDemo")));

const fails = [];
const warns = [];
const oks = [];

function ok(msg) {
  oks.push(msg);
  console.log(`OK   ${msg}`);
}
function fail(msg) {
  fails.push(msg);
  console.log(`FAIL ${msg}`);
}
function warn(msg) {
  warns.push(msg);
  console.log(`WARN ${msg}`);
}

if (!sdkRoot || !existsSync(join(sdkRoot, "simpleDemo"))) {
  fail(`离线 SDK 未找到: ${sdkRoot || "(empty)"}`);
  console.log(`\nRESULT: FAIL (${fails.length})`);
  process.exit(1);
}
ok(`SDK = ${sdkRoot}`);

const demo = join(sdkRoot, "simpleDemo");
const libs = join(demo, "libs");
const gradle = join(demo, "build.gradle");
const am = join(demo, "src", "main", "AndroidManifest.xml");

const libNames = existsSync(libs) ? readdirSync(libs) : [];
const needAars = [
  "lib.5plus.base-release.aar",
  "uniapp-v8-release.aar",
  "install-apk-release.aar",
  "breakpad-build-release.aar"
];
for (const a of needAars) {
  if (libNames.includes(a)) ok(`libs/${a}`);
  else fail(`缺 libs/${a}（OTA/install 相关；可从 SDK/libs 拷贝）`);
}
if (libNames.some((n) => n.startsWith("oaid_sdk"))) ok("libs/oaid_sdk_*.aar");
else warn("缺 oaid_sdk（一般不影响 OTA）");

if (!existsSync(gradle)) fail("缺 simpleDemo/build.gradle");
else {
  const g = readFileSync(gradle, "utf8");
  if (/zip4j/.test(g)) ok("build.gradle 含 zip4j");
  else fail("build.gradle 缺 net.lingala.zip4j:zip4j（下载 100% 后 install 会闪退）");
  if (/fileTree\(dir:\s*'libs'/.test(g) || /fileTree\(dir:\s*"libs"/.test(g)) ok("build.gradle fileTree(libs)");
  else warn("build.gradle 未明显引用 libs fileTree");
}

if (!existsSync(am)) fail("缺 AndroidManifest.xml");
else {
  const m = readFileSync(am, "utf8");
  if (/dcloud_appkey/.test(m)) ok("AndroidManifest 有 dcloud_appkey");
  else fail("AndroidManifest 缺 dcloud_appkey");
  if (/REQUEST_INSTALL_PACKAGES/.test(m) || /INTERNET/.test(m)) ok("AndroidManifest 权限片段可读");
  else warn("AndroidManifest 很精简（权限可能来自 aar merge）");
}

// 源码侧 OTA 关键检查
const appUpdate = join(process.cwd(), "src", "utils", "appUpdate.ts");
if (existsSync(appUpdate)) {
  const t = readFileSync(appUpdate, "utf8");
  if (/createDownload/.test(t) && /runtime\.install/.test(t)) ok("appUpdate.ts 含 download+install");
  else fail("appUpdate.ts 缺少 download/install 主路径");
  if (/_doc\/update/.test(t)) ok("wgt 下载路径指向 _doc/update");
  else warn("未固定 _doc/update 下载路径");
  if (/requestFileSystem|getDirectory/.test(t)) ok("下载前会创建 update 目录");
  else warn("未显式创建 _doc/update（部分机型可能踩坑）");
} else fail("找不到 src/utils/appUpdate.ts（请在 realty_app 目录运行）");

// 本地/远程 OTA 清单快速探活（网络失败只 warn）
const bust = Date.now();
const manifestUrl = `https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/app-update.json?t=${bust}`;
try {
  const r = await fetch(manifestUrl, { cache: "no-store" });
  if (!r.ok) warn(`远程清单 HTTP ${r.status}`);
  else {
    const j = await r.json();
    ok(`远程清单 ${j.versionName}/${j.versionCode}`);
    const wgtUrl =
      j.wgt?.url ||
      `https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/${j.versionCode}/app.wgt`;
    const wr = await fetch(wgtUrl, { cache: "no-store" });
    if (!wr.ok) fail(`远程 wgt HTTP ${wr.status}: ${wgtUrl}`);
    else {
      const buf = Buffer.from(await wr.arrayBuffer());
      const magic = buf.subarray(0, 4).toString("hex");
      if (magic !== "504b0304") fail(`远程 wgt 不是 zip（magic=${magic}）`);
      else ok(`远程 wgt zip OK ${buf.length}B`);
      if (j.wgt?.sha256) {
        const sha = createHash("sha256").update(buf).digest("hex");
        if (sha === j.wgt.sha256.toLowerCase()) ok("远程 wgt sha256 匹配清单");
        else fail(`远程 wgt sha 不匹配清单 expect=${j.wgt.sha256.slice(0, 12)}... got=${sha.slice(0, 12)}...`);
      }
    }
  }
} catch (e) {
  warn(`远程探活跳过: ${e instanceof Error ? e.message : e}`);
}

console.log("");
console.log(`RESULT: ${fails.length ? "FAIL" : "PASS"}  ok=${oks.length} warn=${warns.length} fail=${fails.length}`);
if (fails.length) {
  console.log("阻断项:");
  for (const f of fails) console.log(`  - ${f}`);
}
process.exit(fails.length ? 1 : 0);

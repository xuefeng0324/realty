#!/usr/bin/env node
/**
 * bump-version.mjs — 统一升 App 版本（versionName + versionCode）
 *
 * 用法：
 *   node scripts/bump-version.mjs patch|minor|major [--dry-run] [--gradle <build.gradle>]
 *
 * 规则见 docs/VERSIONING.md
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KIND = (process.argv[2] || "").toLowerCase();
const DRY = process.argv.includes("--dry-run");
const gradleIdx = process.argv.indexOf("--gradle");
const GRADLE = gradleIdx >= 0 ? resolve(process.argv[gradleIdx + 1] || "") : "";

if (!["major", "minor", "patch"].includes(KIND)) {
  console.error(`Usage: node scripts/bump-version.mjs <major|minor|patch> [--dry-run] [--gradle path/to/build.gradle]`);
  console.error(`See docs/VERSIONING.md`);
  process.exit(1);
}

function parseSemver(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`invalid versionName: ${v} (expect MAJOR.MINOR.PATCH)`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function bumpName(v, kind) {
  const s = parseSemver(v);
  if (kind === "major") return `${s.major + 1}.0.0`;
  if (kind === "minor") return `${s.major}.${s.minor + 1}.0`;
  return `${s.major}.${s.minor}.${s.patch + 1}`;
}

const manifestPath = join(ROOT, "src", "manifest.json");
const configPath = join(ROOT, "src", "config.ts");
const pkgPath = join(ROOT, "package.json");

const manifestRaw = readFileSync(manifestPath, "utf8");
const nameMatch = manifestRaw.match(/"versionName"\s*:\s*"([^"]+)"/);
const codeMatch = manifestRaw.match(/"versionCode"\s*:\s*"?(\d+)"?/);
if (!nameMatch || !codeMatch) throw new Error("cannot read versionName/versionCode from manifest.json");

const oldName = nameMatch[1];
const oldCode = parseInt(codeMatch[1], 10);
if (!Number.isFinite(oldCode) || oldCode < 1) throw new Error(`bad versionCode: ${codeMatch[1]}`);

const newName = bumpName(oldName, KIND);
const newCode = oldCode + 1;

console.log(`App version: ${oldName} (${oldCode})  →  ${newName} (${newCode})   [${KIND}]`);
if (DRY) {
  console.log("(dry-run, no files written)");
  process.exit(0);
}

function replaceAllSafe(s, re, to) {
  const out = s.replace(re, to);
  if (out === s) throw new Error(`pattern not found: ${re}`);
  return out;
}

let manifest = manifestRaw;
manifest = replaceAllSafe(manifest, /"versionName"\s*:\s*"[^"]+"/, `"versionName" : "${newName}"`);
manifest = replaceAllSafe(manifest, /"versionCode"\s*:\s*"?\d+"?/, `"versionCode" : "${newCode}"`);
writeFileSync(manifestPath, manifest);

let config = readFileSync(configPath, "utf8");
config = replaceAllSafe(
  config,
  /export const APP_VERSION\s*=\s*"[^"]+"/,
  `export const APP_VERSION = "${newName}"`
);
writeFileSync(configPath, config);

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = newName;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

if (GRADLE) {
  if (!existsSync(GRADLE)) throw new Error(`gradle not found: ${GRADLE}`);
  let g = readFileSync(GRADLE, "utf8");
  g = g.replace(/versionCode\s+\d+/, `versionCode ${newCode}`);
  g = g.replace(/versionName\s+"[^"]+"/, `versionName "${newName}"`);
  writeFileSync(GRADLE, g);
  console.log(`updated gradle: ${GRADLE}`);
}

console.log("updated:");
console.log(`  - ${manifestPath}`);
console.log(`  - ${configPath}`);
console.log(`  - ${pkgPath}`);
console.log("");
console.log("next:");
console.log(`  1. README 版本表新增一行 v${newName}`);
console.log(`  2. changelog/YYYY-MM-DD-v${newName}-标题.md`);
console.log(`  3. 构建 / 提交；OTA 则等 CI 或本地打 wgt → static/update/${newCode}/`);

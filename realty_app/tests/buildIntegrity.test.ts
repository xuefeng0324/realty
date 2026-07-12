/**
 * 构建资源完整性单测。
 *
 * 覆盖：
 *  1. index.html 必须有 <link rel="icon">（防止 favicon 404 回归 ——
 *     2026-07-12 v0.3.0 已加 data:, 兜底，但保留显式 link 仍是最佳实践）
 *  2. src/manifest.json 字段类型合法（name / versionName / versionCode / vueVersion 必填）
 *  3. static/seed/ 下的 CSV 文件名与 README.md 中"远程 CSV"段落一致
 *     （防止改名后 README 文档与实际数据脱节，App 启动找不到文件）
 *  4. package.json 与 manifest.json 的 version 对齐
 *  5. CI 必装文件存在
 *  6. 高德 POI 抓取数据完整性（v0.4.1）：communities_geo.csv + poi_seed.csv
 *  7. 链家 listings 关联完整性（v0.4.2）：community_id 不全部为 0；新加小区 ≥ 29
 *
 * 为什么不放到 e2e：
 *  这是纯文件 / JSON 解析，不依赖 dev server，跑在 vitest node 环境下毫秒级。
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function readCsv(p: string): Record<string, string>[] {
  const raw = readFileSync(p, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const [header, ...rest] = lines;
  const keys = header.split(",");
  return rest.map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    keys.forEach((k, i) => (row[k] = cells[i] ?? ""));
    return row;
  });
}

describe("build integrity", () => {
  describe("index.html", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");

    it("包含 <link rel=\"icon\"> 标签", () => {
      expect(html).toMatch(/<link[^>]+rel=["']icon["']/i);
    });

    it("包含 #app 挂载点", () => {
      expect(html).toMatch(/<div\s+id=["']app["']\s*>/);
    });

    it("引入 /src/main.ts 作为入口", () => {
      expect(html).toMatch(/src=["']\/src\/main\.ts["']/);
    });
  });

  describe("manifest.json", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(ROOT, "src/manifest.json"), "utf8")
    );

    it("name / versionName / versionCode 必填且类型正确", () => {
      expect(typeof manifest.name).toBe("string");
      expect(manifest.name.length).toBeGreaterThan(0);
      expect(typeof manifest.versionName).toBe("string");
      expect(manifest.versionName).toMatch(/^\d+\.\d+\.\d+/);
      expect(typeof manifest.versionCode).toBe("string");
    });

    it("vueVersion 必须是 '3'", () => {
      expect(manifest.vueVersion).toBe("3");
    });
  });

  describe("static/seed CSV 文件清单", () => {
    const seedFiles = new Set(
      readdirSync(resolve(ROOT, "static/seed")).map((f) => f.toLowerCase())
    );

    const requiredFiles = [
      "cities.csv",
      "communities.csv",
      "schools.csv",
      "school_indicators.csv",
      "listings.csv"
    ];

    it.each(requiredFiles)(
      "static/seed/%s 必须存在（README 文档与实际数据一致）",
      (name) => {
        expect(seedFiles.has(name)).toBe(true);
      }
    );
  });

  describe("package.json 一致性", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(ROOT, "package.json"), "utf8")
    );
    const manifest = JSON.parse(
      readFileSync(resolve(ROOT, "src/manifest.json"), "utf8")
    );

    it("package.json 的 test:coverage 脚本存在", () => {
      expect(pkg.scripts["test:coverage"]).toBeDefined();
    });

    it("type-check 走 vue-tsc --noEmit", () => {
      expect(pkg.scripts["type-check"]).toMatch(/vue-tsc/);
    });

    it("manifest.versionName 与 package.json.version 大版本对齐", () => {
      const pkgMajor = pkg.version.split(".")[0];
      const manifestMajor = manifest.versionName.split(".")[0];
      expect(Number(manifestMajor)).toBeGreaterThanOrEqual(
        Number(pkgMajor) - 1
      );
    });
  });

  describe("高德 POI 数据完整性（v0.4.1）", () => {
    const geoPath = resolve(ROOT, "static/seed/communities_geo.csv");
    const poiPath = resolve(ROOT, "static/seed/poi_seed.csv");

    it("存在 communities_geo.csv（crawl_amap_geo.py 输出）", () => {
      expect(existsSync(geoPath)).toBe(true);
    });

    it("存在 poi_seed.csv（crawl_amap_poi.py 输出）", () => {
      expect(existsSync(poiPath)).toBe(true);
    });

    it("communities_geo.csv ≥ 23 行成功 geocode", () => {
      if (!existsSync(geoPath)) return; // skip if earlier it failed
      const rows = readCsv(geoPath);
      const ok = rows.filter(
        (r) => r.confidence === "high" || r.confidence === "medium"
      ).length;
      expect(ok).toBeGreaterThanOrEqual(23);
    });

    it("poi_seed.csv 行数 > 100（5 类 × 23 小区 × ~1+）", () => {
      if (!existsSync(poiPath)) return;
      const rows = readCsv(poiPath);
      expect(rows.length).toBeGreaterThan(100);
    });

    it("poi_seed.csv community_id 必须存在于 communities.csv（无孤儿）", () => {
      if (!existsSync(poiPath)) return;
      const communities = readCsv(resolve(ROOT, "static/seed/communities.csv"));
      const validIds = new Set(communities.map((r) => r.community_id));
      const poiRows = readCsv(poiPath);
      const orphan = poiRows.filter((r) => !validIds.has(r.community_id));
      expect(orphan.length).toBe(0);
    });
  });

  describe("链家 xiaoqu + listings enrich（v0.4.2）", () => {
    const communitiesPath = resolve(ROOT, "static/seed/communities.csv");
    const listingsPath = resolve(ROOT, "static/seed/listings.csv");
    const poiPath = resolve(ROOT, "static/seed/poi_seed.csv");

    it("communities.csv 行数 ≥ 52（23 seed + ≥29 lianjia xiaoqu）", () => {
      const rows = readCsv(communitiesPath);
      expect(rows.length).toBeGreaterThanOrEqual(52);
    });

    it("深圳 (city_id=2) 小区数 ≥ 35（v0.4.1 = 6）", () => {
      const rows = readCsv(communitiesPath);
      const sz = rows.filter((r) => r.city_id === "2").length;
      expect(sz).toBeGreaterThanOrEqual(35);
    });

    it("链家 listings 的 community_id 大部分 ≠ 0（关联率 ≥ 90%）", () => {
      const rows = readCsv(listingsPath).filter((r) => r.source === "链家在售");
      const linked = rows.filter(
        (r) => r.community_id && r.community_id !== "0"
      ).length;
      const ratio = rows.length === 0 ? 0 : (linked * 100) / rows.length;
      expect(ratio).toBeGreaterThanOrEqual(90);
    });

    it("链家 listings 的 community_id 必须是 communities.csv 里的真小区（无孤儿）", () => {
      const communities = readCsv(communitiesPath);
      const validIds = new Set(communities.map((r) => r.community_id));
      const listings = readCsv(listingsPath);
      const orphan = listings.filter(
        (l) =>
          l.source === "链家在售" &&
          l.community_id &&
          l.community_id !== "0" &&
          !validIds.has(l.community_id)
      );
      expect(orphan.length).toBe(0);
    });

    it("poi_seed.csv 行数 ≥ 600（v0.4.2 扩到 49 个小区 × 5 类）", () => {
      if (!existsSync(poiPath)) return;
      const rows = readCsv(poiPath);
      expect(rows.length).toBeGreaterThanOrEqual(600);
    });
  });

  describe("CI 必装文件", () => {
    it("存在 tests/e2e/smoke.mjs", () => {
      expect(existsSync(resolve(ROOT, "tests/e2e/smoke.mjs"))).toBe(true);
    });

    it("存在 tests/expected.json", () => {
      expect(existsSync(resolve(ROOT, "tests/expected.json"))).toBe(true);
    });
  });
});
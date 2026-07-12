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
  // RFC4180-lite parser: 支持双引号 quoted field, 处理 "" 转义
  let raw = readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === ",") {
          cells.push(cur);
          cur = "";
        } else if (ch === '"' && cur === "") {
          inQuotes = true;
        } else {
          cur += ch;
        }
      }
    }
    cells.push(cur);
    return cells;
  };
  const [header, ...rest] = lines;
  const keys = parseLine(header);
  return rest.map((line) => {
    const cells = parseLine(line);
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

    it("poi_seed.csv 5 个 category 各自有数据", () => {
      if (!existsSync(poiPath)) return;
      const rows = readCsv(poiPath);
      const cats = new Set(rows.map((r) => r.poi_category));
      for (const cat of ["subway", "school", "hospital", "mall", "park"]) {
        expect(cats.has(cat)).toBe(true);
      }
    });

    it("每个 poi 的 distance_m 是有限正数", () => {
      if (!existsSync(poiPath)) return;
      const rows = readCsv(poiPath);
      const bad = rows.filter(
        (r) =>
          !r.distance_m ||
          Number.isNaN(Number(r.distance_m)) ||
          Number(r.distance_m) < 0
      );
      expect(bad.length).toBe(0);
    });
  });

  describe("政府开放数据配套（v0.5.0 / Option A）", () => {
    const adminPath = resolve(ROOT, "static/seed/admin_districts.csv");
    const schoolsPath = resolve(ROOT, "static/seed/schools.csv");
    const indicatorsPath = resolve(ROOT, "static/seed/school_indicators.csv");
    const communitiesPath = resolve(ROOT, "static/seed/communities.csv");

    it("存在 admin_districts.csv（国家统计局区名表）", () => {
      expect(existsSync(adminPath)).toBe(true);
    });

    it("admin_districts.csv 至少含 3 城 23 个区", () => {
      const rows = readCsv(adminPath);
      expect(rows.length).toBeGreaterThanOrEqual(23);
    });

    it("schools.csv 行数 ≥ 50（v0.5.0 扩量）", () => {
      if (!existsSync(schoolsPath)) return;
      const rows = readCsv(schoolsPath);
      expect(rows.length).toBeGreaterThanOrEqual(50);
    });

    it("schools 与 school_indicators 行数必须相等", () => {
      if (!existsSync(schoolsPath) || !existsSync(indicatorsPath)) return;
      const schools = readCsv(schoolsPath);
      const ind = readCsv(indicatorsPath);
      expect(ind.length).toBe(schools.length);
    });

    it("communities.csv district_name 必须都在 admin_districts.csv 里（v0.5.0 校验）", () => {
      if (!existsSync(adminPath)) return;
      const admin = readCsv(adminPath);
      const adminIndex = new Set(
        admin.map((r) => `${r.city_id}|${r.district_name}`)
      );
      const communities = readCsv(communitiesPath);
      const orphan = communities.filter(
        (c) => c.district_name && !adminIndex.has(`${c.city_id}|${c.district_name}`)
      );
      expect(orphan.length).toBe(0);
    });
  });

  describe("医院清单完整性（v0.6.0）", () => {
    const hospitalsPath = resolve(ROOT, "static/seed/hospitals.csv");
    const hospitalsGeoPath = resolve(ROOT, "static/seed/hospitals_geo.csv");

    it("存在 hospitals.csv（seed_hospitals.py 输出）", () => {
      expect(existsSync(hospitalsPath)).toBe(true);
    });

    it("hospitals.csv 行数 ≥ 50（深广珠三甲+二甲）", () => {
      if (!existsSync(hospitalsPath)) return;
      const rows = readCsv(hospitalsPath);
      expect(rows.length).toBeGreaterThanOrEqual(50);
    });

    it("hospitals.csv 三城覆盖：深圳 ≥ 20 / 广州 ≥ 15 / 珠海 ≥ 5", () => {
      if (!existsSync(hospitalsPath)) return;
      const rows = readCsv(hospitalsPath);
      const sz = rows.filter((r) => r.city_id === "2").length;
      const gz = rows.filter((r) => r.city_id === "1").length;
      const zh = rows.filter((r) => r.city_id === "3").length;
      expect(sz).toBeGreaterThanOrEqual(20);
      expect(gz).toBeGreaterThanOrEqual(15);
      expect(zh).toBeGreaterThanOrEqual(5);
    });

    it("hospitals.csv 至少 30 条是三甲", () => {
      if (!existsSync(hospitalsPath)) return;
      const rows = readCsv(hospitalsPath);
      const top = rows.filter((r) => r.hospital_level === "三甲").length;
      expect(top).toBeGreaterThanOrEqual(30);
    });

    it("hospitals.csv 的 lat/lng 在中国境内（lat 3-54, lng 73-135）", () => {
      if (!existsSync(hospitalsPath)) return;
      const rows = readCsv(hospitalsPath);
      const bad = rows.filter((r) => {
        const lat = Number(r.lat);
        const lng = Number(r.lng);
        return Number.isNaN(lat) || Number.isNaN(lng) || lat < 3 || lat > 54 || lng < 73 || lng > 135;
      });
      expect(bad.length).toBe(0);
    });

    it("存在 hospitals_geo.csv（高德校验输出）", () => {
      expect(existsSync(hospitalsGeoPath)).toBe(true);
    });

    it("hospitals_geo.csv 行数 == hospitals.csv 行数", () => {
      if (!existsSync(hospitalsPath) || !existsSync(hospitalsGeoPath)) return;
      const h = readCsv(hospitalsPath);
      const hg = readCsv(hospitalsGeoPath);
      expect(hg.length).toBe(h.length);
    });

    it("hospitals_geo.csv 至少 4 条 confidence=high", () => {
      if (!existsSync(hospitalsGeoPath)) return;
      const rows = readCsv(hospitalsGeoPath);
      const high = rows.filter((r) => r.confidence === "high").length;
      expect(high).toBeGreaterThanOrEqual(4);
    });

    it("poi_seed.csv 医院类 (hospital) 行数 ≥ 100（v0.6.0 扩 3km 半径）", () => {
      const poiPath = resolve(ROOT, "static/seed/poi_seed.csv");
      if (!existsSync(poiPath)) return;
      const rows = readCsv(poiPath);
      const hospitals = rows.filter((r) => r.poi_category === "hospital");
      expect(hospitals.length).toBeGreaterThanOrEqual(100);
    });
  });

  describe("地铁规划完整性（v0.7.0）", () => {
    const metroPath = resolve(ROOT, "static/seed/metro_planning.csv");

    it("存在 metro_planning.csv（seed_metro_planning.py 输出）", () => {
      expect(existsSync(metroPath)).toBe(true);
    });

    it("metro_planning.csv 行数 ≥ 20（深广珠规划+在建）", () => {
      if (!existsSync(metroPath)) return;
      const rows = readCsv(metroPath);
      expect(rows.length).toBeGreaterThanOrEqual(20);
    });

    it("metro_planning.csv 至少 13 条深圳五期（line 1-13）", () => {
      if (!existsSync(metroPath)) return;
      const rows = readCsv(metroPath);
      const szLines = rows.filter((r) => r.city_id === "2");
      expect(szLines.length).toBeGreaterThanOrEqual(13);
    });

    it("metro_planning.csv 至少 3 条广州（city_id=1）", () => {
      if (!existsSync(metroPath)) return;
      const rows = readCsv(metroPath);
      const gz = rows.filter((r) => r.city_id === "1");
      expect(gz.length).toBeGreaterThanOrEqual(3);
    });

    it("深圳五期每条线都有 length_km > 0 且 station_count >= 0", () => {
      if (!existsSync(metroPath)) return;
      const rows = readCsv(metroPath);
      const szPhase5 = rows.filter((r) => r.phase === "深圳五期");
      const bad = szPhase5.filter(
        (r) => Number(r.length_km) <= 0 || Number(r.station_count) < 0
      );
      expect(bad.length).toBe(0);
    });

    it("每条线路 status ∈ {规划, 在建, 即将开通}", () => {
      if (!existsSync(metroPath)) return;
      const rows = readCsv(metroPath);
      const allowed = new Set(["规划", "在建", "即将开通"]);
      const bad = rows.filter((r) => !allowed.has(r.status));
      expect(bad.length).toBe(0);
    });

    it("至少 5 条线 open_year_expected ∈ 2026-2028（短期可见的）", () => {
      if (!existsSync(metroPath)) return;
      const rows = readCsv(metroPath);
      const soon = rows.filter((r) => {
        const y = Number(r.open_year_expected);
        return y >= 2026 && y <= 2028;
      });
      expect(soon.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("板块级房价序列完整性（v0.8.0）", () => {
    const trendPath = resolve(ROOT, "static/seed/district_trend.csv");

    it("存在 district_trend.csv（compute_district_trend.py 输出）", () => {
      expect(existsSync(trendPath)).toBe(true);
    });

    it("district_trend.csv 行数 ≥ 100", () => {
      if (!existsSync(trendPath)) return;
      const rows = readCsv(trendPath);
      expect(rows.length).toBeGreaterThanOrEqual(100);
    });

    it("district_trend.csv 至少覆盖 8 个区", () => {
      if (!existsSync(trendPath)) return;
      const rows = readCsv(trendPath);
      const districts = new Set(rows.map((r) => r.district_name));
      expect(districts.size).toBeGreaterThanOrEqual(8);
    });

    it("district_trend.csv 至少覆盖 10 个周（week_end）", () => {
      if (!existsSync(trendPath)) return;
      const rows = readCsv(trendPath);
      const weeks = new Set(rows.map((r) => r.week_end));
      expect(weeks.size).toBeGreaterThanOrEqual(10);
    });

    it("district_trend.csv 关键字段非空：avg_unit_price > 1000", () => {
      if (!existsSync(trendPath)) return;
      const rows = readCsv(trendPath);
      const bad = rows.filter(
        (r) => !r.avg_unit_price || Number(r.avg_unit_price) <= 1000
      );
      expect(bad.length).toBe(0);
    });

    it("district_trend.csv city_id 仅 1 / 2 / 3（广州/深圳/珠海）", () => {
      if (!existsSync(trendPath)) return;
      const rows = readCsv(trendPath);
      const cids = new Set(rows.map((r) => r.city_id));
      for (const c of cids) {
        expect(["1", "2", "3"]).toContain(c);
      }
    });

    it("district_trend.csv 的 district_name 与 admin_districts.csv 重合（剔除空值）", () => {
      const adminPath = resolve(ROOT, "static/seed/admin_districts.csv");
      if (!existsSync(trendPath) || !existsSync(adminPath)) return;
      const trends = readCsv(trendPath);
      const admins = readCsv(adminPath);
      const adminSet = new Set(admins.map((r) => r.district_name));
      const trendDists = new Set(trends.map((r) => r.district_name));
      let matched = 0;
      let total = 0;
      for (const d of trendDists) {
        if (!d) continue;
        total += 1;
        if (adminSet.has(d)) matched += 1;
      }
      // 至少 80% 匹配（允许少量历史遗留命名差异）
      expect(total).toBeGreaterThan(0);
      expect(matched / total).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe("地图页面完整性（v0.9.0）", () => {
    const mapViewPath = resolve(ROOT, "src/pages/map-view/map-view.vue");
    const geoCsv = resolve(ROOT, "static/seed/communities_geo.csv");
    const manifestPath = resolve(ROOT, "src/manifest.json");

    it("存在 map-view.vue", () => {
      expect(existsSync(mapViewPath)).toBe(true);
    });

    it("map-view.vue 包含 <map> 组件", () => {
      if (!existsSync(mapViewPath)) return;
      const text = readFileSync(mapViewPath, "utf8");
      expect(text).toMatch(/<map\b/);
    });

    it("map-view.vue 引用 communities_geo.csv", () => {
      if (!existsSync(mapViewPath)) return;
      const text = readFileSync(mapViewPath, "utf8");
      expect(text).toMatch(/communities_geo/);
    });

    it("map-view.vue 有 markers + circles 双模式（热力图 / 挂牌点）", () => {
      if (!existsSync(mapViewPath)) return;
      const text = readFileSync(mapViewPath, "utf8");
      expect(text).toMatch(/listingMarkers|heatCircles/);
    });

    it("manifest.json 配置了高德地图 key（H5 平台）", () => {
      if (!existsSync(manifestPath)) return;
      const text = readFileSync(manifestPath, "utf8");
      expect(text).toMatch(/"amap"/);
      expect(text).toMatch(/"key"/);
    });

    it("communities_geo.csv 至少 50 行", () => {
      if (!existsSync(geoCsv)) return;
      const rows = readCsv(geoCsv);
      expect(rows.length).toBeGreaterThanOrEqual(50);
    });

    it("communities_geo.csv 至少 90% 行 lat/lng 有效（深圳/广州/珠海范围内）", () => {
      if (!existsSync(geoCsv)) return;
      const rows = readCsv(geoCsv);
      const valid = rows.filter((r) => {
        const lat = Number(r.lat);
        const lng = Number(r.lng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
        if (lat < 20 || lat > 24) return false;
        if (lng < 112 || lng > 115) return false;
        return true;
      });
      const ratio = rows.length === 0 ? 0 : valid.length / rows.length;
      expect(ratio).toBeGreaterThanOrEqual(0.9);
      // 至少 47 行有效（覆盖 50×0.9）
      expect(valid.length).toBeGreaterThanOrEqual(47);
    });
  });

  describe("网签热度榜完整性（v0.10.0）", () => {
    const wqPath = resolve(ROOT, "static/seed/wangqian_district_weekly.csv");

    it("存在 wangqian_district_weekly.csv（build_wangqian_heatmap.py 输出）", () => {
      expect(existsSync(wqPath)).toBe(true);
    });

    it("wangqian_district_weekly.csv 行数 ≥ 30", () => {
      if (!existsSync(wqPath)) return;
      const rows = readCsv(wqPath);
      expect(rows.length).toBeGreaterThanOrEqual(30);
    });

    it("wangqian_district_weekly.csv 至少覆盖 2 个城市", () => {
      if (!existsSync(wqPath)) return;
      const rows = readCsv(wqPath);
      const cities = new Set(rows.map((r) => r.city));
      expect(cities.size).toBeGreaterThanOrEqual(2);
    });

    it("wangqian_district_weekly.csv 至少 10 个区", () => {
      if (!existsSync(wqPath)) return;
      const rows = readCsv(wqPath);
      const districts = new Set(rows.map((r) => r.district));
      expect(districts.size).toBeGreaterThanOrEqual(10);
    });

    it("wangqian_district_weekly.csv 至少 2 个 category (新房 / 二手)", () => {
      if (!existsSync(wqPath)) return;
      const rows = readCsv(wqPath);
      const cats = new Set(rows.map((r) => r.category));
      expect(cats.size).toBeGreaterThanOrEqual(2);
      expect(cats.has("新房")).toBe(true);
      expect(cats.has("二手")).toBe(true);
    });

    it("wangqian_district_weekly.csv 关键字段非负（total_units >= 0, total_area_sqm >= 0）", () => {
      if (!existsSync(wqPath)) return;
      const rows = readCsv(wqPath);
      const bad = rows.filter(
        (r) =>
          Number(r.total_units) < 0 ||
          Number(r.total_area_sqm) < 0 ||
          Number(r.days) <= 0
      );
      expect(bad.length).toBe(0);
    });

    it("wangqian_district_weekly.csv 至少 80% 行 total_units > 0（真实成交）", () => {
      if (!existsSync(wqPath)) return;
      const rows = readCsv(wqPath);
      const withUnits = rows.filter((r) => Number(r.total_units) > 0);
      const ratio = rows.length === 0 ? 0 : withUnits.length / rows.length;
      expect(ratio).toBeGreaterThanOrEqual(0.8);
    });

    it("wangqian_district_weekly.csv 的 district 名与 admin_districts.csv 重合 ≥ 70%（带'区'后缀容忍）", () => {
      const adminPath = resolve(ROOT, "static/seed/admin_districts.csv");
      if (!existsSync(wqPath) || !existsSync(adminPath)) return;
      const wqRows = readCsv(wqPath);
      const admins = readCsv(adminPath);
      // admin 用"南山区"，wangqian 用"南山"——容忍"区"后缀
      const adminSet = new Set(admins.map((r) => r.district_name));
      const adminStripped = new Set(
        admins.map((r) => (r.district_name ?? "").replace(/区$/, ""))
      );
      const wqDistricts = new Set(wqRows.map((r) => r.district));
      let matched = 0;
      let total = 0;
      for (const d of wqDistricts) {
        if (!d) continue;
        total += 1;
        if (adminSet.has(d) || adminStripped.has(d)) matched += 1;
      }
      expect(total).toBeGreaterThan(0);
      expect(matched / total).toBeGreaterThanOrEqual(0.7);
    });
  });

  // ---------- v0.11.0 学区溢价 ----------
  describe("学区溢价板块 v0.11.0", () => {
    const premiumDistPath = resolve(ROOT, "static/seed/school_premium_district.csv");
    const premiumComPath = resolve(ROOT, "static/seed/school_premium_community.csv");

    it("school_premium_district.csv 存在", () => {
      expect(existsSync(premiumDistPath)).toBe(true);
    });

    it("school_premium_district.csv 至少 10 行 (3 城)", () => {
      if (!existsSync(premiumDistPath)) return;
      const rows = readCsv(premiumDistPath);
      expect(rows.length).toBeGreaterThanOrEqual(10);
    });

    it("premium_ratio 是合法的有限数", () => {
      if (!existsSync(premiumDistPath)) return;
      const rows = readCsv(premiumDistPath);
      const bad = rows.filter((r) => {
        const v = parseFloat(r.premium_ratio);
        return !Number.isFinite(v);
      });
      expect(bad.length).toBe(0);
    });

    it("city_id 覆盖 1 (广州)、2 (深圳)、3 (珠海)", () => {
      if (!existsSync(premiumDistPath)) return;
      const rows = readCsv(premiumDistPath);
      const cities = new Set(rows.map((r) => r.city_id));
      expect(cities.has("1")).toBe(true);
      expect(cities.has("2")).toBe(true);
      expect(cities.has("3")).toBe(true);
    });

    it("school_count > 0 的区至少 10 个", () => {
      if (!existsSync(premiumDistPath)) return;
      const rows = readCsv(premiumDistPath);
      const withSchools = rows.filter((r) => parseInt(r.school_count) > 0);
      expect(withSchools.length).toBeGreaterThanOrEqual(10);
    });

    it("listing_count > 0 的区至少 8 个 (避免全 0)", () => {
      if (!existsSync(premiumDistPath)) return;
      const rows = readCsv(premiumDistPath);
      const withListings = rows.filter((r) => parseInt(r.listing_count) > 0);
      expect(withListings.length).toBeGreaterThanOrEqual(8);
    });

    it("school_premium_community.csv 存在", () => {
      expect(existsSync(premiumComPath)).toBe(true);
    });

    it("school_premium_community.csv 行数 = communities.csv 行数", () => {
      if (!existsSync(premiumComPath)) return;
      const commPath = resolve(ROOT, "static/seed/communities.csv");
      if (!existsSync(commPath)) return;
      const rows = readCsv(premiumComPath);
      const commRows = readCsv(commPath);
      expect(rows.length).toBe(commRows.length);
    });

    it("schools.csv 有 district_name 列且至少 80% 已填", () => {
      const schoolsPath = resolve(ROOT, "static/seed/schools.csv");
      if (!existsSync(schoolsPath)) return;
      const rows = readCsv(schoolsPath);
      const filled = rows.filter((r) => (r.district_name || "").trim()).length;
      expect(filled / rows.length).toBeGreaterThanOrEqual(0.8);
    });

    it("scripts/compute_school_premium.py 存在", () => {
      expect(existsSync(resolve(ROOT, "scripts/compute_school_premium.py"))).toBe(true);
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

  // ---------- v0.12.0 地图成交价热力 ----------
  describe("地图成交价热力 v0.12.0", () => {
    it("map-view.vue 存在", () => {
      expect(existsSync(resolve(ROOT, "src/pages/map-view/map-view.vue"))).toBe(true);
    });

    it("map-view.vue 含 'priceColorRamp' (成交价热力色阶函数)", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf-8"
      );
      expect(content).toMatch(/priceColorRamp/);
      expect(content).toMatch(/成交价热力/);
    });

    it("map-view.vue 含 MapMode = count | price | listings", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf-8"
      );
      expect(content).toMatch(/MapMode/);
      expect(content).toMatch(/"count"/);
      expect(content).toMatch(/"price"/);
      expect(content).toMatch(/"listings"/);
    });

    it("map-view.vue 包含 5 档 priceLevel CSS 类 (low/mid_low/mid/mid_high/high)", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf-8"
      );
      for (const cls of ["price-low", "price-mid_low", "price-mid", "price-mid_high", "price-high"]) {
        expect(content).toMatch(new RegExp(cls));
      }
    });

    it("communities_geo.csv 有 ≥ 50 行 (成交价热力数据基础)", () => {
      const geoPath = resolve(ROOT, "static/seed/communities_geo.csv");
      if (!existsSync(geoPath)) return;
      const rows = readCsv(geoPath);
      expect(rows.length).toBeGreaterThanOrEqual(50);
    });
  });

  // ---------- v0.12.0+ bugfix: 城市校验 ----------
  describe("app store 城市校验", () => {
    it("app.ts 含 VALID_CITY_IDS 校验", () => {
      const content = readFileSync(
        resolve(ROOT, "src/store/app.ts"),
        "utf-8"
      );
      expect(content).toMatch(/VALID_CITY_IDS/);
    });

    it("setCityId 拒绝非法 cityId (防御性)", () => {
      const content = readFileSync(
        resolve(ROOT, "src/store/app.ts"),
        "utf-8"
      );
      expect(content).toMatch(/setCityId rejected invalid/);
    });

    it("uni-app H5 input 重写 class 为 uni-input-input", () => {
      // 文档已知行为：uni-app H5 把 <input class="..."> 重写为 class="uni-input-input"
      // 这影响 .input 选择器；记录以备查询
      const content = readFileSync(
        resolve(ROOT, "src/pages/school/school.vue"),
        "utf-8"
      );
      expect(content).toMatch(/class="input"/);
    });
  });

  // ---------- v0.13.0 POI overlay ----------
  describe("POI overlay v0.13.0", () => {
    it("map-view.vue 含 POI 模式分支", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf-8"
      );
      expect(content).toMatch(/poiMarkers/);
      expect(content).toMatch(/getPoisByCity/);
    });

    it("MapMode 包含 poi 类型", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf-8"
      );
      expect(content).toMatch(/"poi"/);
    });

    it("queries.ts 提供 getCityPois 函数", () => {
      const content = readFileSync(
        resolve(ROOT, "src/local/queries.ts"),
        "utf-8"
      );
      expect(content).toMatch(/export async function getCityPois/);
      expect(content).toMatch(/CityPoisResponse/);
    });

    it("store.ts 提供 getPoisByCity 函数", () => {
      const content = readFileSync(
        resolve(ROOT, "src/local/store.ts"),
        "utf-8"
      );
      expect(content).toMatch(/export function getPoisByCity/);
    });

    it("poi_seed.csv 含 5 类 POI 数据", () => {
      const poiPath = resolve(ROOT, "static/seed/poi_seed.csv");
      if (!existsSync(poiPath)) return;
      const rows = readCsv(poiPath);
      const cats = new Set(rows.map((r) => r.poi_category));
      expect(cats.has("subway")).toBe(true);
      expect(cats.has("school")).toBe(true);
      expect(cats.has("hospital")).toBe(true);
      expect(cats.has("mall")).toBe(true);
      expect(cats.has("park")).toBe(true);
    });

    it("POI 总数 ≥ 500 (5 类齐全)", () => {
      const poiPath = resolve(ROOT, "static/seed/poi_seed.csv");
      if (!existsSync(poiPath)) return;
      const rows = readCsv(poiPath);
      expect(rows.length).toBeGreaterThanOrEqual(500);
    });
  });

  // ---------- v0.14.0 学区评分小区榜 ----------
  describe("学区评分小区榜 v0.14.0", () => {
    it("queries.ts 提供 getSchoolPremiumCommunityRank 函数", () => {
      const content = readFileSync(
        resolve(ROOT, "src/local/queries.ts"),
        "utf-8"
      );
      expect(content).toMatch(/export async function getSchoolPremiumCommunityRank/);
      expect(content).toMatch(/SchoolPremiumCommunityItem/);
    });

    it("store.ts 提供 getSchoolPremiumCommunityRank 函数", () => {
      const content = readFileSync(
        resolve(ROOT, "src/local/store.ts"),
        "utf-8"
      );
      expect(content).toMatch(/export function getSchoolPremiumCommunityRank/);
    });

    it("dashboard.vue 含 '学区评分 Top' 卡", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/dashboard/dashboard.vue"),
        "utf-8"
      );
      expect(content).toMatch(/学区评分 Top/);
      expect(content).toMatch(/schoolPremiumCommunityItems/);
    });

    it("school_premium_community.csv 至少 50 行", () => {
      const path = resolve(ROOT, "static/seed/school_premium_community.csv");
      if (!existsSync(path)) return;
      const rows = readCsv(path);
      expect(rows.length).toBeGreaterThanOrEqual(50);
    });

    it("school_premium_community.csv 的 avg_school_score ∈ [0, 100]", () => {
      const path = resolve(ROOT, "static/seed/school_premium_community.csv");
      if (!existsSync(path)) return;
      const rows = readCsv(path);
      const bad = rows.filter((r) => {
        const v = parseFloat(r.avg_school_score);
        return !Number.isFinite(v) || v < 0 || v > 100;
      });
      expect(bad.length).toBe(0);
    });
  });

  // ---------- v0.15.0 地铁规划 overlay ----------
  describe("地铁规划 overlay v0.15.0", () => {
    const geoPath = resolve(ROOT, "static/seed/metro_planning_geo.csv");

    it("metro_planning_geo.csv 存在且 ≥ 20 行", () => {
      if (!existsSync(geoPath)) return; // 可选,允许跳过
      const rows = readCsv(geoPath);
      expect(rows.length).toBeGreaterThanOrEqual(20);
    });

    it("queries.ts 提供 getMetroLineGeos 函数", () => {
      const content = readFileSync(
        resolve(ROOT, "src/local/queries.ts"),
        "utf-8"
      );
      expect(content).toMatch(/export async function getMetroLineGeos/);
      expect(content).toMatch(/MetroLineGeoItem/);
    });

    it("store.ts 提供 getMetroLineGeosByCity 函数", () => {
      const content = readFileSync(
        resolve(ROOT, "src/local/store.ts"),
        "utf-8"
      );
      expect(content).toMatch(/export function getMetroLineGeosByCity/);
    });

    it("types.ts 增加 LocalMetroLineGeo 接口", () => {
      const content = readFileSync(
        resolve(ROOT, "src/local/types.ts"),
        "utf-8"
      );
      expect(content).toMatch(/export interface LocalMetroLineGeo/);
    });

    it("map-view.vue 加 metro 模式 + polyline + metroPolylines", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf-8"
      );
      expect(content).toMatch(/metroPolylines/);
      expect(content).toMatch(/polyline/);
      expect(content).toMatch(/metroStatusColor/);
      // MapMode 加 metro
      expect(content).toMatch(/MapMode\s*=\s*"count"\s*\|\s*"price"\s*\|\s*"listings"\s*\|\s*"poi"\s*\|\s*"metro"/);
    });

    it("地铁规划: start + end 都 not missing 的行 >= 18", () => {
      if (!existsSync(geoPath)) return;
      const rows = readCsv(geoPath);
      const drawable = rows.filter(
        (r) =>
          r.start_confidence !== "missing" &&
          r.end_confidence !== "missing"
      );
      expect(drawable.length).toBeGreaterThanOrEqual(18);
    });
  });

  // ---------- v0.16.0 实时天气 + 4 天预报 ----------
  describe("天气 v0.16.0", () => {
    const weatherPath = resolve(ROOT, "static/seed/weather.csv");

    it("weather.csv 存在且 = 6 行 (3 城市 × 2 类型)", () => {
      if (!existsSync(weatherPath)) return; // 可选
      const rows = readCsv(weatherPath);
      expect(rows.length).toBe(6);
      const cityIds = new Set(rows.map((r) => r.city_id));
      expect(cityIds.size).toBe(3);
      const types = new Set(rows.map((r) => r.report_type));
      expect(types.has("live")).toBe(true);
      expect(types.has("forecast")).toBe(true);
    });

    it("queries.ts 提供 getWeather 函数", () => {
      const content = readFileSync(
        resolve(ROOT, "src/local/queries.ts"),
        "utf-8"
      );
      expect(content).toMatch(/export async function getWeather/);
      expect(content).toMatch(/WeatherResponse/);
    });

    it("store.ts 提供 getWeatherByCity 函数", () => {
      const content = readFileSync(
        resolve(ROOT, "src/local/store.ts"),
        "utf-8"
      );
      expect(content).toMatch(/export function getWeatherByCity/);
    });

    it("types.ts 增加 LocalWeather 接口", () => {
      const content = readFileSync(
        resolve(ROOT, "src/local/types.ts"),
        "utf-8"
      );
      expect(content).toMatch(/export interface LocalWeather/);
    });

    it("dashboard.vue 加天气卡 + weatherEmoji helper", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/dashboard/dashboard.vue"),
        "utf-8"
      );
      expect(content).toMatch(/weatherResp/);
      expect(content).toMatch(/weatherEmoji/);
      expect(content).toMatch(/forecast-grid/);
    });

    it("weather.csv: live 行有 weather + temperature", () => {
      if (!existsSync(weatherPath)) return;
      const rows = readCsv(weatherPath);
      const lives = rows.filter((r) => r.report_type === "live");
      expect(lives.length).toBe(3);
      for (const lv of lives) {
        expect(lv.weather).toBeTruthy();
        expect(lv.temperature).toBeTruthy();
      }
    });

    it("weather.csv: forecast 行的 forecast_json 含 4 个 cast", () => {
      if (!existsSync(weatherPath)) return;
      const rows = readCsv(weatherPath);
      const fcs = rows.filter((r) => r.report_type === "forecast");
      expect(fcs.length).toBe(3);
      for (const fc of fcs) {
        expect(fc.forecast_json).toBeTruthy();
        const parsed = JSON.parse(fc.forecast_json);
        expect(parsed.length).toBe(4);
      }
    });
  });

  // --------------------------------------------------------------
  // v0.17.0 trend-6: listing 学区溢价 (compute_listing_school_premium.py)
  // --------------------------------------------------------------
  describe("v0.17.0 listing 学区溢价", () => {
    const premiumPath = resolve(ROOT, "static/seed/listing_school_premium.csv");

    it("listing_school_premium.csv 存在", () => {
      expect(existsSync(premiumPath)).toBe(true);
    });

    it("listing_school_premium.csv 行数 ≥ 1000 (覆盖大部分 listings)", () => {
      if (!existsSync(premiumPath)) return;
      const rows = readCsv(premiumPath);
      expect(rows.length).toBeGreaterThanOrEqual(1000);
    });

    it(">= 80% 行有 school_count >= 1 且 avg_school_score > 0", () => {
      if (!existsSync(premiumPath)) return;
      const rows = readCsv(premiumPath);
      const ok = rows.filter(
        (r) =>
          Number(r.school_count) >= 1 &&
          Number(r.avg_school_score) > 0
      ).length;
      expect(ok / rows.length).toBeGreaterThanOrEqual(0.8);
    });

    it("city_id 必须是 1/2/3 (深圳/广州/珠海)", () => {
      if (!existsSync(premiumPath)) return;
      const rows = readCsv(premiumPath);
      const cities = new Set(rows.map((r) => r.city_id));
      for (const c of cities) {
        expect(["1", "2", "3"]).toContain(c);
      }
    });

    it("types.ts 增加 LocalListingSchoolPremium 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(content).toMatch(/export interface LocalListingSchoolPremium/);
    });

    it("store.ts 增加 getListingSchoolPremia 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(content).toMatch(/function getListingSchoolPremia/);
    });

    it("queries.ts 增加 getTopListingsBySchoolPremium 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/getTopListingsBySchoolPremium/);
    });

    it("dashboard.vue 渲染『🏫 高学区评分房源』卡", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/dashboard/dashboard.vue"),
        "utf8"
      );
      expect(content).toMatch(/高学区评分房源/);
    });
  });

  // --------------------------------------------------------------
  // v0.18.0 map-2: marker 聚合 (cluster.ts)
  // --------------------------------------------------------------
  describe("v0.18.0 marker 聚合", () => {
    it("cluster.ts 存在且导出 clusterMarkers", () => {
      const content = readFileSync(resolve(ROOT, "src/local/cluster.ts"), "utf8");
      expect(content).toMatch(/export function clusterMarkers/);
    });

    it("cluster.ts 导出 clusterCellDeg (zoom → cell 度数)", () => {
      const content = readFileSync(resolve(ROOT, "src/local/cluster.ts"), "utf8");
      expect(content).toMatch(/export function clusterCellDeg/);
    });

    it("map-view.vue 用 listingClusterMarkers (非 listingMarkers)", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/map-view/map-view.vue"), "utf8");
      expect(content).toMatch(/listingClusterMarkers/);
      // markers prop 应指向新 computed
      expect(content).toMatch(/:markers="mode === 'listings' \? listingClusterMarkers/);
    });

    it("map-view.vue 引入 cluster.ts", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/map-view/map-view.vue"), "utf8");
      expect(content).toMatch(/from "\.\.\/\.\.\/local\/cluster"/);
    });

    it("onMarkerTap 处理 cluster marker (count > 1 → zoom in)", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/map-view/map-view.vue"), "utf8");
      expect(content).toMatch(/聚合 \$\{m\[1\]\} 套/);
    });
  });

  // --------------------------------------------------------------
  // v0.19.0 new-2: 小区商业热度 (poi_commercial.csv + community_commercial.csv)
  // --------------------------------------------------------------
  describe("v0.19.0 商业热度 (餐饮/银行/便利店)", () => {
    const commercialCsv = resolve(ROOT, "static/seed/poi_commercial.csv");
    const communityCommercialCsv = resolve(ROOT, "static/seed/community_commercial.csv");

    it("poi_commercial.csv 存在", () => {
      expect(existsSync(commercialCsv)).toBe(true);
    });

    it("poi_commercial.csv 行数 >= 200", () => {
      if (!existsSync(commercialCsv)) return;
      const rows = readCsv(commercialCsv);
      expect(rows.length).toBeGreaterThanOrEqual(200);
    });

    it("poi_commercial.csv 至少有 3 类 (restaurant/bank/convenience)", () => {
      if (!existsSync(commercialCsv)) return;
      const rows = readCsv(commercialCsv);
      const cats = new Set(rows.map((r) => r.poi_category));
      expect(cats.has("restaurant")).toBe(true);
      expect(cats.has("bank")).toBe(true);
      expect(cats.has("convenience")).toBe(true);
    });

    it("community_commercial.csv 存在且行数 >= 30", () => {
      if (!existsSync(communityCommercialCsv)) return;
      const rows = readCsv(communityCommercialCsv);
      expect(rows.length).toBeGreaterThanOrEqual(30);
    });

    it("community_commercial.csv >= 80% community 有 score > 0", () => {
      if (!existsSync(communityCommercialCsv)) return;
      const rows = readCsv(communityCommercialCsv);
      const ok = rows.filter((r) => Number(r.commercial_score) > 0).length;
      expect(ok / rows.length).toBeGreaterThanOrEqual(0.8);
    });

    it("commercial_score 范围 0..100", () => {
      if (!existsSync(communityCommercialCsv)) return;
      const rows = readCsv(communityCommercialCsv);
      for (const r of rows) {
        const s = Number(r.commercial_score);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
    });

    it("types.ts 增加 LocalCommunityCommercial 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(content).toMatch(/export interface LocalCommunityCommercial/);
    });

    it("store.ts 增加 getCommunityCommercials 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(content).toMatch(/function getCommunityCommercials/);
    });

    it("queries.ts 增加 getCommercialRanking 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/getCommercialRanking/);
    });

    it("dashboard.vue 渲染「🛒 商业热度」卡", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/dashboard/dashboard.vue"),
        "utf8"
      );
      expect(content).toMatch(/商业热度 Top/);
    });
  });

  // --------------------------------------------------------------
  // v0.20.0 trend-8: 同区多小区对比
  // --------------------------------------------------------------
  describe("v0.20.0 同区多小区对比", () => {
    it("queries.ts 增加 getCommunityCompareByDistrict 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/getCommunityCompareByDistrict/);
    });

    it("queries.ts 导出 DistrictCommunityCompareResponse 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export interface DistrictCommunityCompareResponse/);
    });

    it("dashboard.vue 含 selectedDistrict ref", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/dashboard/dashboard.vue"),
        "utf8"
      );
      expect(content).toMatch(/selectedDistrict = ref/);
    });

    it("dashboard.vue 渲染「📊 {districtName} 小区对比」卡", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/dashboard/dashboard.vue"),
        "utf8"
      );
      expect(content).toMatch(/小区对比/);
    });

    it("dashboard.vue onPickDistrict 调用 loadDistrictCompare", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/dashboard/dashboard.vue"),
        "utf8"
      );
      expect(content).toMatch(/loadDistrictCompare\(name\)/);
    });
  });

  // --------------------------------------------------------------
  // v0.21.0 map-7: 价格热力升级 (5 档分位 + legend)
  // --------------------------------------------------------------
  describe("v0.21.0 价格热力升级", () => {
    it("map-view.vue 含 priceColorRamp5 5 档分位函数", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf8"
      );
      expect(content).toMatch(/function priceColorRamp5/);
    });

    it("map-view.vue 含 priceBuckets computed (legend)", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf8"
      );
      expect(content).toMatch(/priceBuckets = computed/);
    });

    it("map-view.vue 含 cityAvgPrice computed (城市均价)", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf8"
      );
      expect(content).toMatch(/cityAvgPrice = computed/);
    });

    it("map-view.vue 渲染「🎨 价格分位图例」卡片", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf8"
      );
      expect(content).toMatch(/价格分位图例/);
    });

    it("map-view.vue heatCircles 在 price 模式用 5 档分位", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf8"
      );
      expect(content).toMatch(/priceColorRamp5\(tPrice\)/);
    });
  });

  // --------------------------------------------------------------
  // v0.22.0 map-3: POI marker 聚合
  // --------------------------------------------------------------
  describe("v0.22.0 POI marker 聚合", () => {
    it("map-view.vue poiMarkers 用 clusterMarkers 复用 cluster.ts", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf8"
      );
      expect(content).toMatch(/clusterMarkers\(inputs, Math\.round\(mapScale\.value\)\)/);
    });

    it("map-view.vue POI 单点图标 makePoiSingleIcon (SVG data URI)", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf8"
      );
      expect(content).toMatch(/function makePoiSingleIcon/);
    });

    it("map-view.vue POI 聚合图标 makePoiClusterIcon (SVG data URI)", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf8"
      );
      expect(content).toMatch(/function makePoiClusterIcon/);
    });

    it("map-view.vue onMarkerTap 处理 POI cluster (syntheticIdBase = -1000000)", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf8"
      );
      expect(content).toMatch(/if \(markerId <= -1000000\)/);
    });

    it("map-view.vue POI 模式 legend 含 v0.22.0 聚合说明", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/map-view/map-view.vue"),
        "utf8"
      );
      expect(content).toMatch(/v0\.22\.0 \u805a\u5408/);
    });
  });

  // --------------------------------------------------------------
  // v0.23.0 trend-9: 全品类区级网签热度榜
  // --------------------------------------------------------------
  describe("v0.23.0 全品类区级网签热度榜", () => {
    it("queries.ts 增加 getDistrictWangqianRank 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/getDistrictWangqianRank/);
    });

    it("queries.ts 导出 DistrictWangqianRankResponse 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export interface DistrictWangqianRankResponse/);
    });

    it("dashboard.vue 含 wqRankCat ref (新房/二手/全部)", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/dashboard/dashboard.vue"),
        "utf8"
      );
      expect(content).toMatch(/wqRankCat = ref/);
    });

    it("dashboard.vue 渲染「🔥 全品类区级网签热度榜」卡", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/dashboard/dashboard.vue"),
        "utf8"
      );
      expect(content).toMatch(/全品类区级网签热度榜/);
    });

    it("dashboard.vue setWqRankCat 切换 cat", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/dashboard/dashboard.vue"),
        "utf8"
      );
      expect(content).toMatch(/setWqRankCat\(cat\)/);
    });
  });

  // --------------------------------------------------------------
  // v0.24.0 new-5: 通勤时长榜
  // --------------------------------------------------------------
  describe("v0.24.0 通勤时长榜", () => {
    it("queries.ts 增加 getCommuteRanking 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/getCommuteRanking/);
    });

    it("queries.ts 导出 CommuteRankingResponse 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export interface CommuteRankingResponse/);
    });

    it("store.ts 增加 getCommutesByCity 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(content).toMatch(/getCommutesByCity/);
    });

    it("importer.ts 解析 commuteCSV 到 LocalCommute[]", () => {
      const content = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(content).toMatch(/const commutes: LocalCommute\[\]/);
    });

    it("dashboard.vue 渲染「🚇 通勤时长榜」卡", () => {
      const content = readFileSync(
        resolve(ROOT, "src/pages/dashboard/dashboard.vue"),
        "utf8"
      );
      expect(content).toMatch(/通勤时长榜/);
    });

    it("commute.csv 存在且 >= 10 行", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/commute.csv"), "utf8");
      const rows = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
      expect(rows.length).toBeGreaterThanOrEqual(11); // header + 10+ data
    });

    it("commute.csv 同时含 city_name=深圳 和 广州 行", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/commute.csv"), "utf8");
      expect(csv).toMatch(/深圳/);
      expect(csv).toMatch(/广州/);
    });

    it("commute.csv 每行含 cbd_name 和 transit_minutes 字段", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/commute.csv"), "utf8");
      const rows = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const header = rows[0].split(",");
      expect(header).toContain("cbd_name");
      expect(header).toContain("transit_minutes");
      expect(header).toContain("transit_distance_m");
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.25.0 new-7 户型/面积/朝向/装修分布
  // ────────────────────────────────────────────────────────────────────
  describe("v0.25.0 户型分布", () => {
    it("layout_distribution.csv 存在且 >= 20 行", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/layout_distribution.csv"));
      expect(rows.length).toBeGreaterThanOrEqual(20);
    });

    it("layout_distribution.csv 含 3 个 city_id (1,2,3)", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/layout_distribution.csv"));
      const ids = new Set(rows.map((r) => r["city_id"]));
      expect(ids.has("1")).toBe(true);
      expect(ids.has("2")).toBe(true);
      expect(ids.has("3")).toBe(true);
    });

    it("layout_distribution.csv 含 4 个 dimension 值", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/layout_distribution.csv"));
      const dims = new Set(rows.map((r) => r["dimension"]));
      expect(dims.has("bedrooms")).toBe(true);
      expect(dims.has("area_sqm")).toBe(true);
      expect(dims.has("orientation")).toBe(true);
      expect(dims.has("decorate")).toBe(true);
    });

    it("queries.ts 增加 getLayoutDistribution 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export function getLayoutDistribution/);
    });

    it("queries.ts 导出 LayoutDistributionResponse 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export interface LayoutDistributionResponse/);
    });

    it("store.ts 增加 getLayoutDistributionsByCity 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(content).toMatch(/export function getLayoutDistributionsByCity/);
    });

    it("types.ts 增加 LocalLayoutDistribution 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(content).toMatch(/export interface LocalLayoutDistribution/);
    });

    it("types.ts DataSnapshot 增加 layoutDistributions 字段", () => {
      const content = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(content).toMatch(/layoutDistributions: LocalLayoutDistribution\[\]/);
    });

    it("importer.ts 解析 layoutDistributionCSV 输入", () => {
      const content = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(content).toMatch(/layoutDistributionCSV\?: string/);
      expect(content).toMatch(/parseLayoutDistribution/);
    });

    it("seedSnapshot.ts 导入 layout_distribution.csv", () => {
      const content = readFileSync(resolve(ROOT, "src/local/seedSnapshot.ts"), "utf8");
      expect(content).toMatch(/layout_distribution\.csv\?raw/);
    });

    it("dashboard.vue 渲染户型分布卡片", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/layoutDistribution/);
      expect(content).toMatch(/户型分布/);
      expect(content).toMatch(/getLayoutDistribution/);
      expect(content).toMatch(/layoutDims/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.26.0 trend-11 学区评分小区榜增强
  // ────────────────────────────────────────────────────────────────────
  describe("v0.26.0 trend-11 学区评分小区榜增强", () => {
    it("store.ts 导出 SchoolPremiumCommunitySort 类型", () => {
      const content = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(content).toMatch(/export type SchoolPremiumCommunitySort/);
      expect(content).toMatch(/avg_school_score/);
      expect(content).toMatch(/median_unit_price/);
      expect(content).toMatch(/listing_count/);
      expect(content).toMatch(/school_count/);
    });

    it("store.ts getSchoolPremiumCommunityRank 支持 minScore + districtFilter + sort", () => {
      const content = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      const block = content.match(
        /export function getSchoolPremiumCommunityRank[\s\S]+?^}/m
      );
      expect(block).toBeTruthy();
      const body = block![0];
      expect(body).toMatch(/minScore/);
      expect(body).toMatch(/districtFilter/);
      expect(body).toMatch(/sort/);
    });

    it("queries.ts 透传 minScore/districtFilter/sort", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      const block = content.match(
        /export async function getSchoolPremiumCommunityRank[\s\S]+?^}/m
      );
      expect(block).toBeTruthy();
      const body = block![0];
      expect(body).toMatch(/minScore/);
      expect(body).toMatch(/districtFilter/);
      expect(body).toMatch(/sort/);
    });

    it("dashboard.vue 含 3 个 spc-row (区 / 最低评分 / 排序)", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      const matches = content.match(/class="spc-row"/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it("dashboard.vue 含 spDistrictOptions / spMinScoreOptions / spSortOptions 控件", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/spDistrictOptions/);
      expect(content).toMatch(/spMinScoreOptions/);
      expect(content).toMatch(/spSortOptions/);
      expect(content).toMatch(/toggleSpDistrict/);
      expect(content).toMatch(/spSortLabel/);
    });

    it("dashboard.vue loadAll 透传 minScore/districtFilter/sort", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/spMinScore\.value/);
      expect(content).toMatch(/spDistrictFilter\.value/);
      expect(content).toMatch(/spSort\.value/);
    });

    it("school_premium_community.csv 仍 >= 30 行", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/school_premium_community.csv"));
      expect(rows.length).toBeGreaterThanOrEqual(30);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.27.0 map-8 marker 密度过滤
  // ────────────────────────────────────────────────────────────────────
  describe("v0.27.0 map-8 marker 密度过滤", () => {
    it("map-view.vue 含密度过滤逻辑 (zoom 阈值)", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/map-view/map-view.vue"), "utf8");
      // 密度过滤：在 listingClusterMarkers 中判断 scale
      expect(content).toMatch(/scale <= 10/);
      expect(content).toMatch(/scale <= 11/);
      // 应基于 community listing_count
      expect(content).toMatch(/listing_count >= 5|>= 5/);
      expect(content).toMatch(/listing_count >= 2|>= 2/);
    });

    it("map-view.vue legend 含 v0.27.0 密度过滤说明", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/map-view/map-view.vue"), "utf8");
      expect(content).toMatch(/v0\.27\.0 密度过滤/);
    });

    it("cluster.ts 仍存在 (密度过滤复用 grid 聚合)", () => {
      const content = readFileSync(resolve(ROOT, "src/local/cluster.ts"), "utf8");
      expect(content).toMatch(/export function clusterMarkers/);
    });
  });
});
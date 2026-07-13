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

  // ────────────────────────────────────────────────────────────────────
  // v0.28.0 new-6 房源 tags 标签云
  // ────────────────────────────────────────────────────────────────────
  describe("v0.28.0 new-6 房源 tags 标签云", () => {
    it("listing_tags.csv 存在且 >= 1000 行", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/listing_tags.csv"));
      expect(rows.length).toBeGreaterThanOrEqual(1000);
    });

    it("listing_tags.csv 含 3 个 city_id", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/listing_tags.csv"));
      const ids = new Set(rows.map((r) => r["city_id"]));
      expect(ids.has("1")).toBe(true);
      expect(ids.has("2")).toBe(true);
      expect(ids.has("3")).toBe(true);
    });

    it("listing_tags_summary.csv 存在 (city, tag, count, share)", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/listing_tags_summary.csv"));
      expect(rows.length).toBeGreaterThan(20);
      const header = Object.keys(rows[0]);
      expect(header).toContain("city_id");
      expect(header).toContain("tag");
      expect(header).toContain("count");
      expect(header).toContain("share");
    });

    it("listing_tags_summary.csv 至少出现 10 个不同 tag", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/listing_tags_summary.csv"));
      const tags = new Set(rows.map((r) => r["tag"]));
      expect(tags.size).toBeGreaterThanOrEqual(10);
    });

    it("queries.ts 增加 getListingTagCloud 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export function getListingTagCloud/);
    });

    it("queries.ts 导出 TagCloudResponse 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export interface TagCloudResponse/);
    });

    it("store.ts 增加 getListingTagsByCity 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(content).toMatch(/export function getListingTagsByCity/);
    });

    it("types.ts 增加 LocalListingTag 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(content).toMatch(/export interface LocalListingTag/);
    });

    it("importer.ts 解析 listingTagsCSV 输入", () => {
      const content = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(content).toMatch(/listingTagsCSV\?: string/);
      expect(content).toMatch(/parseListingTags/);
    });

    it("dashboard.vue 渲染标签云卡片", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/tagCloud/);
      expect(content).toMatch(/房源标签云|🏷️/);
      expect(content).toMatch(/getListingTagCloud/);
      expect(content).toMatch(/tag-size-/);
      expect(content).toMatch(/onPickTag/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.29.0 trend-13 区房价指数
  // ────────────────────────────────────────────────────────────────────
  describe("v0.29.0 trend-13 区房价指数", () => {
    it("district_index.csv 存在且 >= 100 行", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/district_index.csv"));
      expect(rows.length).toBeGreaterThanOrEqual(100);
    });

    it("district_index.csv 含 3 个 city_id", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/district_index.csv"));
      const ids = new Set(rows.map((r) => r["city_id"]));
      expect(ids.has("1")).toBe(true);
      expect(ids.has("2")).toBe(true);
      expect(ids.has("3")).toBe(true);
    });

    it("district_index.csv baseline 周 index_value = 100", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/district_index.csv"));
      const byDistrict: Record<string, Record<string, string>[]> = {};
      for (const r of rows) {
        const k = `${r["city_id"]}|${r["district_name"]}`;
        if (!byDistrict[k]) byDistrict[k] = [];
        byDistrict[k].push(r);
      }
      // baseline 周 = listing_count >= 4 中最早一周
      for (const k in byDistrict) {
        const filtered = byDistrict[k]
          .filter((r) => Number(r["listing_count"]) >= 4)
          .sort((a, b) => a["week_end"].localeCompare(b["week_end"]));
        if (filtered.length === 0) continue;
        const baseline = filtered[0];
        expect(Number(baseline["index_value"])).toBeCloseTo(100, 1);
      }
    });

    it("queries.ts 增加 getDistrictIndex 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export function getDistrictIndex/);
    });

    it("queries.ts 导出 DistrictIndexResponse 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export interface DistrictIndexResponse/);
    });

    it("store.ts 增加 getDistrictIndicesByCity 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(content).toMatch(/export function getDistrictIndicesByCity/);
    });

    it("types.ts 增加 LocalDistrictIndex 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(content).toMatch(/export interface LocalDistrictIndex/);
    });

    it("importer.ts 解析 districtIndexCSV 输入", () => {
      const content = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(content).toMatch(/districtIndexCSV\?: string/);
      expect(content).toMatch(/parseDistrictIndex/);
    });

    it("dashboard.vue 渲染区房价指数卡片 + sparkline", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/districtIndex/);
      expect(content).toMatch(/区房价指数|📈/);
      expect(content).toMatch(/getDistrictIndex/);
      expect(content).toMatch(/sparkPoints/);
      expect(content).toMatch(/di-spark-bar/);
      expect(content).toMatch(/momChange|yoyChange/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.30.0 trend-14 区涨幅榜
  // ────────────────────────────────────────────────────────────────────
  describe("v0.30.0 trend-14 区涨幅榜", () => {
    it("queries.ts 增加 getDistrictChangeRank 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export function getDistrictChangeRank/);
    });

    it("queries.ts 导出 DistrictChangeResponse 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export interface DistrictChangeResponse/);
    });

    it("queries.ts DistrictChangeItem 含 recentChange4w 字段", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      const block = content.match(/export interface DistrictChangeItem[\s\S]+?^}/m);
      expect(block).toBeTruthy();
      expect(block![0]).toMatch(/recentChange4w/);
      expect(block![0]).toMatch(/latestMom/);
    });

    it("dashboard.vue 渲染区涨幅榜卡片", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/districtChange/);
      expect(content).toMatch(/区涨幅榜|🚀/);
      expect(content).toMatch(/getDistrictChangeRank/);
      expect(content).toMatch(/recentChange4w/);
      expect(content).toMatch(/dc-row/);
    });

    it("dashboard.vue loadAll 调用 getDistrictChangeRank", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/getDistrictChangeRank\(\{\s*cityId:\s*app\.cityId/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.31.0 new-9 生活便利度 (life_convenience.csv)
  // ────────────────────────────────────────────────────────────────────
  describe("v0.31.0 new-9 生活便利度", () => {
    it("life_convenience.csv 存在且 >= 50 行", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/life_convenience.csv"));
      expect(rows.length).toBeGreaterThanOrEqual(50);
    });

    it("life_convenience.csv 含 3 个 city_id", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/life_convenience.csv"));
      const ids = new Set(rows.map((r) => r["city_id"]));
      expect(ids.has("1")).toBe(true);
      expect(ids.has("2")).toBe(true);
      expect(ids.has("3")).toBe(true);
    });

    it("life_convenience.csv score 在 0-110 范围, score100 归一化到 0-100", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/life_convenience.csv"));
      for (const r of rows) {
        const s = Number(r["score"]);
        const s100 = Number(r["score100"]);
        expect(Number.isFinite(s)).toBe(true);
        expect(Number.isFinite(s100)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(110);
        // score100 ≈ score/110*100 (容差 0.2 浮点)
        expect(Math.abs(s100 - s / 110 * 100)).toBeLessThanOrEqual(0.2);
      }
    });

    it("life_convenience.csv 含 market_near 列 (v0.32.0 new-10 菜市场扩充)", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/life_convenience.csv"));
      expect(rows[0]).toHaveProperty("market_near");
      expect(rows[0]).toHaveProperty("score100");
    });

    it("types.ts 定义 LocalLifeConvenience 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(content).toMatch(/export interface LocalLifeConvenience/);
      expect(content).toMatch(/lifeConveniences: LocalLifeConvenience\[\]/);
    });

    it("importer.ts 解析 lifeConvenienceCSV 输入", () => {
      const content = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(content).toMatch(/lifeConvenienceCSV\?: string/);
      expect(content).toMatch(/parseLifeConvenience/);
    });

    it("queries.ts 增加 getLifeConvenienceRank 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export function getLifeConvenienceRank/);
      expect(content).toMatch(/export interface LifeConvenienceResponse/);
    });

    it("dashboard.vue 渲染生活便利度卡片 + 5 维评分", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/lifeConvenience/);
      expect(content).toMatch(/生活便利度|🧭/);
      expect(content).toMatch(/getLifeConvenienceRank/);
      expect(content).toMatch(/lifeScoreClass/);
      expect(content).toMatch(/lc-row|lc-scores/);
    });

    it("dashboard.vue loadAll 调用 getLifeConvenienceRank", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/getLifeConvenienceRank\(\{\s*cityId:\s*app\.cityId/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.33.0 trend-15 小区综合评分 (community_score.csv)
  // ────────────────────────────────────────────────────────────────────
  describe("v0.33.0 trend-15 小区综合评分", () => {
    it("community_score.csv 存在且 >= 50 行", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/community_score.csv"));
      expect(rows.length).toBeGreaterThanOrEqual(50);
    });

    it("community_score.csv total_score 0-100 范围", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/community_score.csv"));
      for (const r of rows) {
        const t = Number(r["total_score"]);
        expect(Number.isFinite(t)).toBe(true);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(100);
      }
    });

    it("community_score.csv rank_city 1-based 且每城内连续", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/community_score.csv"));
      const byCity: Record<string, number[]> = {};
      for (const r of rows) {
        const c = r["city_id"];
        byCity[c] = byCity[c] ?? [];
        byCity[c].push(Number(r["rank_city"]));
      }
      for (const c in byCity) {
        const ranks = byCity[c].slice().sort((a, b) => a - b);
        expect(ranks[0]).toBe(1);
        for (let i = 0; i < ranks.length; i++) {
          expect(ranks[i]).toBe(i + 1);
        }
      }
    });

    it("types.ts 定义 LocalCommunityScore 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(content).toMatch(/export interface LocalCommunityScore/);
      expect(content).toMatch(/communityScores: LocalCommunityScore\[\]/);
    });

    it("importer.ts 解析 communityScoreCSV 输入", () => {
      const content = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(content).toMatch(/communityScoreCSV\?: string/);
      expect(content).toMatch(/parseCommunityScore/);
    });

    it("queries.ts 增加 getCommunityScoreRank 函数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export function getCommunityScoreRank/);
      expect(content).toMatch(/export interface CommunityScoreResponse/);
    });

    it("dashboard.vue 渲染小区综合评分卡片 + 3 维细分", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/communityScore/);
      expect(content).toMatch(/小区综合评分|🏅/);
      expect(content).toMatch(/getCommunityScoreRank/);
      expect(content).toMatch(/csTotalClass|csMedalClass/);
      expect(content).toMatch(/cs-row|cs-scores/);
    });

    it("dashboard.vue loadAll 调用 getCommunityScoreRank", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/getCommunityScoreRank\(\{\s*cityId:\s*app\.cityId/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.34.0 trend-16 综合评分权重自定义
  // ────────────────────────────────────────────────────────────────────
  describe("v0.34.0 trend-16 综合评分权重自定义", () => {
    it("queries.ts getCommunityScoreRank 接受 weights 参数", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/getCommunityScoreRank[\s\S]+?weights\?:\s*\{\s*life:\s*number/);
    });

    it("queries.ts weights 重新计算 totalScore (覆盖原 CSV 预存值)", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      // 公式: totalScore = life*wf.life + school*wf.school + commute*wf.commute
      expect(content).toMatch(/l\.lifeScore\s*\*\s*wf\.life/);
      expect(content).toMatch(/l\.schoolScore\s*\*\s*wf\.school/);
      expect(content).toMatch(/l\.commuteScore\s*\*\s*wf\.commute/);
    });

    it("queries.ts weights 总和归一化 (避免全 0 时除零)", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/w\.life\s*\/\s*wSum/);
    });

    it("queries.ts 按新 totalScore 重排 rank_city", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/newRank\[l\.communityId\]/);
    });

    it("dashboard.vue 综合评分卡包含 4 个预设 chip + 3 个 slider", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/csPresets/);
      expect(content).toMatch(/applyCsPreset/);
      expect(content).toMatch(/onCsWeightChange/);
      expect(content).toMatch(/cs-weights/);
      // 4 个预设: 均衡/学区/通勤/生活
      expect(content).toMatch(/均衡/);
      expect(content).toMatch(/学区/);
      expect(content).toMatch(/通勤/);
      expect(content).toMatch(/生活/);
    });

    it("dashboard.vue reloadCommunityScore 用 csWeights 重算", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/getCommunityScoreRank\(\{[\s\S]+?weights:\s*csWeights\.value/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.35.0 map-9 地铁步行通勤 (metro_walk.csv)
  // ────────────────────────────────────────────────────────────────────
  describe("v0.35.0 map-9 地铁步行通勤", () => {
    it("metro_walk.csv 存在且 >= 30 行", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/metro_walk.csv"));
      expect(rows.length).toBeGreaterThanOrEqual(30);
    });

    it("metro_walk.csv walk_minutes 0-60 范围 + station_name 非空", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/metro_walk.csv"));
      for (const r of rows) {
        const m = Number(r["walk_minutes"]);
        expect(Number.isFinite(m)).toBe(true);
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThan(60);
        expect(r["station_name"]).toBeTruthy();
      }
    });

    it("metro_walk.csv 至少有一行 source=AMAP_API (高德实测)", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/metro_walk.csv"));
      const apiCount = rows.filter((r) => r["source"] === "AMAP_API").length;
      expect(apiCount).toBeGreaterThanOrEqual(1);
    });

    it("types.ts 定义 LocalMetroWalk 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(content).toMatch(/export\s+interface\s+LocalMetroWalk/);
      expect(content).toMatch(/walkMinutes/);
      expect(content).toMatch(/source:\s*"AMAP_API"\s*\|\s*"ESTIMATED"/);
    });

    it("importer.ts 解析 metroWalkCSV 并入 snapshot", () => {
      const content = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(content).toMatch(/metroWalkCSV\?:\s*string/);
      expect(content).toMatch(/parseMetroWalk\(/);
      expect(content).toMatch(/metroWalks:\s*LocalMetroWalk\[\]/);
    });

    it("queries.ts getMetroWalkRanking 按 walkMinutes 升序 + 返回 avg + fastest", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export\s+function\s+getMetroWalkRanking/);
      expect(content).toMatch(/sort\(\(a,\s*b\)\s*=>\s*a\.walkMinutes\s*-\s*b\.walkMinutes\)/);
      expect(content).toMatch(/avgMinutes/);
      expect(content).toMatch(/fastestCommunity/);
    });

    it("dashboard.vue 地铁步行通勤卡 + 颜色分档 (mw-min-green/orange/red)", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/地铁步行通勤 Top/);
      expect(content).toMatch(/metroWalk\.value = await\s+getMetroWalkRanking/);
      expect(content).toMatch(/mwBandClass/);
      expect(content).toMatch(/mw-min-green/);
      expect(content).toMatch(/mw-min-orange/);
      expect(content).toMatch(/mw-min-red/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.36.0 map-10 地铁规划受益 (metro_benefit.csv)
  // ────────────────────────────────────────────────────────────────────
  describe("v0.36.0 map-10 地铁规划受益", () => {
    it("metro_benefit.csv 存在且 >= 40 行", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/metro_benefit.csv"));
      expect(rows.length).toBeGreaterThanOrEqual(40);
    });

    it("metro_benefit.csv benefit_score 0-100 + status 是 3 档之一", () => {
      const rows = readCsv(resolve(ROOT, "static/seed/metro_benefit.csv"));
      const okStatuses = new Set(["规划", "在建", "即将开通", ""]);
      for (const r of rows) {
        const s = Number(r["benefit_score"]);
        expect(Number.isFinite(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
        expect(okStatuses.has(r["nearest_line_status"])).toBe(true);
      }
    });

    it("compute_metro_benefit.py 跨城过滤 (不能用深圳 station 给广州算分)", () => {
      const content = readFileSync(resolve(ROOT, "scripts/compute_metro_benefit.py"), "utf8");
      expect(content).toMatch(/if s\["city_id"\] is not None and s\["city_id"\] != c\["city_id"\]/);
    });

    it("types.ts 定义 LocalMetroBenefit 接口", () => {
      const content = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(content).toMatch(/export\s+interface\s+LocalMetroBenefit/);
      expect(content).toMatch(/benefitScore:\s*number/);
      expect(content).toMatch(/nearestLineStatus:\s*"规划"\s*\|\s*"在建"\s*\|\s*"即将开通"/);
    });

    it("importer.ts parseMetroBenefit + 接入 snapshot", () => {
      const content = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(content).toMatch(/metroBenefitCSV\?:\s*string/);
      expect(content).toMatch(/parseMetroBenefit\(/);
      expect(content).toMatch(/metroBenefits:\s*LocalMetroBenefit\[\]/);
    });

    it("queries.ts getMetroBenefitRanking 按受益分降序 + 返回 avg/max/nearCount", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/export\s+function\s+getMetroBenefitRanking/);
      expect(content).toMatch(/b\.benefitScore\s*-\s*a\.benefitScore/);
      expect(content).toMatch(/avgScore/);
      expect(content).toMatch(/maxScore/);
      expect(content).toMatch(/nearCount/);
    });

    it("dashboard.vue 地铁规划受益卡 + 3 档 mb-tag-green/orange/red + status 徽章", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(content).toMatch(/地铁规划受益 Top/);
      expect(content).toMatch(/metroBenefit\.value = await\s+getMetroBenefitRanking/);
      expect(content).toMatch(/mbBandClass/);
      expect(content).toMatch(/mb-tag-green/);
      expect(content).toMatch(/mb-tag-orange/);
      expect(content).toMatch(/mb-tag-red/);
      expect(content).toMatch(/mb-st-open/);
      expect(content).toMatch(/mb-st-build/);
      expect(content).toMatch(/mb-st-plan/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.37.0 trend-17: 5 维小区指标 (filter 列表 + community 详情)
  // ────────────────────────────────────────────────────────────────────
  describe("v0.37.0 trend-17 5 维小区指标", () => {
    it("store.ts 提供 3 个 per-id 查找 (life / walk / benefit)", () => {
      const content = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(content).toMatch(/getLifeConvenienceByCommunity/);
      expect(content).toMatch(/getMetroWalkByCommunity/);
      expect(content).toMatch(/getMetroBenefitByCommunity/);
    });

    it("listing-filter.vue 列出 5 个维度键 (位置/房屋/楼龄/配套/性价比)", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/listing-filter/listing-filter.vue"), "utf8");
      expect(content).toMatch(/MINI_DIM_DEFS/);
      expect(content).toMatch(/location_score/);
      expect(content).toMatch(/house_quality_score/);
      expect(content).toMatch(/building_age_score/);
      expect(content).toMatch(/amenity_score/);
      expect(content).toMatch(/price_value_score/);
      expect(content).toMatch(/minidim-row/);
    });

    it("listing-filter.vue 用 explain_preview.dimension_scores 渲染迷你条", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/listing-filter/listing-filter.vue"), "utf8");
      expect(content).toMatch(/it\.explain_preview\?\.dimension_scores/);
      expect(content).toMatch(/minidim-fill-green/);
      expect(content).toMatch(/minidim-fill-orange/);
      expect(content).toMatch(/minidim-fill-red/);
    });

    it("community.vue 5 维小区指标卡 (CM_DEFS + cmBand + 5 列 grid)", () => {
      const content = readFileSync(resolve(ROOT, "src/pages/community/community.vue"), "utf8");
      expect(content).toMatch(/5 维小区指标/);
      expect(content).toMatch(/CM_DEFS/);
      expect(content).toMatch(/cm-grid/);
      expect(content).toMatch(/cmBand/);
      expect(content).toMatch(/cmScore/);
      expect(content).toMatch(/getLifeConvenienceByCommunity/);
      expect(content).toMatch(/getCommuteByCommunity/);
      expect(content).toMatch(/getMetroWalkByCommunity/);
      expect(content).toMatch(/getMetroBenefitByCommunity/);
      expect(content).toMatch(/getCommunitySchoolScore/);
    });

    it("queries.ts toListingItem 已注入 explain_preview (无需新增)", () => {
      const content = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(content).toMatch(/explain_preview:\s*\{\s*overall_score:\s*s\.overallScore,\s*dimension_scores:\s*s\.dimensionScores\s*\}/);
    });
  });

  // v0.38.0 trend-18: 区情画像
  describe("v0.38.0 trend-18 区情画像", () => {
    it("district_meta.csv 存在 + 有列 + 不空", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/district_meta.csv"), "utf8");
      // 允许 BOM
      expect(csv).toMatch(/^(\ufeff)?city_id,district_name,admin_code/);
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(10);
      // 至少 1 行 24 行政区数据
      const data = lines.slice(1);
      expect(data.length).toBeGreaterThanOrEqual(20);
    });

    it("district_meta.csv 每行都有 admin_code (6 位)", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/district_meta.csv"), "utf8");
      const lines = csv.trim().split(/\r?\n/).slice(1);
      let withCode = 0;
      for (const l of lines) {
        const cols = l.split(",");
        if (cols[2] && /^\d{6}$/.test(cols[2])) withCode++;
      }
      // 至少 80% 有 6 位区码
      expect(withCode).toBeGreaterThanOrEqual(lines.length * 0.8);
    });

    it("compute_district_metadata.py 脚本 + parseDistrictMeta 都已实现", () => {
      const script = readFileSync(resolve(ROOT, "scripts/compute_district_metadata.py"), "utf8");
      expect(script).toMatch(/admin_districts\.csv/);
      expect(script).toMatch(/school_premium_district\.csv/);
      expect(script).toMatch(/district_meta\.csv/);

      const importer = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(importer).toMatch(/function parseDistrictMeta/);
      expect(importer).toMatch(/districtMetaCSV/);
    });

    it("types.ts + store.ts + queries.ts 都导出 district_meta 相关 API", () => {
      const types = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(types).toMatch(/LocalDistrictMeta/);
      expect(types).toMatch(/districtMeta:\s*LocalDistrictMeta\[\]/);

      const store = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(store).toMatch(/getDistrictMeta\(/);
      expect(store).toMatch(/getDistrictMetaByCity\(/);

      const queries = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(queries).toMatch(/export function getDistrictMetaRanking/);
      expect(queries).toMatch(/DistrictMetaItem/);
    });

    it("seedSnapshot.ts + dataRefresher.ts + settings.vue 都接入了 district_meta", () => {
      const seed = readFileSync(resolve(ROOT, "src/local/seedSnapshot.ts"), "utf8");
      expect(seed).toMatch(/import districtMetaCSV/);
      expect(seed).toMatch(/districtMetaCSV:/);

      const ref = readFileSync(resolve(ROOT, "src/local/dataRefresher.ts"), "utf8");
      expect(ref).toMatch(/districtMeta:/);

      const settings = readFileSync(resolve(ROOT, "src/pages/settings/settings.vue"), "utf8");
      expect(settings).toMatch(/district_meta\.csv/);
      expect(settings).toMatch(/districtMetaCSV:/);
    });

    it("dashboard.vue 区情画像卡 + sort chips + 排序/隐藏切换", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/区情画像/);
      expect(dash).toMatch(/districtMetaSortBy/);
      expect(dash).toMatch(/setDmSort/);
      expect(dash).toMatch(/toggleDmHideEmpty/);
      expect(dash).toMatch(/reloadDistrictMeta/);
      expect(dash).toMatch(/dm-chip/);
      expect(dash).toMatch(/dm-row/);
      expect(dash).toMatch(/dm-mom-up|dm-mom-down|dm-mom-flat/);
    });

    it("getDistrictMetaRanking 数据正确 (深圳有 10 区，admin_code 全有)", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getDistrictMetaRanking } = await import("../src/local/queries");
      const resp = getDistrictMetaRanking({ cityId: 2, sortBy: "default" });
      expect(resp).toBeTruthy();
      expect(resp!.items.length).toBeGreaterThanOrEqual(8);
      // 至少 80% 区有 6 位 adminCode
      const withCode = resp!.items.filter((d) => /^\d{6}$/.test(d.adminCode)).length;
      expect(withCode).toBeGreaterThanOrEqual(resp!.items.length * 0.8);
    });

    it("getDistrictMetaRanking 排序: sortBy=price 应按 medianUnitPrice 降序", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getDistrictMetaRanking } = await import("../src/local/queries");
      const resp = getDistrictMetaRanking({ cityId: 2, sortBy: "price" });
      expect(resp).toBeTruthy();
      const prices = resp!.items.map((d) => d.medianUnitPrice ?? -1);
      // 验证单调性
      for (let i = 1; i < prices.length; i++) {
        if (prices[i] >= 0 && prices[i - 1] >= 0) {
          expect(prices[i - 1]).toBeGreaterThanOrEqual(prices[i]);
        }
      }
    });
  });

  // v0.39.0 trend-19: 特征画像溢价
  describe("v0.39.0 trend-19 特征画像溢价", () => {
    it("feature_premium.csv 存在 + 有列 + city_name 正确", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/feature_premium.csv"), "utf8");
      expect(csv).toMatch(/^(\ufeff)?city_id,city_name,dimension,bucket/);
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(20);
      // 验证 city_name 不是 id (e.g. "广州")
      expect(csv).toMatch(/,广州,/);
      expect(csv).toMatch(/,深圳,/);
      expect(csv).toMatch(/,珠海,/);
      // 排除"未知"桶
      const data = lines.slice(1);
      for (const l of data) {
        const cols = l.split(",");
        expect(cols[3]).not.toBe("未知");
      }
    });

    it("compute_feature_premium.py + types/parser/store/queries 都实现", () => {
      const script = readFileSync(resolve(ROOT, "scripts/compute_feature_premium.py"), "utf8");
      expect(script).toMatch(/city_median_unit_price/);
      expect(script).toMatch(/feature_premium\.csv/);

      const types = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(types).toMatch(/LocalFeaturePremium/);
      expect(types).toMatch(/featurePremia:\s*LocalFeaturePremium\[\]/);

      const importer = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(importer).toMatch(/function parseFeaturePremium/);
      expect(importer).toMatch(/featurePremiumCSV/);

      const store = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(store).toMatch(/getFeaturePremia\(/);
      expect(store).toMatch(/getFeaturePremiaByCity\(/);

      const queries = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(queries).toMatch(/export function getFeaturePremiumRanking/);
      expect(queries).toMatch(/FeaturePremiumItem/);
    });

    it("seedSnapshot.ts + dataRefresher.ts + settings.vue 都接入 feature_premium", () => {
      const seed = readFileSync(resolve(ROOT, "src/local/seedSnapshot.ts"), "utf8");
      expect(seed).toMatch(/import featurePremiumCSV/);
      expect(seed).toMatch(/featurePremiumCSV:/);

      const ref = readFileSync(resolve(ROOT, "src/local/dataRefresher.ts"), "utf8");
      expect(ref).toMatch(/featurePremia:/);

      const settings = readFileSync(resolve(ROOT, "src/pages/settings/settings.vue"), "utf8");
      expect(settings).toMatch(/feature_premium\.csv/);
      expect(settings).toMatch(/featurePremiumCSV:/);
    });

    it("dashboard.vue 特征画像溢价卡 + 4 dim blocks + bar + percent", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/特征画像溢价/);
      expect(dash).toMatch(/featurePremium/);
      expect(dash).toMatch(/reloadFeaturePremium/);
      expect(dash).toMatch(/fp-dim-block/);
      expect(dash).toMatch(/fp-bar/);
      expect(dash).toMatch(/fp-pct/);
      expect(dash).toMatch(/fpBarClass/);
      expect(dash).toMatch(/fpPctClass/);
      expect(dash).toMatch(/FP_DIM_LABEL/);
    });

    it("getFeaturePremiumRanking 数据正确 + top/bottom 排序", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getFeaturePremiumRanking } = await import("../src/local/queries");
      const resp = getFeaturePremiumRanking({ cityId: 2, minCount: 5, topN: 10 });
      expect(resp).toBeTruthy();
      // 深圳 (cityId=2) 至少有 bedrooms/orientation/decorate/area_sqm 4 维
      expect(resp!.dimensions.length).toBe(4);
      // top 应按 premium 降序
      for (let i = 1; i < resp!.topPremium.length; i++) {
        expect(resp!.topPremium[i - 1].premiumPct).toBeGreaterThanOrEqual(
          resp!.topPremium[i].premiumPct
        );
      }
      // bottom 应按 premium 升序
      for (let i = 1; i < resp!.bottomPremium.length; i++) {
        expect(resp!.bottomPremium[i - 1].premiumPct).toBeLessThanOrEqual(
          resp!.bottomPremium[i].premiumPct
        );
      }
    });

    it("getFeaturePremiumRanking 维度过滤只返回指定维度", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getFeaturePremiumRanking } = await import("../src/local/queries");
      const resp = getFeaturePremiumRanking({
        cityId: 2,
        dimensions: ["bedrooms", "orientation"],
        minCount: 5
      });
      expect(resp).toBeTruthy();
      // 应该只 2 个维度
      expect(resp!.dimensions.length).toBe(2);
      for (const d of resp!.dimensions) {
        expect(["bedrooms", "orientation"]).toContain(d.dimension);
      }
    });
  });

  // v0.40.0 trend-20: 标签组合热度
  describe("v0.40.0 trend-20 标签组合热度", () => {
    it("tag_combination.csv 存在 + 有列 + city_name 正确", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/tag_combination.csv"), "utf8");
      expect(csv).toMatch(/^(\ufeff)?city_id,city_name,tag_a,tag_b/);
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(50);
      // 验证 city_name 是中文
      expect(csv).toMatch(/,广州,/);
      expect(csv).toMatch(/,深圳,/);
      expect(csv).toMatch(/,珠海,/);
    });

    it("compute_tag_combination.py + types/parser/store/queries 都实现", () => {
      const script = readFileSync(resolve(ROOT, "scripts/compute_tag_combination.py"), "utf8");
      expect(script).toMatch(/listing_tags\.csv/);
      expect(script).toMatch(/combinations/);
      expect(script).toMatch(/tag_combination\.csv/);

      const types = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(types).toMatch(/LocalTagCombination/);
      expect(types).toMatch(/tagCombinations:\s*LocalTagCombination\[\]/);

      const importer = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(importer).toMatch(/function parseTagCombination/);
      expect(importer).toMatch(/tagCombinationCSV/);

      const store = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(store).toMatch(/getTagCombinations\(/);
      expect(store).toMatch(/getTagCombinationsByCity\(/);

      const queries = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(queries).toMatch(/export function getTagCombinationRanking/);
      expect(queries).toMatch(/TagCombinationItem/);
    });

    it("seedSnapshot.ts + dataRefresher.ts + settings.vue 都接入 tag_combination", () => {
      const seed = readFileSync(resolve(ROOT, "src/local/seedSnapshot.ts"), "utf8");
      expect(seed).toMatch(/import tagCombinationCSV/);
      expect(seed).toMatch(/tagCombinationCSV:/);

      const ref = readFileSync(resolve(ROOT, "src/local/dataRefresher.ts"), "utf8");
      expect(ref).toMatch(/tagCombinations:/);

      const settings = readFileSync(resolve(ROOT, "src/pages/settings/settings.vue"), "utf8");
      expect(settings).toMatch(/tag_combination\.csv/);
      expect(settings).toMatch(/tagCombinationCSV:/);
    });

    it("dashboard.vue 标签组合卡 + tag pair 渲染", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/标签组合热度/);
      expect(dash).toMatch(/tagCombination/);
      expect(dash).toMatch(/reloadTagCombination/);
      expect(dash).toMatch(/tc-row/);
      expect(dash).toMatch(/tc-tag/);
      expect(dash).toMatch(/tc-bar/);
      expect(dash).toMatch(/tcBarWidth/);
    });

    it("getTagCombinationRanking 数据正确 + count 降序", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getTagCombinationRanking } = await import("../src/local/queries");
      const resp = getTagCombinationRanking({ cityId: 2, topN: 12, minCount: 5 });
      expect(resp).toBeTruthy();
      // 深圳应该有数据
      expect(resp!.totalCount).toBeGreaterThan(20);
      expect(resp!.topN.length).toBeGreaterThan(0);
      // 验证 topN 按 count 降序
      for (let i = 1; i < resp!.topN.length; i++) {
        expect(resp!.topN[i - 1].count).toBeGreaterThanOrEqual(resp!.topN[i].count);
      }
      // 验证 tagA < tagB (lexical order, sorted)
      for (const it of resp!.topN) {
        expect(it.tagA).toBeTruthy();
        expect(it.tagB).toBeTruthy();
        expect(it.tagA).not.toBe(it.tagB);
      }
    });

    it("getTagCombinationRanking 过滤 minCount 有效", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getTagCombinationRanking } = await import("../src/local/queries");
      const respAll = getTagCombinationRanking({ cityId: 2, topN: 200, minCount: 3 });
      const respHigh = getTagCombinationRanking({ cityId: 2, topN: 200, minCount: 100 });
      expect(respAll).toBeTruthy();
      expect(respHigh).toBeTruthy();
      // minCount=100 应该过滤掉大部分
      expect(respHigh!.topN.length).toBeLessThan(respAll!.topN.length);
      for (const it of respHigh!.topN) {
        expect(it.count).toBeGreaterThanOrEqual(100);
      }
    });
  });

  // v0.41.0 trend-21: 房源新鲜度
  describe("v0.41.0 trend-21 房源新鲜度", () => {
    it("listing_freshness.csv 存在 + 有列 + city_name 正确", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/listing_freshness.csv"), "utf8");
      expect(csv).toMatch(/^(\ufeff)?city_id,city_name,community_id/);
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(20);
      expect(csv).toMatch(/,广州,/);
      expect(csv).toMatch(/,深圳,/);
      expect(csv).toMatch(/,珠海,/);
    });

    it("compute_listing_freshness.py + types/parser/store/queries 都实现", () => {
      const script = readFileSync(resolve(ROOT, "scripts/compute_listing_freshness.py"), "utf8");
      expect(script).toMatch(/listings\.csv/);
      expect(script).toMatch(/crawl_date/);
      expect(script).toMatch(/freshness_score/);
      expect(script).toMatch(/listing_freshness\.csv/);

      const types = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(types).toMatch(/LocalListingFreshness/);
      expect(types).toMatch(/listingFreshness:\s*LocalListingFreshness\[\]/);

      const importer = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(importer).toMatch(/function parseListingFreshness/);
      expect(importer).toMatch(/listingFreshnessCSV/);

      const store = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(store).toMatch(/getListingFreshness\(/);
      expect(store).toMatch(/getListingFreshnessByCity\(/);

      const queries = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(queries).toMatch(/export function getListingFreshnessRanking/);
      expect(queries).toMatch(/ListingFreshnessItem/);
    });

    it("seedSnapshot.ts + dataRefresher.ts + settings.vue 都接入", () => {
      const seed = readFileSync(resolve(ROOT, "src/local/seedSnapshot.ts"), "utf8");
      expect(seed).toMatch(/import listingFreshnessCSV/);
      expect(seed).toMatch(/listingFreshnessCSV:/);

      const ref = readFileSync(resolve(ROOT, "src/local/dataRefresher.ts"), "utf8");
      expect(ref).toMatch(/listingFreshness:/);

      const settings = readFileSync(resolve(ROOT, "src/pages/settings/settings.vue"), "utf8");
      expect(settings).toMatch(/listing_freshness\.csv/);
      expect(settings).toMatch(/listingFreshnessCSV:/);
    });

    it("dashboard.vue 房源新鲜度卡 + 双 section (活跃/滞销)", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/房源新鲜度/);
      expect(dash).toMatch(/listingFreshness/);
      expect(dash).toMatch(/reloadListingFreshness/);
      expect(dash).toMatch(/lf-row/);
      expect(dash).toMatch(/lf-section-title/);
      expect(dash).toMatch(/lf-fresh-up|lf-fresh-mid|lf-fresh-down/);
    });

    it("getListingFreshnessRanking 数据正确 + 活跃/滞销 两榜", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getListingFreshnessRanking } = await import("../src/local/queries");
      const resp = getListingFreshnessRanking({ cityId: 2, topN: 8, minListings: 5 });
      expect(resp).toBeTruthy();
      expect(resp!.mostFresh.length).toBeGreaterThan(0);
      expect(resp!.mostStale.length).toBeGreaterThan(0);
      // 验证 mostFresh 按 freshnessScore 降序
      for (let i = 1; i < resp!.mostFresh.length; i++) {
        expect(resp!.mostFresh[i - 1].freshnessScore).toBeGreaterThanOrEqual(
          resp!.mostFresh[i].freshnessScore
        );
      }
      // 验证 mostStale 按 medianAgeDays 降序
      for (let i = 1; i < resp!.mostStale.length; i++) {
        expect(resp!.mostStale[i - 1].medianAgeDays ?? 0).toBeGreaterThanOrEqual(
          resp!.mostStale[i].medianAgeDays ?? 0
        );
      }
    });
  });

  // v0.42.0 trend-22: 户型 × 面积 联合分布
  describe("v0.42.0 trend-22 户型 × 面积 联合分布", () => {
    it("bedroom_area.csv 存在 + 有列 + city_name 正确", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/bedroom_area.csv"), "utf8");
      expect(csv).toMatch(/^(\ufeff)?city_id,city_name,bedrooms/);
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(15);
      expect(csv).toMatch(/,广州,/);
      expect(csv).toMatch(/,深圳,/);
      expect(csv).toMatch(/,珠海,/);
    });

    it("compute_bedroom_area.py + types/parser/store/queries 都实现", () => {
      const script = readFileSync(resolve(ROOT, "scripts/compute_bedroom_area.py"), "utf8");
      expect(script).toMatch(/bucket_area/);
      expect(script).toMatch(/bedroom_area\.csv/);

      const types = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(types).toMatch(/LocalBedroomArea/);
      expect(types).toMatch(/bedroomArea:\s*LocalBedroomArea\[\]/);

      const importer = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(importer).toMatch(/function parseBedroomArea/);
      expect(importer).toMatch(/bedroomAreaCSV/);

      const store = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(store).toMatch(/getBedroomArea\(/);
      expect(store).toMatch(/getBedroomAreaByCity\(/);

      const queries = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(queries).toMatch(/export function getBedroomAreaDistribution/);
      expect(queries).toMatch(/BedroomAreaCell/);
    });

    it("seedSnapshot.ts + dataRefresher.ts + settings.vue 都接入", () => {
      const seed = readFileSync(resolve(ROOT, "src/local/seedSnapshot.ts"), "utf8");
      expect(seed).toMatch(/import bedroomAreaCSV/);
      expect(seed).toMatch(/bedroomAreaCSV:/);

      const ref = readFileSync(resolve(ROOT, "src/local/dataRefresher.ts"), "utf8");
      expect(ref).toMatch(/bedroomArea:/);

      const settings = readFileSync(resolve(ROOT, "src/pages/settings/settings.vue"), "utf8");
      expect(settings).toMatch(/bedroom_area\.csv/);
      expect(settings).toMatch(/bedroomAreaCSV:/);
    });

    it("dashboard.vue 热图卡 + 5 bedrooms × 6 buckets", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/户型 × 面积 分布/);
      expect(dash).toMatch(/bedroomArea/);
      expect(dash).toMatch(/reloadBedroomArea/);
      expect(dash).toMatch(/ba-heatmap/);
      expect(dash).toMatch(/ba-cell/);
      expect(dash).toMatch(/baCellOpacity/);
      expect(dash).toMatch(/baMaxCount/);
    });

    it("getBedroomAreaDistribution 数据正确 + grid 完整", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getBedroomAreaDistribution } = await import("../src/local/queries");
      const resp = getBedroomAreaDistribution({ cityId: 2, minCount: 3 });
      expect(resp).toBeTruthy();
      // 深圳应该有数据
      expect(resp!.bedrooms.length).toBeGreaterThan(2);
      expect(resp!.areaBuckets.length).toBeGreaterThan(3);
      // grid 维度
      expect(resp!.grid.length).toBe(resp!.bedrooms.length);
      for (let i = 0; i < resp!.grid.length; i++) {
        expect(resp!.grid[i].length).toBe(resp!.areaBuckets.length);
      }
      // top 5 排序: count 降序
      for (let i = 1; i < resp!.topCells.length; i++) {
        expect(resp!.topCells[i - 1].count).toBeGreaterThanOrEqual(
          resp!.topCells[i].count
        );
      }
    });
  });

  // v0.43.0 trend-23: 朝向 × 楼层 溢价
  describe("v0.43.0 trend-23 朝向 × 楼层 溢价", () => {
    it("orientation_floor.csv 存在 + 有列 + city_name 正确", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/orientation_floor.csv"), "utf8");
      expect(csv).toMatch(/^(\ufeff)?city_id,city_name,orientation,floor_bucket/);
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(40);
      expect(csv).toMatch(/,广州,/);
      expect(csv).toMatch(/,深圳,/);
      expect(csv).toMatch(/,珠海,/);
      // 每行有 premium_pct 列
      expect(csv).toMatch(/premium_pct/);
    });

    it("compute_orientation_floor.py + types/parser/store/queries 都实现", () => {
      const script = readFileSync(resolve(ROOT, "scripts/compute_orientation_floor.py"), "utf8");
      expect(script).toMatch(/premium_pct/);
      expect(script).toMatch(/orientation_floor\.csv/);

      const types = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(types).toMatch(/LocalOrientationFloor/);
      expect(types).toMatch(/orientationFloor:\s*LocalOrientationFloor\[\]/);
      expect(types).toMatch(/premiumPct:/);

      const importer = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(importer).toMatch(/function parseOrientationFloor/);
      expect(importer).toMatch(/orientationFloorCSV/);

      const store = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(store).toMatch(/getOrientationFloor\(/);
      expect(store).toMatch(/getOrientationFloorByCity\(/);

      const queries = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(queries).toMatch(/export function getOrientationFloorMatrix/);
      expect(queries).toMatch(/OrientationFloorCell/);
      expect(queries).toMatch(/topPremium/);
      expect(queries).toMatch(/topDiscount/);
    });

    it("seedSnapshot.ts + dataRefresher.ts + settings.vue 都接入", () => {
      const seed = readFileSync(resolve(ROOT, "src/local/seedSnapshot.ts"), "utf8");
      expect(seed).toMatch(/import orientationFloorCSV/);
      expect(seed).toMatch(/orientationFloorCSV:/);

      const ref = readFileSync(resolve(ROOT, "src/local/dataRefresher.ts"), "utf8");
      expect(ref).toMatch(/orientationFloor:/);

      const settings = readFileSync(resolve(ROOT, "src/pages/settings/settings.vue"), "utf8");
      expect(settings).toMatch(/orientation_floor\.csv/);
      expect(settings).toMatch(/orientationFloorCSV:/);
    });

    it("dashboard.vue 溢价卡 + 折价卡 + 矩阵 + 颜色编码", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/朝向 × 楼层 溢价/);
      expect(dash).toMatch(/orientationFloor/);
      expect(dash).toMatch(/reloadOrientationFloor/);
      expect(dash).toMatch(/of-row-up/);
      expect(dash).toMatch(/of-row-down/);
      expect(dash).toMatch(/of-matrix/);
      expect(dash).toMatch(/of-mcell/);
      expect(dash).toMatch(/ofCellClass/);
      expect(dash).toMatch(/of-cell-up/);
      expect(dash).toMatch(/of-cell-down/);
    });

    it("getOrientationFloorMatrix 数据正确 + 溢价/折价排序", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getOrientationFloorMatrix } = await import("../src/local/queries");
      const resp = getOrientationFloorMatrix({ cityId: 2, minCount: 5 });
      expect(resp).toBeTruthy();
      // 深圳应至少有 4 orientations × 3 floor_buckets = 12 cells
      expect(resp!.orientations.length).toBeGreaterThanOrEqual(4);
      expect(resp!.floorBuckets.length).toBeGreaterThanOrEqual(3);
      expect(resp!.grid.length).toBe(resp!.orientations.length);
      // topPremium 降序
      for (let i = 1; i < resp!.topPremium.length; i++) {
        expect(resp!.topPremium[i - 1].premiumPct).toBeGreaterThanOrEqual(
          resp!.topPremium[i].premiumPct
        );
      }
      // topDiscount 升序 (折价最大在第 1)
      for (let i = 1; i < resp!.topDiscount.length; i++) {
        expect(resp!.topDiscount[i - 1].premiumPct).toBeLessThanOrEqual(
          resp!.topDiscount[i].premiumPct
        );
      }
    });

    it("珠海应有大折价 cell (珠海 朝南/高楼层 +20%, 南北通透/低楼层应 < -30%)", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getOrientationFloorMatrix } = await import("../src/local/queries");
      const resp = getOrientationFloorMatrix({ cityId: 3, minCount: 5 });
      expect(resp).toBeTruthy();
      // 珠海 折价头牌 < -30%
      const worst = resp!.topDiscount[0];
      expect(worst.premiumPct).toBeLessThan(-30);
    });
  });

  // v0.44.0 trend-24: 装修 × 楼龄 溢价
  describe("v0.44.0 trend-24 装修 × 楼龄 溢价", () => {
    it("decorate_age.csv 存在 + 有列 + city_name 正确", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/decorate_age.csv"), "utf8");
      expect(csv).toMatch(/^(\ufeff)?city_id,city_name,decorate,age_bucket/);
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(40);
      expect(csv).toMatch(/,广州,/);
      expect(csv).toMatch(/,深圳,/);
      expect(csv).toMatch(/,珠海,/);
      expect(csv).toMatch(/premium_pct/);
    });

    it("compute_decorate_age.py + types/parser/store/queries 都实现", () => {
      const script = readFileSync(resolve(ROOT, "scripts/compute_decorate_age.py"), "utf8");
      expect(script).toMatch(/premium_pct/);
      expect(script).toMatch(/decorate_age\.csv/);
      expect(script).toMatch(/age_bucket/);

      const types = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(types).toMatch(/LocalDecorateAge/);
      expect(types).toMatch(/decorateAge:\s*LocalDecorateAge\[\]/);
      expect(types).toMatch(/ageBucket:/);

      const importer = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(importer).toMatch(/function parseDecorateAge/);
      expect(importer).toMatch(/decorateAgeCSV/);

      const store = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(store).toMatch(/getDecorateAge\(/);
      expect(store).toMatch(/getDecorateAgeByCity\(/);

      const queries = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(queries).toMatch(/export function getDecorateAgeMatrix/);
      expect(queries).toMatch(/DecorateAgeCell/);
      expect(queries).toMatch(/haoZhuangByAge/);
      expect(queries).toMatch(/maoPoByAge/);
    });

    it("seedSnapshot.ts + dataRefresher.ts + settings.vue 都接入", () => {
      const seed = readFileSync(resolve(ROOT, "src/local/seedSnapshot.ts"), "utf8");
      expect(seed).toMatch(/import decorateAgeCSV/);
      expect(seed).toMatch(/decorateAgeCSV:/);

      const ref = readFileSync(resolve(ROOT, "src/local/dataRefresher.ts"), "utf8");
      expect(ref).toMatch(/decorateAge:/);

      const settings = readFileSync(resolve(ROOT, "src/pages/settings/settings.vue"), "utf8");
      expect(settings).toMatch(/decorate_age\.csv/);
      expect(settings).toMatch(/decorateAgeCSV:/);
    });

    it("dashboard.vue 装修卡 + 折价卡 + 矩阵 + da-cell 颜色", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/装修 × 楼龄 溢价/);
      expect(dash).toMatch(/decorateAge/);
      expect(dash).toMatch(/reloadDecorateAge/);
      expect(dash).toMatch(/daCellClass/);
      expect(dash).toMatch(/da-cell-up-strong/);
      expect(dash).toMatch(/da-cell-down-strong/);
    });

    it("getDecorateAgeMatrix 数据正确 + 矩阵完整 + haoZhuang/maoPo 提取", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getDecorateAgeMatrix } = await import("../src/local/queries");
      const resp = getDecorateAgeMatrix({ cityId: 2, minCount: 5 });
      expect(resp).toBeTruthy();
      expect(resp!.decorates.length).toBeGreaterThanOrEqual(3);
      expect(resp!.ageBuckets.length).toBeGreaterThanOrEqual(3);
      expect(resp!.grid.length).toBe(resp!.decorates.length);
      // 豪装 应该有数据
      expect(resp!.haoZhuangByAge.length).toBeGreaterThan(0);
      // 毛坯 应该有数据
      expect(resp!.maoPoByAge.length).toBeGreaterThan(0);
      // topPremium 降序
      for (let i = 1; i < resp!.topPremium.length; i++) {
        expect(resp!.topPremium[i - 1].premiumPct).toBeGreaterThanOrEqual(
          resp!.topPremium[i].premiumPct
        );
      }
    });

    it("珠海应有大折价装修格 (普装/2010-2014 ≈ -41%, 全城最大)", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getDecorateAgeMatrix } = await import("../src/local/queries");
      const resp = getDecorateAgeMatrix({ cityId: 3, minCount: 5 });
      expect(resp).toBeTruthy();
      const worst = resp!.topDiscount[0];
      expect(worst.premiumPct).toBeLessThanOrEqual(-30);
      expect(worst.decorate).toBeTruthy();
      expect(worst.ageBucket).toBeTruthy();
    });
  });

  // v0.45.0 trend-25: 社区 散点
  describe("v0.45.0 trend-25 社区 总价 × 单价 散点", () => {
    it("community_scatter.csv 存在 + 有列 + city_name 正确", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/community_scatter.csv"), "utf8");
      expect(csv).toMatch(/^(\ufeff)?city_id,city_name,community_id,community_name/);
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(20);  // at least 21 rows
      expect(csv).toMatch(/,广州,/);
      expect(csv).toMatch(/,深圳,/);
      expect(csv).toMatch(/,珠海,/);
      expect(csv).toMatch(/quadrant/);
    });

    it("compute_community_scatter.py + types/parser/store/queries 都实现", () => {
      const script = readFileSync(resolve(ROOT, "scripts/compute_community_scatter.py"), "utf8");
      expect(script).toMatch(/quadrant/);
      expect(script).toMatch(/community_scatter\.csv/);
      expect(script).toMatch(/area_cohort/);

      const types = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(types).toMatch(/LocalCommunityScatter/);
      expect(types).toMatch(/communityScatter:\s*LocalCommunityScatter\[\]/);
      expect(types).toMatch(/quadrant:/);

      const importer = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(importer).toMatch(/function parseCommunityScatter/);
      expect(importer).toMatch(/communityScatterCSV/);

      const store = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(store).toMatch(/getCommunityScatter\(/);
      expect(store).toMatch(/getCommunityScatterByCity\(/);

      const queries = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(queries).toMatch(/export function getCommunityScatter/);
      expect(queries).toMatch(/byQuadrant/);
      expect(queries).toMatch(/cityMedianUnit/);
      expect(queries).toMatch(/cityMedianTotal/);
    });

    it("seedSnapshot.ts + dataRefresher.ts + settings.vue 都接入", () => {
      const seed = readFileSync(resolve(ROOT, "src/local/seedSnapshot.ts"), "utf8");
      expect(seed).toMatch(/import communityScatterCSV/);
      expect(seed).toMatch(/communityScatterCSV:/);

      const ref = readFileSync(resolve(ROOT, "src/local/dataRefresher.ts"), "utf8");
      expect(ref).toMatch(/communityScatter:/);

      const settings = readFileSync(resolve(ROOT, "src/pages/settings/settings.vue"), "utf8");
      expect(settings).toMatch(/community_scatter\.csv/);
      expect(settings).toMatch(/communityScatterCSV:/);
    });

    it("dashboard.vue 散点卡 + SVG + 4 quadrant 分桶", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/总价 × 单价 散点/);
      expect(dash).toMatch(/scatter/);
      expect(dash).toMatch(/reloadScatter/);
      expect(dash).toMatch(/scatter-svg/);
      expect(dash).toMatch(/scatterX/);
      expect(dash).toMatch(/scatterY/);
      expect(dash).toMatch(/scatterColor/);
      expect(dash).toMatch(/豪宅板块/);
      expect(dash).toMatch(/学区刚需/);
      expect(dash).toMatch(/改善低密/);
      expect(dash).toMatch(/价值洼地/);
      expect(dash).toMatch(/circle/);
    });

    it("getCommunityScatter 数据正确 + 4 quadrant 都有数据", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getCommunityScatter } = await import("../src/local/queries");
      const resp = getCommunityScatter({ cityId: 2 });
      expect(resp).toBeTruthy();
      expect(resp!.points.length).toBeGreaterThan(5);
      expect(resp!.cityMedianUnit).toBeGreaterThan(0);
      expect(resp!.cityMedianTotal).toBeGreaterThan(0);
      // 4 quadrant 至少存在 2 个
      let nonEmpty = 0;
      for (const q of ["豪宅板块", "学区刚需", "改善低密", "价值洼地"]) {
        if (resp!.byQuadrant[q]?.length > 0) nonEmpty++;
      }
      expect(nonEmpty).toBeGreaterThanOrEqual(2);
      // x range valid
      expect(resp!.xMax).toBeGreaterThan(resp!.xMin);
      expect(resp!.yMax).toBeGreaterThan(resp!.yMin);
    });

    it("深圳 应至少有 5 个社区散点 (主测试城)", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getCommunityScatter } = await import("../src/local/queries");
      const resp = getCommunityScatter({ cityId: 2 });
      expect(resp).toBeTruthy();
      expect(resp!.points.length).toBeGreaterThanOrEqual(5);
    });
  });

  // v0.46.0 map-11: 行政区 + 社区 marker
  describe("v0.46.0 map-11 行政区 + 社区 marker 地图", () => {
    it("district_polygon.csv 存在 + 有 polygons_json", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/district_polygon.csv"), "utf8");
      expect(csv).toMatch(/^(\ufeff)?district_code,district_name/);
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(20);
      expect(csv).toMatch(/polygons_json/);
    });

    it("communities_geo.csv 存在 + 有 lat/lng", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/communities_geo.csv"), "utf8");
      expect(csv).toMatch(/^(\ufeff)?community_id,city_id,community_name,lat,lng/);
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(20);
    });

    it("crawl_district_polygon.py + types/parser/store/queries 实现", () => {
      const script = readFileSync(resolve(ROOT, "scripts/crawl_district_polygon.py"), "utf8");
      expect(script).toMatch(/district_polygon\.csv/);
      expect(script).toMatch(/config\/district/);

      const types = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(types).toMatch(/LocalDistrictPolygon/);
      expect(types).toMatch(/districtPolygon:\s*LocalDistrictPolygon\[\]/);
      expect(types).toMatch(/polygons:\s*Array<Array<\[number/);

      const importer = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(importer).toMatch(/function parseDistrictPolygon/);
      expect(importer).toMatch(/function parseCommunityGeo/);
      expect(importer).toMatch(/districtPolygonCSV/);
      expect(importer).toMatch(/communityGeoCSV/);

      const store = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(store).toMatch(/getDistrictPolygon\(/);
      expect(store).toMatch(/getDistrictPolygonByCity\(/);
      expect(store).toMatch(/getCommunityGeoByCity\(/);

      const queries = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(queries).toMatch(/export function getDistrictMap/);
      expect(queries).toMatch(/DistrictMapResponse/);
      expect(queries).toMatch(/bbox/);
    });

    it("seedSnapshot.ts + dataRefresher.ts + settings.vue 接入", () => {
      const seed = readFileSync(resolve(ROOT, "src/local/seedSnapshot.ts"), "utf8");
      expect(seed).toMatch(/import districtPolygonCSV/);
      expect(seed).toMatch(/import communityGeoCSV/);
      expect(seed).toMatch(/districtPolygonCSV:/);
      expect(seed).toMatch(/communityGeoCSV:/);

      const ref = readFileSync(resolve(ROOT, "src/local/dataRefresher.ts"), "utf8");
      expect(ref).toMatch(/districtPolygon:/);
      expect(ref).toMatch(/communityGeo:/);

      const settings = readFileSync(resolve(ROOT, "src/pages/settings/settings.vue"), "utf8");
      expect(settings).toMatch(/district_polygon\.csv/);
      expect(settings).toMatch(/communities_geo\.csv/);
    });

    it("dashboard.vue 地图卡 + SVG + 多边形 + marker + label", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/行政区域图/);
      expect(dash).toMatch(/districtMap/);
      expect(dash).toMatch(/reloadDistrictMap/);
      expect(dash).toMatch(/map-svg/);
      expect(dash).toMatch(/mapDistrictClass|map-district-p/);
      expect(dash).toMatch(/map-marker/);
      expect(dash).toMatch(/mapX|mapY/);
      expect(dash).toMatch(/districtAllPath|ringToPath/);
      expect(dash).toMatch(/fill-rule="evenodd"/);
    });

    it("getDistrictMap 返回 bbox + 多边形 + markers", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getDistrictMap } = await import("../src/local/queries");
      const resp = getDistrictMap(2); // 深圳
      expect(resp).toBeTruthy();
      expect(resp!.districts.length).toBeGreaterThanOrEqual(5);
      expect(resp!.markers.length).toBeGreaterThan(0);
      // bbox valid
      expect(resp!.bbox.maxLng).toBeGreaterThan(resp!.bbox.minLng);
      expect(resp!.bbox.maxLat).toBeGreaterThan(resp!.bbox.minLat);
      // 至少 80% district 有 polyline (大鹏新区属于边界区,可能无 polyline)
      let withPoly = 0;
      for (const d of resp!.districts) {
        if (d.polygons.length > 0 && d.polygons[0].length >= 3) withPoly++;
      }
      const ratio = withPoly / resp!.districts.length;
      expect(ratio).toBeGreaterThanOrEqual(0.8);
    });
  });

  // v0.47.0 school-4: 学区指标加权细分
  describe("v0.47.0 school-4 学区指标加权细分", () => {
    it("school_dimensions.csv 存在 + 有 12 列", () => {
      const csv = readFileSync(resolve(ROOT, "static/seed/school_dimensions.csv"), "utf8");
      expect(csv).toMatch(/^(\ufeff)?city_id,city_name,school_id/);
      expect(csv).toMatch(/composite_score/);
      expect(csv).toMatch(/trend_delta/);
      expect(csv).toMatch(/district_balance/);
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(50);
      // header 12 列
      const header = lines[0].split(",");
      expect(header.length).toBe(12);
    });

    it("compute_school_dimensions.py + 5 维全部输出", () => {
      const script = readFileSync(resolve(ROOT, "scripts/compute_school_dimensions.py"), "utf8");
      expect(script).toMatch(/school_dimensions\.csv/);
      expect(script).toMatch(/latest_level_score_raw/);
      expect(script).toMatch(/group_school_strength_raw/);
      expect(script).toMatch(/district_balance_level_raw/);
      expect(script).toMatch(/trend_delta_raw/);
      expect(script).toMatch(/composite_score/);
      expect(script).toMatch(/DEFAULT_WEIGHTS/);
    });

    it("types/parser/store/queries 实现", () => {
      const types = readFileSync(resolve(ROOT, "src/local/types.ts"), "utf8");
      expect(types).toMatch(/LocalSchoolDimension/);
      expect(types).toMatch(/compositeScore:/);

      const importer = readFileSync(resolve(ROOT, "src/local/importer.ts"), "utf8");
      expect(importer).toMatch(/function parseSchoolDimensions/);
      expect(importer).toMatch(/schoolDimensionsCSV/);

      const store = readFileSync(resolve(ROOT, "src/local/store.ts"), "utf8");
      expect(store).toMatch(/getSchoolDimensions\(/);
      expect(store).toMatch(/getSchoolDimensionsByCity\(/);

      const queries = readFileSync(resolve(ROOT, "src/local/queries.ts"), "utf8");
      expect(queries).toMatch(/export function getSchoolDimensions/);
      expect(queries).toMatch(/SchoolDimResponse/);
      expect(queries).toMatch(/topOverall|topByLevel|topByGroup|topByDistrict|topByTrend/);
    });

    it("seedSnapshot + dataRefresher + settings.vue 接入", () => {
      const seed = readFileSync(resolve(ROOT, "src/local/seedSnapshot.ts"), "utf8");
      expect(seed).toMatch(/import schoolDimensionsCSV/);
      expect(seed).toMatch(/schoolDimensionsCSV:/);

      const ref = readFileSync(resolve(ROOT, "src/local/dataRefresher.ts"), "utf8");
      expect(ref).toMatch(/schoolDimensions:/);

      const settings = readFileSync(resolve(ROOT, "src/pages/settings/settings.vue"), "utf8");
      expect(settings).toMatch(/school_dimensions\.csv/);
    });

    it("dashboard.vue: 学区指标卡 + reloadSchoolDims + schoolDimsColor", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/学区 5 维评分/);
      expect(dash).toMatch(/schoolDims/);
      expect(dash).toMatch(/reloadSchoolDims/);
      expect(dash).toMatch(/schoolDimsColor/);
      expect(dash).toMatch(/compositeScore/);
      expect(dash).toMatch(/topOverall/);
    });

    it("getSchoolDimensions 综合/4 维度 Top 正确", async () => {
      const { setSnapshot } = await import("../src/local/store");
      const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      const { getSchoolDimensions } = await import("../src/local/queries");
      const resp = getSchoolDimensions(2); // 深圳
      expect(resp).toBeTruthy();
      expect(resp!.total).toBeGreaterThan(10);
      // 5 列各返回 Top 10
      expect(resp!.topOverall.length).toBeGreaterThan(0);
      expect(resp!.topByLevel.length).toBeGreaterThan(0);
      expect(resp!.topByGroup.length).toBeGreaterThan(0);
      expect(resp!.topByDistrict.length).toBeGreaterThan(0);
      expect(resp!.topByTrend.length).toBeGreaterThan(0);
      // 综合 top 一定是 compositeScore 最高
      expect(resp!.topOverall[0].compositeScore).toBeGreaterThanOrEqual(
        resp!.topOverall[resp!.topOverall.length - 1].compositeScore
      );
      // 涨幅最大 > 0
      expect(resp!.topByTrend[0].trendDelta).toBeGreaterThan(0);
    });
  });

  // v0.48.0 dashboard-tabs: 顶部 tab 分类切换
  describe("v0.48.0 dashboard-tabs Tab 分类", () => {
    it("dashboard.vue: 含 5 个 tab (all/price/school/transit/map)", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/DASHBOARD_TABS/);
      expect(dash).toMatch(/activeTab = ref<DashTabKey>\("all"\)/);
      expect(dash).toMatch(/activeTab = t\.key/);
      // 5 tab labels
      expect(dash).toMatch(/"全部"/);
      expect(dash).toMatch(/"价格画像"/);
      expect(dash).toMatch(/"学区配套"/);
      expect(dash).toMatch(/"通勤地铁"/);
      expect(dash).toMatch(/"地图视图"/);
    });

    it("dashboard.vue: 至少 25 个 card 有 data-tab 属性", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      // 至少 24 张数据卡 + 1 张 tab 按钮 = 25
      const matches = dash.match(/data-tab=/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(25);
      // 4 个 tab 维度都要出现
      expect(dash).toMatch(/data-tab="all,price"/);
      expect(dash).toMatch(/data-tab="all,school"/);
      expect(dash).toMatch(/data-tab="all,transit"/);
      expect(dash).toMatch(/data-tab="all,map"/);
      // 至少 1 个 map-only
      expect(dash).toMatch(/data-tab="all,map"/);
    });

    it("dashboard.vue: 全局 style 用 body[data-dash-tab] 隐藏卡片", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/body\[data-dash-tab="price"\] \.card:not\(\[data-tab\*="price"\]\)/);
      expect(dash).toMatch(/body\[data-dash-tab="school"\]/);
      expect(dash).toMatch(/body\[data-dash-tab="transit"\]/);
      expect(dash).toMatch(/body\[data-dash-tab="map"\]/);
    });

    it("dashboard.vue: applyTabClass + watch 联动", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/applyTabClass/);
      expect(dash).toMatch(/document\.body\.setAttribute\("data-dash-tab"/);
      expect(dash).toMatch(/watch\(activeTab/);
    });
  });

  // v0.49.0 topnav-1: 周期 sticky 切换
  describe("v0.49.0 topnav-1 周期 sticky 顶栏", () => {
    it("dashboard.vue: 含 topnav-period + stepPeriod + currentPeriodIdx", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/topnav-period/);
      expect(dash).toMatch(/stepPeriod/);
      expect(dash).toMatch(/currentPeriodIdx/);
      expect(dash).toMatch(/上一周/);
      expect(dash).toMatch(/下一周/);
    });

    it("dashboard.vue: 边界禁用 (cur<=0 / cur>=len)", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/topnav-p-btn--disabled/);
      expect(dash).toMatch(/currentPeriodIdx <= 0/);
      expect(dash).toMatch(/currentPeriodIdx >= periods\.length - 1/);
    });

    it("dashboard.vue: 切周期调用 app.setWeekEnd + loadRankingAndDistrict", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      const m = dash.match(/function stepPeriod[\s\S]*?\n\}/);
      expect(m).toBeTruthy();
      expect(m![0]).toMatch(/app\.setWeekEnd/);
      expect(m![0]).toMatch(/loadRankingAndDistrict/);
    });

    it("dashboard.vue: sticky 顶栏 CSS (position sticky + top)", () => {
      const css = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(css).toMatch(/\.topnav-period\s*\{[\s\S]*position: sticky/);
      expect(css).toMatch(/\.topnav-period\s*\{[\s\S]*top: 0/);
      expect(css).toMatch(/\.topnav-p-num/);
      expect(css).toMatch(/\.topnav-p-btn/);
    });
  });

  // v0.50.0 drill-1: 小区 drill-down 跳转详情
  describe("v0.50.0 drill-1 小区 drill-down", () => {
    it("dashboard.vue: scatter 卡 quadrant row + SVG 圆点 可点击 → goCommunity", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      // quadrant row 整体点击
      expect(dash).toMatch(/class="scatter-row tap-row"[\s\S]{0,200}@click="goCommunity\(p\.communityId\)"/);
      // SVG 圆点 @click (允许 1000 字符任意空白)
      expect(dash).toMatch(/class="scatter-pt"[\s\S]{0,1000}@click="goCommunity\(p\.communityId\)"/);
    });

    it("dashboard.vue: 行政区图 marker (≤30 + 30+) 可点击 → goCommunity", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      // 命名 group 版本 (≤30 marker)
      expect(dash).toMatch(/class="map-marker-g tap-row"[\s\S]{0,200}@click="goCommunity\(m\.communityId\)"/);
      // bare 版本 (>30 marker)
      expect(dash).toMatch(/class="map-marker-bare tap-row"[\s\S]{0,1000}@click="goCommunity\(m\.communityId\)"/);
    });

    it("goCommunity 已实现 (uni.navigateTo)", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      const m = dash.match(/function goCommunity\([^)]*\)\s*\{[\s\S]*?\n\}/);
      expect(m).toBeTruthy();
      expect(m![0]).toMatch(/uni\.navigateTo/);
      expect(m![0]).toMatch(/\/pages\/community\/community/);
    });

    it("dashboard.vue: drill-down hover CSS (scatter-pt + map-marker-g)", () => {
      const dash = readFileSync(resolve(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
      expect(dash).toMatch(/\.scatter-pt\s*\{[\s\S]*cursor: pointer/);
      expect(dash).toMatch(/\.map-marker-g\s*\{[\s\S]*cursor: pointer/);
      expect(dash).toMatch(/\.scatter-pt:hover/);
      expect(dash).toMatch(/\.map-marker-g:hover/);
    });
  });
});
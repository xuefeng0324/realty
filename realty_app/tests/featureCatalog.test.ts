/**
 * 门禁：全功能验收目录与强制流程文档必须存在，且关键功能 ID / 流程章节齐全。
 * 防止「流程写了但文件丢了 / 目录被掏空」导致后续功能跳过验收。
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const REQUIRED_IDS = [
  "F-GATE-01",
  "F-DASH-01",
  "F-DASH-02",
  "F-DASH-05",
  "F-DASH-06",
  "F-LIST-01",
  "F-LIST-03",
  "F-COMM-01",
  "F-SCH-01",
  "F-SCH-02",
  "F-MAP-01",
  "F-MAP-03",
  "F-MAP-04",
  "F-SET-01",
  "F-OTA-01",
  "F-S70-01",
  "F-WQ-01",
  "F-X-01"
];

describe("FEATURE QA 文档门禁", () => {
  it("强制流程与目录文件存在", () => {
    expect(existsSync(resolve(root, "docs/FEATURE_QA_PROCESS.md"))).toBe(true);
    expect(existsSync(resolve(root, "docs/FEATURE_CATALOG.md"))).toBe(true);
    expect(existsSync(resolve(root, "docs/FEATURE_ACCEPTANCE.md"))).toBe(true);
    expect(existsSync(resolve(root, "docs/TEST_ACCEPTANCE.md"))).toBe(true);
    expect(existsSync(resolve(root, "docs/FEATURES.md"))).toBe(true);
    expect(existsSync(resolve(root, "docs/LISTING_FILTER_ACCEPTANCE.md"))).toBe(true);
    expect(existsSync(resolve(root, "docs/MAP_ACCEPTANCE.md"))).toBe(true);
    expect(existsSync(resolve(root, "docs/THEME_ACCEPTANCE.md"))).toBe(true);
  });

  it("QA_PROCESS 含三类 bug 与 8 步 / DoD", () => {
    const text = read("docs/FEATURE_QA_PROCESS.md");
    expect(text).toContain("UI");
    expect(text).toContain("功能");
    expect(text).toContain("逻辑");
    expect(text).toMatch(/8\s*步|固定 8 步/);
    expect(text).toContain("Definition of Done");
    expect(text).toContain("FEATURE_CATALOG");
    expect(text).toContain("TEST_ACCEPTANCE");
  });

  it("CATALOG 登记关键功能 ID 与三类风险标记", () => {
    const text = read("docs/FEATURE_CATALOG.md");
    for (const id of REQUIRED_IDS) {
      expect(text, `缺少功能 ID ${id}`).toContain(id);
    }
    expect(text).toMatch(/\|\s*U\s*=\s*UI/);
    expect(text).toContain("期望");
    expect(text).toContain("手工");
    expect(text).toContain("自动化");
    expect(text).toContain("LISTING_FILTER_ACCEPTANCE");
  });

  it("FEATURE_ACCEPTANCE / TEST_ACCEPTANCE / FEATURES 交叉引用", () => {
    const acc = read("docs/FEATURE_ACCEPTANCE.md");
    expect(acc).toContain("FEATURE_QA_PROCESS.md");
    expect(acc).toContain("FEATURE_CATALOG.md");
    expect(acc).toContain("TEST_ACCEPTANCE.md");
    expect(acc).toContain("FEATURES.md");
    const testAcc = read("docs/TEST_ACCEPTANCE.md");
    expect(testAcc).toContain("P-LIST-01");
    expect(testAcc).toContain("P-MAP-02");
    expect(testAcc).toContain("listingFilterTypeDecorate");
    const features = read("docs/FEATURES.md");
    expect(features).toContain("F-LIST-01");
    expect(features).toContain("MAP_ACCEPTANCE");
    expect(features).toContain("在售");
    expect(read("docs/FEATURE_CATALOG.md")).toContain("MAP_ACCEPTANCE");
  });

  it("CATALOG 引用的核心 smoke / 单测文件存在", () => {
    const mustExist = [
      "tests/e2e/smoke_dashboard_feed_seam.mjs",
      "tests/e2e/smoke_theme_visual.mjs",
      "tests/e2e/smoke_map_controls.mjs",
      "tests/e2e/smoke_school_detail.mjs",
      "tests/e2e/smoke_price_heatmap.mjs",
      "tests/e2e/smoke_map_find.mjs",
      "tests/mapMath.test.ts",
      "tests/mapFind.test.ts",
      "tests/priceSemantics.test.ts",
      "tests/theme.test.ts",
      "tests/stats70Freshness.test.ts",
      "tests/listingFilterTypeDecorate.test.ts",
      "scripts/check.ps1",
      "scripts/check_stats70_freshness.py",
      "src/local/stats70Freshness.ts",
      "src/local/listingFilterMatch.ts"
    ];
    for (const rel of mustExist) {
      expect(existsSync(resolve(root, rel)), `缺失 ${rel}`).toBe(true);
    }
  });
});

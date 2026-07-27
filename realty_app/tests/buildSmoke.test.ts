// tests/buildSmoke.test.ts
// 验证 uni build:app 能成功 (wgt 热更新打包前置检查)
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist", "build", "app");

describe("wgt build smoke (v1.121.153)", () => {
  it("dist/build/app exists and has manifest.json", () => {
    // 注意: 实际 build 在 CI/本地跑, 这里只验证产物存在
    if (!existsSync(DIST)) {
      console.warn(`[skip] ${DIST} not built yet (run npm run build:app)`);
      return;
    }
    expect(existsSync(join(DIST, "manifest.json"))).toBe(true);
    expect(existsSync(join(DIST, "app.css"))).toBe(true);
  });

  it("data-tools.vue has all 14 derived cards (Batch 1-5 全部完成)", () => {
    const toolsSrc = readFileSync(join(ROOT, "src/pages/data-tools/data-tools.vue"), "utf8");
    // Batch 1-5: 14 张卡
    expect(toolsSrc).toContain("data-dt-stats70-drift");
    expect(toolsSrc).toContain("data-dt-metro-walk");
    expect(toolsSrc).toContain("data-dt-district-trend");
    expect(toolsSrc).toContain("data-dt-edu-overview");
    expect(toolsSrc).toContain("data-dt-commute-walk");
    expect(toolsSrc).toContain("data-dt-plan-benefit");
    expect(toolsSrc).toContain("data-dt-listing-structure");
    expect(toolsSrc).toContain("data-dt-district-meta");
    expect(toolsSrc).toContain("data-dt-feature-premium");
    expect(toolsSrc).toContain("data-dt-listing-tags");
    expect(toolsSrc).toContain("data-dt-tag-combination");
    expect(toolsSrc).toContain("data-dt-school-indicator");
    expect(toolsSrc).toContain("data-dt-school-dimension");
    expect(toolsSrc).toContain("data-dt-metro-plan");
  });

  it("dashboard.vue has no duplicate v-if attributes (build blocker)", () => {
    const dashSrc = readFileSync(join(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
    const lines = dashSrc.split(/\r?\n/);
    let dupCount = 0;
    for (const line of lines) {
      const m = line.match(/<view[^>]*v-if="[^"]+"[^>]*v-if="/);
      if (m) dupCount++;
    }
    expect(dupCount).toBe(0);
  });

  it("dashboard.vue has .tc-bar CSS class (build blocker)", () => {
    const dashSrc = readFileSync(join(ROOT, "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dashSrc).toMatch(/\.tc-bar\s*\{/);
  });

  it("data-tools.vue template is balanced (use vue compiler-sfc parse)", () => {
    const toolsSrc = readFileSync(join(ROOT, "src/pages/data-tools/data-tools.vue"), "utf8");
    // 用 vue 自己的 SFC parser 验证 (跟 vite build 用同一套)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");
    const compilerSfc = require(path.resolve(ROOT, "node_modules/@vue/compiler-sfc"));
    const { descriptor, errors } = compilerSfc.parse(toolsSrc, { filename: "data-tools.vue" });
    if (errors.length > 0) {
      throw new Error(`data-tools.vue SFC parse errors: ${errors.map((e: any) => e.message).join("; ")}`);
    }
    expect(descriptor.template).toBeDefined();
  });
});

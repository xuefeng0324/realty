import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const readPage = (name: string) => readFileSync(resolve(ROOT, `src/pages/${name}/${name}.vue`), "utf8");

describe("secondary page design contracts", () => {
  it("学校页提供搜索引导、结果计数和主题变量控件", () => {
    const page = readPage("school");
    expect(page).toContain("EDUCATION SEARCH");
    expect(page).toContain("result-count");
    expect(page).toContain("从学校名称开始查询");
    expect(page).toContain("var(--color-surface-raised)");
    expect(page).toContain("data-education-overview");
    expect(page).toContain("官方教育事业统计");
  });

  it("设置页宽屏双列且窄屏回落单列", () => {
    const page = readPage("settings");
    expect(page).toContain("settings-grid");
    expect(page).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(page).toMatch(/@media \(max-width: 760px\)[\s\S]*grid-template-columns: 1fr/);
  });

  it("地图控制区分离城市、图层与当前模式且保留原控制函数", () => {
    const page = readPage("map-view");
    expect(page).toContain("city-segment");
    expect(page).toContain("图层模式");
    expect(page).toContain("当前：{{ modeLabel }}");
    expect(page).toContain('@click="toggleType"');
    expect(page).toContain('@click="setMapMode(item.key)"');
    expect(page).toContain('@click="zoomToCity(2)"');
    expect(page).toContain('@updated="onMapUpdated"');
    expect(page).toContain('@error="onMapError"');
    expect(page).toContain('data-map-retry @click="retryMap"');
    expect(page).toContain("底图加载较慢");
  });

  it("学校查询进入独立详情页并明确模型数据边界", () => {
    const search = readPage("school");
    const detail = readFileSync(resolve(ROOT, "src/pages/school-detail/school-detail.vue"), "utf8");
    expect(search).toContain("/pages/school-detail/school-detail?id=${id}");
    expect(detail).toContain("getSchoolFutureScore");
    expect(detail).toContain("不代表教育主管部门排名");
    expect(detail).toContain("当地教育主管部门当年公告");
    expect(detail).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
  });
});

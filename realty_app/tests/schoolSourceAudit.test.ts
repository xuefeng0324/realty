import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const audit = JSON.parse(readFileSync(resolve(__dirname, "../static/school_source_audit.json"), "utf8"));

describe("school official source audit", () => {
  it("只登记深圳政府开放数据平台的HTTPS详情页", () => {
    expect(audit.source_domain).toBe("opendata.sz.gov.cn");
    expect(audit.datasets.length).toBeGreaterThanOrEqual(4);
    for (const dataset of audit.datasets) {
      expect(dataset.detail_url).toMatch(/^https:\/\/opendata\.sz\.gov\.cn\//);
      expect(dataset.publisher).toMatch(/人民政府|教育局/);
      expect(dataset.record_total).toBeGreaterThan(0);
    }
  });

  it("过期或元数据冲突的数据集不得自动导入", () => {
    const mismatch = audit.datasets.find((dataset: any) => dataset.issues.includes("title_abstract_mismatch"));
    const stale = audit.datasets.filter((dataset: any) => dataset.issues.includes("stale_over_730_days"));
    expect(mismatch?.eligible_for_import).toBe(false);
    expect(stale.length).toBeGreaterThanOrEqual(3);
    expect(audit.datasets.every((dataset: any) => dataset.eligible_for_import === false)).toBe(true);
  });
});

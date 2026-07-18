import { describe, expect, it } from "vitest";
import { normalizeDataMode } from "../src/local/dataMode";
import { listingSourceKindLabel, normalizeListingSourceKind } from "../src/local/listingSource";

describe("data mode normalization", () => {
  it("空 storage 和历史 http 值都安全回退到 seed", () => {
    expect(normalizeDataMode("")).toBe("seed");
    expect(normalizeDataMode(null)).toBe("seed");
    expect(normalizeDataMode("http")).toBe("seed");
  });

  it("只接受已实现的 csv-url 模式", () => {
    expect(normalizeDataMode("csv-url")).toBe("csv-url");
  });
});

describe("listing source trust", () => {
  it("识别显式等级和旧版派生来源名", () => {
    expect(normalizeListingSourceKind("REAL", "任意来源")).toBe("REAL");
    expect(normalizeListingSourceKind("", "深圳住建局公开成交")).toBe("DERIVED");
    expect(normalizeListingSourceKind(undefined, "深圳安居客")).toBe("REAL");
  });

  it("提供用户可读标签", () => {
    expect(listingSourceKindLabel("DERIVED")).toBe("派生样本");
    expect(listingSourceKindLabel("REAL")).toBe("真实挂牌");
  });
});

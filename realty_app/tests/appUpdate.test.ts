import { describe, expect, it } from "vitest";
import {
  rewriteWgtUrlToBase,
  selectWgtBase,
  buildWgtUrlCandidates,
  buildUpdatePrompt,
  supportsAppUpdateRuntime
} from "../src/utils/appUpdate";

describe("appUpdate.rewriteWgtUrlToBase", () => {
  it("把 jsDelivr 清单里的 wgt URL 改写到命中的 update 根", () => {
    const src =
      "https://cdn.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/93/app.wgt";
    const base =
      "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/";
    expect(rewriteWgtUrlToBase(src, base)).toBe(
      "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/93/app.wgt"
    );
  });

  it("base 无尾斜杠也能拼", () => {
    const src =
      "https://cdn.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/120/app.wgt";
    const base =
      "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update";
    expect(rewriteWgtUrlToBase(src, base)).toBe(
      "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/120/app.wgt"
    );
  });

  it("无法识别路径时回退为 base + 文件名", () => {
    expect(
      rewriteWgtUrlToBase(
        "https://example.com/foo.wgt",
        "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/"
      )
    ).toBe(
      "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/foo.wgt"
    );
  });
});

describe("appUpdate.selectWgtBase (v1.121.5)", () => {
  it("manifest 命中 raw 时 wgtBase 保留 raw（可下二进制）", () => {
    const raw =
      "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/";
    const jsd =
      "https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/";
    expect(selectWgtBase(raw, [raw, jsd])).toBe(raw);
  });

  it("manifest 命中 jsDelivr 时若候选有 raw 则改走 raw", () => {
    const raw =
      "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/";
    const jsd =
      "https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/";
    expect(selectWgtBase(jsd, [jsd, raw])).toBe(raw);
  });

  it("没有 raw 时回退 manifestBase", () => {
    const jsd =
      "https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/";
    expect(selectWgtBase(jsd, [jsd])).toBe(jsd);
  });
});

describe("appUpdate.buildWgtUrlCandidates (v1.121.5)", () => {
  it("raw / github raw 优先于 jsDelivr", () => {
    const src =
      "https://cdn.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/93/app.wgt";
    const cands = buildWgtUrlCandidates(src);
    expect(cands[0]).toContain("raw.githubusercontent.com");
    expect(cands[1]).toContain("github.com/xuefeng0324/realty/raw/");
    expect(cands.some((u) => u.includes("gcore.jsdelivr.net"))).toBe(true);
    expect(new Set(cands).size).toBe(cands.length);
  });

  it("从 gcore 出发仍把 raw 放第一", () => {
    const src =
      "https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/120/app.wgt";
    const cands = buildWgtUrlCandidates(src);
    expect(cands[0]).toBe(
      "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/120/app.wgt"
    );
  });
});

describe("appUpdate startup prompt", () => {
  it("启动提示包含版本、发布日期和精简后的更新说明", () => {
    const prompt = buildUpdatePrompt({
      versionName: "1.122.0",
      versionCode: "131",
      publishedAt: "2026-07-26T08:00:00Z",
      notes: "  启动时自动检查更新。\n有新版本时显示更新内容。  "
    });
    expect(prompt.title).toBe("发现新版本 v1.122.0");
    expect(prompt.content).toContain("版本号：131");
    expect(prompt.content).toContain("发布时间：2026-07-26T08:00:00Z");
    expect(prompt.content).toContain("启动时自动检查更新。 有新版本时显示更新内容。");
    expect(prompt.confirmText).toBe("立即更新");
    expect(prompt.cancelText).toBe("稍后");
  });

  it("非原生运行时不会启用启动热更新", () => {
    expect(supportsAppUpdateRuntime()).toBe(false);
  });
});

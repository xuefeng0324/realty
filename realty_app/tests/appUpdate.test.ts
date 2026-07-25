import { describe, expect, it } from "vitest";
import {
  rewriteWgtUrlToBase,
  selectWgtBase,
  buildWgtUrlCandidates
} from "../src/utils/appUpdate";

describe("appUpdate.rewriteWgtUrlToBase", () => {
  it("把 jsDelivr 清单里的 wgt URL 改写到命中的 update 根", () => {
    const src =
      "https://cdn.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/93/app.wgt";
    const base =
      "https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/";
    expect(rewriteWgtUrlToBase(src, base)).toBe(
      "https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/93/app.wgt"
    );
  });

  it("base 无尾斜杠也能拼", () => {
    const src =
      "https://cdn.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/120/app.wgt";
    const base =
      "https://fastly.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update";
    expect(rewriteWgtUrlToBase(src, base)).toBe(
      "https://fastly.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/120/app.wgt"
    );
  });

  it("无法识别路径时回退为 base + 文件名", () => {
    expect(
      rewriteWgtUrlToBase(
        "https://example.com/foo.wgt",
        "https://gcore.jsdelivr.net/gh/x/y@main/realty_app/static/update/"
      )
    ).toBe(
      "https://gcore.jsdelivr.net/gh/x/y@main/realty_app/static/update/foo.wgt"
    );
  });
});

describe("appUpdate.selectWgtBase (v1.121.2)", () => {
  it("manifest 命中 jsDelivr 时 wgtBase = manifestBase", () => {
    const mb =
      "https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/";
    expect(selectWgtBase(mb, [mb])).toBe(mb);
  });

  it("manifest 命中 raw 时 wgtBase 强制走 jsDelivr 镜像", () => {
    const raw =
      "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/";
    const jsd =
      "https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/";
    expect(selectWgtBase(raw, [raw, jsd])).toBe(jsd);
  });

  it("所有 base 都是 raw 时回退 manifestBase", () => {
    const raw =
      "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/";
    expect(selectWgtBase(raw, [raw])).toBe(raw);
  });
});

describe("appUpdate.buildWgtUrlCandidates (v1.121.4)", () => {
  it("固定优先 gcore，再 fastly/cdn/b-cdn（不把 cdn 原 URL 硬放第一）", () => {
    const src =
      "https://cdn.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/93/app.wgt";
    const cands = buildWgtUrlCandidates(src);
    expect(cands[0]).toBe(
      "https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/93/app.wgt"
    );
    expect(cands).toContain(
      "https://fastly.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/93/app.wgt"
    );
    expect(cands).toContain(
      "https://cdn.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/93/app.wgt"
    );
    expect(cands).toContain(
      "https://jsdelivr.b-cdn.net/gh/xuefeng0324/realty@main/realty_app/static/update/93/app.wgt"
    );
    // raw 不会出现在候选里（不能下二进制）
    expect(cands.every((u) => !u.includes("raw.githubusercontent.com"))).toBe(true);
    // 不重复
    expect(new Set(cands).size).toBe(cands.length);
  });

  it("从 gcore 出发时 gcore 仍第一，其它镜像列后", () => {
    const src =
      "https://gcore.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/120/app.wgt";
    const cands = buildWgtUrlCandidates(src);
    expect(cands[0]).toBe(src);
    expect(cands).toContain(
      "https://cdn.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/120/app.wgt"
    );
  });
});

import { describe, expect, it } from "vitest";
import { rewriteWgtUrlToBase } from "../src/utils/appUpdate";

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

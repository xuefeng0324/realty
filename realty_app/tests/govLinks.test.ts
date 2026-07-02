import { describe, expect, it } from "vitest";
import { GOV_WEB_LINKS, normalizeGovUrl } from "../src/config/govLinks";

describe("govLinks", () => {
  it("预售公示使用 index.html hash 路由", () => {
    expect(GOV_WEB_LINKS.szPresale.url).toContain("szfdccommon/index.html#/publicInfo");
    expect(GOV_WEB_LINKS.szPresale.url).toContain("ysxk");
  });

  it("normalizeGovUrl 补全缺失的 index.html", () => {
    const raw = "https://fdc.zjj.sz.gov.cn/szfdccommon/#/publicInfo/main?params=ysxk";
    expect(normalizeGovUrl(raw)).toBe(
      "https://fdc.zjj.sz.gov.cn/szfdccommon/index.html#/publicInfo/main?params=ysxk"
    );
  });

  it("住建局登录指向 zjlogin 页面", () => {
    expect(GOV_WEB_LINKS.szPortal.url).toContain("gkyjzj/index_zjlogin.html");
  });

  it("成交走势页为静态 html", () => {
    expect(GOV_WEB_LINKS.szWangqianTrend.url).toContain("housePriceTrendInfo");
  });
});

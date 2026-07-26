import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildHousingAppDeepLink,
  buildHousingAppDeepLinks,
  buildHttpsPackageIntent,
  extractKeHouseCode,
  housingAppHint,
  openExternalUrl,
  openHousingSourceUrl,
  rewriteLianjiaToKe
} from "../src/utils/openExternal";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("openExternalUrl", () => {
  it("空地址不执行任何平台调用", () => {
    const showToast = vi.fn();
    vi.stubGlobal("uni", { showToast });
    openExternalUrl("");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("H5 使用 noopener 新窗口打开", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    vi.stubGlobal("uni", { showToast: vi.fn() });
    openExternalUrl("https://example.test/path");
    expect(open).toHaveBeenCalledWith("https://example.test/path", "_blank", "noopener,noreferrer");
  });

  it("小程序环境复制链接并在成功后提示", () => {
    const showToast = vi.fn();
    const setClipboardData = vi.fn(({ success }) => success());
    vi.stubGlobal("uni", { showToast, setClipboardData });
    openExternalUrl("https://example.test/path");
    expect(setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: "https://example.test/path" }));
    expect(showToast).toHaveBeenCalledWith({ title: "链接已复制，请在浏览器打开", icon: "none" });
  });

  it("小程序剪贴板失败时给出明确提示", () => {
    const showToast = vi.fn();
    const setClipboardData = vi.fn(({ fail }) => fail());
    vi.stubGlobal("uni", { showToast, setClipboardData });
    openExternalUrl("https://example.test/path");
    expect(showToast).toHaveBeenCalledWith({ title: "复制失败，请手动复制链接", icon: "none" });
  });

  it("无浏览器和剪贴板能力时回退为明确提示", () => {
    const showToast = vi.fn();
    vi.stubGlobal("uni", { showToast });
    openExternalUrl("https://example.test/path");
    expect(showToast).toHaveBeenCalledWith({ title: "请复制链接到浏览器打开", icon: "none" });
  });

  it("App 端优先交给系统浏览器", () => {
    const openURL = vi.fn();
    vi.stubGlobal("plus", { runtime: { openURL } });
    vi.stubGlobal("window", { open: vi.fn() });
    openExternalUrl("https://example.test/path");
    expect(openURL).toHaveBeenCalledWith("https://example.test/path");
  });
});

describe("housing deep link", () => {
  it("ke.com 搜索页 → 优先 https+贝壳包名 Intent（竞品惯例）", () => {
    const url = "https://sz.ke.com/ershoufang/rs%E6%B5%8B/";
    expect(housingAppHint(url)?.label).toBe("去贝壳查看");
    expect(extractKeHouseCode(url)).toBeNull();
    expect(buildHousingAppDeepLink(url)).toBe(
      "intent://sz.ke.com/ershoufang/rs%E6%B5%8B/#Intent;scheme=https;package=com.lianjia.beike;end"
    );
    expect(buildHousingAppDeepLinks(url)).toContain(
      `lianjiabeike://web/main?url=${encodeURIComponent(url)}`
    );
    expect(buildHousingAppDeepLinks(url).some((l) => l.includes("browser_fallback"))).toBe(false);
  });

  it("详情页：https 包名 Intent 优先，其次原生 house/detail", () => {
    const url = "https://sz.ke.com/ershoufang/105123170923.html";
    expect(extractKeHouseCode(url)).toBe("105123170923");
    const links = buildHousingAppDeepLinks(url);
    expect(links[0]).toBe(
      "intent://sz.ke.com/ershoufang/105123170923.html#Intent;scheme=https;package=com.lianjia.beike;end"
    );
    expect(links).toContain("lianjiabeike://house/detail?houseCode=105123170923");
    expect(links).toContain(`lianjiabeike://web/main?url=${encodeURIComponent(url)}`);
  });

  it("lianjia.com 改写为 ke.com 再进贝壳", () => {
    const url = "https://sz.lianjia.com/ershoufang/105123170923.html";
    const ke = rewriteLianjiaToKe(url);
    expect(ke).toBe("https://sz.ke.com/ershoufang/105123170923.html");
    expect(buildHousingAppDeepLink(url)).toContain("sz.ke.com");
    expect(buildHousingAppDeepLink(url)).toContain("package=com.lianjia.beike");
  });

  it("anjuke → 安居客 deep link", () => {
    const url = "https://sz.anjuke.com/prop/view/A123/";
    expect(housingAppHint(url)?.label).toBe("去安居客查看");
    expect(buildHousingAppDeepLink(url)).toContain("package=com.anjuke.android.app");
  });

  it("未知域名不造 deep link", () => {
    expect(buildHousingAppDeepLink("https://example.test/x")).toBeNull();
    expect(housingAppHint("https://example.test/x")?.label).toBe("打开来源页");
  });

  it("App 端默认直接 deep link，不先弹 ActionSheet", () => {
    const openURL = vi.fn();
    const showActionSheet = vi.fn();
    const showToast = vi.fn();
    vi.stubGlobal("plus", {
      runtime: {
        openURL,
        isApplicationExist: () => true
      }
    });
    vi.stubGlobal("uni", { showToast, showActionSheet, setClipboardData: vi.fn() });
    const url = "https://gz.ke.com/ershoufang/rsFoo/";
    openHousingSourceUrl(url);
    expect(showActionSheet).not.toHaveBeenCalled();
    expect(openURL.mock.calls[0][0]).toBe(
      "intent://gz.ke.com/ershoufang/rsFoo/#Intent;scheme=https;package=com.lianjia.beike;end"
    );
  });

  it("未检测到 App 仍先尝试 deep link（不短路浏览器）", () => {
    const openURL = vi.fn();
    const showActionSheet = vi.fn();
    const showToast = vi.fn();
    vi.stubGlobal("plus", {
      runtime: {
        openURL,
        isApplicationExist: () => false
      }
    });
    vi.stubGlobal("uni", { showToast, showActionSheet, setClipboardData: vi.fn() });
    const url = "https://gz.ke.com/ershoufang/rsFoo/";
    openHousingSourceUrl(url);
    expect(openURL.mock.calls[0][0]).toContain("package=com.lianjia.beike");
    expect(openURL.mock.calls[0][0]).not.toBe(url);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("未检测到贝壳找房") })
    );
  });

  it("mode=sheet 时弹出选择后再 deep link", () => {
    const openURL = vi.fn();
    const showActionSheet = vi.fn(({ success }) => success({ tapIndex: 0 }));
    vi.stubGlobal("plus", {
      runtime: { openURL, isApplicationExist: () => true }
    });
    vi.stubGlobal("uni", { showToast: vi.fn(), showActionSheet, setClipboardData: vi.fn() });
    const url = "https://gz.ke.com/ershoufang/rsFoo/";
    openHousingSourceUrl(url, { mode: "sheet" });
    expect(showActionSheet).toHaveBeenCalled();
    expect(openURL.mock.calls[0][0]).toContain("package=com.lianjia.beike");
  });

  it("无 plus 时走 openExternalUrl（H5 新窗口）", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    vi.stubGlobal("uni", { showToast: vi.fn() });
    openHousingSourceUrl("https://sz.ke.com/ershoufang/x/");
    expect(open).toHaveBeenCalled();
  });

  it("buildHttpsPackageIntent 生成显式包名 Intent", () => {
    expect(buildHttpsPackageIntent("https://sz.ke.com/ershoufang/1.html", "com.lianjia.beike")).toBe(
      "intent://sz.ke.com/ershoufang/1.html#Intent;scheme=https;package=com.lianjia.beike;end"
    );
  });
});

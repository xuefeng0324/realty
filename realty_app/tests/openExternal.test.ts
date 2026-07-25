import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildHousingAppDeepLink,
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
  it("ke.com → 贝壳 deep link", () => {
    const url = "https://sz.ke.com/ershoufang/rs%E6%B5%8B/";
    expect(housingAppHint(url)?.label).toBe("打开贝壳找房");
    expect(buildHousingAppDeepLink(url)).toBe(
      `lianjiabeike://web/main?url=${encodeURIComponent(url)}`
    );
  });

  it("lianjia.com 改写为 ke.com 再进贝壳", () => {
    const url = "https://sz.lianjia.com/ershoufang/105123170923.html";
    const ke = rewriteLianjiaToKe(url);
    expect(ke).toBe("https://sz.ke.com/ershoufang/105123170923.html");
    expect(buildHousingAppDeepLink(url)).toBe(
      `lianjiabeike://web/main?url=${encodeURIComponent(ke)}`
    );
  });

  it("anjuke → 安居客 deep link", () => {
    const url = "https://sz.anjuke.com/prop/view/A123/";
    expect(housingAppHint(url)?.label).toBe("打开安居客");
    expect(buildHousingAppDeepLink(url)).toContain("openanjuke://");
    expect(buildHousingAppDeepLink(url)).toContain(encodeURIComponent(url));
  });

  it("未知域名不造 deep link", () => {
    expect(buildHousingAppDeepLink("https://example.test/x")).toBeNull();
    expect(housingAppHint("https://example.test/x")?.label).toBe("打开来源页");
  });

  it("App 端优先 openURL deep link，失败回退 https", () => {
    const openURL = vi.fn((_url: string, err?: (e?: unknown) => void) => {
      if (err && String(_url).startsWith("lianjiabeike://")) err(new Error("no app"));
    });
    const showToast = vi.fn();
    vi.stubGlobal("plus", { runtime: { openURL } });
    vi.stubGlobal("uni", { showToast, setClipboardData: vi.fn() });
    const url = "https://gz.ke.com/ershoufang/rsFoo/";
    openHousingSourceUrl(url);
    expect(openURL.mock.calls[0][0]).toBe(`lianjiabeike://web/main?url=${encodeURIComponent(url)}`);
    expect(openURL.mock.calls[1][0]).toBe(url);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("未安装贝壳找房") })
    );
  });

  it("无 plus 时走 openExternalUrl（H5 新窗口）", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    vi.stubGlobal("uni", { showToast: vi.fn() });
    openHousingSourceUrl("https://sz.ke.com/ershoufang/x/");
    expect(open).toHaveBeenCalled();
  });
});

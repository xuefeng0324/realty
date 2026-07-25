import { afterEach, describe, expect, it, vi } from "vitest";
import { openExternalUrl } from "../src/utils/openExternal";

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

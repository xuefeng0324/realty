/**
 * 在系统浏览器 / 新窗口打开外链（政府站登录、SSL、跳转更稳定）。
 */
export function openExternalUrl(url: string): void {
  if (!url) return;

  const showFallback = () => {
    uni.showToast({ title: "请复制链接到浏览器打开", icon: "none" });
  };

  if (typeof plus !== "undefined" && (plus as { runtime?: { openURL?: (url: string) => void } }).runtime?.openURL) {
    (plus as { runtime: { openURL: (url: string) => void } }).runtime.openURL(url);
    return;
  }

  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  if (typeof uni !== "undefined" && typeof uni.setClipboardData === "function") {
    uni.setClipboardData({
      data: url,
      success: () => uni.showToast({ title: "链接已复制，请在浏览器打开", icon: "none" }),
      fail: () => uni.showToast({ title: "复制失败，请手动复制链接", icon: "none" })
    });
    return;
  }

  showFallback();
}

type PlusRuntime = {
  openURL: (url: string, errorCB?: (err?: unknown) => void) => void;
};

function getPlusRuntime(): PlusRuntime | null {
  if (typeof plus === "undefined") return null;
  const rt = (plus as { runtime?: PlusRuntime }).runtime;
  return rt?.openURL ? rt : null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** 链家 PC/M 站与贝壳同源库存，优先进贝壳 App 可复用登录态 */
export function rewriteLianjiaToKe(url: string): string {
  return url
    .replace(/([a-z0-9-]+)\.lianjia\.com/gi, "$1.ke.com")
    .replace(/\/\/lianjia\.com/gi, "//ke.com");
}

export type HousingAppHint = {
  kind: "beike" | "anjuke" | "generic";
  /** 按钮文案 */
  label: string;
};

/**
 * 根据 source_url 推断「打开某某 App」按钮文案。
 */
export function housingAppHint(url: string): HousingAppHint | null {
  if (!url) return null;
  const host = hostOf(url);
  if (!host) return null;
  if (host === "ke.com" || host.endsWith(".ke.com") || host === "lianjia.com" || host.endsWith(".lianjia.com")) {
    return { kind: "beike", label: "打开贝壳找房" };
  }
  if (host.includes("anjuke.com")) {
    return { kind: "anjuke", label: "打开安居客" };
  }
  return { kind: "generic", label: "打开来源页" };
}

/**
 * 构造优先唤起房产 App 的 deep link（在 App 内 WebView 打开原 URL，保留登录态）。
 * 未识别域名时返回 null。
 */
export function buildHousingAppDeepLink(url: string): string | null {
  if (!url) return null;
  const host = hostOf(url);
  if (!host) return null;

  if (host === "ke.com" || host.endsWith(".ke.com") || host === "lianjia.com" || host.endsWith(".lianjia.com")) {
    const pageUrl = host.includes("lianjia.com") ? rewriteLianjiaToKe(url) : url;
    return `lianjiabeike://web/main?url=${encodeURIComponent(pageUrl)}`;
  }

  if (host.includes("anjuke.com")) {
    return `openanjuke://app.anjuke.com/m/page/common/webview?url=${encodeURIComponent(url)}`;
  }

  return null;
}

function copyUrlFallback(url: string, toast: string): void {
  if (typeof uni !== "undefined" && typeof uni.setClipboardData === "function") {
    uni.setClipboardData({
      data: url,
      success: () => uni.showToast({ title: toast, icon: "none" }),
      fail: () => uni.showToast({ title: "复制失败，请手动复制链接", icon: "none" })
    });
    return;
  }
  uni.showToast({ title: "请复制链接到浏览器打开", icon: "none" });
}

/**
 * 房源「查看参考/源链接」：App 端优先跳对应房产 App；失败再系统浏览器；再失败才复制。
 * H5 / 小程序走 openExternalUrl。
 */
export function openHousingSourceUrl(url: string): void {
  if (!url) return;

  const runtime = getPlusRuntime();
  const deep = buildHousingAppDeepLink(url);
  const hint = housingAppHint(url);

  if (runtime && deep) {
    runtime.openURL(deep, () => {
      runtime.openURL(url, () => {
        const name = hint?.kind === "beike" ? "贝壳找房" : hint?.kind === "anjuke" ? "安居客" : "对应 App";
        copyUrlFallback(url, `未安装${name}，链接已复制`);
      });
      if (typeof uni !== "undefined" && typeof uni.showToast === "function") {
        const name = hint?.kind === "beike" ? "贝壳找房" : hint?.kind === "anjuke" ? "安居客" : "对应 App";
        uni.showToast({ title: `未安装${name}，已用浏览器打开`, icon: "none" });
      }
    });
    return;
  }

  openExternalUrl(url);
}

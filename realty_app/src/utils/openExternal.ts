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
  isApplicationExist?: (opts: { pname?: string; action?: string }) => boolean;
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
  androidPackage?: string;
};

/**
 * 根据 source_url 推断「打开某某 App」按钮文案。
 */
export function housingAppHint(url: string): HousingAppHint | null {
  if (!url) return null;
  const host = hostOf(url);
  if (!host) return null;
  if (host === "ke.com" || host.endsWith(".ke.com") || host === "lianjia.com" || host.endsWith(".lianjia.com")) {
    return { kind: "beike", label: "打开贝壳找房", androidPackage: "com.lianjia.beike" };
  }
  if (host.includes("anjuke.com")) {
    return { kind: "anjuke", label: "打开安居客", androidPackage: "com.anjuke.android.app" };
  }
  return { kind: "generic", label: "打开来源页" };
}

/**
 * 构造优先唤起房产 App 的 deep link 候选（scheme + Android Intent）。
 * 未识别域名时返回空数组。
 */
export function buildHousingAppDeepLinks(url: string): string[] {
  if (!url) return [];
  const host = hostOf(url);
  if (!host) return [];
  const out: string[] = [];

  if (host === "ke.com" || host.endsWith(".ke.com") || host === "lianjia.com" || host.endsWith(".lianjia.com")) {
    const pageUrl = host.includes("lianjia.com") ? rewriteLianjiaToKe(url) : url;
    const enc = encodeURIComponent(pageUrl);
    out.push(`lianjiabeike://web/main?url=${enc}`);
    out.push(`lianjia://web/main?url=${enc}`);
    // Android 显式指定包名，避免只落到浏览器
    out.push(
      `intent://web/main?url=${enc}#Intent;scheme=lianjiabeike;package=com.lianjia.beike;S.browser_fallback_url=${enc};end`
    );
    return out;
  }

  if (host.includes("anjuke.com")) {
    const enc = encodeURIComponent(url);
    out.push(`openanjuke://app.anjuke.com/m/page/common/webview?url=${enc}`);
    out.push(`anjuke://app.anjuke.com/m/page/common/webview?url=${enc}`);
    out.push(
      `intent://app.anjuke.com/m/page/common/webview?url=${enc}#Intent;scheme=openanjuke;package=com.anjuke.android.app;S.browser_fallback_url=${enc};end`
    );
    return out;
  }

  return out;
}

/** @deprecated 兼容旧调用：返回第一个 deep link */
export function buildHousingAppDeepLink(url: string): string | null {
  return buildHousingAppDeepLinks(url)[0] ?? null;
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

function tryOpenDeepLinks(
  runtime: PlusRuntime,
  links: string[],
  httpsUrl: string,
  appName: string,
  onAllFailed?: () => void
): void {
  const pkg = housingAppHint(httpsUrl)?.androidPackage;
  if (pkg && typeof runtime.isApplicationExist === "function") {
    try {
      const installed = runtime.isApplicationExist({ pname: pkg });
      if (!installed) {
        runtime.openURL(httpsUrl, () => {
          copyUrlFallback(httpsUrl, `未安装${appName}，链接已复制`);
        });
        uni.showToast({ title: `未检测到${appName}，已用浏览器打开`, icon: "none" });
        return;
      }
    } catch {
      /* ignore detection errors, still try deep links */
    }
  }

  let i = 0;
  const tryNext = () => {
    if (i >= links.length) {
      runtime.openURL(httpsUrl, () => {
        copyUrlFallback(httpsUrl, `未能打开${appName}，链接已复制`);
      });
      onAllFailed?.();
      return;
    }
    const link = links[i++]!;
    runtime.openURL(link, () => tryNext());
  };
  tryNext();
}

/**
 * 房源「查看参考/源链接」：App 端弹出选择（打开 App / 浏览器 / 复制），
 * 避免静默落到浏览器让用户以为「没跳 App」。
 * H5 / 小程序走 openExternalUrl。
 */
export function openHousingSourceUrl(url: string): void {
  if (!url) return;

  const runtime = getPlusRuntime();
  const links = buildHousingAppDeepLinks(url);
  const hint = housingAppHint(url);
  const appName =
    hint?.kind === "beike" ? "贝壳找房" : hint?.kind === "anjuke" ? "安居客" : "对应 App";

  if (!runtime) {
    openExternalUrl(url);
    return;
  }

  const itemList =
    links.length > 0
      ? [`打开${appName}`, "用系统浏览器打开", "复制链接"]
      : ["用系统浏览器打开", "复制链接"];

  if (typeof uni !== "undefined" && typeof uni.showActionSheet === "function") {
    uni.showActionSheet({
      itemList,
      success: (res) => {
        const label = itemList[res.tapIndex] ?? "";
        if (label.startsWith("打开") && links.length > 0) {
          tryOpenDeepLinks(runtime, links, url, appName, () => {
            uni.showToast({ title: `未能唤起${appName}`, icon: "none" });
          });
          return;
        }
        if (label.includes("浏览器")) {
          runtime.openURL(url, () => copyUrlFallback(url, "链接已复制"));
          return;
        }
        if (label.includes("复制")) {
          copyUrlFallback(url, "链接已复制");
        }
      },
      fail: () => {
        // 用户取消或端能力异常：仍尝试唤起 App
        if (links.length > 0) tryOpenDeepLinks(runtime, links, url, appName);
        else runtime.openURL(url);
      }
    });
    return;
  }

  if (links.length > 0) {
    tryOpenDeepLinks(runtime, links, url, appName);
    return;
  }
  openExternalUrl(url);
}

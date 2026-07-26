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
  launchApplication?: (
    opts: { pname?: string; action?: string },
    successCB?: () => void,
    errorCB?: (err?: unknown) => void
  ) => void;
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

/** 从贝壳/链家详情 URL 解析 houseCode（搜索页 rs 无码则返回 null） */
export function extractKeHouseCode(url: string): string | null {
  if (!url) return null;
  const fromPath = url.match(/\/ershoufang\/(\d{8,})\.html/i);
  if (fromPath?.[1]) return fromPath[1];
  const fromQuery = url.match(/[?&#]house(?:Code|Id|code|id)=(\d{8,})/i);
  return fromQuery?.[1] ?? null;
}

export type HousingAppHint = {
  kind: "beike" | "anjuke" | "generic";
  /** 按钮文案 */
  label: string;
  androidPackages: string[];
};

/**
 * 根据 source_url 推断「打开某某 App」按钮文案。
 */
export function housingAppHint(url: string): HousingAppHint | null {
  if (!url) return null;
  const host = hostOf(url);
  if (!host) return null;
  if (host === "ke.com" || host.endsWith(".ke.com") || host === "lianjia.com" || host.endsWith(".lianjia.com")) {
    return {
      kind: "beike",
      label: "去贝壳查看",
      androidPackages: ["com.lianjia.beike", "com.homelink.android"]
    };
  }
  if (host.includes("anjuke.com")) {
    return {
      kind: "anjuke",
      label: "去安居客查看",
      androidPackages: ["com.anjuke.android.app"]
    };
  }
  return { kind: "generic", label: "打开来源页", androidPackages: [] };
}

function uniqueLinks(links: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of links) {
    if (!l || seen.has(l)) continue;
    seen.add(l);
    out.push(l);
  }
  return out;
}

/**
 * 竞品惯例（Android）：VIEW https URL + setPackage(贝壳/链家)
 * → `intent://host/path#Intent;scheme=https;package=com.lianjia.beike;end`
 * 比自定义 scheme 更稳：贝壳对 ke.com 有 App Links / intent-filter。
 */
export function buildHttpsPackageIntent(url: string, androidPackage: string): string | null {
  if (!url || !androidPackage) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const scheme = u.protocol.replace(":", "");
    const path = `${u.pathname || "/"}${u.search || ""}${u.hash || ""}`;
    return `intent://${u.host}${path}#Intent;scheme=${scheme};package=${androidPackage};end`;
  } catch {
    return null;
  }
}

/**
 * 构造优先唤起房产 App 的 deep link 候选。
 * 顺序对齐贝壳/链家生态常见做法：
 * 1) https + 指定包名（App Links / 显式包）
 * 2) 原生详情 scheme（有 houseCode 时）
 * 3) App 内 WebView scheme
 * Intent 不带 browser_fallback，避免静默掉进浏览器。
 */
export function buildHousingAppDeepLinks(url: string): string[] {
  if (!url) return [];
  const host = hostOf(url);
  if (!host) return [];
  const out: string[] = [];

  if (host === "ke.com" || host.endsWith(".ke.com") || host === "lianjia.com" || host.endsWith(".lianjia.com")) {
    const pageUrl = host.includes("lianjia.com") ? rewriteLianjiaToKe(url) : url;
    const enc = encodeURIComponent(pageUrl);
    const houseCode = extractKeHouseCode(pageUrl);

    // ① 竞品同款：把 https 页直接交给贝壳 / 链家包处理
    const beikeHttps = buildHttpsPackageIntent(pageUrl, "com.lianjia.beike");
    const lianjiaHttps = buildHttpsPackageIntent(pageUrl, "com.homelink.android");
    if (beikeHttps) out.push(beikeHttps);
    if (lianjiaHttps) out.push(lianjiaHttps);

    if (houseCode) {
      // ② 原生二手详情
      out.push(`lianjiabeike://house/detail?houseCode=${houseCode}`);
      out.push(`lianjiabeike://ershoufang/detail?houseCode=${houseCode}`);
      out.push(`lianjia://house/detail?houseCode=${houseCode}`);
      out.push(
        `intent://house/detail?houseCode=${houseCode}#Intent;scheme=lianjiabeike;package=com.lianjia.beike;end`
      );
    }

    // ③ App 内 WebView（搜索 rs / 任意 ke 页兜底；渗透测试公开可 am start）
    out.push(`lianjiabeike://web/main?url=${enc}`);
    out.push(`lianjia://web/main?url=${enc}`);
    out.push(
      `intent://web/main?url=${enc}#Intent;scheme=lianjiabeike;package=com.lianjia.beike;end`
    );
    return uniqueLinks(out);
  }

  if (host.includes("anjuke.com")) {
    const enc = encodeURIComponent(url);
    const anjukeHttps = buildHttpsPackageIntent(url, "com.anjuke.android.app");
    if (anjukeHttps) out.push(anjukeHttps);
    out.push(`openanjuke://app.anjuke.com/m/page/common/webview?url=${enc}`);
    out.push(`anjuke://app.anjuke.com/m/page/common/webview?url=${enc}`);
    out.push(
      `intent://app.anjuke.com/m/page/common/webview?url=${enc}#Intent;scheme=openanjuke;package=com.anjuke.android.app;end`
    );
    return uniqueLinks(out);
  }

  return [];
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

function anyHousingAppInstalled(runtime: PlusRuntime, packages: string[]): boolean | null {
  if (!packages.length || typeof runtime.isApplicationExist !== "function") return null;
  try {
    for (const pname of packages) {
      if (runtime.isApplicationExist({ pname })) return true;
    }
    return false;
  } catch {
    return null;
  }
}

function tryOpenDeepLinks(
  runtime: PlusRuntime,
  links: string[],
  httpsUrl: string,
  appName: string,
  onAllFailed?: () => void
): void {
  let i = 0;
  const tryNext = () => {
    if (i >= links.length) {
      onAllFailed?.();
      return;
    }
    const link = links[i++]!;
    runtime.openURL(link, () => tryNext());
  };
  tryNext();
}

function showFallbackSheet(runtime: PlusRuntime, url: string, appName: string): void {
  if (typeof uni === "undefined" || typeof uni.showActionSheet !== "function") {
    uni.showToast({ title: `未能打开${appName}，请点「复制链接」`, icon: "none" });
    return;
  }
  uni.showActionSheet({
    itemList: ["用系统浏览器打开", "复制链接"],
    success: (res) => {
      if (res.tapIndex === 0) {
        runtime.openURL(url, () => copyUrlFallback(url, "链接已复制"));
        return;
      }
      if (res.tapIndex === 1) copyUrlFallback(url, "链接已复制");
    }
  });
}

export type OpenHousingSourceOptions = {
  /** app=直接唤起（默认）；sheet=先弹出 App/浏览器/复制 */
  mode?: "app" | "sheet";
};

/**
 * 房源「查看参考/源链接」：
 * - App 默认 **直接** 唤起贝壳/链家/安居客（不再先弹「浏览器/复制」）
 * - 全部 deep link 失败后再让用户选浏览器或复制（避免静默复制+开浏览器）
 * - H5 / 小程序走 openExternalUrl
 */
export function openHousingSourceUrl(url: string, opts?: OpenHousingSourceOptions): void {
  if (!url) return;

  const runtime = getPlusRuntime();
  const links = buildHousingAppDeepLinks(url);
  const hint = housingAppHint(url);
  const appName =
    hint?.kind === "beike" ? "贝壳找房" : hint?.kind === "anjuke" ? "安居客" : "对应 App";
  const mode = opts?.mode ?? "app";

  if (!runtime) {
    openExternalUrl(url);
    return;
  }

  if (links.length === 0) {
    openExternalUrl(url);
    return;
  }

  const runApp = () => {
    // 检测仅作提示，**不**短路去浏览器（Android 包可见性常误报未安装）
    const installed = anyHousingAppInstalled(runtime, hint?.androidPackages ?? []);
    if (installed === false) {
      uni.showToast({ title: `未检测到${appName}，可装 App 或选浏览器`, icon: "none", duration: 2200 });
    }
    tryOpenDeepLinks(runtime, links, url, appName, () => {
      showFallbackSheet(runtime, url, appName);
    });
  };

  if (mode === "sheet") {
    const itemList = [`打开${appName}`, "用系统浏览器打开", "复制链接"];
    if (typeof uni.showActionSheet === "function") {
      uni.showActionSheet({
        itemList,
        success: (res) => {
          const label = itemList[res.tapIndex] ?? "";
          if (label.startsWith("打开")) {
            runApp();
            return;
          }
          if (label.includes("浏览器")) {
            runtime.openURL(url, () => copyUrlFallback(url, "链接已复制"));
            return;
          }
          if (label.includes("复制")) copyUrlFallback(url, "链接已复制");
        },
        fail: () => runApp()
      });
      return;
    }
  }

  runApp();
}

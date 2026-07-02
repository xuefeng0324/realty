/**
 * 政府网站在线查询入口（WebView 打开，需用户在页内登录）。
 */

import { openExternalUrl } from "../utils/openExternal";

export interface GovWebLink {
  title: string;
  url: string;
  note: string;
}

/** fdc Vue SPA 在 App WebView 中须带 index.html，否则 hash 路由易报「无法打开」。 */
export function normalizeGovUrl(url: string): string {
  if (/szfdccommon\/#\//.test(url)) {
    return url.replace("szfdccommon/#", "szfdccommon/index.html#");
  }
  return url;
}

export const GOV_WEB_LINKS = {
  /** 预售许可 + 楼盘表（单套面积/总价/销售状态） */
  szPresale: {
    title: "深圳预售公示",
    url: "https://fdc.zjj.sz.gov.cn/szfdccommon/index.html#/publicInfo/main?params=ysxk",
    note: "预售许可、楼盘表；查看单套需登录住建局账号"
  },
  /** 住建局办事登录（广东省统一身份认证入口） */
  szPortal: {
    title: "住建局登录",
    url: "https://zjj.sz.gov.cn/gkyjzj/index_zjlogin.html",
    note: "广东省统一身份认证；登录后再打开「预售公示」查看楼盘表"
  },
  /** 住建局门户（桌面站，移动端会弹跳转提示） */
  szZjjPortal: {
    title: "深圳市住房和建设局",
    url: "https://zjj.sz.gov.cn/",
    note: "住建局官网；手机端可能提示跳转，建议用系统浏览器"
  },
  /** 匿名可看的全市新房/二手成交走势 */
  szWangqianTrend: {
    title: "深圳成交走势",
    url: "https://fdc.zjj.sz.gov.cn/public/marketInfo/housePriceTrendInfo.html",
    note: "全市新房/二手套数与面积走势（无需登录）"
  }
} as const satisfies Record<string, GovWebLink>;

export type GovWebLinkKey = keyof typeof GOV_WEB_LINKS;

/** 打开后需在站内已登录的入口（不含登录页本身） */
const NEEDS_FDC_LOGIN = new Set<GovWebLinkKey>(["szPresale"]);

function navigateGovWebview(url: string, title: string): void {
  const q = `url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  uni.navigateTo({ url: `/pages/gov-webview/gov-webview?${q}` });
}

function isAppPlusRuntime(): boolean {
  // #ifdef APP-PLUS
  return typeof plus !== "undefined";
  // #endif
  return false;
}

/**
 * 打开政府查询页。
 * App 端默认用系统浏览器（规避 WebView 对 fdc 子站 SSL / hash 路由的兼容问题）。
 */
export function openGovWeb(key: GovWebLinkKey, mode: "auto" | "inapp" | "browser" = "auto"): void {
  const run = () => openGovWebDirect(key, mode);
  if (NEEDS_FDC_LOGIN.has(key)) {
    uni.showModal({
      title: "需登录政府平台",
      content:
        "深圳房地产信息平台需使用住建局或广东省统一身份认证账号登录。登录成功后再查看预售公示、楼盘表等数据。",
      confirmText: "去登录",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) run();
      }
    });
    return;
  }
  run();
}

function openGovWebDirect(key: GovWebLinkKey, mode: "auto" | "inapp" | "browser"): void {
  const item = GOV_WEB_LINKS[key];
  const url = normalizeGovUrl(item.url);
  const useBrowser = mode === "browser" || (mode === "auto" && isAppPlusRuntime());

  if (useBrowser) {
    openExternalUrl(url);
    return;
  }

  navigateGovWebview(url, item.title);
}

export function openGovWebInApp(key: GovWebLinkKey): void {
  openGovWeb(key, "inapp");
}

export function openGovWebInBrowser(key: GovWebLinkKey): void {
  openGovWeb(key, "browser");
}

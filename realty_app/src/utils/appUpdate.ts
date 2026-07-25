/**
 * App OTA 升级（wgt）
 *
 * 流程：
 *   1. uni.request 拉 UPDATE CDN 上的 app-update.json（多镜像回退）
 *   2. 对比 versionCode：远程 > 本地 → 提示用户升级
 *   3. 用户确认后 plus.downloader 下载 wgt → plus.runtime.install → 重启生效
 *
 * 注意：App-Plus WebView 通常没有全局 fetch（会报 fetch is not a function），
 * 必须走 uni.request；与 remoteFetch.downloadText 同口径。
 */

import { APP_UPDATE_STORAGE_KEY, APP_UPDATE_MANIFEST, UPDATE_BASE_URL } from "../config";
import { getStaticBases } from "../local/remoteFetch";

export interface AppUpdateManifest {
  /** 与 src/manifest.json 的 versionName 同步 */
  versionName: string;
  /** 与 src/manifest.json 的 versionCode 同步，整数字符串 */
  versionCode: string;
  /** 更新说明（纯文本 / Markdown） */
  notes?: string;
  /** 发布时间 ISO 8601 */
  publishedAt?: string;
  /** 是否强制升级（true 时用户不能跳过） */
  force?: boolean;
  /** Android wgt 资源包 */
  wgt?: {
    url: string;
    sha256?: string;
    silent?: boolean;
  };
  /** Android 完整 APK 整包（可选；与 wgt 二选一时优先 wgt） */
  apk?: {
    url: string;
    sha256?: string;
  };
  /** iOS 资源：未上架 App Store 时必须置 false */
  ios?: {
    available: boolean;
    note?: string;
  };
}

export interface UpdateCheckResult {
  status: "up-to-date" | "available" | "skipped" | "unsupported";
  manifest?: AppUpdateManifest;
  reason?: string;
}

/** 候选更新清单 URL：自定义 UPDATE_BASE_URL 优先，再跟 static 多镜像。 */
function getUpdateManifestUrls(): string[] {
  const urls: string[] = [];
  const primary = (UPDATE_BASE_URL || "").replace(/\/+$/, "");
  if (primary) urls.push(`${primary}/${APP_UPDATE_MANIFEST}`);
  for (const base of getStaticBases()) {
    const u = `${base.replace(/\/+$/, "")}/update/${APP_UPDATE_MANIFEST}`;
    if (!urls.includes(u)) urls.push(u);
  }
  return urls;
}

/**
 * 用 uni.request 拉 JSON（App/H5/小程序通用）；失败返回 null。
 * App-Plus 无 fetch，不能用全局 fetch。
 */
function requestJson(url: string, timeoutMs = 15000): Promise<unknown | null> {
  return new Promise((resolve) => {
    const u = (typeof uni !== "undefined" ? uni : undefined) as
      | { request?: (opts: Record<string, unknown>) => void }
      | undefined;
    if (u && typeof u.request === "function") {
      u.request({
        url,
        method: "GET",
        timeout: timeoutMs,
        // 避免 CDN 缓存旧清单
        header: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        success: (res: { statusCode?: number; data?: unknown }) => {
          if (res.statusCode === 200 && res.data != null) {
            if (typeof res.data === "string") {
              try {
                resolve(JSON.parse(res.data));
              } catch {
                resolve(null);
              }
            } else {
              resolve(res.data);
            }
          } else {
            resolve(null);
          }
        },
        fail: () => resolve(null)
      });
      return;
    }
    // 非 uni 环境（单测 / Node）兜底：仅当全局有 fetch 时才用
    if (typeof fetch === "function") {
      fetch(url, { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => resolve(j))
        .catch(() => resolve(null));
      return;
    }
    resolve(null);
  });
}

/**
 * 拉到清单的同时记住命中的 update 根目录，方便把 wgt.url 改写到同一镜像。
 *
 * v1.121.2: raw.githubusercontent.com 上**没有** wgt 二进制（GitHub raw 不提供二进制下载），
 * 所以 manifestBase（拉清单的源）≠ wgtBase（下 wgt 的源）。wgtBase 强制走 jsDelivr 系列镜像。
 */
async function fetchManifestWithBase(): Promise<{
  manifest: AppUpdateManifest;
  manifestBase: string;
  wgtBase: string;
} | null> {
  const urls = getUpdateManifestUrls();
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const data = await requestJson(url);
    if (!data || typeof data !== "object") continue;
    const m = data as AppUpdateManifest;
    if (!m.versionCode || !m.versionName) continue;
    const manifestBase = url.slice(0, url.lastIndexOf("/") + 1);
    const candidates = urls.map((u) => u.slice(0, u.lastIndexOf("/") + 1));
    const wgtBase = selectWgtBase(manifestBase, candidates);
    return { manifest: m, manifestBase, wgtBase };
  }
  return null;
}

/**
 * 把清单里写死的 cdn.jsdelivr wgt URL 改写到当前命中的镜像根。
 * 例如 .../static/update/93/app.wgt → 用 updateBase + 93/app.wgt
 */
export function rewriteWgtUrlToBase(wgtUrl: string, updateBase: string): string {
  const m = wgtUrl.match(/\/update\/(\d+\/[^/?#]+)$/);
  if (m) return `${updateBase.replace(/\/+$/, "")}/${m[1]}`;
  // 兜底：若只是文件名
  const file = wgtUrl.split("/").pop();
  if (file) return `${updateBase.replace(/\/+$/, "")}/${file}`;
  return wgtUrl;
}

/**
 * v1.121.2: 给定命中的 manifestBase（拉清单的源），挑出能下 wgt 二进制的镜像 base。
 * raw.githubusercontent.com 不能下二进制，所以必须回退到 jsDelivr 系列。
 * 导出供单测。
 */
export function selectWgtBase(manifestBase: string, candidateBases: string[]): string {
  if (!/raw\.githubusercontent\.com/.test(manifestBase)) return manifestBase;
  for (const b of candidateBases) {
    if (!/raw\.githubusercontent\.com/.test(b)) {
      return b.endsWith("/") ? b : `${b}/`;
    }
  }
  return manifestBase;
}

/**
 * 仅做远程版本探测，不下载不安装。供设置页"检查更新"按钮使用。
 * App-Plus / H5 均走 uni.request（App WebView 无全局 fetch）。
 */
export async function checkAppUpdate(): Promise<UpdateCheckResult> {
  const hit = await fetchManifestWithBase();
  if (!hit) {
    return {
      status: "unsupported",
      reason: "无法访问更新服务器：所有 CDN 镜像均失败（请检查网络或稍后重试）"
    };
  }
  const { manifest, wgtBase } = hit;
  if (manifest.wgt?.url) {
    manifest.wgt = {
      ...manifest.wgt,
      url: rewriteWgtUrlToBase(manifest.wgt.url, wgtBase)
    };
  }
  const remoteCode = parseInt(manifest.versionCode, 10);
  if (!Number.isFinite(remoteCode)) {
    return { status: "unsupported", reason: "更新清单 versionCode 非整数" };
  }
  const localInfo = await getLocalVersion();
  if (remoteCode <= localInfo.versionCode) {
    return { status: "up-to-date", manifest };
  }
  // 用户已忽略过的版本不再提示（除非 manifest.force）
  if (!manifest.force) {
    const skipped = uni.getStorageSync(APP_UPDATE_STORAGE_KEY);
    if (skipped === manifest.versionCode) {
      return { status: "skipped", manifest };
    }
  }
  return { status: "available", manifest };
}

export interface LocalVersionInfo {
  versionName: string;
  versionCode: number;
}

/**
 * 读本地版本（仅 APP-PLUS）。其它平台返回 0.0.0/0，由调用方决定如何兜底。
 */
export function getLocalVersion(): Promise<LocalVersionInfo> {
  return new Promise((resolve) => {
    // #ifdef APP-PLUS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plus = (globalThis as any).plus;
    if (plus?.runtime?.getProperty) {
      plus.runtime.getProperty(plus.runtime.appID, (info: { version: string; versionCode: string }) => {
        resolve({
          versionName: info.version ?? "0.0.0",
          versionCode: parseInt(info.versionCode ?? "0", 10) || 0
        });
      });
      return;
    }
    // #endif
    resolve({ versionName: "0.0.0", versionCode: 0 });
  });
}

/**
 * 标记某个版本已被用户忽略。force=true 的版本不允许忽略。
 */
export function skipVersion(versionCode: string): void {
  uni.setStorageSync(APP_UPDATE_STORAGE_KEY, versionCode);
}

/**
 * 下载并安装 wgt；成功后提示用户"重启应用"。
 *
 * v1.121.3: 多 URL 回退——依次尝试 primaryUrl → fallbackUrls，任一成功即用其产物 install。
 * 单个 URL 下载失败（DNS 解析失败 / 超时 / 4xx 5xx）→ 自动试下一个。
 *
 * 仅 APP-PLUS 可用，调用方需先 #ifdef APP-PLUS。
 */
export interface InstallProgress {
  downloaded: number;
  total: number;
}

/**
 * 把一个 wgt URL 拆出（base, versionDir/file），给同一资源生成多镜像候选 URL。
 * 例如 https://gcore.jsdelivr.net/gh/x/y@main/realty_app/static/update/93/app.wgt
 *   → base=gcore.jsdelivr.net, tail=/update/93/app.wgt
 * 候选顺序：原 URL 的 base 优先，其余 jsDelivr 镜像；raw.githubusercontent 不可下二进制所以排除。
 */
export function buildWgtUrlCandidates(primaryUrl: string): string[] {
  const u = new URL(primaryUrl);
  const tail = primaryUrl.slice(primaryUrl.indexOf("/update/"));
  const baseOf = (host: string) => `${u.protocol}//${host}${u.pathname.slice(0, u.pathname.indexOf("/update/"))}`;
  const jsdelivrHosts = [
    "cdn.jsdelivr.net",
    "gcore.jsdelivr.net",
    "fastly.jsdelivr.net",
    "jsdelivr.b-cdn.net"
  ];
  const out: string[] = [primaryUrl];
  for (const h of jsdelivrHosts) {
    const cand = `${baseOf(h)}${tail}`;
    if (cand !== primaryUrl && !out.includes(cand)) out.push(cand);
  }
  return out;
}

export async function downloadAndInstallWgt(
  url: string,
  onProgress?: (p: InstallProgress) => void
): Promise<{ ok: true; localPath: string } | { ok: false; reason: string }> {
  // #ifdef APP-PLUS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plus = (globalThis as any).plus;
  if (!plus?.downloader || !plus?.runtime?.install) {
    return { ok: false, reason: "当前运行时不支持 plus.runtime.install（仅 APP-PLUS）" };
  }
  interface PlusDownloadTask {
    downloadedSize: number;
    totalSize: number;
    state: number;
    filename: string;
  }

  const urls = buildWgtUrlCandidates(url);
  const tried: string[] = [];
  for (const u of urls) {
    tried.push(u);
    const task = plus.downloader.createDownload(u, { method: "GET" }, undefined as unknown as string);
    try {
      const localPath: string = await new Promise<string>((resolve, reject) => {
        task.addEventListener("statechanged", (task2: PlusDownloadTask, status: number) => {
          if (typeof onProgress === "function") {
            onProgress({ downloaded: task2.downloadedSize, total: task2.totalSize });
          }
          if (task2.state === 4 && status === 200) {
            resolve(task2.filename);
          } else if (task2.state === 4) {
            reject(new Error(`status=${status}`));
          }
        });
        task.start();
      });
      // 下载成功 → 安装
      const installResult = await new Promise<{ ok: true; localPath: string } | { ok: false; reason: string }>((resolve) => {
        plus.runtime.install(
          localPath,
          { force: true },
          () => resolve({ ok: true, localPath }),
          (err: { message: string }) => resolve({ ok: false, reason: err?.message ?? "安装失败" })
        );
      });
      if (installResult.ok) return installResult;
      // 安装失败：直接返回（不再试别的 URL，文件已损坏）
      return installResult;
    } catch (e) {
      // 当前 URL 下载失败，尝试下一个
      continue;
    }
  }
  return { ok: false, reason: `所有 wgt 镜像均失败（已试 ${tried.length} 个：${tried.map((s) => s.slice(8, 30)).join(", ")}...）` };
  // #endif
  return { ok: false, reason: "当前平台不支持 OTA 升级（仅 APP-PLUS）" };
}

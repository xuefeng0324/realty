/**
 * App OTA 升级（wgt）
 *
 * 流程：
 *   1. uni.request 并行/串行拉多镜像 app-update.json（带缓存戳）
 *   2. **取 versionCode 最高的清单**（防止 jsDelivr @main 返回过期 200）
 *   3. wgt 优先走 raw.githubusercontent.com（实测可下 ~1MB wgt），jsDelivr 作回退
 *   4. plus.downloader 下载 → plus.runtime.install → 可选 restart
 */

import { APP_UPDATE_STORAGE_KEY, APP_UPDATE_MANIFEST, UPDATE_BASE_URL } from "../config";
import { getStaticBases } from "../local/remoteFetch";

export interface AppUpdateManifest {
  versionName: string;
  versionCode: string;
  notes?: string;
  publishedAt?: string;
  force?: boolean;
  wgt?: {
    url: string;
    sha256?: string;
    silent?: boolean;
  };
  apk?: {
    url: string;
    sha256?: string;
  };
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

/** 候选更新清单 URL：raw / 自定义优先，jsDelivr 垫后（其 @main 常缓存旧清单）。 */
export function getUpdateManifestUrls(): string[] {
  const bust = `t=${Date.now()}`;
  const urls: string[] = [];
  const push = (u: string) => {
    if (!urls.includes(u)) urls.push(u);
  };
  const primary = (UPDATE_BASE_URL || "").replace(/\/+$/, "");
  if (primary) push(`${primary}/${APP_UPDATE_MANIFEST}?${bust}`);
  // 显式保证 raw 在前列（即便 UPDATE_BASE_URL 被改回 jsDelivr）
  push(
    `https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/${APP_UPDATE_MANIFEST}?${bust}`
  );
  for (const base of getStaticBases()) {
    push(`${base.replace(/\/+$/, "")}/update/${APP_UPDATE_MANIFEST}?${bust}`);
  }
  return urls;
}

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
 * v1.121.5: 拉取**所有**可用清单，选 versionCode 最高者。
 * 旧逻辑「第一个 200 即返回」会被 jsDelivr 过期缓存骗成「已是最新」。
 */
export async function fetchManifestWithBase(): Promise<{
  manifest: AppUpdateManifest;
  manifestBase: string;
  wgtBase: string;
} | null> {
  const urls = getUpdateManifestUrls();
  const hits: Array<{
    manifest: AppUpdateManifest;
    manifestBase: string;
    code: number;
  }> = [];

  // 并行拉，总耗时≈最慢镜像，而不是串行累加
  await Promise.all(
    urls.map(async (url) => {
      const data = await requestJson(url);
      if (!data || typeof data !== "object") return;
      const m = data as AppUpdateManifest;
      if (!m.versionCode || !m.versionName) return;
      const code = parseInt(m.versionCode, 10);
      if (!Number.isFinite(code)) return;
      const cleanUrl = url.split("?")[0];
      const manifestBase = cleanUrl.slice(0, cleanUrl.lastIndexOf("/") + 1);
      hits.push({ manifest: m, manifestBase, code });
    })
  );

  if (!hits.length) return null;
  hits.sort((a, b) => b.code - a.code);
  const best = hits[0];
  const candidateBases = urls.map((u) => {
    const c = u.split("?")[0];
    return c.slice(0, c.lastIndexOf("/") + 1);
  });
  const wgtBase = selectWgtBase(best.manifestBase, candidateBases);
  return { manifest: best.manifest, manifestBase: best.manifestBase, wgtBase };
}

export function rewriteWgtUrlToBase(wgtUrl: string, updateBase: string): string {
  const bare = wgtUrl.split("?")[0];
  const m = bare.match(/\/update\/(\d+\/[^/?#]+)$/);
  if (m) return `${updateBase.replace(/\/+$/, "")}/${m[1]}`;
  const file = bare.split("/").pop();
  if (file) return `${updateBase.replace(/\/+$/, "")}/${file}`;
  return wgtUrl;
}

/**
 * v1.121.5: raw.githubusercontent.com **可以**下本仓库 ~1MB 的 wgt（已实测 sha 一致）。
 * 优先保留 raw；仅当没有 raw 候选时才用 jsDelivr。
 */
export function selectWgtBase(manifestBase: string, candidateBases: string[]): string {
  const norm = (b: string) => (b.endsWith("/") ? b : `${b}/`);
  if (/raw\.githubusercontent\.com/.test(manifestBase)) return norm(manifestBase);
  for (const b of candidateBases) {
    if (/raw\.githubusercontent\.com/.test(b)) return norm(b);
  }
  return norm(manifestBase);
}

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

export function skipVersion(versionCode: string): void {
  uni.setStorageSync(APP_UPDATE_STORAGE_KEY, versionCode);
}

export interface InstallProgress {
  downloaded: number;
  total: number;
}

/**
 * v1.121.5: 候选顺序 raw → github raw → gcore → fastly → cdn → b-cdn
 */
export function buildWgtUrlCandidates(primaryUrl: string): string[] {
  const bare = primaryUrl.split("?")[0];
  const m = bare.match(/\/update\/(\d+\/[^/?#]+)$/);
  const tail = m ? m[1] : bare.split("/").pop() || "app.wgt";
  const out: string[] = [];
  const push = (u: string) => {
    if (u && !out.includes(u)) out.push(u);
  };

  push(`https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/${tail}`);
  push(`https://github.com/xuefeng0324/realty/raw/main/realty_app/static/update/${tail}`);

  const jsHosts = [
    "gcore.jsdelivr.net",
    "fastly.jsdelivr.net",
    "cdn.jsdelivr.net",
    "jsdelivr.b-cdn.net"
  ];
  for (const h of jsHosts) {
    push(`https://${h}/gh/xuefeng0324/realty@main/realty_app/static/update/${tail}`);
  }
  push(bare);
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
      const installResult = await new Promise<{ ok: true; localPath: string } | { ok: false; reason: string }>(
        (resolve) => {
          plus.runtime.install(
            localPath,
            { force: true },
            () => resolve({ ok: true, localPath }),
            (err: { message: string }) => resolve({ ok: false, reason: err?.message ?? "安装失败" })
          );
        }
      );
      if (installResult.ok) return installResult;
      return installResult;
    } catch {
      continue;
    }
  }
  return {
    ok: false,
    reason: `所有 wgt 镜像均失败（已试 ${tried.length} 个：${tried.map((s) => s.slice(8, 40)).join(", ")}...）`
  };
  // #endif
  return { ok: false, reason: "当前平台不支持 OTA 升级（仅 APP-PLUS）" };
}

export function restartAppAfterUpdate(): boolean {
  // #ifdef APP-PLUS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plus = (globalThis as any).plus;
  if (plus?.runtime?.restart) {
    try {
      plus.runtime.restart();
      return true;
    } catch {
      return false;
    }
  }
  // #endif
  return false;
}

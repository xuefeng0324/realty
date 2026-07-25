/**
 * App OTA 升级（wgt）
 *
 * 流程：
 *   1. fetch(UPDATE_BASE_URL + app-update.json) 拿到远程清单
 *   2. 解析 wgt.android / wgt.ios（iOS 仅在企业签/自签/TestFlight 内可用）
 *   3. 对比 versionCode：远程 > 本地 → 提示用户升级
 *   4. 用户确认后下载 wgt → plus.runtime.install(path, force) → 重启生效
 *
 * H5/小程序端本文件的方法均走条件编译，调用前 #ifdef APP-PLUS 即可避免误触发。
 * 直接在 H5 里调用 downloadAndInstall 会因为没有 plus 抛错，调用方需负责平台判断。
 */

import { APP_UPDATE_STORAGE_KEY, APP_UPDATE_MANIFEST, UPDATE_BASE_URL } from "../config";

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

/**
 * 仅做远程版本探测，不下载不安装。供设置页"检查更新"按钮使用。
 */
export async function checkAppUpdate(): Promise<UpdateCheckResult> {
  // #ifdef APP-PLUS
  const url = UPDATE_BASE_URL + APP_UPDATE_MANIFEST;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-cache" });
  } catch (e) {
    return { status: "unsupported", reason: `无法访问更新服务器：${(e as Error).message}` };
  }
  if (!res.ok) {
    return { status: "unsupported", reason: `更新清单 HTTP ${res.status}` };
  }
  let manifest: AppUpdateManifest;
  try {
    manifest = (await res.json()) as AppUpdateManifest;
  } catch (e) {
    return { status: "unsupported", reason: `更新清单解析失败：${(e as Error).message}` };
  }
  if (!manifest.versionCode || !manifest.versionName) {
    return { status: "unsupported", reason: "更新清单缺 versionCode/versionName" };
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
  // #endif
  // 非 APP-PLUS 平台：H5 / 小程序不支持 plus.runtime.install
  return { status: "unsupported", reason: "当前平台不支持 OTA 升级（仅 APP-PLUS）" };
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
 * 仅 APP-PLUS 可用，调用方需先 #ifdef APP-PLUS。
 */
export interface InstallProgress {
  downloaded: number;
  total: number;
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
const task = plus.downloader.createDownload(url, { method: "GET" }, undefined as unknown as string);
  const localPath: string = await new Promise((resolve, reject) => {
    task.addEventListener("statechanged", (task2: PlusDownloadTask, status: number) => {
      if (typeof onProgress === "function") {
        onProgress({ downloaded: task2.downloadedSize, total: task2.totalSize });
      }
      if (task2.state === 4 && status === 200) {
        resolve(task2.filename);
      } else if (task2.state === 4) {
        reject(new Error(`下载失败 status=${status}`));
      }
    });
    task.start();
  });
  return new Promise((resolve) => {
    plus.runtime.install(
      localPath,
      { force: true },
      () => resolve({ ok: true, localPath }),
      (err: { message: string }) => resolve({ ok: false, reason: err?.message ?? "安装失败" })
    );
  });
  // #endif
  return { ok: false, reason: "当前平台不支持 OTA 升级（仅 APP-PLUS）" };
}
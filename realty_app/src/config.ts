/**
 * 全局配置
 *
 * - API_BASE_URL：后端 FastAPI 地址
 *   - H5 调试：`http://localhost:8000`
 *   - 真机/小程序调试：把电脑 IP 填进去，例如 `http://192.168.1.10:8000`
 *   - 生产：部署后的公网/内网域名
 *
 * 也可在 app 内"设置"页运行时覆盖（持久化在 storage），优先级高于这里。
 */
export const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const APP_NAME = "Realty App";
// 与 src/manifest.json 的 versionName 同步；CI 出包时会自动覆写
export const APP_VERSION = "1.121.132";

export const STORAGE_KEYS = {
  apiBaseUrl: "realty_app.apiBaseUrl",
  cityId: "realty_app.cityId",
  weekEnd: "realty_app.weekEnd",
  source: "realty_app.source",
  metric: "realty_app.metric",
};

export const SNAPSHOT_UPDATED_EVENT = "realty:snapshot-updated";

export const DEFAULT_PAGE_SIZE = 20;

/**
 * 应用升级（OTA）配置
 *
 * - UPDATE_BASE_URL：检查更新 manifest 的根地址
 *   - jsDelivr：https://cdn.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/update/
 *   - GitHub Pages：未来可改为 https://xuefeng0324.github.io/realty/static/update/
 * - APP_UPDATE_MANIFEST：相对路径下的 app-update.json
 * - APP_UPDATE_STORAGE_KEY：本地记录"已忽略的版本"，避免每次启动都弹升级
 */
// 清单优先走 raw（JSON 文本稳）；wgt 二进制仍由 appUpdate 改写到 jsDelivr。
export const UPDATE_BASE_URL =
  "https://raw.githubusercontent.com/xuefeng0324/realty/main/realty_app/static/update/";

export const APP_UPDATE_MANIFEST = "app-update.json";

export const APP_UPDATE_STORAGE_KEY = "realty_app.update.skippedVersion";

/** 升级弹层页读取的待处理清单（对齐 uni-upgrade-center 用 storage 传参） */
export const APP_UPDATE_PENDING_KEY = "realty_app.update.pendingManifest";

/** 上次前台检查更新时间戳，用于 onShow 节流（毫秒） */
export const APP_UPDATE_LAST_CHECK_KEY = "realty_app.update.lastCheckAt";

/**
 * GitHub Release（仅整包 APK 用）
 * OTA 升级不需要这里；只有"重新装整包"才走 Release assets。
 */
export const APP_GITHUB_REPO = "xuefeng0324/realty";

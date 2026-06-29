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
export const APP_VERSION = "0.1.0";

export const STORAGE_KEYS = {
  apiBaseUrl: "realty_app.apiBaseUrl",
  cityId: "realty_app.cityId",
  weekEnd: "realty_app.weekEnd",
  source: "realty_app.source",
  metric: "realty_app.metric"
};

export const DEFAULT_PAGE_SIZE = 20;
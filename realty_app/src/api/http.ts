import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from "../config";

/**
 * 统一的 HTTP 客户端。
 *  - 通过 `STORAGE_KEYS.apiBaseUrl` 持久化 baseUrl，可在 app 内"设置"页修改
 *  - 跨平台：H5 用 `fetch`；其它平台 uni-app 自带 `uni.request`
 */

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function readBaseUrl(): string {
  // #ifdef H5
  try {
    const v = uni.getStorageSync(STORAGE_KEYS.apiBaseUrl);
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  } catch {}
  // #endif
  return DEFAULT_API_BASE_URL;
}

function buildUrl(path: string, params?: Record<string, any>): string {
  const base = readBaseUrl().replace(/\/+$/, "");
  let url = base + (path.startsWith("/") ? path : "/" + path);
  if (params) {
    const filtered: string[] = [];
    Object.keys(params).forEach((k) => {
      const v = params[k];
      if (v === undefined || v === null || v === "") return;
      filtered.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    });
    if (filtered.length > 0) url += "?" + filtered.join("&");
  }
  return url;
}

export async function apiGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  const url = buildUrl(path, params);
  // #ifdef H5
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}`, res.status, data);
  }
  return data as T;
  // #endif
  // #ifndef H5
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url,
      method: "GET",
      header: { Accept: "application/json" },
      success: (r) => {
        if (r.statusCode >= 200 && r.statusCode < 300) {
          resolve(r.data as T);
        } else {
          reject(new ApiError(`HTTP ${r.statusCode}`, r.statusCode, r.data));
        }
      },
      fail: (err) => reject(new ApiError(err.errMsg || "request failed", 0, null))
    });
  });
  // #endif
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const url = buildUrl(path);
  // #ifdef H5
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}`, res.status, data);
  }
  return data as T;
  // #endif
  // #ifndef H5
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url,
      method: "POST",
      header: { "Content-Type": "application/json", Accept: "application/json" },
      data: body,
      success: (r) => {
        if (r.statusCode >= 200 && r.statusCode < 300) {
          resolve(r.data as T);
        } else {
          reject(new ApiError(`HTTP ${r.statusCode}`, r.statusCode, r.data));
        }
      },
      fail: (err) => reject(new ApiError(err.errMsg || "request failed", 0, null))
    });
  });
  // #endif
}

export function setApiBaseUrl(url: string) {
  uni.setStorageSync(STORAGE_KEYS.apiBaseUrl, url);
}

export function getApiBaseUrl(): string {
  return readBaseUrl();
}
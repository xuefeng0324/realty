/**
 * 从 jsDelivr 拉远端 daily_wangqian.csv，更新宏观网签数据。
 *
 * 数据流：
 *   crawl-daily-wangqian.yml → daily_wangqian.csv + wangqian_meta.json
 *        ↓ jsDelivr
 *   App 启动 / 设置页「刷新网签」→ uni.request → loadDailyWangqianFromCSV
 */

import { loadDailyWangqianFromCSV } from "./dailyWangqian";
import { hasDailyWangqian } from "./store";

const DEFAULT_REPO = "xuefeng0324/realty";
const CDN_STATIC = `https://cdn.jsdelivr.net/gh/${DEFAULT_REPO}@main/realty_app/static`;

const STORAGE_SHA = "realty:lastWangqianSha";
const STORAGE_AT = "realty:lastWangqianAt";

export interface WangqianRemoteMeta {
  csv_url: string;
  meta_url: string;
  sha256: string;
  row_count: number;
  generated_at: string;
  source: string;
}

export interface WangqianRefreshResult {
  ok: boolean;
  changed: boolean;
  meta?: WangqianRemoteMeta;
  error?: string;
  rowCount?: number;
}

function downloadText(url: string, timeoutMs = 15000): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (v: string | null) => {
      if (!resolved) {
        resolved = true;
        resolve(v);
      }
    };

    const u = (typeof uni !== "undefined" ? uni : undefined) as any;
    if (u && typeof u.request === "function") {
      u.request({
        url,
        method: "GET",
        timeout: timeoutMs,
        success: (res: any) => {
          if (res.statusCode === 200 && typeof res.data === "string") {
            finish(res.data);
          } else {
            finish(null);
          }
        },
        fail: () => finish(null)
      });
      return;
    }
    if (typeof fetch === "function") {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      fetch(url, { signal: ctl.signal })
        .then((r) => r.text())
        .then((txt) => {
          clearTimeout(t);
          finish(txt);
        })
        .catch(() => {
          clearTimeout(t);
          finish(null);
        });
      return;
    }
    finish(null);
  });
}

function getUniStorage() {
  return (typeof uni !== "undefined" ? uni : undefined) as any;
}

/** 拉远端 wangqian_meta.json → 对比 sha → 拉 CSV → 注入 store。 */
export async function refreshWangqianFromRemote(): Promise<WangqianRefreshResult> {
  const metaUrl = `${CDN_STATIC}/wangqian_meta.json`;
  const metaText = await downloadText(metaUrl, 8000);
  if (!metaText) {
    return { ok: false, changed: false, error: "无法连接 jsDelivr（网签 meta）" };
  }

  let meta: WangqianRemoteMeta;
  try {
    meta = JSON.parse(metaText);
  } catch {
    return { ok: false, changed: false, error: "远端 wangqian_meta 格式错误" };
  }

  const u = getUniStorage();
  const lastSha = u?.getStorageSync ? u.getStorageSync(STORAGE_SHA) : undefined;
  if (lastSha === meta.sha256 && hasDailyWangqian()) {
    return { ok: true, changed: false, meta, rowCount: meta.row_count };
  }

  const csvUrl = meta.csv_url ?? `${CDN_STATIC}/daily_wangqian.csv`;
  const csvText = await downloadText(csvUrl, 20000);
  if (!csvText || csvText.length < 50 || !csvText.includes("date,city")) {
    return { ok: false, changed: false, error: "远端 daily_wangqian.csv 拉取失败", meta };
  }

  try {
    const rows = loadDailyWangqianFromCSV(csvText);
    if (rows.length === 0) {
      return { ok: false, changed: false, error: "网签 CSV 解析后无有效行", meta };
    }
    if (u?.setStorageSync) {
      u.setStorageSync(STORAGE_SHA, meta.sha256);
      u.setStorageSync(STORAGE_AT, meta.generated_at);
    }
    return { ok: true, changed: true, meta, rowCount: rows.length };
  } catch (e) {
    console.warn("[wangqianRefresher] parse failed:", e);
    return { ok: false, changed: false, error: "网签 CSV 解析失败", meta };
  }
}

export function getLastWangqianRefreshInfo(): { sha?: string; at?: string } {
  const u = getUniStorage();
  return {
    sha: u?.getStorageSync ? u.getStorageSync(STORAGE_SHA) : undefined,
    at: u?.getStorageSync ? u.getStorageSync(STORAGE_AT) : undefined
  };
}

export function clearWangqianRemoteCache() {
  const u = getUniStorage();
  if (u?.removeStorageSync) {
    u.removeStorageSync(STORAGE_SHA);
    u.removeStorageSync(STORAGE_AT);
  }
}

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
import { downloadText, fetchFromMirrors } from "./remoteFetch";

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

function getUniStorage() {
  return (typeof uni !== "undefined" ? uni : undefined) as any;
}

/** 拉远端 wangqian_meta.json → 对比 sha → 拉 CSV → 注入 store。 */
export async function refreshWangqianFromRemote(): Promise<WangqianRefreshResult> {
  const metaHit = await fetchFromMirrors("wangqian_meta.json", 8000, (t) =>
    t.includes("sha256")
  );
  if (!metaHit) {
    return {
      ok: false,
      changed: false,
      error: "无法连接任一 CDN 镜像（网签 meta，jsDelivr 可能被网络屏蔽）"
    };
  }

  let meta: WangqianRemoteMeta;
  try {
    meta = JSON.parse(metaHit.text);
  } catch {
    return { ok: false, changed: false, error: "远端 wangqian_meta 格式错误" };
  }

  const u = getUniStorage();
  const lastSha = u?.getStorageSync ? u.getStorageSync(STORAGE_SHA) : undefined;
  if (lastSha === meta.sha256 && hasDailyWangqian()) {
    return { ok: true, changed: false, meta, rowCount: meta.row_count };
  }

  // 用命中的同一镜像拉 CSV（meta.csv_url 写死 cdn.jsdelivr，可能被墙）
  const csvText = await downloadText(`${metaHit.base}/daily_wangqian.csv`, 20000);
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

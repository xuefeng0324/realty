/**
 * 从 CDN 拉取一整套相互一致的 CSV 快照。
 *
 * 旧实现只替换 listings，却保留基于旧 listings 生成的趋势、标签和评分，
 * 会让一个页面混用两个数据版本。现在以 crawl_meta 的 snapshot 指纹为边界，
 * 基础表和全部派生表解析成功后才原子 setSnapshot。
 */

import { getSnapshot, setSnapshot } from "./store";
import { fetchFromMirrors } from "./remoteFetch";
import { loadSnapshotFromBase } from "./snapshotLoader";

interface RemoteMeta {
  csv_url: string;
  meta_url: string;
  sha256: string;
  snapshot_sha256?: string;
  schema_version?: number;
  row_count: number;
  generated_at: string;
  source: string;
}

interface RefreshResult {
  ok: boolean;
  changed: boolean;
  meta?: RemoteMeta;
  error?: string;
  rowCount?: number;
}

function fingerprint(meta: RemoteMeta): string {
  return meta.snapshot_sha256 || meta.sha256;
}

/** 拉 meta → 拉完整 seed 目录 → 校验 → 原子替换 snapshot。 */
export async function refreshFromRemote(): Promise<RefreshResult> {
  const metaHit = await fetchFromMirrors("seed/crawl_meta.json", 8000, (t) =>
    t.includes("sha256")
  );
  if (!metaHit) {
    return {
      ok: false,
      changed: false,
      error: "无法连接任一 CDN 镜像，请检查网络或稍后再试"
    };
  }

  let meta: RemoteMeta;
  try {
    meta = JSON.parse(metaHit.text);
  } catch {
    return { ok: false, changed: false, error: "远端 meta 格式错误" };
  }
  if (!meta.sha256 || !Number.isInteger(meta.row_count) || meta.row_count <= 0) {
    return { ok: false, changed: false, error: "远端 meta 缺少有效指纹或行数" };
  }

  const fp = fingerprint(meta);
  const remoteSource = `remote:${fp}`;
  const current = getSnapshot();
  // 只在当前内存中已经装着同一远端快照时跳过。App 重启会先恢复内置包，
  // 即使 storage 里 sha 相同也必须重新下载，避免“显示最新、实际仍是旧包”。
  if (current?.source === remoteSource) {
    return { ok: true, changed: false, meta, rowCount: meta.row_count };
  }

  try {
    const snapshot = await loadSnapshotFromBase(`${metaHit.base}/seed`, remoteSource);
    if (snapshot.listings.length !== meta.row_count) {
      return {
        ok: false,
        changed: false,
        meta,
        error: `远端快照行数不一致：meta=${meta.row_count}，CSV=${snapshot.listings.length}`
      };
    }

    setSnapshot(snapshot);
    const u = (typeof uni !== "undefined" ? uni : undefined) as any;
    if (u?.setStorageSync) {
      u.setStorageSync("realty:lastRemoteSha", fp);
      u.setStorageSync("realty:lastRemoteAt", meta.generated_at);
    }
    return { ok: true, changed: true, meta, rowCount: snapshot.listings.length };
  } catch (e) {
    console.warn("[dataRefresher] full snapshot load failed:", e);
    return {
      ok: false,
      changed: false,
      meta,
      error: e instanceof Error ? e.message : "远端完整快照加载失败"
    };
  }
}

export function getLastRefreshInfo(): { sha?: string; at?: string } {
  const u = (typeof uni !== "undefined" ? uni : undefined) as any;
  return {
    sha: u?.getStorageSync ? u.getStorageSync("realty:lastRemoteSha") : undefined,
    at: u?.getStorageSync ? u.getStorageSync("realty:lastRemoteAt") : undefined
  };
}

export function clearRemoteCache() {
  const u = (typeof uni !== "undefined" ? uni : undefined) as any;
  if (u?.removeStorageSync) {
    u.removeStorageSync("realty:lastRemoteSha");
    u.removeStorageSync("realty:lastRemoteAt");
  }
}

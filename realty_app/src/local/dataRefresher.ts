/**
 * 从 jsDelivr CDN 拉远端 CSV，覆盖本地 seed snapshot 的 listings。
 *
 * 数据流：
 *   github-actions/workflows/crawl-weekly.yml
 *      每周跑 scripts/crawl_anjuke.py
 *      写 static/seed/listings.csv + crawl_meta.json
 *         ↓ commit + push
 *   GitHub main 分支
 *         ↓ jsDelivr 自动缓存
 *   https://cdn.jsdelivr.net/gh/<user>/<repo>@main/realty_app/static/seed/listings.csv
 *         ↓ 用户在 app 内点"刷新数据"
 *   app 内 uni.request 拿 CSV
 *         ↓ mergeListingsIntoSnapshot（保留 cities/communities/schools）
 *   setSnapshot（覆盖 listings，保留其它）
 *
 * 失败策略：
 *   - 网络不可达 → 不覆盖，回退到包内 seed
 *   - SHA256 与本地一致 → 跳过 reload
 *   - CSV 解析失败 → 回退并提示错误
 */

import { parseCSV, rowsToObjects } from "./csv";
import type {
  DataSnapshot,
  LocalListing
} from "./types";
import { setSnapshot, getSnapshot } from "./store";
import { downloadText, fetchFromMirrors } from "./remoteFetch";

interface RemoteMeta {
  csv_url: string;
  meta_url: string;
  sha256: string;
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

function nOrNull(v: string | undefined): number | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t || t === "NULL") return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}
function sOrNull(v: string | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" || t === "NULL" ? null : t;
}
function bOrNull(v: string | undefined): boolean | null {
  if (v == null) return null;
  const t = v.trim().toLowerCase();
  if (t === "1" || t === "true") return true;
  if (t === "0" || t === "false") return false;
  return null;
}

/** 把 raw listings CSV 解析成 LocalListing[]。 */
function parseListings(csvText: string): LocalListing[] | null {
  try {
    const rows = rowsToObjects<Record<string, string>>(parseCSV(csvText));
    return rows.map((r) => ({
      listingId: nOrZero(r.listing_id),
      cityId: nOrZero(r.city_id),
      communityId: nOrZero(r.community_id),
      title: sOrNull(r.title) ?? "",
      source: sOrNull(r.source),
      sourceListingId: sOrNull(r.source_listing_id),
      sourceUrl: sOrNull(r.source_url),
      totalPrice10k: nOrNull(r.total_price_10k),
      unitPrice: nOrNull(r.unit_price),
      areaSqm: nOrNull(r.area_sqm),
      listingType: sOrNull(r.listing_type),
      bedrooms: nOrNull(r.bedrooms),
      bathrooms: nOrNull(r.bathrooms),
      orientation: sOrNull(r.orientation),
      floorNumber: sOrNull(r.floor_number),
      hasElevator: bOrNull(r.has_elevator),
      decorateType: sOrNull(r.decorate_type),
      buildYear: nOrNull(r.build_year),
      nearestMetroDistanceM: nOrNull(r.nearest_metro_distance_m),
      schoolIdsJson: sOrNull(r.school_ids_json),
      tagsJson: sOrNull(r.tags_json),
      crawlDate: sOrNull(r.crawl_date)
    }));
  } catch (e) {
    console.warn("[dataRefresher] listings parse failed:", e);
    return null;
  }
}

function nOrZero(v: string | undefined): number {
  const x = nOrNull(v);
  return x == null ? 0 : x;
}

function weekEndFromDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** 把远端 listings 合并进现有 snapshot，保留 cities/community/schools。 */
function mergeListingsIntoSnapshot(
  existing: DataSnapshot | null,
  remoteListings: LocalListing[]
): DataSnapshot | null {
  const cities = existing?.cities ?? [];
  const communities = existing?.communities ?? [];
  const schools = existing?.schools ?? [];
  const schoolIndicators = existing?.schoolIndicators ?? [];

  const weekEnds = new Set<string>();
  for (const l of remoteListings) {
    if (l.crawlDate) weekEnds.add(weekEndFromDate(l.crawlDate));
  }
  const sorted = [...weekEnds].sort();
  const availableWeeks = sorted.map((we) => {
    const start = new Date(we + "T00:00:00Z");
    start.setUTCDate(start.getUTCDate() - 6);
    return { weekStartDate: start.toISOString().slice(0, 10), weekEndDate: we };
  });

  return {
    importedAt: new Date().toISOString(),
    source: "remote:anjuke",
    cities,
    communities,
    schools,
    schoolIndicators,
    listings: remoteListings,
    pois: existing?.pois ?? [],
    hospitals: existing?.hospitals ?? [],
    metroLines: existing?.metroLines ?? [],
    districtTrends: existing?.districtTrends ?? [],
    wangqianDistrictWeekly: existing?.wangqianDistrictWeekly ?? [],
    schoolPremiumDistricts: existing?.schoolPremiumDistricts ?? [],
    schoolPremiumCommunities: existing?.schoolPremiumCommunities ?? [],
    metroLineGeos: existing?.metroLineGeos ?? [],
    weather: existing?.weather ?? [],
    listingSchoolPremia: existing?.listingSchoolPremia ?? [],
    communityCommercials: existing?.communityCommercials ?? [],
    commutes: existing?.commutes ?? [],
    layoutDistributions: existing?.layoutDistributions ?? [],
    listingTags: existing?.listingTags ?? [],
    districtIndices: existing?.districtIndices ?? [],
    lifeConveniences: existing?.lifeConveniences ?? [],
    communityScores: existing?.communityScores ?? [],
    metroWalks: existing?.metroWalks ?? [],
    metroBenefits: existing?.metroBenefits ?? [],
    districtMeta: existing?.districtMeta ?? [],
    featurePremia: existing?.featurePremia ?? [],
    tagCombinations: existing?.tagCombinations ?? [],
    listingFreshness: existing?.listingFreshness ?? [],
    availableWeeks
  };
}

/**
 * 拉远端 crawl_meta.json → 看 sha 是否变化 → 拉 CSV → merge → setSnapshot
 */
export async function refreshFromRemote(): Promise<RefreshResult> {
  const metaHit = await fetchFromMirrors("seed/crawl_meta.json", 8000, (t) =>
    t.includes("sha256")
  );
  if (!metaHit) {
    return {
      ok: false,
      changed: false,
      error: "无法连接任一 CDN 镜像（jsDelivr 可能被网络屏蔽），请检查网络或稍后再试"
    };
  }
  let meta: RemoteMeta;
  try {
    meta = JSON.parse(metaHit.text);
  } catch {
    return { ok: false, changed: false, error: "远端 meta 格式错误" };
  }

  // 看本地是否已 cache 此 sha
  const u = (typeof uni !== "undefined" ? uni : undefined) as any;
  const lastSha = u?.getStorageSync ? u.getStorageSync("realty:lastRemoteSha") : undefined;
  if (lastSha === meta.sha256) {
    return { ok: true, changed: false, meta, rowCount: meta.row_count };
  }

  // 用命中的同一镜像拉 CSV（meta.csv_url 写死 cdn.jsdelivr，可能被墙）
  const csvText = await downloadText(`${metaHit.base}/seed/listings.csv`, 20000);
  if (!csvText || csvText.length < 100) {
    return { ok: false, changed: false, error: "远端 CSV 拉取失败", meta };
  }
  const remoteListings = parseListings(csvText);
  if (!remoteListings || remoteListings.length === 0) {
    return { ok: false, changed: false, error: "远端 CSV 解析失败或无 listings", meta };
  }

  const newSnap = mergeListingsIntoSnapshot(getSnapshot(), remoteListings);
  if (!newSnap) return { ok: false, changed: false, error: "合并 snapshot 失败", meta };

  setSnapshot(newSnap);
  if (u?.setStorageSync) {
    u.setStorageSync("realty:lastRemoteSha", meta.sha256);
    u.setStorageSync("realty:lastRemoteAt", meta.generated_at);
  }
  return { ok: true, changed: true, meta, rowCount: remoteListings.length };
}

/** 读上次刷新时间和 sha。供 settings 页面显示。 */
export function getLastRefreshInfo(): { sha?: string; at?: string } {
  const u = (typeof uni !== "undefined" ? uni : undefined) as any;
  return {
    sha: u?.getStorageSync ? u.getStorageSync("realty:lastRemoteSha") : undefined,
    at: u?.getStorageSync ? u.getStorageSync("realty:lastRemoteAt") : undefined
  };
}

/** 清除缓存（settings 页"回到包内 seed"按钮用）。 */
export function clearRemoteCache() {
  const u = (typeof uni !== "undefined" ? uni : undefined) as any;
  if (u?.removeStorageSync) {
    u.removeStorageSync("realty:lastRemoteSha");
    u.removeStorageSync("realty:lastRemoteAt");
  }
}

// 让解析模块引用进来，避免 tree-shake 误删
void parseCSV;
void rowsToObjects;

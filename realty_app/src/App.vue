<script setup lang="ts">
import { onLaunch, onShow } from "@dcloudio/uni-app";
import { setSnapshot, isLoaded, hasStats70, hasDailyWangqian } from "./local/store";
import { buildSeedSnapshot } from "./local/seedSnapshot";
import { loadSnapshotFromBase } from "./local/snapshotLoader";
import { getStoredCsvBaseUrl, getStoredDataMode } from "./local/dataMode";
import { SNAPSHOT_UPDATED_EVENT, APP_UPDATE_LAST_CHECK_KEY } from "./config";
import { loadStats70FromCSV } from "./local/stats70";
import { loadDailyWangqianFromCSV } from "./local/dailyWangqian";
import { loadProvidentFundRatesFromCSV } from "./local/providentFund";
import { loadNbsRealEstateFromCSV } from "./local/nbsRealEstate";
import { loadGzInventoryFromCSV } from "./local/gzNewHouseInventory";
import {
  refreshWangqianFromRemote
} from "./local/wangqianDataRefresher";
import { initializeTheme, refreshThemeChrome } from "./utils/theme";
import {
  checkAppUpdate,
  openUpgradePopup,
  supportsAppUpdateRuntime,
  trySilentWgtUpdate
} from "./utils/appUpdate";
// 直接以 raw 字符串 import，绕开 app-plus 静态资源下载问题。
//   H5/小程序：`?raw` query 由 vite 处理返回字符串
//   app-plus：在 webpack/vite 阶段把文件内联进来
// 该 CSV 1.2 MB，压缩后 < 300 KB，能放进 JS 包。
// 需要 Vite >= 4 ?raw 支持；uni-app 默认 vite >= 4 已支持。
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import stats70Raw from "../static/stats_70.csv?raw";
// @ts-ignore
import dailyWangqianRaw from "../static/daily_wangqian.csv?raw";
// @ts-ignore
import providentFundRaw from "../static/provident_fund_rates.csv?raw";
// @ts-ignore
import nbsRealEstateRaw from "../static/nbs_real_estate.csv?raw";
// @ts-ignore
import gzNewHouseInventoryRaw from "../static/gz_new_house_inventory.csv?raw";

let startupUpdateCheckStarted = false;
const UPDATE_FOREGROUND_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function markUpdateCheckedNow() {
  try {
    uni.setStorageSync(APP_UPDATE_LAST_CHECK_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function shouldSkipForegroundCheck(): boolean {
  try {
    const raw = uni.getStorageSync(APP_UPDATE_LAST_CHECK_KEY);
    const last = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
    if (!Number.isFinite(last) || last <= 0) return false;
    return Date.now() - last < UPDATE_FOREGROUND_COOLDOWN_MS;
  } catch {
    return false;
  }
}

async function runUpdateCheck(opts: { ignoreSkipped: boolean; fromForeground?: boolean }) {
  if (!supportsAppUpdateRuntime()) return;
  if (opts.fromForeground && shouldSkipForegroundCheck()) return;
  try {
    const result = await checkAppUpdate({ ignoreSkipped: opts.ignoreSkipped });
    markUpdateCheckedNow();
    if (result.status !== "available" || !result.manifest) return;
    const manifest = result.manifest;
    // Expo / uni-upgrade-center：silent wgt 后台装，不挡首屏
    if (manifest.wgt?.silent && !manifest.force) {
      void trySilentWgtUpdate(manifest).then((ok) => {
        if (ok) {
          console.log("[realty_app] silent wgt installed; restart to apply");
        }
      });
      return;
    }
    openUpgradePopup(manifest);
  } catch (error) {
    console.warn("[realty_app] update check failed", error);
  }
}

async function checkUpdateOnLaunch() {
  if (startupUpdateCheckStarted) return;
  startupUpdateCheckStarted = true;
  await runUpdateCheck({ ignoreSkipped: true });
}

onLaunch(() => {
  initializeTheme();
  // 避开开屏/首屏抢焦点：过早 showModal 在部分机型会被系统关掉再弹，看起来像闪烁
  setTimeout(() => {
    void checkUpdateOnLaunch();
  }, 1200);
  // 启动时加载种子"真数据"快照（来自国家统计局 70 城指数 + 公开政策派生）
  // 替代原本的内置随机 demo。
  if (!isLoaded()) {
    try {
      const snap = buildSeedSnapshot();
      setSnapshot(snap);
      console.log("[realty_app] seed loaded:", snap.listings.length, "listings");
    } catch (e) {
      console.warn("[realty_app] seed load failed, falling back not applied yet", e);
    }
  }
  // 自定义 CSV 模式会在每次启动时重新加载整套快照；先显示内置数据，
  // 成功后再原子替换并通知已挂载页面刷新，失败则保留内置快照。
  if (getStoredDataMode() === "csv-url") {
    const base = getStoredCsvBaseUrl().replace(/\/+$/, "");
    if (base) {
      void loadSnapshotFromBase(base, `csv-url:${base}`)
        .then((snap) => {
          setSnapshot(snap);
          uni.$emit(SNAPSHOT_UPDATED_EVENT);
          console.log("[realty_app] custom snapshot loaded:", snap.listings.length, "listings");
        })
        .catch((e) => console.warn("[realty_app] custom snapshot load failed; using bundle", e));
    }
  }
  // 启动时加载国家统计局 70 城指数（直接内联 CSV，绕过网络）。
  if (!hasStats70() && typeof stats70Raw === "string" && stats70Raw.length > 0) {
    try {
      const rows = loadStats70FromCSV(stats70Raw);
      console.log("[realty_app] stats_70 loaded:", rows.length);
    } catch (e) {
      console.warn("[realty_app] stats_70 parse failed", e);
    }
  }
  if (!hasDailyWangqian() && typeof dailyWangqianRaw === "string" && dailyWangqianRaw.length > 0) {
    try {
      const rows = loadDailyWangqianFromCSV(dailyWangqianRaw);
      console.log("[realty_app] daily_wangqian loaded:", rows.length);
    } catch (e) {
      console.warn("[realty_app] daily_wangqian parse failed", e);
    }
  }
  if (typeof providentFundRaw === "string" && providentFundRaw.length > 0) {
    try {
      const rows = loadProvidentFundRatesFromCSV(providentFundRaw);
      console.log("[realty_app] provident_fund_rates loaded:", rows.length);
    } catch (e) {
      console.warn("[realty_app] provident_fund_rates parse failed", e);
    }
  }
  if (typeof nbsRealEstateRaw === "string" && nbsRealEstateRaw.length > 0) {
    try {
      const rows = loadNbsRealEstateFromCSV(nbsRealEstateRaw);
      console.log("[realty_app] nbs_real_estate loaded:", rows.length);
    } catch (e) {
      console.warn("[realty_app] nbs_real_estate parse failed", e);
    }
  }
  if (typeof gzNewHouseInventoryRaw === "string" && gzNewHouseInventoryRaw.length > 0) {
    try {
      const rows = loadGzInventoryFromCSV(gzNewHouseInventoryRaw);
      console.log("[realty_app] gz_new_house_inventory loaded:", rows.length);
    } catch (e) {
      console.warn("[realty_app] gz_new_house_inventory parse failed", e);
    }
  }
  // 静默尝试从 jsDelivr 拉最新网签（失败则保留包内数据）
  void refreshWangqianFromRemote().then((r) => {
    if (r.ok && r.changed) {
      console.log("[realty_app] daily_wangqian remote updated:", r.rowCount);
    }
  }).catch(() => {});
  console.log("[realty_app] launched, snapshot loaded:", isLoaded());
});

onShow(() => {
  console.log("[realty_app] shown");
  // 切回前台 / Tab 时重刷导航栏与 TabBar；未知系统主题时兜底深色，避免误刷浅色白闪
  refreshThemeChrome();
  // Expo 建议：回到前台再检查；我们加 6h 冷却，避免反复弹升级页
  if (startupUpdateCheckStarted) {
    void runUpdateCheck({ ignoreSkipped: false, fromForeground: true });
  }
});
</script>

<style lang="scss">
@use "./styles/foundation.scss";

page {
  /* 默认 = 深色；浅色由 data-realty-theme=light 覆盖 */
  --color-bg: #080d18;
  --color-surface: #111827;
  --color-surface-raised: #182235;
  --color-border: rgba(148, 163, 184, 0.16);
  --color-border-soft: rgba(148, 163, 184, 0.1);
  --color-text: #e2e8f0;
  --color-text-secondary: #cbd5e1;
  --color-heading: #f3f4f6;
  --color-muted: #94a3b8;
  --color-primary: #22c55e;
  --color-primary-strong: #16a34a;
  --color-primary-contrast: #4ade80;
  --color-primary-text: #052e16;
  --color-primary-soft: rgba(34, 197, 94, 0.16);
  --color-danger: #ef4444;
  --color-danger-text: #ffffff;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-accent: #1d4ed8;
  --color-accent-text: #ffffff;
  --color-soft: #1e293b;
  --color-soft-strong: #334155;
  --color-panel: #0f172a;
  --color-panel-soft: #162033;
  --color-card: #111827;
  --color-chip-text: #cbd5e1;
  --color-overlay: rgba(2, 6, 23, 0.72);
  --color-focus: #38bdf8;
  --color-trend-up: #f87171;
  --color-trend-down: #4ade80;
  --color-trend-flat: #94a3b8;
  --color-success-soft: rgba(34, 197, 94, 0.16);
  --color-danger-soft: rgba(239, 68, 68, 0.16);
  --color-warn-soft: rgba(234, 179, 8, 0.16);
  --color-info-soft: rgba(56, 189, 248, 0.16);
  --color-violet-soft: rgba(139, 92, 246, 0.18);
  --color-on-success-soft: #86efac;
  --color-on-danger-soft: #fca5a5;
  --color-on-warn-soft: #fde68a;
  --shadow-card: 0 12rpx 34rpx rgba(0, 0, 0, 0.2);
  --shadow-sheet: 0 -20rpx 56rpx rgba(0, 0, 0, 0.32);
  background-color: var(--color-bg);
  background-image:
    radial-gradient(circle at 12% -10%, rgba(34, 197, 94, 0.09), transparent 34%),
    radial-gradient(circle at 92% 0%, rgba(59, 130, 246, 0.08), transparent 30%);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
  font-size: 28rpx;
}

/* 浅色：对照 MD3 / 微信 / 贝壳 — 浅灰底 + 白卡片 + 深正文，必须肉眼可辨 */
html[data-realty-theme="light"],
html.realty-theme-light,
html[data-realty-theme="light"] page,
body[data-realty-theme="light"],
body.realty-theme-light,
body[data-realty-theme="light"] page,
page[data-realty-theme="light"],
page.realty-theme-light,
uni-page-body[data-realty-theme="light"],
uni-page-body.realty-theme-light,
.uni-page-body[data-realty-theme="light"],
uni-app[data-realty-theme="light"] {
  --color-bg: #f2f4f7;
  --color-surface: #ffffff;
  --color-surface-raised: #ffffff;
  --color-border: #d8dee8;
  --color-border-soft: #e8edf3;
  --color-text: #1e293b;
  --color-text-secondary: #475569;
  --color-heading: #0f172a;
  --color-muted: #64748b;
  --color-primary: #16a34a;
  --color-primary-strong: #15803d;
  --color-primary-contrast: #15803d;
  --color-primary-text: #ffffff;
  --color-primary-soft: #e9f7ee;
  --color-danger: #dc2626;
  --color-danger-text: #ffffff;
  --color-success: #15803d;
  --color-warning: #b45309;
  --color-accent: #2563eb;
  --color-accent-text: #ffffff;
  --color-soft: #eef2f7;
  --color-soft-strong: #e2e8f0;
  --color-panel: #f8fafc;
  --color-panel-soft: #f1f5f9;
  --color-card: #ffffff;
  --color-chip-text: #334155;
  --color-overlay: rgba(15, 23, 42, 0.42);
  --color-focus: #2563eb;
  --color-trend-up: #dc2626;
  --color-trend-down: #15803d;
  --color-trend-flat: #64748b;
  --color-success-soft: #ecfdf5;
  --color-danger-soft: #fef2f2;
  --color-warn-soft: #fef3c7;
  --color-info-soft: #e0f2fe;
  --color-violet-soft: #ede9fe;
  --color-on-success-soft: #166534;
  --color-on-danger-soft: #991b1b;
  --color-on-warn-soft: #92400e;
  --shadow-card: 0 8rpx 24rpx rgba(15, 23, 42, 0.08);
  --shadow-sheet: 0 -18rpx 48rpx rgba(15, 23, 42, 0.14);
  background-color: var(--color-bg) !important;
  background-image: none !important;
  color: var(--color-text);
}

/*
 * App 端主路径：页面根 `<view class="page" :data-realty-theme="...">` 由 Vue 响应式
 * 绑定属性（逻辑层→渲染层可靠同步）。这里用「属性在任意节点」的通用选择器，让浅色
 * 变量从 .page 根级联到全部子内容——不再依赖 document 写 html/body（App 逻辑层拿不到）。
 */
[data-realty-theme="light"] {
  --color-bg: #f2f4f7;
  --color-surface: #ffffff;
  --color-surface-raised: #ffffff;
  --color-border: #d8dee8;
  --color-border-soft: #e8edf3;
  --color-text: #1e293b;
  --color-text-secondary: #475569;
  --color-heading: #0f172a;
  --color-muted: #64748b;
  --color-primary: #16a34a;
  --color-primary-strong: #15803d;
  --color-primary-contrast: #15803d;
  --color-primary-text: #ffffff;
  --color-primary-soft: #e9f7ee;
  --color-danger: #dc2626;
  --color-danger-text: #ffffff;
  --color-success: #15803d;
  --color-warning: #b45309;
  --color-accent: #2563eb;
  --color-accent-text: #ffffff;
  --color-soft: #eef2f7;
  --color-soft-strong: #e2e8f0;
  --color-panel: #f8fafc;
  --color-panel-soft: #f1f5f9;
  --color-card: #ffffff;
  --color-chip-text: #334155;
  --color-overlay: rgba(15, 23, 42, 0.42);
  --color-focus: #2563eb;
  --color-trend-up: #dc2626;
  --color-trend-down: #15803d;
  --color-trend-flat: #64748b;
  --color-success-soft: #ecfdf5;
  --color-danger-soft: #fef2f2;
  --color-warn-soft: #fef3c7;
  --color-info-soft: #e0f2fe;
  --color-violet-soft: #ede9fe;
  --color-on-success-soft: #166534;
  --color-on-danger-soft: #991b1b;
  --color-on-warn-soft: #92400e;
  --shadow-card: 0 8rpx 24rpx rgba(15, 23, 42, 0.08);
  --shadow-sheet: 0 -18rpx 48rpx rgba(15, 23, 42, 0.14);
  color-scheme: light;
}
/* 页面根本身补底色，避免根 view 透出下层 page 深底 */
.page[data-realty-theme="light"] {
  background-color: var(--color-bg);
  background-image: none;
  color: var(--color-text);
}
/* 深色显式回写：从浅色切回深色时覆盖 .page 上残留的浅色变量 */
[data-realty-theme="dark"] {
  --color-bg: #080d18;
  --color-surface: #111827;
  --color-surface-raised: #182235;
  --color-border: rgba(148, 163, 184, 0.16);
  --color-border-soft: rgba(148, 163, 184, 0.1);
  --color-text: #e2e8f0;
  --color-text-secondary: #cbd5e1;
  --color-heading: #f3f4f6;
  --color-muted: #94a3b8;
  --color-primary: #22c55e;
  --color-primary-strong: #16a34a;
  --color-primary-contrast: #4ade80;
  --color-primary-text: #052e16;
  --color-primary-soft: rgba(34, 197, 94, 0.16);
  --color-danger: #ef4444;
  --color-danger-text: #ffffff;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-accent: #1d4ed8;
  --color-accent-text: #ffffff;
  --color-soft: #1e293b;
  --color-soft-strong: #334155;
  --color-panel: #0f172a;
  --color-panel-soft: #162033;
  --color-card: #111827;
  --color-chip-text: #cbd5e1;
  --color-overlay: rgba(2, 6, 23, 0.72);
  --color-focus: #38bdf8;
  --color-trend-up: #f87171;
  --color-trend-down: #4ade80;
  --color-trend-flat: #94a3b8;
  --color-success-soft: rgba(34, 197, 94, 0.16);
  --color-danger-soft: rgba(239, 68, 68, 0.16);
  --color-warn-soft: rgba(234, 179, 8, 0.16);
  --color-info-soft: rgba(56, 189, 248, 0.16);
  --color-violet-soft: rgba(139, 92, 246, 0.18);
  --color-on-success-soft: #86efac;
  --color-on-danger-soft: #fca5a5;
  --color-on-warn-soft: #fde68a;
  --shadow-card: 0 12rpx 34rpx rgba(0, 0, 0, 0.2);
  --shadow-sheet: 0 -20rpx 56rpx rgba(0, 0, 0, 0.32);
  color-scheme: dark;
}
.page[data-realty-theme="dark"] {
  background-color: var(--color-bg);
  color: var(--color-text);
}

/* 浅色下分数胶囊不用「深色霓虹字」 */
[data-realty-theme="light"] .score-high,
.realty-theme-light .score-high {
  background: #ecfdf5;
  color: #166534;
}
[data-realty-theme="light"] .score-mid,
.realty-theme-light .score-mid {
  background: #fef3c7;
  color: #92400e;
}
[data-realty-theme="light"] .score-low,
.realty-theme-light .score-low {
  background: #fef2f2;
  color: #991b1b;
}

</style>

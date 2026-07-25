<script setup lang="ts">
import { onLaunch, onShow } from "@dcloudio/uni-app";
import { setSnapshot, isLoaded, hasStats70, hasDailyWangqian } from "./local/store";
import { buildSeedSnapshot } from "./local/seedSnapshot";
import { loadSnapshotFromBase } from "./local/snapshotLoader";
import { getStoredCsvBaseUrl, getStoredDataMode } from "./local/dataMode";
import { SNAPSHOT_UPDATED_EVENT } from "./config";
import { loadStats70FromCSV } from "./local/stats70";
import { loadDailyWangqianFromCSV } from "./local/dailyWangqian";
import { loadProvidentFundRatesFromCSV } from "./local/providentFund";
import { loadNbsRealEstateFromCSV } from "./local/nbsRealEstate";
import { loadGzInventoryFromCSV } from "./local/gzNewHouseInventory";
import {
  refreshWangqianFromRemote
} from "./local/wangqianDataRefresher";
import { initializeTheme } from "./utils/theme";
import {
  buildUpdatePrompt,
  checkAppUpdate,
  createDownloadProgressUi,
  downloadAndInstallWgt,
  restartAppAfterUpdate,
  supportsAppUpdateRuntime
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
let startupUpdatePromptOpen = false;

async function checkUpdateOnLaunch() {
  if (startupUpdateCheckStarted || !supportsAppUpdateRuntime()) return;
  startupUpdateCheckStarted = true;
  try {
    const result = await checkAppUpdate({ ignoreSkipped: true });
    if (result.status !== "available" || !result.manifest) return;
    if (startupUpdatePromptOpen) return;
    const manifest = result.manifest;
    const prompt = buildUpdatePrompt(manifest);
    startupUpdatePromptOpen = true;
    uni.showModal({
      ...prompt,
      showCancel: !manifest.force,
      success: async (choice) => {
        if (!choice.confirm) return;
        const url = manifest.wgt?.url;
        if (!url) {
          uni.showModal({
            title: "暂不支持热更新",
            content: "新版本没有提供 WGT 更新包，请前往设置页查看整包更新方式。",
            showCancel: false
          });
          return;
        }
        const progressUi = createDownloadProgressUi();
        progressUi.start("下载更新 0%");
        let installed: Awaited<ReturnType<typeof downloadAndInstallWgt>>;
        try {
          installed = await downloadAndInstallWgt(url, (progress) => {
            progressUi.update(progress);
          });
        } catch (error) {
          installed = {
            ok: false,
            reason: error instanceof Error ? error.message : "下载或安装更新时发生未知错误"
          };
        } finally {
          progressUi.close();
        }
        if (!installed.ok) {
          uni.showModal({
            title: "更新失败",
            content: installed.reason,
            showCancel: false
          });
          return;
        }
        // 等 loading 完全关掉再弹结果，避免原生层抢焦点闪烁
        setTimeout(() => {
          uni.showModal({
            title: "更新已安装",
            content: "热更新资源已经安装完成，立即重启后生效。",
            confirmText: "立即重启",
            cancelText: "稍后",
            success: (restartChoice) => {
              if (restartChoice.confirm && !restartAppAfterUpdate()) {
                uni.showToast({ title: "请手动重启 App", icon: "none", duration: 2500 });
              }
            }
          });
        }, 200);
      },
      complete: () => {
        startupUpdatePromptOpen = false;
      }
    });
  } catch (error) {
    // 启动检查失败不阻塞主页面；用户仍可在设置页手动检查并查看具体错误。
    console.warn("[realty_app] startup update check failed", error);
  }
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
});
</script>

<style lang="scss">
page {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  /* 默认 = 深色；浅色由 data-realty-theme=light 覆盖 */
  --color-bg: #080d18;
  --color-surface: #111827;
  --color-surface-raised: #182235;
  --color-border: rgba(148, 163, 184, 0.16);
  --color-text: #e2e8f0;
  --color-heading: #f3f4f6;
  --color-muted: #94a3b8;
  --color-primary: #22c55e;
  --color-primary-strong: #16a34a;
  --color-primary-contrast: #4ade80;
  --color-primary-text: #052e16;
  --color-danger: #ef4444;
  --color-accent: #3b82f6;
  --color-accent-text: #eff6ff;
  --color-soft: #1e293b;
  --color-soft-strong: #334155;
  --color-panel: #0f172a;
  --color-chip-text: #cbd5e1;
  --color-success-soft: rgba(34, 197, 94, 0.16);
  --color-danger-soft: rgba(239, 68, 68, 0.16);
  --color-warn-soft: rgba(234, 179, 8, 0.16);
  --color-info-soft: rgba(56, 189, 248, 0.16);
  --color-violet-soft: rgba(139, 92, 246, 0.18);
  --color-on-success-soft: #86efac;
  --color-on-danger-soft: #fca5a5;
  --color-on-warn-soft: #fde68a;
  --shadow-card: 0 12rpx 34rpx rgba(0, 0, 0, 0.2);
  background-color: var(--color-bg);
  background-image:
    radial-gradient(circle at 12% -10%, rgba(34, 197, 94, 0.09), transparent 34%),
    radial-gradient(circle at 92% 0%, rgba(59, 130, 246, 0.08), transparent 30%);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
  font-size: 28rpx;
}

html[data-realty-theme="light"],
html[data-realty-theme="light"] page,
body[data-realty-theme="light"],
body[data-realty-theme="light"] page,
page[data-realty-theme="light"] {
  --color-bg: #f4f7fb;
  --color-surface: #ffffff;
  --color-surface-raised: #f6f8fb;
  --color-border: #dfe6ef;
  --color-text: #1f2937;
  --color-heading: #0f172a;
  --color-muted: #64748b;
  --color-primary: #16a34a;
  --color-primary-strong: #15803d;
  --color-primary-contrast: #15803d;
  --color-primary-text: #ffffff;
  --color-accent: #2563eb;
  --color-accent-text: #ffffff;
  --color-soft: #f1f5f9;
  --color-soft-strong: #e2e8f0;
  --color-panel: #f8fafc;
  --color-chip-text: #334155;
  --color-success-soft: #ecfdf5;
  --color-danger-soft: #fef2f2;
  --color-warn-soft: #fef3c7;
  --color-info-soft: #e0f2fe;
  --color-violet-soft: #ede9fe;
  --color-on-success-soft: #166534;
  --color-on-danger-soft: #991b1b;
  --color-on-warn-soft: #92400e;
  --shadow-card: 0 10rpx 30rpx rgba(15, 23, 42, 0.065);
  background-image: none;
}

/* 表单控件默认跟主题，避免深色模式下冒出系统浅色输入框 */
input,
textarea {
  color: var(--color-text);
  background: var(--color-soft);
}

.container {
  padding: 24rpx;
  padding-left: calc(24rpx + var(--safe-area-left));
  padding-right: calc(24rpx + var(--safe-area-right));
  max-width: 1180px;
  margin: 0 auto;
}

.card {
  background: var(--color-surface);
  border: 1rpx solid var(--color-border);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
}

.card-title {
  font-size: 32rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
  color: var(--color-heading);
}

.muted {
  color: var(--color-muted);
  font-size: 24rpx;
}

.row {
  display: flex;
  align-items: center;
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row-gap {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}

.tag {
  display: inline-block;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: var(--color-soft);
  color: var(--color-chip-text);
  font-size: 22rpx;
  margin-right: 8rpx;
  margin-bottom: 8rpx;
}

.tag-success {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
}

.tag-warn {
  background: rgba(234, 179, 8, 0.18);
  color: #facc15;
}

.tag-danger {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

/* 干掉 uni-app button 默认浅灰底/黑字，否则深色模式到处「浅色按键」 */
button {
  background: transparent;
  color: inherit;
  padding-left: 0;
  padding-right: 0;
  line-height: inherit;
  font-size: inherit;
  border-radius: inherit;
}
button::after {
  border: none;
}

.btn,
button.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent) !important;
  color: var(--color-accent-text) !important;
  border: 1rpx solid transparent;
  border-radius: 12rpx;
  padding: 16rpx 32rpx;
  font-size: 28rpx;
  line-height: 1.3;
}

.btn-ghost,
button.btn-ghost {
  background: var(--color-soft) !important;
  color: var(--color-text) !important;
  border: 1rpx solid var(--color-border) !important;
}

.btn-danger,
button.btn-danger {
  background: var(--color-danger) !important;
  color: #fff !important;
}

.score-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 600;
  font-size: 26rpx;
}

.score-high {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
}

.score-mid {
  background: rgba(234, 179, 8, 0.18);
  color: #facc15;
}

.score-low {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

.divider {
  height: 1rpx;
  background: var(--color-border);
  margin: 16rpx 0;
}

.empty {
  padding: 64rpx 0;
  text-align: center;
  color: var(--color-muted);
}

.error {
  padding: 16rpx;
  background: rgba(239, 68, 68, 0.15);
  color: #fecaca;
  border: 1rpx solid #ef4444;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}

/* a11y：列表项/可点击行保证至少 44pt 触摸高度（750rpx 设计稿对应 88rpx） */
.tap-target {
  min-height: 88rpx;
}

/* a11y：键盘焦点（web/小程序可触发） */
.focusable:focus,
button:focus,
.btn:focus {
  outline: 2rpx solid #4ade80;
  outline-offset: 2rpx;
}

/* a11y：屏幕阅读器专用隐藏文本（保留视觉空白） */
.sr-only {
  position: absolute;
  width: 1rpx;
  height: 1rpx;
  padding: 0;
  margin: -1rpx;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* a11y：可点击卡/行的按压反馈 */
.card-active,
.row-active {
  opacity: 0.75;
  background: var(--color-soft) !important;
}
</style>

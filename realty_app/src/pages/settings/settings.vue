<template>
  <view class="page" :data-realty-theme="realtyTheme" :class="'realty-theme-' + realtyTheme">
    <view class="container">
      <view class="settings-hero">
        <view>
          <view class="hero-eyebrow">MY REALTY</view>
          <view class="hero-title">我的</view>
          <view class="hero-subtitle">收藏、浏览足迹与应用设置</view>
        </view>
      </view>

      <view class="settings-grid">
      <view class="card user-library-card" data-user-library>
        <view class="row-between">
          <view>
            <view class="card-title">我的收藏与足迹</view>
            <view class="muted library-privacy">仅保存在本机，不需要账号，也不会上传云端</view>
          </view>
          <text class="local-only-badge">仅本机</text>
        </view>

        <view class="library-tabs" role="tablist">
          <button
            class="library-tab"
            :class="{ 'library-tab--active': libraryTab === 'favorites' }"
            size="mini"
            data-library-tab="favorites"
            @click="libraryTab = 'favorites'"
          >
            收藏 {{ userLibrary.favorites.length }}
          </button>
          <button
            class="library-tab"
            :class="{ 'library-tab--active': libraryTab === 'history' }"
            size="mini"
            data-library-tab="history"
            @click="libraryTab = 'history'"
          >
            最近浏览 {{ userLibrary.history.length }}
          </button>
          <button
            v-if="libraryTab === 'history' && userLibrary.history.length > 0"
            class="library-clear"
            size="mini"
            @click="confirmClearHistory"
          >
            清空足迹
          </button>
        </view>

        <view v-if="libraryItems.length === 0" class="library-empty">
          <view class="library-empty-icon">{{ libraryTab === "favorites" ? "☆" : "◷" }}</view>
          <view class="library-empty-title">
            {{ libraryTab === "favorites" ? "还没有收藏" : "还没有浏览足迹" }}
          </view>
          <view class="muted">
            {{ libraryTab === "favorites" ? "在房源、小区或学校详情页点击收藏" : "成功打开详情后会自动记录，最多保留 100 条、90 天" }}
          </view>
        </view>

        <scroll-view v-else class="library-list" scroll-y>
          <view
            v-for="item in libraryItems"
            :key="`${item.type}:${item.id}`"
            class="library-row tap-target"
            role="button"
            tabindex="0"
            hover-class="library-row--active"
            @click="openLibraryItem(item)"
          >
            <image v-if="item.coverUrl" class="library-cover" :src="item.coverUrl" mode="aspectFill" lazy-load />
            <view v-else class="library-cover library-cover--placeholder">
              {{ item.type === "listing" ? "房" : item.type === "community" ? "区" : "校" }}
            </view>
            <view class="library-copy">
              <view class="library-title">{{ item.title }}</view>
              <view class="muted library-meta">
                {{ libraryTypeLabel(item.type) }}<text v-if="item.city"> · {{ item.city }}</text>
                · {{ formatLibraryTime(item.updatedAt) }}
              </view>
            </view>
            <button
              v-if="libraryTab === 'favorites'"
              class="library-remove"
              size="mini"
              aria-label="取消收藏"
              @click.stop="removeLibraryFavorite(item)"
            >
              移除
            </button>
            <text v-else class="library-caret">›</text>
          </view>
        </scroll-view>
      </view>

      <view class="card">
        <view class="card-title">外观</view>
        <view class="muted">
          浅色 / 深色 / 跟随系统。对齐 uni-app 官方 DarkMode：原生导航栏与 TabBar 随主题切换；页面内容走 CSS 变量。
          详见 docs/THEME_ACCEPTANCE.md。
        </view>
        <view class="theme-options" style="margin-top: 16rpx">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            class="theme-option"
            :class="{ 'theme-option--active': themeMode === option.value }"
            size="mini"
            @click="pickTheme(option.value)"
          >
            <text class="theme-option-icon">{{ option.icon }}</text>
            <text>{{ option.label }}</text>
          </button>
        </view>
      </view>

      <!-- 主卡片：当前状态 + 一键重置回种子数据 -->
      <view class="card">
        <view class="card-title">数据源</view>
        <view class="muted">
          模式：<text style="color: #4ade80">{{ dataModeLabel }}</text>
          <text v-if="loadedAt"> · 加载于 {{ loadedAt }}</text>
        </view>
        <view class="muted" style="margin-top: 6rpx">
          数据量：城市 {{ counts.cities }} / 小区 {{ counts.communities }} / 房源 {{ counts.listings }}
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          挂牌可信度：{{ listingTrustLine }}
        </view>
        <view class="muted" style="margin-top: 4rpx; font-size: 22rpx">
          70城指数：{{ stats70FreshnessLine }}
        </view>
        <view class="muted" style="margin-top: 4rpx; font-size: 20rpx">
          REAL 为公开页解析的真实挂牌；DERIVED 为分析样本，不代表逐套成交。见 HOUSING_PRICE Phase C/D。
        </view>

        <view class="row-gap" style="margin-top: 16rpx">
          <button class="btn" size="mini" @click="resetToSeed">重置为内置快照</button>
        </view>
      </view>

      <!-- 从 CDN 拉整套一致快照 -->
      <view class="card">
        <view class="card-title">远程完整快照</view>
        <view class="muted">
          <text v-if="lastRefresh.at">上次刷新：{{ lastRefresh.at }}</text>
          <text v-else>尚未刷新过，仍用 app 包内数据</text>
        </view>
        <view v-if="lastRefresh.sha" class="muted" style="margin-top: 6rpx; font-size: 22rpx;">
          sha: {{ lastRefresh.sha }}
        </view>
        <view class="row-gap" style="margin-top: 16rpx">
          <button class="btn" size="mini" :disabled="refreshing" @click="refreshFromCdn">
            {{ refreshing ? "刷新中…" : "刷新数据" }}
          </button>
          <button class="btn btn-ghost" size="mini" :disabled="!lastRefresh.sha" @click="restoreSeed">
            回到内置快照
          </button>
        </view>
        <text class="muted" style="margin-top: 12rpx; font-size: 22rpx;">
          一次更新房源与全部衍生指标，避免新房源混用旧榜单。数据来自 GitHub Actions → CDN。
        </text>
      </view>

      <!-- 政府在线查询（WebView，页内登录） -->
      <view class="card">
        <view class="card-title">政府在线查询</view>
        <view class="muted">
          「成交走势」无需登录。查预售/楼盘表：先点「住建局登录」，成功后再点「深圳预售公示」。也可用 i深圳 App → i深房。
        </view>
        <view class="row-gap" style="margin-top: 16rpx">
          <button class="btn" size="mini" @click="openGov('szPortal')">住建局登录</button>
          <button class="btn btn-ghost" size="mini" @click="openGov('szPresale')">深圳预售公示</button>
        </view>
        <view class="row-gap" style="margin-top: 12rpx">
          <button class="btn btn-ghost" size="mini" @click="openGov('szWangqianTrend')">成交走势</button>
          <button class="btn btn-ghost" size="mini" @click="openGov('szZjjPortal')">住建局官网</button>
        </view>
        <text class="muted" style="margin-top: 12rpx; font-size: 22rpx; display: block">
          {{ govLinkNotes.szPortal.note }}
        </text>
      </view>

      <!-- 政府网签宏观数据 -->
      <view class="card">
        <view class="card-title">政府网签（深广）</view>
        <view class="muted">
          <text v-if="lastWangqianRefresh.at">上次刷新：{{ lastWangqianRefresh.at }}</text>
          <text v-else>尚未刷新过，仍用 app 包内网签数据</text>
        </view>
        <view v-if="lastWangqianRefresh.sha" class="muted" style="margin-top: 6rpx; font-size: 22rpx;">
          sha: {{ lastWangqianRefresh.sha }}
        </view>
        <view class="row-gap" style="margin-top: 16rpx">
          <button class="btn" size="mini" :disabled="wangqianRefreshing" @click="refreshWangqianFromCdn">
            {{ wangqianRefreshing ? "刷新中…" : "刷新网签" }}
          </button>
          <button class="btn btn-ghost" size="mini" @click="restoreWangqianBundle">
            回到包内网签
          </button>
        </view>
        <text class="muted" style="margin-top: 12rpx; font-size: 22rpx;">
          数据源：GitHub Actions 工作日抓 zjj.sz.gov.cn → jsDelivr CDN → 本 app
        </text>
      </view>

      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>
      <view v-if="infoMsg" class="card muted">{{ infoMsg }}      </view>

      <!-- 首页与分析（对照大厂：次要能力进设置，不堆首屏） -->
      <view class="card" data-settings-home-ia>
        <view class="card-title">首页与分析</view>
        <view class="muted" style="font-size: 22rpx">
          卡片管理、深度分析、精简模式已从总览首屏迁出。频道「工具 / 供需」仍可直达。
        </view>
        <view class="row-gap" style="margin-top: 16rpx">
          <button class="btn" size="mini" data-settings-go-data-tools @click="goDataTools">
            首页卡片管理
          </button>
          <button class="btn btn-ghost" size="mini" data-settings-go-trend @click="goTrendAnalysis">
            深度可视化
          </button>
          <button class="btn btn-ghost" size="mini" data-settings-go-map @click="goMapAnalysis">
            行政区地图
          </button>
        </view>
        <view class="row-gap" style="margin-top: 12rpx">
          <button
            class="btn btn-ghost"
            size="mini"
            data-settings-featured-toggle
            @click="toggleFeaturedMode"
          >
            {{ featuredMode ? "当前：精简模式 · 点此切完整" : "当前：完整模式 · 点此切精简" }}
          </button>
        </view>
        <text class="muted" style="margin-top: 12rpx; font-size: 22rpx; display: block">
          精简模式影响总览信息流卡数量；切换后回总览立即生效。
        </text>
      </view>

      <!-- 高级设置（折叠） -->
      <view class="card">
        <view
          class="row-between tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="toggleAdvanced"
        >
          <view class="card-title" style="margin-bottom: 0">高级设置</view>
          <text class="muted">{{ advancedOpen ? "▾" : "▸" }}</text>
        </view>

        <view v-if="advancedOpen" style="margin-top: 16rpx">
          <view class="form-item">
            <text class="form-label">数据源类型</text>
            <view
            class="picker-value tap tap-target"
            role="button"
            tabindex="0"
            hover-class="row-active"
            @click="pickDataMode"
            style="display: flex; justify-content: space-between;"
          >
              <text>{{ dataModeLabels[dataModeIndex] }}</text>
              <text class="muted">▾</text>
            </view>
          </view>

          <view v-if="dataMode === 'csv-url'" class="form-item" style="margin-top: 16rpx">
            <text class="form-label">完整 CSV 快照根地址</text>
            <input
              class="input"
              type="text"
              v-model="csvBaseUrl"
              placeholder="例如 https://your-cdn.com/realty-data/"
            />
            <text class="muted" style="margin-top: 8rpx; font-size: 22rpx">
              5 个基础文件必需；其余榜单与地图 CSV 会同步加载。该模式会在下次启动时自动恢复。
            </text>
          </view>

          <view class="row-gap" style="margin-top: 16rpx">
            <button class="btn btn-ghost" size="mini" @click="save">保存</button>
            <button class="btn btn-ghost" size="mini" @click="downloadNewCsv">下载新 CSV</button>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-title">关于</view>
        <view class="muted">
          Realty App v{{ APP_VERSION }} · 启动时自动检查热更新；升级交互对齐 uni-upgrade-center / Expo Updates<br />
          默认数据：真实挂牌与公开指标派生样本并存，详情页会明确标注数据等级<br />
          评分规则在手机上实时计算；核心路径已纳入自动化回归
        </view>
      </view>

      <!-- 应用升级（OTA / 整包） -->
      <!-- #ifdef APP-PLUS -->
      <view class="card" data-card="app-update">
        <view class="card-title">应用升级</view>
        <view class="muted">
          当前版本：v{{ localVersion.versionName }}（{{ localVersion.versionCode }}）
        </view>
        <view v-if="updateStatus" class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          {{ updateStatus }}
        </view>
        <view v-if="updateProgress" style="margin-top: 12rpx">
          <ProgressBar :percent="updateProgressPercent" size="lg" />
          <view class="muted" style="margin-top: 6rpx; font-size: 22rpx">
            下载进度：{{ updateProgress }}
          </view>
        </view>
        <view class="row-gap" style="margin-top: 16rpx">
          <button
            class="btn"
            size="mini"
            :disabled="updateChecking"
            @click="onCheckUpdate"
          >
            {{ updateChecking ? "检查中…" : "检查更新" }}
          </button>
          <button
            v-if="updateAvailable"
            class="btn"
            size="mini"
            :disabled="updateDownloading"
            @click="onOpenUpgradePopup"
          >
            打开升级页
          </button>
          <button
            v-if="updateAvailable"
            class="btn btn-ghost"
            size="mini"
            :disabled="updateDownloading"
            @click="onDownloadAndInstall"
          >
            {{ updateDownloading ? "安装中…" : "本页安装" }}
          </button>
          <button
            v-if="updateAvailable && !updateManifest?.force"
            class="btn btn-ghost"
            size="mini"
            @click="onSkipUpdate"
          >
            跳过该版本
          </button>
        </view>
        <view v-if="updateManifest?.notes" class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          更新内容：{{ updateManifest.notes }}
        </view>
        <text class="muted" style="margin-top: 12rpx; font-size: 22rpx; display: block">
          数据源：GitHub Actions build-app-wgt → jsDelivr CDN；
          整包 APK 见 <text class="link" @click="openGithubReleases">Releases</text>。
        </text>
      </view>
      <!-- #endif -->
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { APP_VERSION, SNAPSHOT_UPDATED_EVENT } from "../../config";
import { toErrorMessage } from "../../utils/errorMessage";
import { setSnapshot, getSnapshot } from "../../local/store";
import {
  formatListingTrustLine,
  summarizeListingTrust
} from "../../local/listingTrustSummary";
import { assessStats70Freshness } from "../../local/stats70Freshness";
import { getLatestMonth } from "../../local/stats70";
import { buildSeedSnapshot, resetSeedSnapshotCache } from "../../local/seedSnapshot";
import { showToast } from "../../utils/format";
import { loadSnapshotFromBase } from "../../local/snapshotLoader";
import {
  CSV_BASE_URL_STORAGE_KEY,
  DATA_MODE_STORAGE_KEY,
  getStoredCsvBaseUrl,
  getStoredDataMode,
  type DataMode
} from "../../local/dataMode";
import {
  refreshFromRemote,
  getLastRefreshInfo,
  clearRemoteCache
} from "../../local/dataRefresher";
import {
  refreshWangqianFromRemote,
  getLastWangqianRefreshInfo,
  clearWangqianRemoteCache
} from "../../local/wangqianDataRefresher";
import { loadDailyWangqianFromCSV } from "../../local/dailyWangqian";
import { getStoredThemeMode, setThemeMode, resolvedThemeRef as realtyTheme, type ThemeMode } from "../../utils/theme";
import { GOV_WEB_LINKS, openGovWeb, type GovWebLinkKey } from "../../config/govLinks";
import {
  checkAppUpdate,
  downloadAndInstallWgt,
  getLocalVersion,
  openUpgradePopup,
  restartAppAfterUpdate,
  skipVersion,
  type AppUpdateManifest
} from "../../utils/appUpdate";
import { openExternalUrl } from "../../utils/openExternal";
import ProgressBar from "../../components/ProgressBar.vue";
import { buildUserLibraryUrl, type LocalEntityType, type UserLibraryEntity } from "../../local/userLibrary";
import { useUserLibraryStore } from "../../store/userLibrary";
// @ts-ignore
import dailyWangqianRaw from "../../../static/daily_wangqian.csv?raw";

const FEATURED_MODE_KEY = "realty_dashboard_featured_mode";
const userLibrary = useUserLibraryStore();
const libraryTab = ref<"favorites" | "history">("favorites");
const libraryItems = computed(() => libraryTab.value === "favorites"
  ? userLibrary.favorites
  : userLibrary.history
);

function libraryTypeLabel(type: LocalEntityType): string {
  return ({ listing: "房源", community: "小区", school: "学校" } as const)[type];
}

function formatLibraryTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function openLibraryItem(item: UserLibraryEntity): void {
  uni.navigateTo({ url: buildUserLibraryUrl(item) });
}

function removeLibraryFavorite(item: UserLibraryEntity): void {
  userLibrary.removeFavorite(item.type, item.id);
  showToast("已从本机收藏移除");
}

function confirmClearHistory(): void {
  uni.showModal({
    title: "清空浏览足迹",
    content: "将删除本机保存的全部浏览记录，此操作不可撤销。",
    confirmText: "清空",
    confirmColor: "#dc2626",
    success: (result) => {
      if (!result.confirm) return;
      userLibrary.clearHistory();
      showToast("浏览足迹已清空");
    }
  });
}

function goDataTools(): void {
  uni.navigateTo({ url: "/pages/data-tools/data-tools" });
}
function goTrendAnalysis(): void {
  uni.navigateTo({ url: "/pages/trend-analysis/trend-analysis" });
}
function goMapAnalysis(): void {
  uni.navigateTo({ url: "/pages/map-analysis/map-analysis" });
}

function readFeaturedMode(): boolean {
  try {
    const raw = uni.getStorageSync(FEATURED_MODE_KEY);
    if (raw === "" || raw == null) return true;
    return JSON.parse(String(raw)) as boolean;
  } catch {
    return true;
  }
}
const featuredMode = ref(readFeaturedMode());
function toggleFeaturedMode(): void {
  featuredMode.value = !featuredMode.value;
  try {
    uni.setStorageSync(FEATURED_MODE_KEY, JSON.stringify(featuredMode.value));
  } catch (e) {
    console.warn("saveFeaturedMode failed:", e);
  }
  showToast(featuredMode.value ? "已切精简模式" : "已切完整模式");
}

const govLinkNotes = GOV_WEB_LINKS;

function openGov(key: GovWebLinkKey) {
  openGovWeb(key);
}

const dataMode = ref<DataMode>(getStoredDataMode());
const csvBaseUrl = ref<string>(getStoredCsvBaseUrl());
const advancedOpen = ref<boolean>(false);
const refreshing = ref<boolean>(false);
const lastRefresh = ref<{ sha?: string; at?: string }>(getLastRefreshInfo());
const wangqianRefreshing = ref<boolean>(false);
const themeMode = ref<ThemeMode>(getStoredThemeMode());
const themeOptions = [
  { value: "system" as const, label: "跟随系统", icon: "◐" },
  { value: "light" as const, label: "浅色", icon: "☀" },
  { value: "dark" as const, label: "深色", icon: "☾" }
];

function pickTheme(mode: ThemeMode) {
  themeMode.value = mode;
  setThemeMode(mode);
  showToast(mode === "system" ? "已跟随系统外观" : `已切换为${mode === "light" ? "浅色" : "深色"}模式`);
}

const lastWangqianRefresh = ref<{ sha?: string; at?: string }>(getLastWangqianRefreshInfo());

const errorMsg = ref<string>("");
const infoMsg = ref<string>("");

const loadedAt = computed(() => {
  const s = getSnapshot();
  return s ? s.importedAt.slice(0, 19).replace("T", " ") : "";
});

const counts = computed(() => {
  const s = getSnapshot();
  return {
    cities: s?.cities.length ?? 0,
    communities: s?.communities.length ?? 0,
    listings: s?.listings.length ?? 0
  };
});

const listingTrustLine = computed(() => {
  const s = getSnapshot();
  return formatListingTrustLine(summarizeListingTrust(s?.listings ?? []));
});

const stats70FreshnessLine = computed(() => assessStats70Freshness(getLatestMonth()).label);

const dataModeLabels = ["内置完整快照", "自定义 CSV 快照"];
const dataModeIndex = computed(() => dataMode.value === "csv-url" ? 1 : 0);
const dataModeLabel = computed(() => dataModeLabels[dataModeIndex.value]);

function onDataModeChange(e: any) {
  // 兜底，保留兼容性
  pickDataMode();
}

function pickDataMode() {
  uni.showActionSheet({
    itemList: dataModeLabels,
    title: "数据源类型",
    success: (res: any) => {
      const idx = Number(res.tapIndex);
      dataMode.value = idx === 1 ? "csv-url" : "seed";
    },
    fail: () => {}
  });
}

function toggleAdvanced() {
  advancedOpen.value = !advancedOpen.value;
}

async function save() {
  errorMsg.value = "";
  infoMsg.value = "";
  try {
    if (dataMode.value === "csv-url") {
      if (!csvBaseUrl.value.trim()) {
        showToast("请填写完整 CSV 快照地址");
        return;
      }
      uni.setStorageSync(CSV_BASE_URL_STORAGE_KEY, csvBaseUrl.value.trim());
      await loadFromCsvUrl(csvBaseUrl.value);
    }
    if (dataMode.value === "seed") {
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
      uni.$emit(SNAPSHOT_UPDATED_EVENT);
    }
    uni.setStorageSync(DATA_MODE_STORAGE_KEY, dataMode.value);
    showToast("已保存");
  } catch (e) {
    errorMsg.value = toErrorMessage(e);
  }
}

async function loadFromCsvUrl(base: string) {
  const root = base.trim().replace(/\/+$/, "");
  const snap = await loadSnapshotFromBase(root, "csv-url:" + root);
  setSnapshot(snap);
  uni.$emit(SNAPSHOT_UPDATED_EVENT);
  infoMsg.value = `已加载：${snap.listings.length} 套房源 / ${snap.communities.length} 个小区`;
}

async function downloadNewCsv() {
  errorMsg.value = "";
  infoMsg.value = "";
  if (dataMode.value === "csv-url" && csvBaseUrl.value) {
    try {
      await loadFromCsvUrl(csvBaseUrl.value);
      showToast("下载完成");
    } catch (e) {
      errorMsg.value = `下载失败：${toErrorMessage(e)}`;
    }
    return;
  }
  if (dataMode.value === "seed") {
    await resetToSeed();
    return;
  }
  // 不应到这里；保留兜底提示，避免静默失败
  infoMsg.value = "当前数据源无需手动下载。";
}

async function resetToSeed() {
  resetSeedSnapshotCache();
  const snap = buildSeedSnapshot();
  setSnapshot(snap);
  uni.$emit(SNAPSHOT_UPDATED_EVENT);
  dataMode.value = "seed";
  uni.setStorageSync(DATA_MODE_STORAGE_KEY, "seed");
  infoMsg.value = `已加载内置完整快照：${snap.listings.length} 套房源 / ${snap.communities.length} 个小区`;
  showToast("已重置为内置快照");
}

async function refreshFromCdn() {
  if (refreshing.value) return;
  errorMsg.value = "";
  infoMsg.value = "";
  refreshing.value = true;
  try {
    const result = await refreshFromRemote();
    lastRefresh.value = getLastRefreshInfo();
    if (result.ok && result.changed) {
      uni.$emit(SNAPSHOT_UPDATED_EVENT);
      const s = getSnapshot();
      infoMsg.value = `已更新 ${result.rowCount ?? s?.listings.length ?? 0} 套房源 · ${result.meta?.generated_at ?? ""}`;
      showToast("数据已更新");
    } else if (result.ok && !result.changed) {
      infoMsg.value = `已是最新版本（${result.rowCount ?? "?"} 条） · ${result.meta?.generated_at ?? ""}`;
      showToast("已是最新");
    } else {
      errorMsg.value = result.error ?? "刷新失败";
    }
  } catch (e) {
    errorMsg.value = `刷新失败：${toErrorMessage(e)}`;
  } finally {
    refreshing.value = false;
  }
}

async function refreshWangqianFromCdn() {
  if (wangqianRefreshing.value) return;
  errorMsg.value = "";
  infoMsg.value = "";
  wangqianRefreshing.value = true;
  try {
    const result = await refreshWangqianFromRemote();
    lastWangqianRefresh.value = getLastWangqianRefreshInfo();
    if (result.ok && result.changed) {
      infoMsg.value = `网签已更新 ${result.rowCount ?? "?"} 行 · ${result.meta?.generated_at ?? ""}`;
      showToast("网签已更新");
    } else if (result.ok && !result.changed) {
      infoMsg.value = `网签已是最新（${result.rowCount ?? "?"} 行） · ${result.meta?.generated_at ?? ""}`;
      showToast("网签已是最新");
    } else {
      errorMsg.value = result.error ?? "网签刷新失败";
    }
  } catch (e) {
    errorMsg.value = `网签刷新失败：${toErrorMessage(e)}`;
  } finally {
    wangqianRefreshing.value = false;
  }
}

function restoreWangqianBundle() {
  clearWangqianRemoteCache();
  lastWangqianRefresh.value = {};
  if (typeof dailyWangqianRaw === "string" && dailyWangqianRaw.length > 0) {
    loadDailyWangqianFromCSV(dailyWangqianRaw);
    infoMsg.value = "已恢复包内网签数据";
    showToast("已恢复包内网签");
  } else {
    errorMsg.value = "包内网签数据不可用";
  }
}

function restoreSeed() {
  clearRemoteCache();
  lastRefresh.value = {};
  resetToSeed();
}

// ===== 应用升级（OTA）=====
const localVersion = ref<{ versionName: string; versionCode: number }>({
  versionName: APP_VERSION,
  versionCode: 0
});
const updateStatus = ref<string>("");
const updateProgress = ref<string>("");
const updateProgressPercent = ref<number>(0);
const updateAvailable = ref<boolean>(false);
const updateChecking = ref<boolean>(false);
const updateDownloading = ref<boolean>(false);
const updateManifest = ref<AppUpdateManifest | null>(null);

// 页面加载时初始化本地版本（仅 APP-PLUS 走 plus，其它平台用 src/config 兜底）
void (async () => {
  try {
    const info = await getLocalVersion();
    if (info.versionCode > 0) localVersion.value = info;
  } catch (e) {
    // 忽略：H5 / 小程序无 plus
  }
})();

async function onCheckUpdate() {
  errorMsg.value = "";
  updateStatus.value = "";
  updateChecking.value = true;
  try {
    const result = await checkAppUpdate();
    if (result.status === "available" && result.manifest) {
      updateManifest.value = result.manifest;
      updateAvailable.value = true;
      updateStatus.value = `发现新版本 v${result.manifest.versionName}（${result.manifest.versionCode}）`;
      // 对齐升级中心：检查到后直接进自定义升级页
      openUpgradePopup(result.manifest);
    } else if (result.status === "up-to-date") {
      updateManifest.value = result.manifest ?? null;
      updateAvailable.value = false;
      updateStatus.value = "已是最新版本";
    } else if (result.status === "skipped") {
      updateManifest.value = result.manifest ?? null;
      updateAvailable.value = false;
      updateStatus.value = `已跳过 v${result.manifest?.versionName}`;
    } else {
      updateStatus.value = `检查失败：${result.reason ?? "未知错误"}`;
    }
  } catch (e) {
    updateStatus.value = `检查异常：${toErrorMessage(e)}`;
  } finally {
    updateChecking.value = false;
  }
}

function onOpenUpgradePopup() {
  const m = updateManifest.value;
  if (!m) return;
  openUpgradePopup(m);
}

async function onDownloadAndInstall() {
  const m = updateManifest.value;
  if (!m) return;
  const url = m.wgt?.url;
  if (!url) {
    updateStatus.value = "新版本未提供 wgt 资源，无法 OTA 升级";
    return;
  }
  updateDownloading.value = true;
  updateStatus.value = "正在下载 wgt…";
  updateProgress.value = "0%";
  updateProgressPercent.value = 0;
  try {
    const result = await downloadAndInstallWgt(url, (p) => {
      if (p.total > 0) {
        const pct = Math.floor((p.downloaded / p.total) * 100);
        updateProgress.value = `${pct}%`;
        updateProgressPercent.value = pct;
      } else {
        updateProgress.value = `${(p.downloaded / 1024).toFixed(0)} KB`;
      }
    });
    if (result.ok) {
      updateStatus.value = "安装成功，请重启生效";
      updateProgress.value = "100%";
      updateProgressPercent.value = 100;
      // 稍等一帧再弹窗，避免 install 刚结束立刻抢 UI 触发个别机型异常
      setTimeout(() => {
        uni.showModal({
          title: "升级完成",
          content: "新资源已装好。点「立即重启」生效；若闪退过，请改用新整包 APK（已补 zip4j）再试 OTA。",
          confirmText: "立即重启",
          cancelText: "稍后",
          success: (res) => {
            if (res.confirm) {
              setTimeout(() => {
                if (!restartAppAfterUpdate()) {
                  updateStatus.value = "自动重启失败，请手动关闭并重新打开 App";
                }
              }, 300);
            } else {
              updateStatus.value = "已安装，请手动关闭并重新打开 App 生效";
            }
          }
        });
      }, 200);
    } else {
      updateStatus.value = `升级失败：${result.reason}`;
    }
  } catch (e) {
    updateStatus.value = `升级异常：${toErrorMessage(e)}`;
  } finally {
    updateDownloading.value = false;
  }
}

function onSkipUpdate() {
  const m = updateManifest.value;
  if (!m) return;
  skipVersion(m.versionCode);
  updateAvailable.value = false;
  updateStatus.value = `已跳过 v${m.versionName}`;
}

function openGithubReleases() {
  openExternalUrl("https://github.com/xuefeng0324/realty/releases");
}
</script>

<style lang="scss" scoped>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

@media (max-width: 760px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

.settings-hero {
  margin-bottom: 16rpx;
}

.hero-eyebrow {
  color: var(--color-primary);
  font-size: 19rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
}

.hero-title {
  font-size: 36rpx;
  font-weight: 700;
  margin-top: 8rpx;
}

.hero-subtitle {
  margin-top: 6rpx;
  color: var(--color-muted);
  font-size: 23rpx;
}

.user-library-card {
  grid-column: 1 / -1;
}

.library-privacy {
  margin-top: 4rpx;
  font-size: 21rpx;
}

.local-only-badge {
  flex: 0 0 auto;
  padding: 7rpx 13rpx;
  border-radius: 999rpx;
  background: rgba(16, 185, 129, 0.12);
  color: var(--color-primary);
  font-size: 20rpx;
  font-weight: 700;
}

.library-tabs {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 18rpx;
}

.library-tab,
.library-clear,
.library-remove {
  margin: 0;
  border: 1rpx solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: 21rpx;
}

.library-tab::after,
.library-clear::after,
.library-remove::after {
  border: 0;
}

.library-tab--active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-primary-text);
}

.library-clear {
  margin-left: auto;
  color: var(--color-danger, #dc2626);
}

.library-empty {
  padding: 38rpx 20rpx 24rpx;
  text-align: center;
}

.library-empty-icon {
  color: var(--color-primary);
  font-size: 52rpx;
}

.library-empty-title {
  margin: 8rpx 0 4rpx;
  color: var(--color-heading);
  font-size: 26rpx;
  font-weight: 700;
}

.library-list {
  max-height: 620rpx;
  margin-top: 14rpx;
}

.library-row {
  display: flex;
  min-height: 92rpx;
  align-items: center;
  gap: 14rpx;
  padding: 12rpx 0;
  border-top: 1rpx solid var(--color-border);
}

.library-row--active {
  background: var(--color-soft);
}

.library-cover {
  flex: 0 0 82rpx;
  width: 82rpx;
  height: 68rpx;
  border-radius: 10rpx;
  background: var(--color-soft);
}

.library-cover--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 700;
}

.library-copy {
  min-width: 0;
  flex: 1;
}

.library-title {
  overflow: hidden;
  color: var(--color-heading);
  font-size: 25rpx;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-meta {
  margin-top: 5rpx;
  font-size: 20rpx;
}

.library-remove {
  flex: 0 0 auto;
  color: var(--color-muted);
}

.library-caret {
  color: var(--color-muted);
  font-size: 34rpx;
}

.theme-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.theme-option {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  background: var(--color-surface-raised);
  color: var(--color-text);
  border: 1rpx solid var(--color-border);
}

.theme-option--active {
  background: var(--color-primary-strong) !important;
  border-color: var(--color-primary-strong);
  color: var(--color-primary-text) !important;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.form-label {
  color: var(--color-muted);
  font-size: 24rpx;
}

.picker-value {
  background: var(--color-soft);
  border: 1rpx solid var(--color-border);
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  color: var(--color-heading);
  font-size: 26rpx;
}

.input {
  box-sizing: border-box;
  min-height: 64rpx;
  line-height: 40rpx;
  background: var(--color-soft);
  border: 1rpx solid var(--color-border);
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  color: var(--color-heading);
  font-size: 26rpx;
}
</style>

<template>
  <view class="page">
    <view class="container">
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
          {{ govLinkNotes.szPortal }}
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
      <view v-if="infoMsg" class="card muted">{{ infoMsg }}</view>

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
          Realty App v{{ APP_VERSION }} · 纯本地快照模式<br />
          默认数据：真实挂牌与公开指标派生样本并存，详情页会明确标注数据等级<br />
          评分规则在手机上实时计算；当前自动化测试为 458 个用例
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { APP_VERSION, SNAPSHOT_UPDATED_EVENT } from "../../config";
import { toErrorMessage } from "../../utils/errorMessage";
import { setSnapshot, getSnapshot } from "../../local/store";
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
import { GOV_WEB_LINKS, openGovWeb, type GovWebLinkKey } from "../../config/govLinks";
// @ts-ignore
import dailyWangqianRaw from "../../../static/daily_wangqian.csv?raw";

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
</script>

<style lang="scss" scoped>
.form-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.form-label {
  color: #94a3b8;
  font-size: 24rpx;
}

.picker-value {
  background: #1e293b;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  color: #f3f4f6;
  font-size: 26rpx;
}

.input {
  background: #1e293b;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  color: #f3f4f6;
  font-size: 26rpx;
}
</style>

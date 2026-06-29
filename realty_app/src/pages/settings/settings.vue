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
          <button class="btn" size="mini" @click="resetToSeed">重置为政府公开种子</button>
          <button class="btn btn-ghost" size="mini" @click="resetToDemo">切到示例数据</button>
        </view>
      </view>

      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>
      <view v-if="infoMsg" class="card muted">{{ infoMsg }}</view>

      <!-- 高级设置（折叠） -->
      <view class="card">
        <view class="row-between" @click="toggleAdvanced">
          <view class="card-title" style="margin-bottom: 0">高级设置</view>
          <text class="muted">{{ advancedOpen ? "▾" : "▸" }}</text>
        </view>

        <view v-if="advancedOpen" style="margin-top: 16rpx">
          <view class="form-item">
            <text class="form-label">数据源类型</text>
            <view class="picker-value tap" @click="pickDataMode" style="display: flex; justify-content: space-between;">
              <text>{{ dataModeLabels[dataModeIndex] }}</text>
              <text class="muted">▾</text>
            </view>
          </view>

          <view v-if="dataMode === 'http'" class="form-item" style="margin-top: 16rpx">
            <text class="form-label">后端地址（http://host:port）</text>
            <input
              class="input"
              type="text"
              v-model="httpBaseUrl"
              placeholder="例如 http://192.168.1.10:8000"
            />
          </view>

          <view v-if="dataMode === 'csv-url'" class="form-item" style="margin-top: 16rpx">
            <text class="form-label">CSV 远程地址（5 个文件根 URL）</text>
            <input
              class="input"
              type="text"
              v-model="csvBaseUrl"
              placeholder="例如 https://your-cdn.com/realty-data/"
            />
            <text class="muted" style="margin-top: 8rpx; font-size: 22rpx">
              需要 5 个文件：cities.csv / communities.csv / schools.csv / school_indicators.csv / listings.csv
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
          Realty App v0.3.0 · 纯 app 模式（不依赖电脑后端）<br />
          默认数据：政府公开种子（国家统计局 70 城指数 + 公开深圳/广州/珠海楼盘均价派生，1226 套房源）<br />
          评分规则在手机上实时计算，与 backend Python 版 1:1 对应（42 个测试对照）
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from "../../config";
import { setSnapshot, getSnapshot } from "../../local/store";
import { importSnapshot } from "../../local/importer";
import { buildDemoSnapshot } from "../../local/demoData";
import { buildSeedSnapshot, resetSeedSnapshotCache } from "../../local/seedSnapshot";
import { getApiBaseUrl, setApiBaseUrl } from "../../api/http";
import { showToast } from "../../utils/format";

type DataMode = "seed" | "demo" | "csv-url" | "http";

const dataMode = ref<DataMode>(
  (uni.getStorageSync("realty_app.dataMode") as DataMode) ?? "seed"
);
const httpBaseUrl = ref<string>(getApiBaseUrl());
const csvBaseUrl = ref<string>(
  (uni.getStorageSync("realty_app.csvBaseUrl") as string) ?? ""
);
const advancedOpen = ref<boolean>(false);

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

const dataModeLabels = ["政府公开种子", "示例数据（内置）", "下载 CSV（远程）", "HTTP 后端"];
const dataModeIndex = computed(() =>
  {
    const v = dataMode.value;
    if (v === "seed") return 0;
    if (v === "demo") return 1;
    if (v === "csv-url") return 2;
    return 3;
  }
);
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
      if (idx === 0) dataMode.value = "seed";
      else if (idx === 1) dataMode.value = "demo";
      else if (idx === 2) dataMode.value = "csv-url";
      else dataMode.value = "http";
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
    if (dataMode.value === "http") {
      const v = httpBaseUrl.value.trim();
      if (!/^https?:\/\//i.test(v)) {
        showToast("后端地址必须以 http(s):// 开头");
        return;
      }
      setApiBaseUrl(v.replace(/\/+$/, ""));
      uni.setStorageSync(STORAGE_KEYS.apiBaseUrl, v);
    }
    if (dataMode.value === "csv-url" && csvBaseUrl.value) {
      uni.setStorageSync("realty_app.csvBaseUrl", csvBaseUrl.value);
      await loadFromCsvUrl(csvBaseUrl.value);
    }
    if (dataMode.value === "seed") {
      resetSeedSnapshotCache();
      setSnapshot(buildSeedSnapshot());
    }
    uni.setStorageSync("realty_app.dataMode", dataMode.value);
    showToast("已保存");
  } catch (e: any) {
    errorMsg.value = e?.message || String(e);
  }
}

async function loadFromCsvUrl(base: string) {
  const root = base.replace(/\/+$/, "") + "/";
  const fetchText = (path: string) =>
    fetch(root + path).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
      return r.text();
    });
  const snap = importSnapshot(
    {
      citiesCSV: await fetchText("cities.csv"),
      communitiesCSV: await fetchText("communities.csv"),
      schoolsCSV: await fetchText("schools.csv"),
      schoolIndicatorsCSV: await fetchText("school_indicators.csv"),
      listingsCSV: await fetchText("listings.csv")
    },
    "csv-url:" + root
  );
  setSnapshot(snap);
  infoMsg.value = `已加载：${snap.listings.length} 套房源 / ${snap.communities.length} 个小区`;
}

async function downloadNewCsv() {
  errorMsg.value = "";
  infoMsg.value = "";
  if (dataMode.value === "csv-url" && csvBaseUrl.value) {
    try {
      await loadFromCsvUrl(csvBaseUrl.value);
      showToast("下载完成");
    } catch (e: any) {
      errorMsg.value = `下载失败：${e?.message || String(e)}`;
    }
    return;
  }
  if (dataMode.value === "http") {
    infoMsg.value =
      "HTTP 模式下数据由后端实时提供，无需手动下载。请打开 app 其他页面即可看到最新数据。";
    return;
  }
  if (dataMode.value === "seed" || dataMode.value === "demo") {
    await resetToSeed();
    return;
  }
  // 其他兜底：重新随机生成 demo 数据
  setSnapshot(buildDemoSnapshot());
  infoMsg.value = "已重新生成示例数据";
}

function resetToDemo() {
  setSnapshot(buildDemoSnapshot());
  dataMode.value = "demo";
  uni.setStorageSync("realty_app.dataMode", "demo");
  showToast("已重置为示例数据");
}

async function resetToSeed() {
  resetSeedSnapshotCache();
  const snap = buildSeedSnapshot();
  setSnapshot(snap);
  dataMode.value = "seed";
  uni.setStorageSync("realty_app.dataMode", "seed");
  infoMsg.value = `已加载政府公开种子：${snap.listings.length} 套房源 / ${snap.communities.length} 个小区`;
  showToast("已重置为政府公开种子数据");
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
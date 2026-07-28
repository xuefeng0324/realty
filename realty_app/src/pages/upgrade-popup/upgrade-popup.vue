<template>
  <!--
    参考 DCloud uni-upgrade-center：透明独立页盖住 tabBar/导航，
    用自定义卡片 + 进度条（Expo Updates 同款）代替原生 showModal/showLoading，避免闪烁。
  -->
  <view class="upgrade-mask" :data-realty-theme="realtyTheme" :class="'realty-theme-' + realtyTheme" @touchmove.stop.prevent="noop">
    <view class="upgrade-card">
      <view class="upgrade-eyebrow">APP UPDATE</view>
      <view class="upgrade-title">发现新版本 v{{ manifest?.versionName || "—" }}</view>
      <view class="upgrade-meta muted">
        版本号 {{ manifest?.versionCode || "—" }}
        <text v-if="manifest?.publishedAt"> · {{ formatPublished(manifest.publishedAt) }}</text>
      </view>

      <scroll-view scroll-y class="upgrade-notes">
        <text class="upgrade-notes-text">{{ notesText }}</text>
      </scroll-view>

      <view v-if="phase === 'downloading' || phase === 'installing'" class="upgrade-progress">
        <ProgressBar :percent="progressPercent" size="lg" />
        <text class="muted upgrade-progress-hint">{{ phaseLabel }}</text>
      </view>

      <view v-if="errorMsg" class="upgrade-error">{{ errorMsg }}</view>

      <view class="upgrade-actions">
        <button
          v-if="phase === 'idle' || phase === 'error'"
          class="btn upgrade-btn"
          :disabled="busy"
          @click="startDownload"
        >
          {{ phase === "error" ? "重试下载" : "立即更新" }}
        </button>
        <button
          v-if="phase === 'done'"
          class="btn upgrade-btn"
          @click="restartNow"
        >
          立即重启
        </button>
        <button
          v-if="canDismiss"
          class="btn btn-ghost upgrade-btn"
          :disabled="busy"
          @click="dismiss"
        >
          {{ phase === "done" ? "稍后重启" : "稍后" }}
        </button>
      </view>

      <text v-if="manifest?.force" class="upgrade-force muted">
        本版本为强制更新，需完成安装后才能继续使用。
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { resolvedThemeRef as realtyTheme } from "../../utils/theme";
import { computed, ref } from "vue";
import { onBackPress, onLoad } from "@dcloudio/uni-app";
import { APP_UPDATE_PENDING_KEY } from "../../config";
import ProgressBar from "../../components/ProgressBar.vue";
import {
  type AppUpdateManifest,
  createThrottledProgressHandler,
  downloadAndInstallWgt,
  restartAppAfterUpdate,
  skipVersion
} from "../../utils/appUpdate";

type Phase = "idle" | "downloading" | "installing" | "done" | "error";

const manifest = ref<AppUpdateManifest | null>(null);
const phase = ref<Phase>("idle");
const progressPercent = ref(0);
const errorMsg = ref("");
const busy = computed(() => phase.value === "downloading" || phase.value === "installing");

const notesText = computed(() => {
  const raw = manifest.value?.notes?.trim();
  return raw && raw.length > 0 ? raw : "包含功能改进与问题修复。";
});

const phaseLabel = computed(() => {
  if (phase.value === "installing") return "正在安装…";
  if (progressPercent.value > 0) return `正在下载 ${progressPercent.value}%`;
  return "正在连接更新服务器…";
});

const canDismiss = computed(() => {
  if (manifest.value?.force && phase.value !== "done") return false;
  return phase.value === "idle" || phase.value === "error" || phase.value === "done";
});

function noop() {}

function formatPublished(iso: string): string {
  const d = iso.slice(0, 10);
  return d || iso;
}

function readPending(): AppUpdateManifest | null {
  try {
    const raw = uni.getStorageSync(APP_UPDATE_PENDING_KEY);
    if (!raw) return null;
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!obj?.versionCode || !obj?.versionName) return null;
    return obj as AppUpdateManifest;
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    uni.removeStorageSync(APP_UPDATE_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

onLoad(() => {
  const m = readPending();
  if (!m) {
    uni.navigateBack({ fail: () => uni.switchTab({ url: "/pages/dashboard/dashboard" }) });
    return;
  }
  manifest.value = m;
});

onBackPress(() => {
  // 强制更新时拦截返回（对齐 uni-upgrade-center）
  if (manifest.value?.force && phase.value !== "done") return true;
  if (busy.value) return true;
  return false;
});

const onProgress = createThrottledProgressHandler((_title, p) => {
  if (p.total > 0) {
    progressPercent.value = Math.min(100, Math.floor((p.downloaded / p.total) * 100));
  }
});

async function startDownload() {
  const m = manifest.value;
  const url = m?.wgt?.url;
  if (!url) {
    phase.value = "error";
    errorMsg.value = "新版本未提供 WGT 包，请到设置页查看整包更新方式。";
    return;
  }
  phase.value = "downloading";
  errorMsg.value = "";
  progressPercent.value = 0;
  try {
    const result = await downloadAndInstallWgt(url, (p) => {
      onProgress(p);
      if (p.total > 0 && p.downloaded >= p.total) {
        phase.value = "installing";
        progressPercent.value = 100;
      }
    });
    if (!result.ok) {
      phase.value = "error";
      errorMsg.value = result.reason;
      return;
    }
    phase.value = "done";
    progressPercent.value = 100;
    clearPending();
  } catch (e) {
    phase.value = "error";
    errorMsg.value = e instanceof Error ? e.message : "下载或安装失败";
  }
}

function dismiss() {
  const m = manifest.value;
  if (phase.value === "idle" && m && !m.force) {
    skipVersion(m.versionCode);
  }
  clearPending();
  uni.navigateBack({
    fail: () => uni.switchTab({ url: "/pages/dashboard/dashboard" })
  });
}

function restartNow() {
  setTimeout(() => {
    if (!restartAppAfterUpdate()) {
      uni.showToast({ title: "请手动重启 App", icon: "none", duration: 2500 });
    }
  }, 200);
}
</script>

<style scoped lang="scss">
.upgrade-mask {
  min-height: 100vh;
  background: rgba(8, 13, 24, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx 40rpx;
  box-sizing: border-box;
}
.upgrade-card {
  width: 100%;
  max-width: 640rpx;
  background: var(--color-surface);
  border: 1rpx solid var(--color-border);
  border-radius: 24rpx;
  padding: 36rpx 32rpx 28rpx;
  box-shadow: var(--shadow-card);
}
.upgrade-eyebrow {
  font-size: 20rpx;
  letter-spacing: 0.16em;
  color: var(--color-primary-contrast);
  margin-bottom: 8rpx;
}
.upgrade-title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--color-heading);
}
.upgrade-meta {
  margin-top: 8rpx;
  font-size: 22rpx;
}
.upgrade-notes {
  margin-top: 20rpx;
  max-height: 280rpx;
  padding: 16rpx;
  border-radius: 12rpx;
  background: var(--color-soft);
}
.upgrade-notes-text {
  font-size: 24rpx;
  color: var(--color-text);
  line-height: 1.55;
  white-space: pre-wrap;
}
.upgrade-progress {
  margin-top: 24rpx;
}
.upgrade-progress-hint {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
}
.upgrade-error {
  margin-top: 16rpx;
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  background: var(--color-danger-soft);
  color: var(--color-on-danger-soft);
  font-size: 22rpx;
  line-height: 1.45;
}
.upgrade-actions {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 28rpx;
}
.upgrade-btn {
  width: 100%;
}
.upgrade-force {
  display: block;
  margin-top: 16rpx;
  font-size: 20rpx;
  text-align: center;
}
</style>

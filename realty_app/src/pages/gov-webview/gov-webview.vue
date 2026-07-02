<template>
  <view class="gov-webview-page">
    <view v-if="pageUrl" class="gov-toolbar">
      <text class="toolbar-hint muted">政府站登录、跳转在系统浏览器中更稳定</text>
      <button class="btn btn-ghost toolbar-btn" size="mini" @click="openInBrowser">
        系统浏览器打开
      </button>
    </view>

    <!-- #ifdef H5 -->
    <view v-if="!pageUrl" class="fallback">
      <text class="fallback-title">链接无效</text>
    </view>
    <iframe v-else class="gov-frame" :src="pageUrl" frameborder="0" />
    <!-- #endif -->

    <!-- #ifndef H5 -->
    <web-view v-if="pageUrl" :src="pageUrl" @error="onWebError" />
    <view v-else class="fallback">
      <text class="fallback-title">链接无效</text>
      <text class="fallback-hint muted">请从设置页重新进入政府查询。</text>
    </view>
    <view v-if="loadError" class="fallback error-panel">
      <text class="fallback-title">页面无法加载</text>
      <text class="fallback-hint muted">{{ loadError }}</text>
      <button class="btn" style="margin-top: 24rpx" @click="openInBrowser">用系统浏览器打开</button>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { normalizeGovUrl } from "../../config/govLinks";
import { openExternalUrl } from "../../utils/openExternal";

const pageUrl = ref("");
const pageTitle = ref("政府公示");
const loadError = ref("");

onLoad((options?: Record<string, string | undefined>) => {
  const raw = options?.url ?? "";
  const title = options?.title ?? "政府公示";
  try {
    pageUrl.value = normalizeGovUrl(decodeURIComponent(raw));
    pageTitle.value = decodeURIComponent(title);
  } catch {
    pageUrl.value = normalizeGovUrl(raw);
    pageTitle.value = title;
  }
  if (pageUrl.value) {
    uni.setNavigationBarTitle({ title: pageTitle.value });
  }
});

function openInBrowser() {
  if (pageUrl.value) openExternalUrl(pageUrl.value);
}

function onWebError() {
  loadError.value = "内置 WebView 无法打开该政府页面，请改用系统浏览器。";
}
</script>

<style lang="scss" scoped>
.gov-webview-page {
  width: 100%;
  height: 100vh;
  background: #0b1020;
  display: flex;
  flex-direction: column;
}

.gov-toolbar {
  flex-shrink: 0;
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid #1f2937;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.toolbar-hint {
  flex: 1;
  font-size: 22rpx;
}

.toolbar-btn {
  flex-shrink: 0;
}

.gov-frame {
  flex: 1;
  width: 100%;
  border: none;
  display: block;
}

web-view {
  flex: 1;
  width: 100%;
}

.fallback {
  padding: 48rpx 32rpx;
  text-align: center;
}

.error-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: 120rpx;
  z-index: 10;
  background: rgba(11, 16, 32, 0.95);
}

.fallback-title {
  color: #f3f4f6;
  font-size: 32rpx;
}

.fallback-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
}
</style>

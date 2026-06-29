<script setup lang="ts">
import { onLaunch, onShow } from "@dcloudio/uni-app";
import { setSnapshot, isLoaded, hasStats70 } from "./local/store";
import { buildSeedSnapshot } from "./local/seedSnapshot";
import { loadStats70FromCSV } from "./local/stats70";
// 直接以 raw 字符串 import，绕开 app-plus 静态资源下载问题。
//   H5/小程序：`?raw` query 由 vite 处理返回字符串
//   app-plus：在 webpack/vite 阶段把文件内联进来
// 该 CSV 1.2 MB，压缩后 < 300 KB，能放进 JS 包。
// 需要 Vite >= 4 ?raw 支持；uni-app 默认 vite >= 4 已支持。
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import stats70Raw from "../static/stats_70.csv?raw";

onLaunch(() => {
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
  // 启动时加载国家统计局 70 城指数（直接内联 CSV，绕过网络）。
  if (!hasStats70() && typeof stats70Raw === "string" && stats70Raw.length > 0) {
    try {
      const rows = loadStats70FromCSV(stats70Raw);
      console.log("[realty_app] stats_70 loaded:", rows.length);
    } catch (e) {
      console.warn("[realty_app] stats_70 parse failed", e);
    }
  }
  console.log("[realty_app] launched, snapshot loaded:", isLoaded());
});

onShow(() => {
  console.log("[realty_app] shown");
});
</script>

<style lang="scss">
/* 全局样式 - 移动端友好 */
page {
  background-color: #0b1020;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
  font-size: 28rpx;
}

view,
text {
  box-sizing: border-box;
}

.container {
  padding: 24rpx;
}

.card {
  background: #111827;
  border: 1rpx solid #1f2937;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.card-title {
  font-size: 32rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
  color: #f3f4f6;
}

.muted {
  color: #94a3b8;
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
  background: #1e293b;
  color: #cbd5e1;
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

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 12rpx;
  padding: 16rpx 32rpx;
  font-size: 28rpx;
}

.btn-ghost {
  background: transparent;
  color: #93c5fd;
  border: 1rpx solid #1d4ed8;
}

.btn-danger {
  background: #ef4444;
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
  background: #1f2937;
  margin: 16rpx 0;
}

.empty {
  padding: 64rpx 0;
  text-align: center;
  color: #64748b;
}

.error {
  padding: 16rpx;
  background: rgba(239, 68, 68, 0.15);
  color: #fecaca;
  border: 1rpx solid #ef4444;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}
</style>
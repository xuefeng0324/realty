<template>
  <view class="page">
    <view class="header">
      <view class="title">📊 深度可视化分析</view>
      <view class="muted">
        {{ bedroomArea?.cityName ?? "—" }} · 户型×面积 · 朝向×楼层 · 装修×楼龄 · 总价×单价
      </view>
      <view class="muted" style="margin-top: 4rpx; font-size: 22rpx">
        v1.121.149 · 联合分布 / 溢价矩阵 / 双轴散点 · minCount ≥ 3 过滤
      </view>
      <view class="muted" style="margin-top: 4rpx; font-size: 22rpx">
        全部数据本地缓存到 storage；切回首页仍然保留
      </view>
    </view>

    <!-- v0.42.0 trend-22 户型 × 面积 联合热图 -->
    <view v-if="bedroomArea && bedroomArea.bedrooms.length > 0" class="card" data-card-key="trend-bedroom-area" data-ta-trend>
      <view class="row-between">
        <view class="card-title">📐 户型 × 面积 分布 · {{ bedroomArea.cityName }}</view>
        <view class="muted">minCount ≥ 3 · 共 {{ bedroomArea.totalCount }} 套</view>
      </view>
      <view class="ba-heatmap">
        <view class="ba-row ba-header">
          <view class="ba-corner"></view>
          <view
            v-for="area in bedroomArea.areaBuckets"
            :key="area"
            class="ba-col-label"
          >{{ area }}㎡</view>
        </view>
        <view
          v-for="(bedroom, bi) in bedroomArea.bedrooms"
          :key="bedroom"
          class="ba-row"
        >
          <view class="ba-row-label">{{ bedroom }} 室</view>
          <view
            v-for="(area, ai) in bedroomArea.areaBuckets"
            :key="area"
            class="ba-cell"
            :class="baCellClassByIdx(bi, ai)"
            :data-ba-cell="bedroom + '_' + area"
          >
            <view v-if="baCellCountByIdx(bi, ai) > 0" class="ba-count">{{ baCellCountByIdx(bi, ai) }}</view>
            <view v-else class="ba-empty">—</view>
          </view>
        </view>
      </view>
      <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
        数据源：listings.csv (按户型+面积区间聚合)。颜色越深 = 数量越多。空白 = 样本不足 (0 套)。
      </view>
    </view>

    <!-- v0.43.0 trend-23 朝向 × 楼层 溢价矩阵 -->
    <view v-if="orientationFloor && orientationFloor.orientations.length > 0" class="card" data-card-key="trend-orientation-floor">
      <view class="row-between">
        <view class="card-title">🧭 朝向 × 楼层 溢价 · {{ orientationFloor.cityName }}</view>
        <view class="muted">minCount ≥ 5 · 共 {{ orientationFloor.totalCount }} 套</view>
      </view>
      <view class="of-matrix">
        <view class="of-row of-header">
          <view class="of-corner"></view>
          <view
            v-for="floor in orientationFloor.floorBuckets"
            :key="floor"
            class="of-col-label"
          >{{ floorLabel(floor) }}</view>
        </view>
        <view
          v-for="(orient, oi) in orientationFloor.orientations"
          :key="orient"
          class="of-row"
        >
          <view class="of-row-label">{{ orient }}</view>
          <view
            v-for="(floor, fi) in orientationFloor.floorBuckets"
            :key="floor"
            class="of-cell"
            :class="ofCellStyleClassByIdx(oi, fi)"
            :data-of-cell="orient + '_' + floor"
          >
            <view class="of-cell-label">{{ ofCellLabelByIdx(oi, fi) }}</view>
          </view>
        </view>
      </view>
      <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
        数据源：listings.csv (按朝向+楼层聚合平均溢价)。绿 = 高于均价，红 = 低于均价。
      </view>
    </view>

    <!-- v0.44.0 trend-24 装修 × 楼龄 溢价矩阵 -->
    <view v-if="decorateAge && decorateAge.decorates.length > 0" class="card" data-card-key="trend-decorate-age">
      <view class="row-between">
        <view class="card-title">🛋️ 装修 × 楼龄 溢价 · {{ decorateAge.cityName }}</view>
        <view class="muted">minCount ≥ 5 · 共 {{ decorateAge.totalCount }} 套</view>
      </view>
      <view class="da-matrix">
        <view class="da-row da-header">
          <view class="da-corner"></view>
          <view
            v-for="ageBand in decorateAge.ageBuckets"
            :key="ageBand"
            class="da-col-label"
          >{{ ageBandLabel(ageBand) }}</view>
        </view>
        <view
          v-for="(dec, di) in decorateAge.decorates"
          :key="dec"
          class="da-row"
        >
          <view class="da-row-label">{{ dec }}</view>
          <view
            v-for="(ageBand, ai) in decorateAge.ageBuckets"
            :key="ageBand"
            class="da-cell"
            :class="daCellStyleClassByIdx(di, ai)"
            :data-da-cell="dec + '_' + ageBand"
          >
            <view class="da-cell-label">{{ daCellLabelByIdx(di, ai) }}</view>
          </view>
        </view>
      </view>
      <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
        数据源：listings.csv (按装修+楼龄段聚合平均溢价)。深绿 = 强溢价，深红 = 强折价。
      </view>
    </view>

    <!-- v0.45.0 trend-25 社区 总价 × 单价 双轴散点 -->
    <view v-if="scatter && scatter.points.length > 0" class="card" data-card-key="trend-scatter">
      <view class="row-between">
        <view class="card-title">💹 社区 总价 × 单价 散点 · {{ scatter.cityName }}</view>
        <view class="muted">共 {{ scatter.points.length }} 社区 · 中位单价 {{ Math.round(scatter.cityMedianUnit).toLocaleString() }} 元/㎡</view>
      </view>
      <view class="scatter-summary">
        <view class="sc-kpi">
          <text class="sc-kpi-val">{{ localScatterDipCount }}</text>
          <text class="sc-kpi-label muted">低单价社区</text>
        </view>
        <view class="sc-kpi">
          <text class="sc-kpi-val">{{ scatter.points.length - localScatterDipCount }}</text>
          <text class="sc-kpi-label muted">中高单价社区</text>
        </view>
        <view class="sc-kpi">
          <text class="sc-kpi-val">{{ localScatterCohort().length }}</text>
          <text class="sc-kpi-label muted">完成 cohort 标记</text>
        </view>
      </view>
      <view class="scatter-svg-wrap">
        <view class="scatter-svg">
          <view
            v-for="(p, i) in localScatterCohort()"
            :key="i"
            class="scatter-dot"
            :class="'scatter-dot--' + p.cohort"
            :data-sc-dot="i"
            :style="{
              left: scatterX(p.x) + 'rpx',
              bottom: scatterY(p.y) + 'rpx'
            }"
          ></view>
        </view>
      </view>
      <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
        数据源：listings.csv (按社区聚合均价 + 套均价)。横轴 = 单价，纵轴 = 总价，cohort = value(蓝)/mid(灰)/premium(橙)。
      </view>
    </view>

    <!-- 空态 -->
    <view v-if="!bedroomArea && !orientationFloor && !decorateAge && !scatter && !trendVizLoading" class="card">
      <view class="empty">暂无数据</view>
    </view>
    <view v-if="trendVizLoading" class="card">
      <view class="muted">正在加载可视化数据…</view>
    </view>
    <view v-if="trendVizError" class="card">
      <view class="empty">加载失败：{{ trendVizError }}</view>
    </view>

    <view class="footer">
      <button class="back-btn" size="mini" hover-class="tap-row--active" @click.stop="goBack">← 返回首页</button>
      <button class="reload-btn" size="mini" hover-class="tap-row--active" @click.stop="onReload" :disabled="trendVizLoading">🔄 重新加载</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useAppStore } from "../../store/app";
import { useTrendVisualization } from "../../composables/useTrendVisualization";

const app = useAppStore();
const {
  bedroomArea,
  orientationFloor,
  decorateAge,
  scatter,
  trendVizLoading,
  trendVizError,
  reloadAll,
  ofCellLabel,
  daCellClass,
  scatterImproveCohort,
  scatterValueDip
} = useTrendVisualization();

// 为模板用本地 computed (避免 v-for 类型推导错误)
type ScatterCohortPoint = { x: number; y: number; cohort: string };
const localScatterCohort = (): ScatterCohortPoint[] => scatterImproveCohort();
const localScatterDipCount = ref<number>(0);

function refreshLocalDip() {
  localScatterDipCount.value = scatterValueDip().count;
}

watch(scatter, () => refreshLocalDip(), { deep: true, immediate: true });

const cityId = ref<number>(app.cityId);
const scatterValueDipCount = ref<number>(0);

function goBack() {
  uni.navigateBack({ delta: 1, fail: () => uni.switchTab({ url: "/pages/dashboard/dashboard" }) });
}

async function onReload() {
  await reloadAll(cityId.value);
}

onMounted(async () => {
  cityId.value = app.cityId;
  await reloadAll(cityId.value);
});

// 用 idx 而非 key 访问 grid
function baCellCountByIdx(bi: number, ai: number): number {
  if (!bedroomArea.value) return 0;
  const row = bedroomArea.value.grid[bi];
  if (!row) return 0;
  const cell = row[ai];
  return cell ? cell.count : 0;
}

function baCellClassByIdx(bi: number, ai: number): string {
  const count = baCellCountByIdx(bi, ai);
  if (count === 0) return "ba-cell--empty";
  if (!bedroomArea.value) return "";
  let max = 0;
  for (const row of bedroomArea.value.grid) {
    for (const c of row) {
      if (c.count > max) max = c.count;
    }
  }
  const ratio = count / Math.max(1, max);
  if (ratio > 0.7) return "ba-cell--deep";
  if (ratio > 0.4) return "ba-cell--mid";
  return "ba-cell--light";
}

function floorLabel(floor: string): string {
  if (floor === "low") return "低楼层";
  if (floor === "mid") return "中楼层";
  if (floor === "high") return "高楼层";
  return floor;
}

function ageBandLabel(band: string): string {
  if (band === "new") return "新房(<5年)";
  if (band === "mid") return "次新(5-15年)";
  if (band === "old") return "老房(15+年)";
  return band;
}

function ofCellStyleClassByIdx(oi: number, fi: number): string {
  if (!orientationFloor.value) return "";
  const row = orientationFloor.value.grid[oi];
  if (!row) return "of-cell--empty";
  const cell = row[fi];
  if (!cell || cell.premiumPct == null) return "of-cell--empty";
  if (cell.premiumPct > 1) return "of-cell--up";
  if (cell.premiumPct < -1) return "of-cell--down";
  return "of-cell--flat";
}

function ofCellLabelByIdx(oi: number, fi: number): string {
  if (!orientationFloor.value) return "—";
  const row = orientationFloor.value.grid[oi];
  if (!row) return "—";
  const cell = row[fi];
  if (!cell || cell.premiumPct == null) return "—";
  const pct = cell.premiumPct;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function daCellStyleClassByIdx(di: number, ai: number): string {
  if (!decorateAge.value) return "";
  const row = decorateAge.value.grid[di];
  if (!row) return "da-cell--empty";
  const cell = row[ai];
  if (!cell || cell.premiumPct == null) return "da-cell--empty";
  if (cell.premiumPct > 2) return "da-cell--up";
  if (cell.premiumPct < -2) return "da-cell--down";
  return "da-cell--flat";
}

function daCellLabelByIdx(di: number, ai: number): string {
  if (!decorateAge.value) return "—";
  const row = decorateAge.value.grid[di];
  if (!row) return "—";
  const cell = row[ai];
  if (!cell || cell.premiumPct == null) return "—";
  const pct = cell.premiumPct;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function scatterX(price: number): number {
  if (!scatter.value || scatter.value.points.length === 0) return 0;
  if (scatter.value.xMax === scatter.value.xMin) return 50;
  return ((price - scatter.value.xMin) / (scatter.value.xMax - scatter.value.xMin)) * 280;
}

function scatterY(price: number): number {
  if (!scatter.value || scatter.value.points.length === 0) return 0;
  if (scatter.value.yMax === scatter.value.yMin) return 30;
  return ((price - scatter.value.yMin) / (scatter.value.yMax - scatter.value.yMin)) * 180;
}

function refreshScatterDip() {
  scatterValueDipCount.value = scatterValueDip().count;
}

watch(scatter, () => refreshScatterDip(), { deep: true, immediate: true });
</script>

<style scoped>
.page {
  padding: 16rpx;
  padding-bottom: 80rpx;
}
.header {
  padding: 16rpx 24rpx;
  background: var(--color-surface, #fff);
  border-radius: 16rpx;
  margin-bottom: 16rpx;
}
.title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--color-text, #333);
}
.muted {
  color: var(--color-muted, #666);
  font-size: 24rpx;
}
.empty {
  text-align: center;
  padding: 40rpx 0;
  color: var(--color-muted, #999);
}
.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.card {
  background: var(--color-surface, #fff);
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  border: 1rpx solid var(--color-border-soft, #eee);
}
.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--color-text, #333);
}
.footer {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 24rpx;
}
.back-btn,
.reload-btn {
  flex: 1;
  margin: 0;
  font-size: 26rpx;
  padding: 0 24rpx;
  border-radius: 999px !important;
  background: var(--color-soft, #f5f5f5) !important;
  color: var(--color-text, #333) !important;
}

/* BA 热图 */
.ba-heatmap {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.ba-row {
  display: flex;
  gap: 4rpx;
  align-items: center;
}
.ba-corner,
.ba-row-label,
.ba-col-label {
  font-size: 22rpx;
  padding: 4rpx;
  text-align: center;
  flex: 0 0 90rpx;
  color: var(--color-muted, #666);
}
.ba-cell {
  flex: 1 1 0;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: var(--color-text, #333);
}
.ba-cell--empty { background: var(--color-soft, #f5f5f5); color: var(--color-muted, #aaa); }
.ba-cell--light { background: #e3f2fd; }
.ba-cell--mid { background: #90caf9; color: #fff; }
.ba-cell--deep { background: #1976d2; color: #fff; font-weight: 600; }
.ba-empty { color: var(--color-muted, #aaa); }
.ba-count { font-size: 24rpx; font-weight: 600; }

/* OF 朝向×楼层 矩阵 */
.of-matrix,
.da-matrix {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.of-row,
.da-row {
  display: flex;
  gap: 4rpx;
  align-items: center;
}
.of-corner,
.of-row-label,
.of-col-label,
.da-corner,
.da-row-label,
.da-col-label {
  font-size: 22rpx;
  padding: 4rpx;
  text-align: center;
  flex: 0 0 90rpx;
  color: var(--color-muted, #666);
}
.of-cell,
.da-cell {
  flex: 1 1 0;
  height: 70rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  font-size: 22rpx;
}
.of-cell--empty,
.da-cell--empty { background: var(--color-soft, #f5f5f5); color: var(--color-muted, #aaa); }
.of-cell--up { background: #c8e6c9; }
.of-cell--down { background: #ffcdd2; }
.of-cell--flat { background: #fff9c4; }
.da-cell--up { background: #66bb6a; color: #fff; }
.da-cell--down { background: #ef5350; color: #fff; }
.da-cell--flat { background: #fff9c4; }
.of-cell-label,
.da-cell-label { font-weight: 500; }

/* 散点 */
.scatter-summary {
  display: flex;
  gap: 16rpx;
  margin-bottom: 12rpx;
}
.sc-kpi {
  flex: 1;
  text-align: center;
  padding: 8rpx;
  background: var(--color-soft, #f5f5f5);
  border-radius: 8rpx;
}
.sc-kpi-val {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-primary, #4f46e5);
}
.sc-kpi-label {
  display: block;
  font-size: 22rpx;
}
.scatter-svg-wrap {
  position: relative;
  width: 100%;
  height: 200rpx;
  background: var(--color-soft, #f5f5f5);
  border-radius: 12rpx;
  overflow: hidden;
}
.scatter-svg {
  position: relative;
  width: 100%;
  height: 200rpx;
}
.scatter-dot {
  position: absolute;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  transform: translate(-50%, 50%);
}
.scatter-dot--value { background: #1976d2; }
.scatter-dot--mid { background: #9e9e9e; }
.scatter-dot--premium { background: #ef6c00; }
</style>
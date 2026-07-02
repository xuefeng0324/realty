<template>
  <view class="page">
    <view class="container">
      <view class="card">
        <view class="card-title">全国 70 城价格指数</view>
        <view class="muted" v-if="latestMonth">
          数据月份：{{ latestMonth }}（来源：国家统计局）
        </view>
        <view class="muted" v-else>
          暂无 70 城指数数据。请确认 app 已联网启动一次。
        </view>

        <view class="row-gap" style="margin-top: 12rpx" v-if="latestMonth">
          <text class="tag" :class="kind === 'new' ? 'tag-success' : ''" @click="setKind('new')">
            新建
          </text>
          <text class="tag" :class="kind === 'second' ? 'tag-success' : ''" @click="setKind('second')">
            二手
          </text>
        </view>
      </view>

      <view v-if="!hasData" class="card">
        <view class="empty">
          数据未加载或为空。请确认网络通畅，且 app 启动时已尝试加载 stats_70.csv
        </view>
      </view>

      <view v-else class="card">
        <view class="row-between">
          <view class="card-title">榜单（按 {{ kind === "new" ? "新建" : "二手" }}{{ " " }}{{ base }} {{ " " }}{{ sortLabel }}）</view>
          <view class="muted">共 {{ ranking.length }} 城</view>
        </view>
        <view class="ranking-tabs">
          <text class="tab" :class="base === '同比' ? 'tab-on' : ''" @click="setBase('同比')">同比</text>
          <text class="tab" :class="base === '环比' ? 'tab-on' : ''" @click="setBase('环比')">环比</text>
          <view class="ranking-tabs-spacer"></view>
          <text class="tab sort-toggle" @click="toggleSortDir">
            {{ sortDir === "desc" ? "降序 ▽" : "升序 △" }}
          </text>
        </view>

        <view
          v-for="(it, idx) in ranking"
          :key="it.city"
          class="rank-row"
          @click="onPickCity(it.city)"
        >
          <view class="rank-no">#{{ idx + 1 }}</view>
          <view class="rank-name">{{ it.city }}</view>
          <view class="rank-bar-track">
            <view
              class="rank-bar-fill"
              :class="valueClass(it.value)"
              :style="{ width: barPct(it.value) + '%' }"
            ></view>
          </view>
          <view class="rank-val" :class="valueClass(it.value)">{{ formatIndex(it.value) }}</view>
        </view>
      </view>

      <!-- 单城市时间序列（点击 row 时显示） -->
      <view v-if="pickedCity" class="card">
        <view class="card-title">
          {{ pickedCity }} · 近期 {{ trend.length }} 个月 ·
          {{ kind === "new" ? "新建" : "二手" }}{{ base }}
        </view>
        <view v-if="trend.length === 0" class="empty">无时间序列数据</view>
        <view v-else>
          <view v-for="(pt, i) in trend" :key="i" class="trend-row">
            <view class="muted" style="width: 140rpx">{{ formatDateLabel(pt.date) }}</view>
            <view class="trend-bar-track">
              <view
                class="trend-bar-fill"
                :class="valueClass(pt.yoy)"
                :style="{ width: trendBarPct(pt.yoy) + '%' }"
              ></view>
            </view>
            <view style="width: 140rpx" :class="valueClass(pt.yoy)">{{ formatIndex(pt.yoy) }}</view>
          </view>
        </view>
      </view>

      <!-- 深广每日网签（政府公布） -->
      <view class="card">
        <view class="card-title">深广每日网签</view>
        <view class="muted" v-if="wangqianReady">
          最近交易日：{{ wangqianDateLabel }}（住建局公布，非 70 城指数）
        </view>
        <view v-if="!wangqianReady" class="empty" style="padding: 24rpx 0">
          暂无网签数据。请确认包内 daily_wangqian.csv 已生成。
        </view>
        <view v-else class="wangqian-grid">
          <view
            v-for="snap in wangqianSnapshots"
            :key="snap.city"
            class="wangqian-cell"
          >
            <view class="wangqian-city">{{ snap.city }}</view>
            <view class="wangqian-metric">
              <text class="muted">新房</text>
              <text class="wangqian-val">{{ formatUnits(snap.newUnits) }} 套</text>
              <text class="muted wangqian-area">{{ formatArea(snap.newArea) }}</text>
            </view>
            <view class="wangqian-metric" v-if="snap.secondUnits != null">
              <text class="muted">二手</text>
              <text class="wangqian-val">{{ formatUnits(snap.secondUnits) }} 套</text>
              <text class="muted wangqian-area">{{ formatArea(snap.secondArea) }}</text>
            </view>
            <view class="wangqian-metric" v-else>
              <text class="muted">二手日更暂未接入</text>
            </view>
          </view>
        </view>
        <view v-if="wangqianTrend.length" style="margin-top: 16rpx">
          <view class="muted" style="margin-bottom: 8rpx">
            {{ wangqianTrendCity }} · 新房近 {{ wangqianTrend.length }} 日套数
          </view>
          <view v-for="(pt, i) in wangqianTrend" :key="i" class="trend-row">
            <view class="muted" style="width: 160rpx">{{ pt.date }}</view>
            <view class="trend-bar-track">
              <view
                class="trend-bar-fill trend-up"
                :style="{ width: wangqianBarPct(pt.units) + '%' }"
              ></view>
            </view>
            <view style="width: 100rpx">{{ pt.units }}</view>
          </view>
        </view>
      </view>

      <view class="card muted">
        <view style="margin-bottom: 8rpx">关于数据来源</view>
        <view>
          数据来自国家统计局《70 个大中城市商品住宅销售价格变动情况》。
          对应手机端 CSV 在 <text style="color:#4ade80">/static/stats_70.csv</text>，可被
          <text style="color:#4ade80">scripts/crawl_stats_70.py</text> 重新生成。
          指数类型：同比 / 环比（基期=100，&gt;100 上涨，&lt;100 下跌）。
        </view>
        <view style="margin-top: 12rpx">
          <text style="color:#cbd5e1">同比</text>：与「上年同月」相比，例如 2026 年 5 月的同比 = 2026 年 5 月房价 ÷ 2025 年 5 月房价 × 100。
        </view>
        <view style="margin-top: 6rpx">
          <text style="color:#cbd5e1">环比</text>：与「上一月」相比，例如 2026 年 5 月的环比 = 2026 年 5 月房价 ÷ 2026 年 4 月房价 × 100。
        </view>
        <view style="margin-top: 12rpx">
          深广每日网签来自住建局官网 API，字段见
          <text style="color:#4ade80">/static/daily_wangqian.csv</text>，由
          <text style="color:#4ade80">scripts/crawl_daily_wangqian.py</text>
          生成；需每日定时跑脚本积累历史（接口不支持回溯）。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  getLatestMonth,
  getRanking,
  getCityTrend
} from "../../local/stats70";
import {
  getLatestCityDaily,
  getCityDailyTrend,
  getSupportedWangqianCities,
  hasDailyWangqian
} from "../../local/dailyWangqian";
import { showToast } from "../../utils/format";

type Base = "同比" | "环比";
type Kind = "new" | "second";
type SortDir = "desc" | "asc";

const kind = ref<Kind>("new");
const base = ref<Base>("同比");
const sortDir = ref<SortDir>("desc");

const latestMonth = ref<string | null>(getLatestMonth());

const ranking = computed(() => {
  const all = getRanking(base.value, kind.value);
  return sortDir.value === "desc" ? all : [...all].reverse();
});

const sortLabel = computed(() => (sortDir.value === "desc" ? "降序" : "升序"));

const hasData = computed(() => ranking.value.length > 0);

const wangqianReady = computed(() => hasDailyWangqian());
const wangqianSnapshots = computed(() =>
  getSupportedWangqianCities()
    .map((c) => getLatestCityDaily(c))
    .filter((x): x is NonNullable<typeof x> => x != null)
);
const wangqianDateLabel = computed(() => {
  const dates = wangqianSnapshots.value.map((s) => s.date);
  if (dates.length === 0) return "—";
  return [...new Set(dates)].sort().join(" / ");
});
const wangqianTrendCity = computed(() => wangqianSnapshots.value[0]?.city ?? "深圳");
const wangqianTrendDays = computed(() => (wangqianTrendCity.value === "深圳" ? 30 : 14));
const wangqianTrend = computed(() =>
  getCityDailyTrend(wangqianTrendCity.value, wangqianTrendDays.value, "新房")
);
const wangqianMaxUnits = computed(() => {
  const vals = wangqianTrend.value.map((p) => p.units);
  return vals.length ? Math.max(...vals, 1) : 1;
});

function formatUnits(v: number | null): string {
  if (v == null) return "—";
  return String(v);
}

function formatArea(v: number | null): string {
  if (v == null) return "";
  if (v >= 10000) return `${(v / 10000).toFixed(1)} 万㎡`;
  return `${Math.round(v)} ㎡`;
}

function wangqianBarPct(units: number): number {
  return Math.max(4, Math.min(100, (units / wangqianMaxUnits.value) * 100));
}

function setKind(k: Kind) {
  kind.value = k;
  refreshTrend();
}
function setBase(b: Base) {
  base.value = b;
  refreshTrend();
}
function toggleSortDir() {
  sortDir.value = sortDir.value === "desc" ? "asc" : "desc";
}

function refreshTrend() {
  if (!pickedCity.value) return;
  trend.value = getCityTrend(
    pickedCity.value,
    12,
    kind.value === "second" ? "second" : "new",
    base.value
  );
}

function formatIndex(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(1);
}

function valueClass(v: number | null): string {
  if (v == null) return "";
  if (v > 100) return "trend-up";
  if (v < 100) return "trend-down";
  return "trend-flat";
}

function barPct(v: number | null): number {
  if (v == null) return 0;
  // 以 100 为中点：90..110 -> 0..100，让 100 落在 50%
  const x = (v - 90) * 5;
  return Math.max(0, Math.min(100, x));
}

function trendBarPct(v: number | null): number {
  return barPct(v);
}

function formatDateLabel(dateStr: string): string {
  // "2026/5/1" -> "2026-05"
  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr;
  return `${parts[0]}-${parts[1].padStart(2, "0")}`;
}

const pickedCity = ref<string | null>(null);
const trend = ref<{ date: string; yoy: number | null }[]>([]);

function onPickCity(city: string) {
  pickedCity.value = city;
  trend.value = getCityTrend(
    city,
    12,
    kind.value === "second" ? "second" : "new",
    base.value
  );
}
</script>

<style lang="scss" scoped>
.ranking-tabs {
  display: flex;
  gap: 12rpx;
  align-items: center;
  margin-bottom: 12rpx;
}

.ranking-tabs-spacer {
  flex: 1;
}

.sort-toggle {
  margin-left: auto;
}

.tab {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: #1e293b;
  color: #cbd5e1;
  font-size: 24rpx;
  border: 1rpx solid transparent;
}

.tab-on {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
  border-color: #4ade80;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #1f2937;
}

.rank-row:last-child {
  border-bottom: none;
}

.rank-no {
  width: 70rpx;
  font-weight: 600;
  color: #cbd5e1;
}

.rank-name {
  width: 130rpx;
  color: #f3f4f6;
  font-size: 26rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-bar-track {
  flex: 1;
  height: 14rpx;
  background: #1f2937;
  border-radius: 7rpx;
  overflow: hidden;
}

.rank-bar-fill {
  height: 100%;
  border-radius: 7rpx;
}

.rank-val {
  width: 110rpx;
  text-align: right;
  font-weight: 600;
}

.trend-up {
  color: #4ade80;
}

.trend-down {
  color: #fca5a5;
}

.rank-bar-fill.trend-up {
  background: linear-gradient(90deg, #22c55e, #4ade80);
}

.rank-bar-fill.trend-down {
  background: linear-gradient(90deg, #ef4444, #fca5a5);
}

.rank-bar-fill.trend-flat {
  background: linear-gradient(90deg, #475569, #94a3b8);
}

.trend-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
  font-size: 24rpx;
}

.trend-bar-track {
  flex: 1;
  height: 12rpx;
  background: #1f2937;
  border-radius: 6rpx;
  overflow: hidden;
}

.trend-bar-fill {
  height: 100%;
  border-radius: 6rpx;
}

.trend-bar-fill.trend-up {
  background: linear-gradient(90deg, #22c55e, #4ade80);
}

.trend-bar-fill.trend-down {
  background: linear-gradient(90deg, #ef4444, #fca5a5);
}

.trend-bar-fill.trend-flat {
  background: linear-gradient(90deg, #475569, #94a3b8);
}

.wangqian-grid {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 12rpx;
}

.wangqian-cell {
  padding: 16rpx;
  background: #0f172a;
  border-radius: 12rpx;
  border: 1rpx solid #1f2937;
}

.wangqian-city {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 8rpx;
}

.wangqian-metric {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-top: 6rpx;
}

.wangqian-val {
  font-size: 30rpx;
  font-weight: 600;
  color: #4ade80;
}

.wangqian-area {
  font-size: 22rpx;
}
</style>

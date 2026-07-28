<template>
  <view class="page" :data-realty-theme="realtyTheme" :class="'realty-theme-' + realtyTheme">
    <view class="container">
      <!-- 头部：城市 + 新鲜度 + 刷新 -->
      <view class="card">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">政府每日网签</view>
          <button class="btn" size="mini" @click="pickCity">{{ cityName || "选择城市" }} ▾</button>
        </view>
        <view v-if="snapshot" class="row-between" style="margin-top: 12rpx; align-items: center">
          <view class="muted">
            最近交易日 {{ snapshot.date }}
            <text class="fresh-badge" :class="freshClass">{{ freshLabel }}</text>
          </view>
          <button class="btn btn-ghost" size="mini" :loading="refreshing" @click="doRefresh">
            {{ refreshing ? "刷新中" : "刷新" }}
          </button>
        </view>
        <view v-else>
          <EmptyState
            icon="📋"
            :title="ready ? '该城市暂无网签日更' : '网签数据未加载'"
            :desc="wangqianEmptyDesc"
            action-text="刷新"
            @action="doRefresh"
          />
        </view>
      </view>

      <!-- 珠海无日更时：展示不动产登记季报摘要（对照总览；≠网签） -->
      <view v-if="!snapshot && cityName === '珠海' && zhBdcNew && zhBdcStock" class="card" data-zh-bdc-registration>
        <view class="card-title">珠海不动产登记季报 · {{ formatZhBdcPeriod(zhBdcNew) }}</view>
        <view class="metric-grid">
          <view class="metric-cell">
            <text class="metric-label">新增商品房 · 住宅</text>
            <text class="metric-value new">{{ zhBdcNew.residentialUnits.toLocaleString() }} 套</text>
            <text class="metric-sub muted">{{ zhBdcNew.residentialAreaWanSqm.toFixed(2) }} 万㎡</text>
          </view>
          <view class="metric-cell">
            <text class="metric-label">存量房转移 · 住宅</text>
            <text class="metric-value res">{{ zhBdcStock.residentialUnits.toLocaleString() }} 套</text>
            <text class="metric-sub muted">{{ zhBdcStock.residentialAreaWanSqm.toFixed(2) }} 万㎡</text>
          </view>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          {{ zhBdcNew.sourceOrg }} · 登记量 ≠ 日更网签、≠ 挂牌均价。可在总览同名卡片查看分区明细。
        </view>
      </view>

      <!-- 当日成交 -->
      <view v-if="snapshot" class="card">
        <view class="card-title">当日成交套数 · {{ snapshot.date }}</view>
        <view class="metric-grid">
          <view class="metric-cell">
            <text class="metric-label">新房（住宅）</text>
            <text class="metric-value new">{{ fmtUnits(snapshot.newUnits) }}</text>
            <text class="metric-sub muted">{{ fmtArea(snapshot.newArea) }}</text>
          </view>
          <view class="metric-cell">
            <text class="metric-label">二手 · 住宅</text>
            <text class="metric-value res">{{ fmtUnits(snapshot.secondResidentialUnits) }}</text>
            <text class="metric-sub muted">{{ fmtArea(snapshot.secondResidentialArea) }}</text>
          </view>
          <view class="metric-cell" v-if="snapshot.secondAllUnits != null">
            <text class="metric-label">二手 · 全部</text>
            <text class="metric-value all">{{ fmtUnits(snapshot.secondAllUnits) }}</text>
            <text class="metric-sub muted">{{ fmtArea(snapshot.secondAllArea) }}</text>
          </view>
        </view>
        <view
          v-if="nonResidential != null && nonResidential > 0"
          class="muted"
          style="margin-top: 12rpx; font-size: 22rpx"
        >
          其中非住宅二手约 {{ nonResidential }} 套（全部 − 住宅）。「住宅」来自走势页，「全部」来自分区公示。
        </view>
      </view>

      <!-- 本月累计成交 -->
      <view v-if="monthly" class="card">
        <view class="card-title">本月累计成交 · {{ monthly.month }}</view>
        <view class="metric-grid">
          <view class="metric-cell">
            <text class="metric-label">新房（住宅）</text>
            <text class="metric-value new">{{ fmtUnits(monthly.newUnits) }}</text>
            <text class="metric-sub muted">{{ fmtArea(monthly.newArea) }}</text>
          </view>
          <view class="metric-cell">
            <text class="metric-label">二手（全部）</text>
            <text class="metric-value all">{{ fmtUnits(monthly.secondUnits) }}</text>
            <text class="metric-sub muted">{{ fmtArea(monthly.secondArea) }}</text>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 20rpx">
          住建局按月发布的分区累计成交，含下方全部行政区。
        </view>
      </view>

      <!-- 二手近 90 交易日（住宅口径）迷你走势 -->
      <view v-if="secondTrend.length" class="card">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">二手近 {{ secondTrend.length }} 交易日</view>
          <view class="muted" style="font-size: 22rpx">住宅 · 套数</view>
        </view>
        <view class="spark-meta muted">
          最高 {{ secondMax }} · 最新 {{ secondTrend[secondTrend.length - 1].units }} · 均 {{ avgUnits(secondTrend) }}
        </view>
        <view class="spark">
          <view
            v-for="(pt, i) in secondTrend"
            :key="'s' + i"
            class="spark-bar second"
            :style="{ height: sparkPct(pt.units, secondMax) + '%' }"
          ></view>
        </view>
        <view class="spark-axis muted">
          <text>{{ fmtShort(secondTrend[0].date) }}</text>
          <text>{{ fmtShort(secondTrend[secondTrend.length - 1].date) }}</text>
        </view>
      </view>

      <!-- 新房近 90 交易日 -->
      <view v-if="newTrend.length" class="card">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">新房近 {{ newTrend.length }} 交易日</view>
          <view class="muted" style="font-size: 22rpx">住宅 · 套数</view>
        </view>
        <view class="spark-meta muted">
          最高 {{ newMax }} · 最新 {{ newTrend[newTrend.length - 1].units }} · 均 {{ avgUnits(newTrend) }}
        </view>
        <view class="spark">
          <view
            v-for="(pt, i) in newTrend"
            :key="'n' + i"
            class="spark-bar new-bar"
            :style="{ height: sparkPct(pt.units, newMax) + '%' }"
          ></view>
        </view>
        <view class="spark-axis muted">
          <text>{{ fmtShort(newTrend[0].date) }}</text>
          <text>{{ fmtShort(newTrend[newTrend.length - 1].date) }}</text>
        </view>
      </view>

      <!-- 各行政区 · 当日 -->
      <view v-if="district && district.rows.length" class="card">
        <view class="card-title">各行政区 · 当日 {{ district.date }}</view>
        <view class="wq-table-head">
          <text class="wq-col-name">行政区</text>
          <text class="wq-col-num">新房</text>
          <text class="wq-col-num" v-if="hasDistrictSecond">二手</text>
        </view>
        <view v-for="row in district.rows" :key="row.district" class="wq-table-row">
          <text class="wq-col-name">{{ row.district }}</text>
          <text class="wq-col-num">{{ row.newUnits }}</text>
          <text class="wq-col-num" v-if="hasDistrictSecond">{{ fmtUnits(row.secondUnits) }}</text>
        </view>
        <view class="wq-table-row wq-total">
          <text class="wq-col-name">合计</text>
          <text class="wq-col-num">{{ district.districtNewSum }}</text>
          <text class="wq-col-num" v-if="hasDistrictSecond">{{ district.districtSecondSum }}</text>
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 20rpx">
          新房分区=住宅口径（合计=走势新房）；二手分区=全部口径（含非住宅）。分区接口仅当天。
        </view>
      </view>

      <!-- 周趋势派生（wangqianTrendRanking） -->
      <view v-if="wqTrendReady" class="card">
        <view class="card-title">区级周趋势（派生）· {{ cityName }}</view>
        <view v-if="wqCategoryTrend" class="muted" style="margin-bottom: 8rpx; font-size: 22rpx">
          全市 {{ wqCategoryTrend.category }}：近周 {{ wqCategoryTrend.latestUnits }} 套
          · vs 前均 {{ wqCategoryTrend.recentAvg.toFixed(0) }}
          <text :class="wqCategoryTrend.changePct >= 0 ? 'trend-up' : 'trend-down'">
            {{ wqCategoryTrend.changePct >= 0 ? "+" : "" }}{{ formatWowPct(wqCategoryTrend.changePct) }}%
          </text>
        </view>
        <view v-if="wqWowUp.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">周环比上升 Top</view>
        <view v-for="(it, idx) in wqWowUp" :key="'wu-' + it.district" class="wq-table-row">
          <text class="wq-col-name">{{ idx + 1 }}. {{ it.district }}</text>
          <text class="wq-col-num">{{ it.prevUnits }}→{{ it.latestUnits }}</text>
          <text class="wq-col-num trend-up">+{{ formatWowPct(it.changePct) }}%</text>
        </view>
        <view v-if="wqWowDown.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">周环比下降 Top</view>
        <view v-for="(it, idx) in wqWowDown" :key="'wd-' + it.district" class="wq-table-row">
          <text class="wq-col-name">{{ idx + 1 }}. {{ it.district }}</text>
          <text class="wq-col-num">{{ it.prevUnits }}→{{ it.latestUnits }}</text>
          <text class="wq-col-num trend-down">{{ formatWowPct(it.changePct) }}%</text>
        </view>
        <view v-if="wqSpikes.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">近周突增</view>
        <view v-for="(it, idx) in wqSpikes" :key="'ws-' + it.district" class="wq-table-row">
          <text class="wq-col-name">{{ idx + 1 }}. {{ it.district }}</text>
          <text class="wq-col-num">{{ it.latestUnits }} 套</text>
          <text class="wq-col-num">×{{ it.multiplier.toFixed(1) }}</text>
        </view>
        <view v-if="wqVolatility.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">波动最高（CV）</view>
        <view v-for="(it, idx) in wqVolatility" :key="'wv-' + it.district" class="wq-table-row">
          <text class="wq-col-name">{{ idx + 1 }}. {{ it.district }}</text>
          <text class="wq-col-num">均 {{ it.mean.toFixed(0) }}</text>
          <text class="wq-col-num">CV {{ it.cv.toFixed(2) }}</text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 20rpx">
          数据源：wangqian_district_weekly.csv → wangqianTrendRanking。口径默认二手。
        </view>
      </view>

      <!-- 各区分区（本月累计） -->
      <view v-if="monthly && monthly.districts.length" class="card">
        <view class="card-title">各行政区 · 本月累计 {{ monthly.month }}</view>
        <view class="wq-table-head">
          <text class="wq-col-name">行政区</text>
          <text class="wq-col-num">新房</text>
          <text class="wq-col-num">二手</text>
        </view>
        <view v-for="row in monthly.districts" :key="'m' + row.district" class="wq-table-row">
          <text class="wq-col-name">{{ row.district }}</text>
          <text class="wq-col-num">{{ row.newUnits }}</text>
          <text class="wq-col-num all">{{ row.secondUnits }}</text>
        </view>
        <view class="wq-table-row wq-total">
          <text class="wq-col-name">合计</text>
          <text class="wq-col-num">{{ monthly.newUnits }}</text>
          <text class="wq-col-num all">{{ monthly.secondUnits }}</text>
        </view>
      </view>

      <view v-else-if="snapshot && cityName === '广州'" class="card">
        <view class="card-title">广州说明</view>
        <view class="muted">
          广州住建仅公布新房（住宅）签约日更；二手房为月度图片公告（存量房交易登记统计），暂无稳定日更接口，故本页广州只有新房数据。
        </view>
      </view>

      <!-- 月度成交趋势（从日数据派生；不需要外部抓取） -->
      <view
        v-if="newMonthlySummary || secondMonthlySummary"
        class="card"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">月度成交趋势（{{ monthlyMonthsLabel }}）</view>
          <view class="muted" style="font-size: 22rpx">住宅 · 套数</view>
        </view>
        <view class="muted" style="margin-bottom: 12rpx">
          由日数据聚合：同一自然月求和。最新月可能不完整（仍在爬虫累计中），环比基于"最新完整月 vs 前一完整月"。
        </view>
        <view v-if="newMonthlySummary" class="wq-monthly-row">
          <view class="wq-monthly-label">
            <text class="muted">新房</text>
            <text class="wq-monthly-sub muted">
              {{ monthlyDeltaText(newMonthlySummary.momUnits) }}
            </text>
          </view>
          <view class="spark spark-monthly">
            <view
              v-for="(b, i) in newMonthlyTrend"
              :key="'mn' + i"
              class="spark-bar new-bar"
              :style="{ height: monthlyPct(b.units, newMonthlyMax) + '%' }"
            ></view>
          </view>
          <view class="wq-monthly-latest">
            <text class="cell-value">{{ newMonthlySummary.latest ? formatMonthShort(newMonthlySummary.latest.month) : "—" }}</text>
            <text class="muted">{{ newMonthlySummary.latest ? newMonthlySummary.latest.units : 0 }} 套</text>
          </view>
        </view>
        <view v-if="secondMonthlySummary" class="wq-monthly-row">
          <view class="wq-monthly-label">
            <text class="muted">二手</text>
            <text class="wq-monthly-sub muted">
              {{ monthlyDeltaText(secondMonthlySummary.momUnits) }}
            </text>
          </view>
          <view class="spark spark-monthly">
            <view
              v-for="(b, i) in secondMonthlyTrend"
              :key="'ms' + i"
              class="spark-bar second-bar"
              :style="{ height: monthlyPct(b.units, secondMonthlyMax) + '%' }"
            ></view>
          </view>
          <view class="wq-monthly-latest">
            <text class="cell-value">{{ secondMonthlySummary.latest ? formatMonthShort(secondMonthlySummary.latest.month) : "—" }}</text>
            <text class="muted">{{ secondMonthlySummary.latest ? secondMonthlySummary.latest.units : 0 }} 套</text>
          </view>
        </view>
      </view>

      <!-- 深圳预售公示入口 -->
      <view
        v-if="cityName === '深圳'"
        class="card link-card tap-target"
        role="button"
        tabindex="0"
        hover-class="card-active"
        @click="openPresale"
      >
        深圳预售公示（楼盘表，需政务账号登录）›
      </view>

      <!-- 数据来源 -->
      <view class="card muted">
        <view style="margin-bottom: 8rpx; color: #cbd5e1">关于口径</view>
        <view>「住宅」= 走势页《房地产成交趋势》getFjzsInfoData，商品住房口径，可回溯 90 交易日。</view>
        <view style="margin-top: 6rpx">「全部」= 分区/月度公示 getEsf/YsfCjxx*DataNew，含非住宅二手。</view>
        <view style="margin-top: 6rpx">
          深圳二手两套口径同日常有差异（住宅 &lt; 全部），差额为非住宅（商办等）。数据文件
          <text style="color:#4ade80">/static/daily_wangqian.csv</text>。
        </view>
      </view>
    </view>

    <!-- 城市选择 -->
    <view v-if="sheetOpen" class="sheet-mask" @click="sheetOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-title">选择城市</view>
        <view
          v-for="c in supportedCities"
          :key="c"
          class="sheet-item tap-target"
          :class="{ 'sheet-item--active': c === cityName }"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="chooseCity(c)"
        >
          <text>{{ c }}</text>
          <text v-if="c === cityName" class="sheet-check">✓</text>
        </view>
        <view class="sheet-cancel" @click="sheetOpen = false">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { resolvedThemeRef as realtyTheme } from "../../utils/theme";
import { computed, ref } from "vue";
import { onLoad, onPullDownRefresh } from "@dcloudio/uni-app";
import {
  getLatestCityDaily,
  getCityDailyTrend,
  getLatestDistrictBreakdown,
  getLatestMonthlyDeal,
  getSupportedWangqianCities,
  hasDailyWangqian,
  getMonthlyTrendFromDaily,
  summarizeMonthlyTrend,
  type CityDailySnapshot,
  type DistrictBreakdown,
  type MonthlyDeal,
  type MonthlyTrendBucket,
  type MonthlyTrendSummary
} from "../../local/dailyWangqian";
import { refreshWangqianFromRemote } from "../../local/wangqianDataRefresher";
import { openGovWeb } from "../../config/govLinks";
import { showToast, daysAgoFromToday } from "../../utils/format";
import EmptyState from "../../components/EmptyState.vue";
import {
  getWangqianWeeklyWoWChange,
  getWangqianWeeklyRecentSpikes,
  getWangqianWeeklyVolatility,
  getWangqianWeeklyByCityCategoryTrend,
  type DistrictWoWChange,
  type DistrictSpike,
  type DistrictVolatility,
  type CityCategoryTrend
} from "../../local/wangqianTrendRanking";
import {
  formatZhBdcPeriod,
  getLatestZhBdcByKind,
  type ZhBdcRegistrationRow
} from "../../local/zhBdcRegistration";

const cityName = ref<string>("深圳");
const sheetOpen = ref(false);
const refreshing = ref(false);
const dataVersion = ref(0); // 刷新后自增，强制重算 computed

const ready = computed(() => hasDailyWangqian());
const supportedCities = computed(() => {
  void dataVersion.value;
  const list = getSupportedWangqianCities();
  const base = list.length ? list : ["深圳", "广州"];
  // 珠海无日更但仍可选：看登记季报空态（对照总览）
  return base.includes("珠海") ? base : [...base, "珠海"];
});
const wangqianEmptyDesc = computed(() => {
  if (!ready.value) return "请确认启动时已加载 daily_wangqian，或下拉/点刷新。";
  if (cityName.value === "珠海") {
    return "珠海暂无住建局日更网签；下方为不动产登记季报（≠日更网签、≠挂牌均价）。也可切回深圳/广州。";
  }
  return "当前仅深圳 / 广州有每日网签。可切换城市或点刷新重试。";
});
const zhBdcNew = computed<ZhBdcRegistrationRow | null>(() =>
  cityName.value === "珠海" ? getLatestZhBdcByKind("new_commodity") : null
);
const zhBdcStock = computed<ZhBdcRegistrationRow | null>(() =>
  cityName.value === "珠海" ? getLatestZhBdcByKind("stock_transfer") : null
);

const wqWowAll = computed<DistrictWoWChange[]>(() => {
  void dataVersion.value;
  return getWangqianWeeklyWoWChange().filter(
    (x) => x.city === cityName.value && x.category === "二手"
  );
});
const wqWowUp = computed(() =>
  [...wqWowAll.value]
    .filter((x) => Number.isFinite(x.changePct) && x.changePct > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 5)
);
const wqWowDown = computed(() =>
  [...wqWowAll.value]
    .filter((x) => Number.isFinite(x.changePct) && x.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, 5)
);
const wqSpikes = computed<DistrictSpike[]>(() => {
  void dataVersion.value;
  return getWangqianWeeklyRecentSpikes(4, 1.5)
    .filter((x) => x.city === cityName.value && x.category === "二手")
    .slice(0, 5);
});
const wqVolatility = computed<DistrictVolatility[]>(() => {
  void dataVersion.value;
  return getWangqianWeeklyVolatility()
    .filter((x) => x.city === cityName.value && x.category === "二手")
    .sort((a, b) => b.cv - a.cv)
    .slice(0, 5);
});
const wqCategoryTrend = computed<CityCategoryTrend | null>(() => {
  void dataVersion.value;
  return (
    getWangqianWeeklyByCityCategoryTrend(4).find(
      (x) => x.city === cityName.value && x.category === "二手"
    ) ?? null
  );
});
const wqTrendReady = computed(
  () =>
    wqWowUp.value.length > 0 ||
    wqWowDown.value.length > 0 ||
    wqSpikes.value.length > 0 ||
    wqVolatility.value.length > 0 ||
    wqCategoryTrend.value != null
);

function formatWowPct(v: number): string {
  if (!Number.isFinite(v)) return "∞";
  return Math.abs(v).toFixed(1);
}
const snapshot = computed<CityDailySnapshot | null>(() => {
  void dataVersion.value;
  if (!hasDailyWangqian()) return null;
  return getLatestCityDaily(cityName.value);
});

const monthly = computed<MonthlyDeal | null>(() => {
  void dataVersion.value;
  if (!hasDailyWangqian()) return null;
  return getLatestMonthlyDeal(cityName.value);
});

const nonResidential = computed(() => {
  const s = snapshot.value;
  if (!s || s.secondAllUnits == null || s.secondResidentialUnits == null) return null;
  return s.secondAllUnits - s.secondResidentialUnits;
});

const secondTrend = computed(() => {
  void dataVersion.value;
  return getCityDailyTrend(cityName.value, 90, "二手", "住宅");
});
const newTrend = computed(() => {
  void dataVersion.value;
  return getCityDailyTrend(cityName.value, 90, "新房", "住宅");
});
const secondMax = computed(() => Math.max(1, ...secondTrend.value.map((p) => p.units)));
const newMax = computed(() => Math.max(1, ...newTrend.value.map((p) => p.units)));

// 月度趋势（v0.89.0）：从日数据派生月成交，最近 12 个月。
// 仅做行内条形图，不强依赖任何外部接口；与已有月度公示接口（getMonthlyTrendFromDaily
// 也读本月初数据），前者快、后者是"官方本月累计"。
const newMonthlyTrend = computed<MonthlyTrendBucket[]>(() => {
  void dataVersion.value;
  return getMonthlyTrendFromDaily(cityName.value, "新房", 12);
});
const secondMonthlyTrend = computed<MonthlyTrendBucket[]>(() => {
  void dataVersion.value;
  return getMonthlyTrendFromDaily(cityName.value, "二手", 12);
});
const newMonthlySummary = computed<MonthlyTrendSummary>(() =>
  summarizeMonthlyTrend(newMonthlyTrend.value)
);
const secondMonthlySummary = computed<MonthlyTrendSummary>(() =>
  summarizeMonthlyTrend(secondMonthlyTrend.value)
);
const newMonthlyMax = computed(() =>
  Math.max(1, ...newMonthlyTrend.value.map((b) => b.units))
);
const secondMonthlyMax = computed(() =>
  Math.max(1, ...secondMonthlyTrend.value.map((b) => b.units))
);
const monthlyMonthsLabel = computed(() => {
  const a = newMonthlyTrend.value;
  const b = secondMonthlyTrend.value;
  const all = [...a, ...b];
  if (all.length === 0) return "—";
  const sorted = all.slice().sort((x, y) => (x.month < y.month ? 1 : -1));
  return `${formatMonthShort(sorted[sorted.length - 1].month)} 至今 · ${all.length} 月`;
});

function monthlyPct(units: number, max: number): number {
  if (!max || max <= 0) return 0;
  // 单月维度跨度大，用 sqrt 让低值不至于被压平
  const v = Math.sqrt(Math.max(0, units));
  const m = Math.sqrt(max);
  return Math.max(4, Math.round((v / m) * 100));
}

function monthlyDeltaText(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "环比 —";
  const sign = rate > 0 ? "↑" : rate < 0 ? "↓" : "→";
  const pct = (Math.abs(rate) * 100).toFixed(1);
  return `环比 ${sign}${pct}%`;
}

function formatMonthShort(iso: string): string {
  // 2026-06-01 → "6月"
  if (!iso || iso.length < 7) return iso || "—";
  const m = parseInt(iso.slice(5, 7), 10);
  return `${m}月`;
}

const district = computed<DistrictBreakdown | null>(() => {
  void dataVersion.value;
  return getLatestDistrictBreakdown(cityName.value);
});
const hasDistrictSecond = computed(() =>
  (district.value?.rows ?? []).some((r) => r.secondUnits != null)
);

// 数据新鲜度
const daysAgo = computed(() => daysAgoFromToday(snapshot.value?.date));
const freshLabel = computed(() => {
  const n = daysAgo.value;
  if (n == null) return "";
  if (n <= 0) return "今日";
  if (n === 1) return "昨日";
  return `${n} 天前`;
});
const freshClass = computed(() => {
  const n = daysAgo.value;
  if (n == null) return "";
  if (n <= 3) return "fresh-ok";
  if (n <= 7) return "fresh-warn";
  return "fresh-stale";
});

function sparkPct(units: number, max: number): number {
  return Math.max(2, Math.min(100, (units / max) * 100));
}
function avgUnits(series: { units: number }[]): number {
  if (!series.length) return 0;
  return Math.round(series.reduce((s, p) => s + p.units, 0) / series.length);
}
function fmtUnits(v: number | null): string {
  return v == null ? "—" : String(v);
}
function fmtArea(v: number | null): string {
  if (v == null) return "";
  if (v >= 10000) return `${(v / 10000).toFixed(1)} 万㎡`;
  return `${Math.round(v)} ㎡`;
}
function fmtShort(dateStr: string): string {
  const parts = dateStr.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateStr;
}

function pickCity() {
  sheetOpen.value = true;
}
function chooseCity(c: string) {
  cityName.value = c;
  sheetOpen.value = false;
}
function openPresale() {
  openGovWeb("szPresale");
}

async function doRefresh() {
  if (refreshing.value) return;
  refreshing.value = true;
  try {
    const r = await refreshWangqianFromRemote();
    if (r.ok && r.changed) {
      dataVersion.value++;
      showToast("已更新到最新网签");
    } else if (r.ok) {
      showToast("已是最新");
    } else {
      showToast(r.error || "刷新失败，保留本地数据");
    }
  } catch {
    showToast("刷新失败");
  } finally {
    refreshing.value = false;
  }
}

onPullDownRefresh(async () => {
  await doRefresh();
  uni.stopPullDownRefresh();
});

onLoad((opts?: Record<string, string>) => {
  const list = supportedCities.value;
  let c = (opts?.city ?? "").trim();
  // 某些平台 onLoad 参数未自动解码，这里兜底 decode（如 %E6%B7%B1%E5%9C%B3 → 深圳）
  try {
    if (/%[0-9A-Fa-f]{2}/.test(c)) c = decodeURIComponent(c);
  } catch {
    /* 保底：解码失败就用原值 */
  }
  c = c.replace(/市$/, "");
  cityName.value = list.includes(c) ? c : list.includes("深圳") ? "深圳" : list[0]!;
  if (!hasDailyWangqian()) showToast("网签数据未加载");
});
</script>

<style lang="scss" scoped>
.fresh-badge {
  margin-left: 12rpx;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
}
.fresh-ok {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
}
.fresh-warn {
  background: rgba(234, 179, 8, 0.18);
  color: #facc15;
}
.fresh-stale {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

.metric-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
}
.metric-cell {
  flex: 1 1 calc(33% - 12rpx);
  min-width: 180rpx;
  background: var(--color-surface);
  border: 1rpx solid var(--color-soft-strong);
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.metric-label {
  color: var(--color-muted);
  font-size: 22rpx;
}
.metric-value {
  font-size: 40rpx;
  font-weight: 700;
}
.metric-value.new {
  color: #4ade80;
}
.metric-value.res {
  color: #38bdf8;
}
.metric-value.all {
  color: #f59e0b;
}
.metric-sub {
  font-size: 20rpx;
}

.spark-meta {
  font-size: 22rpx;
  margin: 10rpx 0;
}
.spark {
  display: flex;
  align-items: flex-end;
  gap: 2rpx;
  height: 160rpx;
  width: 100%;
  overflow: hidden;
}
.spark-bar {
  flex: 1 1 0;
  min-width: 2rpx;
  border-radius: 2rpx 2rpx 0 0;
}
.spark-bar.second {
  background: linear-gradient(180deg, #38bdf8, #0ea5e9);
}
.spark-bar.new-bar {
  background: linear-gradient(180deg, #4ade80, #22c55e);
}
.spark-axis {
  display: flex;
  justify-content: space-between;
  font-size: 20rpx;
  margin-top: 6rpx;
}

/* v0.89.0 月度趋势 */
.wq-monthly-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx dashed var(--color-soft-strong);
}
.wq-monthly-row:last-child {
  border-bottom: 0;
}
.wq-monthly-label {
  width: 110rpx;
  display: flex;
  flex-direction: column;
}
.wq-monthly-sub {
  font-size: 20rpx;
  margin-top: 4rpx;
}
.spark.spark-monthly {
  flex: 1 1 auto;
  height: 80rpx;
}
.wq-monthly-latest {
  width: 140rpx;
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.wq-monthly-latest .cell-value {
  font-size: 28rpx;
  font-weight: 700;
}

.wq-table-head,
.wq-table-row {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
  font-size: 26rpx;
}
.wq-table-head {
  color: var(--color-muted);
  border-bottom: 1rpx solid var(--color-soft-strong);
}
.wq-table-row {
  border-bottom: 1rpx solid var(--color-soft-strong);
  color: var(--color-text);
}
.wq-total {
  color: var(--color-heading);
  font-weight: 700;
  border-top: 1rpx solid var(--color-soft-strong);
}
.wq-col-name {
  flex: 1.2;
}
.wq-col-num {
  width: 120rpx;
  text-align: right;
  color: #38bdf8;
  font-weight: 600;
}
.wq-col-num.all {
  color: #f59e0b;
}

.link-card {
  color: #4ade80;
  text-align: center;
  font-size: 26rpx;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  max-height: 70vh;
  background: var(--color-surface);
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  padding: 16rpx 0 calc(16rpx + var(--safe-area-bottom, 0px));
}
.sheet-title {
  text-align: center;
  font-size: 28rpx;
  color: var(--color-muted);
  padding: 16rpx;
  border-bottom: 1rpx solid var(--color-soft);
}
.sheet-item {
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid var(--color-soft);
  color: var(--color-heading);
  font-size: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sheet-item--active {
  color: #4ade80;
  background: var(--color-soft);
}
.sheet-check {
  color: #4ade80;
  font-weight: bold;
}
.sheet-cancel {
  text-align: center;
  padding: 28rpx 0;
  color: var(--color-muted);
  font-size: 30rpx;
  border-top: 1rpx solid var(--color-soft);
}
.trend-up {
  color: #ef4444;
}
.trend-down {
  color: #22c55e;
}
</style>

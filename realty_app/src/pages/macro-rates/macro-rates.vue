<template>
  <view class="page" :data-realty-theme="realtyTheme" :class="'realty-theme-' + realtyTheme">
    <view class="container">
      <MacroTabNav active="rates" data-macro-tab-nav />

      <!-- 聚合 · 近 6 期 利率变化趋势（T-009） -->
      <view class="card macro-card" data-rates-trend-summary>
        <view class="macro-kicker">聚合 · 6 项指标</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">近 6 期 利率变化趋势</view>
          <view class="muted" style="font-size: 22rpx">{{ trendWindowLabel }}</view>
        </view>
        <view class="rate-trend-grid" style="margin-top: 16rpx">
          <view class="rate-trend-row" v-for="row in rateTrendRows" :key="row.label">
            <text class="rate-trend-label">{{ row.label }}</text>
            <view class="rate-trend-cells">
              <text
                v-for="(v, i) in row.series"
                :key="i"
                class="rate-trend-cell"
                :class="v.kind"
              >{{ v.text }}</text>
            </view>
            <text
              class="rate-trend-band"
              :class="row.bandKind"
            >{{ row.bandText }}</text>
          </view>
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          6 张主卡的关键利率最近 6 期序列 · 升 / 持平 / 降 · 红涨绿跌（人民币利率反向）；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · LPR（lprHistoryAnalysis） -->
      <view v-if="lprLatest" class="card macro-card" data-lpr-history>
        <view class="macro-kicker">全国 · 人民银行</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">贷款市场报价利率 LPR</view>
          <view class="muted" style="font-size: 22rpx">{{ lprLatest.month }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="1 年期 LPR"
            :value="lprLatest.lpr1y.toFixed(2) + '%'"
            :sub="lprDelta != null ? formatBpDelta(lprDelta.lpr1yDeltaBp) : ''"
            :subTrendClass="lprDelta != null ? bandFromBp(lprDelta.lpr1yDeltaBp) : 'flat'"
          />
          <MacroKpiCell
            label="5 年期以上 LPR"
            :value="lprLatest.lpr5y.toFixed(2) + '%'"
            :sub="lprDelta != null ? formatBpDelta(lprDelta.lpr5yDeltaBp) : ''"
            :subTrendClass="lprDelta != null ? bandFromBp(lprDelta.lpr5yDeltaBp) : 'flat'"
          />
          <MacroKpiCell
            label="首套房贷"
            :value="lprLatest.mortgageFirst.toFixed(2) + '%'"
            :sub="lprDelta != null ? formatBpDelta(lprDelta.mortgageFirstDeltaBp) : ''"
            :subTrendClass="lprDelta != null ? bandFromBp(lprDelta.mortgageFirstDeltaBp) : 'flat'"
          />
          <MacroKpiCell
            label="二套房贷"
            :value="lprLatest.mortgageSecond.toFixed(2) + '%'"
            :sub="lprDelta != null ? formatBpDelta(lprDelta.mortgageSecondDeltaBp) : ''"
            :subTrendClass="lprDelta != null ? bandFromBp(lprDelta.mortgageSecondDeltaBp) : 'flat'"
          />
          <MacroKpiCell
            label="首套 - 二套利差"
            :value="(lprLatest.mortgageFirst - lprLatest.mortgageSecond >= 0 ? '+' : '') + ((lprLatest.mortgageFirst - lprLatest.mortgageSecond) * 100).toFixed(0) + ' bp'"
            subClass="muted"
          />
          <MacroKpiCell
            label="5y - 1y 利差"
            :value="((lprLatest.lpr5y - lprLatest.lpr1y) * 100).toFixed(0) + ' bp'"
            subClass="muted"
          />
        </view>
        <view v-if="lprStreak != null" class="rank-row macro-derived" style="margin-top: 12rpx">
          <text class="muted" style="font-size: 22rpx">最长未调息</text>
          <text class="rank-val">{{ lprStreak }} 个月（lpr5y）</text>
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          每月 20 日发布（遇节假日顺延）；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · MLF（mlfHistory） -->
      <view v-if="mlfLatest" class="card macro-card" data-mlf-history>
        <view class="macro-kicker">全国 · 人民银行</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">中期借贷便利 MLF</view>
          <view class="muted" style="font-size: 22rpx">{{ mlfLatest.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="1 年期利率"
            :value="mlfLatest.mlf1yPct.toFixed(2) + '%'"
            :sub="mlfDelta != null ? formatBpDelta(Math.round(mlfDelta.rateDeltaPp * 100)) : ''"
            :subTrendClass="mlfDelta != null ? bandFromDelta(mlfDelta.rateDeltaPp) : 'flat'"
          />
          <MacroKpiCell
            label="操作量"
            :value="(mlfLatest.amountYi / 10000).toFixed(0) + ' 万亿¥'"
            subClass="muted"
          />
          <MacroKpiCell
            label="期末余额"
            :value="(mlfLatest.balanceYi / 10000).toFixed(2) + ' 万亿¥'"
            subClass="muted"
          />
          <MacroKpiCell
            label="数据源"
            value="人民银行 OMO"
            subClass="muted"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          月度（2014-09 起）；2024 起改多重价位中标，利率样本止于"开展情况"期。
        </view>
      </view>

      <!-- 全国 · 公开市场 7 天逆回购（omoRrHistory） -->
      <view v-if="omoRrLatest" class="card macro-card" data-omo-rr-history>
        <view class="macro-kicker">全国 · 人民银行</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">公开市场 7 天逆回购</view>
          <view class="muted" style="font-size: 22rpx">{{ omoRrLatest.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="7 天利率"
            :value="omoRrLatest.ratePct.toFixed(2) + '%'"
            :sub="omoRrDelta != null ? formatBpDelta(Math.round(omoRrDelta.rateDeltaPp * 100)) : ''"
            :subTrendClass="omoRrDelta != null ? bandFromDelta(omoRrDelta.rateDeltaPp) : 'flat'"
          />
          <MacroKpiCell
            label="操作量"
            :value="(omoRrLatest.amountYi / 10000).toFixed(2) + ' 万亿¥'"
            subClass="muted"
          />
          <MacroKpiCell
            label="期限"
            :value="omoRrLatest.tenorDays + ' 天'"
            subClass="muted"
          />
          <MacroKpiCell
            label="数据源"
            value="人民银行 OMO"
            subClass="muted"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          日度 · 7 天期为主，亦含 14/28 天；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · Shibor（shibor） -->
      <view v-if="shiborLatest" class="card macro-card" data-shibor>
        <view class="macro-kicker">全国 · 外汇交易中心</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">同业拆放 Shibor</view>
          <view class="muted" style="font-size: 22rpx">{{ shiborLatest.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="隔夜 ON"
            :value="shiborLatest.on.toFixed(2) + '%'"
            :sub="shiborDelta != null ? formatBpDelta(Math.round(shiborDelta.onDeltaPp * 100)) : ''"
            :subTrendClass="shiborDelta != null ? bandFromDelta(shiborDelta.onDeltaPp) : 'flat'"
          />
          <MacroKpiCell
            label="1 周 W1"
            :value="shiborLatest.w1.toFixed(2) + '%'"
            :sub="shiborDelta != null ? formatBpDelta(Math.round(shiborDelta.w1DeltaPp * 100)) : ''"
            :subTrendClass="shiborDelta != null ? bandFromDelta(shiborDelta.w1DeltaPp) : 'flat'"
          />
          <MacroKpiCell
            label="2 周 W2"
            :value="shiborLatest.w2.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="1 个月 M1"
            :value="shiborLatest.m1.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="3 个月 M3"
            :value="shiborLatest.m3.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="6 个月 M6"
            :value="shiborLatest.m6.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="9 个月 M9"
            :value="shiborLatest.m9.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="1 年 Y1"
            :value="shiborLatest.y1.toFixed(2) + '%'"
            :sub="shiborDelta != null ? formatBpDelta(Math.round(shiborDelta.y1DeltaPp * 100)) : ''"
            :subTrendClass="shiborDelta != null ? bandFromDelta(shiborDelta.y1DeltaPp) : 'flat'"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          日度 · 8 个关键期限；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · 中债国债收益率（chinaBondYield） -->
      <view v-if="bondLatest" class="card macro-card" data-china-bond-yield>
        <view class="macro-kicker">全国 · 中债登</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">中债国债收益率</view>
          <view class="muted" style="font-size: 22rpx">{{ bondLatest.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="3 个月"
            :value="bondLatest.y3m.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="6 个月"
            :value="bondLatest.y6m.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="1 年"
            :value="bondLatest.y1y.toFixed(2) + '%'"
            :sub="bondDelta != null ? formatBpDelta(Math.round(bondDelta.y1yDeltaPp * 100)) : ''"
            :subTrendClass="bondDelta != null ? bandFromDelta(bondDelta.y1yDeltaPp) : 'flat'"
          />
          <MacroKpiCell
            label="3 年"
            :value="bondLatest.y3y.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="5 年"
            :value="bondLatest.y5y.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="7 年"
            :value="bondLatest.y7y.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="10 年"
            :value="bondLatest.y10y.toFixed(2) + '%'"
            :sub="bondDelta != null ? formatBpDelta(Math.round(bondDelta.y10yDeltaPp * 100)) : ''"
            :subTrendClass="bondDelta != null ? bandFromDelta(bondDelta.y10yDeltaPp) : 'flat'"
          />
          <MacroKpiCell
            label="30 年"
            :value="bondLatest.y30y.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="10y - 1y 利差"
            :value="bondLatest.spread10y1y.toFixed(0) + ' bp'"
            :sub="bondDelta != null ? formatBpDelta(Math.round(bondDelta.spreadDeltaPp * 100)) : ''"
            :subTrendClass="bondDelta != null ? bandFromDelta(bondDelta.spreadDeltaPp) : 'flat'"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          日度 · 9 个关键期限 + 利差；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · 回购定盘利率 FR/FDR（repoFixing） -->
      <view v-if="repoFixingLatest" class="card macro-card" data-repo-fixing>
        <view class="macro-kicker">全国 · 外汇交易中心</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">回购定盘利率 FR / FDR</view>
          <view class="muted" style="font-size: 22rpx">{{ repoFixingLatest.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="FR001 1 天"
            :value="repoFixingLatest.fr001.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="FR007 7 天"
            :value="repoFixingLatest.fr007.toFixed(2) + '%'"
            :sub="repoFixingDelta != null ? formatBpDelta(Math.round(repoFixingDelta.fr007DeltaPp * 100)) : ''"
            :subTrendClass="repoFixingDelta != null ? bandFromDelta(repoFixingDelta.fr007DeltaPp) : 'flat'"
          />
          <MacroKpiCell
            label="FR014 14 天"
            :value="repoFixingLatest.fr014.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="FDR001 1 天"
            :value="repoFixingLatest.fdr001.toFixed(2) + '%'"
            subClass="muted"
          />
          <MacroKpiCell
            label="FDR007 7 天"
            :value="repoFixingLatest.fdr007.toFixed(2) + '%'"
            :sub="repoFixingDelta != null ? formatBpDelta(Math.round(repoFixingDelta.fdr007DeltaPp * 100)) : ''"
            :subTrendClass="repoFixingDelta != null ? bandFromDelta(repoFixingDelta.fdr007DeltaPp) : 'flat'"
          />
          <MacroKpiCell
            label="FDR014 14 天"
            :value="repoFixingLatest.fdr014.toFixed(2) + '%'"
            subClass="muted"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          日度 · FR（普通质押式回购）+ FDR（存款类机构质押式回购）；≠房价/挂牌/网签/70城。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { resolvedThemeRef as realtyTheme } from "../../utils/theme";
/**
 * 宏观 · 利率子页（macro-rates.vue）。
 *
 * 6 张利率卡从「看板」迁入（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2）：
 *   - LPR 贷款市场报价利率（lprHistoryAnalysis，4 利率 × 月度）
 *   - MLF 中期借贷便利（mlfHistory，月度）
 *   - 公开市场 7 天逆回购（omoRrHistory，日度）
 *   - 同业拆放 Shibor（shibor，日度，8 个关键期限）
 *   - 中债国债收益率（chinaBondYield，日度，9 个关键期限）
 *   - 回购定盘利率 FR/FDR（repoFixing，日度，6 个期限）
 *
 * 共享 helper：formatBpDelta / bandFromBp / bandFromDelta / formatDelta
 */
import { computed } from "vue";
import MacroKpiCell from "../../components/MacroKpiCell.vue";
import MacroTabNav from "../../components/MacroTabNav.vue";
import {
  getLprLatest,
  getLprDelta,
  getLprLongestFlatStreak
} from "../../local/lprHistoryAnalysis";
import { getLprHistory } from "../../local/store";
import {
  getLatestMlf,
  getMlfDeltaVsPrev,
  getMlfHistory,
  type MlfRow
} from "../../local/mlfHistory";
import {
  getLatestOmoRr,
  getOmoRrDeltaVsPrev,
  getOmoRrHistory,
  type OmoRrRow
} from "../../local/omoRrHistory";
import {
  getLatestShibor,
  getShiborDeltaVsPrev,
  getShiborHistory,
  type ShiborRow
} from "../../local/shibor";
import {
  getLatestChinaBondYield,
  getChinaBondYieldDeltaVsPrev,
  getChinaBondYieldHistory,
  type ChinaBondYieldRow
} from "../../local/chinaBondYield";
import {
  getLatestRepoFixing,
  getRepoFixingDeltaVsPrev,
  getRepoFixingHistory,
  type RepoFixingRow
} from "../../local/repoFixing";

function formatBpDelta(bp: number): string {
  if (!Number.isFinite(bp) || bp === 0) return "持平";
  return (bp > 0 ? "+" : "") + bp + " bp";
}
function bandFromBp(bp: number | undefined | null): "up" | "down" | "flat" {
  if (bp == null || !Number.isFinite(bp) || bp === 0) return "flat";
  return bp > 0 ? "up" : "down";
}
function bandFromDelta(v: number | undefined | null): "up" | "down" | "flat" {
  if (v == null || !Number.isFinite(v) || v === 0) return "flat";
  return v > 0 ? "up" : "down";
}
function formatDelta(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(0);
}

const lprLatest = computed(() => getLprLatest());
const lprDelta = computed(() => {
  const cur = lprLatest.value;
  if (!cur) return null;
  // 取前一期月份（lprHistory 按月份升序）
  const history = getLprHistory();
  const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month));
  const idx = sorted.findIndex((r) => r.month === cur.month);
  if (idx <= 0) return null;
  const prev = sorted[idx - 1]!;
  return getLprDelta(prev.month, cur.month);
});
const lprStreak = computed(() => getLprLongestFlatStreak());

const mlfLatest = computed<MlfRow | null>(() => getLatestMlf());
const mlfDelta = computed(() => getMlfDeltaVsPrev());

const omoRrLatest = computed<OmoRrRow | null>(() => getLatestOmoRr());
const omoRrDelta = computed(() => getOmoRrDeltaVsPrev());

const shiborLatest = computed<ShiborRow | null>(() => getLatestShibor());
const shiborDelta = computed(() => getShiborDeltaVsPrev());

const bondLatest = computed<ChinaBondYieldRow | null>(() => getLatestChinaBondYield());
const bondDelta = computed(() => getChinaBondYieldDeltaVsPrev());

const repoFixingLatest = computed<RepoFixingRow | null>(() => getLatestRepoFixing());
const repoFixingDelta = computed(() => getRepoFixingDeltaVsPrev());

/* ------------------------------------------------------------------ *
 *  T-009 聚合 · 近 6 期 利率变化趋势
 *  6 张主卡的关键利率最近 6 期序列 + 涨/跌/持平计数。
 *  利率「升 = 红」是债市惯例，但房贷场景里「降 = 红」更直观，故反向：
 *    up = 利率降（红，刺激） / down = 利率升（绿，回收）
 * ------------------------------------------------------------------ */

type TrendKind = "rate-up" | "rate-down" | "rate-flat";
interface TrendCell {
  /** 显示文本：保留 2 位小数的百分比 */
  text: string;
  kind: TrendKind;
}
interface RateTrendRow {
  label: string;
  series: TrendCell[];
  bandText: string;
  bandKind: "rate-up" | "rate-down" | "rate-flat";
}

/**
 * 取最近 N 期某字段值（新→旧）。
 * history 函数已按新→旧排序，直接 slice(0, n) 即可。
 */
function pickRecent<T>(history: T[], n: number, pick: (row: T) => number): number[] {
  return history.slice(0, n).map(pick);
}

/**
 * 把 6 个连续点两两比对（点 0 = 最新），输出每点的方向：
 *   - 下降 → rate-up（红，对应房贷场景的「降息 = 好消息」）
 *   - 上升 → rate-down（绿，回收）
 *   - 持平 → rate-flat
 * 注意首点（最新一期）无可比对前值 → rate-flat。
 */
function diffSeriesToTrend(values: number[]): TrendKind[] {
  const out: TrendKind[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i === values.length - 1) {
      out.push("rate-flat");
      continue;
    }
    const cur = values[i]!;
    const prev = values[i + 1]!;
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) out.push("rate-flat");
    else if (cur < prev) out.push("rate-up");
    else if (cur > prev) out.push("rate-down");
    else out.push("rate-flat");
  }
  return out;
}

/**
 * 把 [up, flat, down] 三类计数转成概要文本 + 主色。
 */
function summarize(kinds: TrendKind[]): { text: string; kind: TrendKind } {
  let up = 0, down = 0, flat = 0;
  for (const k of kinds) {
    if (k === "rate-up") up++;
    else if (k === "rate-down") down++;
    else flat++;
  }
  if (up >= down && up > 0) return { text: `${up} 降 · ${down} 升 · ${flat} 平`, kind: "rate-up" };
  if (down > up) return { text: `${down} 升 · ${up} 降 · ${flat} 平`, kind: "rate-down" };
  return { text: `持平 ${flat} 期`, kind: "rate-flat" };
}

const TREND_WINDOW = 6;

/** 最新一期的窗口日期标签（如「2026-07 ~ 2026-02」），供 card 右上角 muted 显示 */
const trendWindowLabel = computed(() => {
  // 取 LPR 最新月 + 6 期前月
  const history = getLprHistory();
  if (history.length === 0) return "";
  const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month));
  const newest = sorted[sorted.length - 1]?.month ?? "";
  const oldest = sorted[Math.max(0, sorted.length - TREND_WINDOW)]?.month ?? "";
  return `${newest} ~ ${oldest}`;
});

const rateTrendRows = computed<RateTrendRow[]>(() => {
  // LPR 5y：按月份升序再倒序取最近 6 期
  const lprHistorySorted = [...getLprHistory()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, TREND_WINDOW);
  const lprValues = lprHistorySorted.map((r) => r.lpr5y);

  const mlfValues = pickRecent(getMlfHistory(), TREND_WINDOW, (r) => r.mlf1yPct);
  const omoValues = pickRecent(getOmoRrHistory(), TREND_WINDOW, (r) => r.ratePct);
  const shiborValues = pickRecent(getShiborHistory(), TREND_WINDOW, (r) => r.on);
  const bondValues = pickRecent(getChinaBondYieldHistory(), TREND_WINDOW, (r) => r.y10y);
  const repoValues = pickRecent(getRepoFixingHistory(), TREND_WINDOW, (r) => r.fr007);

  const labels = [
    "LPR 5y",
    "MLF 1y",
    "OMO 7d",
    "Shibor ON",
    "国债 10y",
    "FR007"
  ];
  const valuesList = [lprValues, mlfValues, omoValues, shiborValues, bondValues, repoValues];

  return labels.map((label, i) => {
    const vals = valuesList[i]!;
    const kinds = diffSeriesToTrend(vals);
    const series: TrendCell[] = vals.map((v, j) => ({
      text: Number.isFinite(v) ? v.toFixed(2) + "%" : "—",
      kind: kinds[j]!
    }));
    const sum = summarize(kinds.slice(1)); // 跳过首点（无可比对前值）
    return { label, series, bandText: sum.text, bandKind: sum.kind };
  });
});
</script>

<style scoped>
/* T-009 · 利率趋势聚合卡的紧凑网格 */
.rate-trend-grid {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.rate-trend-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 22rpx;
}
.rate-trend-label {
  flex: 0 0 140rpx;
  color: var(--muted, #888);
}
.rate-trend-cells {
  flex: 1;
  display: flex;
  gap: 6rpx;
}
.rate-trend-cell {
  flex: 1;
  text-align: center;
  padding: 4rpx 6rpx;
  border-radius: 6rpx;
  background: rgba(127, 127, 127, 0.08);
  font-variant-numeric: tabular-nums;
}
.rate-trend-cell.rate-up {
  color: #d23b3b;
  background: rgba(210, 59, 59, 0.10);
}
.rate-trend-cell.rate-down {
  color: #2f8a3a;
  background: rgba(47, 138, 58, 0.10);
}
.rate-trend-band {
  flex: 0 0 200rpx;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.rate-trend-band.rate-up {
  color: #d23b3b;
}
.rate-trend-band.rate-down {
  color: #2f8a3a;
}
.rate-trend-band.rate-flat {
  color: var(--muted, #888);
}
</style>
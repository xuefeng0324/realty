<template>
  <view class="page">
    <view class="container">
      <MacroTabNav active="rates" data-macro-tab-nav />

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
  type MlfRow
} from "../../local/mlfHistory";
import {
  getLatestOmoRr,
  getOmoRrDeltaVsPrev,
  type OmoRrRow
} from "../../local/omoRrHistory";
import {
  getLatestShibor,
  getShiborDeltaVsPrev,
  type ShiborRow
} from "../../local/shibor";
import {
  getLatestChinaBondYield,
  getChinaBondYieldDeltaVsPrev,
  type ChinaBondYieldRow
} from "../../local/chinaBondYield";
import {
  getLatestRepoFixing,
  getRepoFixingDeltaVsPrev,
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
</script>
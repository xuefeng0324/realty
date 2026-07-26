<template>
  <view class="page">
    <view class="container">
      <MacroTabNav active="fx" data-macro-tab-nav />

      <!-- 全国 · 外管局月末外汇储备（safeForex） -->
      <view v-if="safeForex" class="card macro-card" data-safe-forex>
        <view class="macro-kicker">全国 · 外管局</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">月末外汇储备</view>
          <view class="muted" style="font-size: 22rpx">{{ safeForex.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="储备规模"
            :value="formatForexYi(safeForex.forexUsdYi)"
            :sub="`环比 ${formatPctDelta(safeForexDelta?.deltaPct)}`"
            :subTrendClass="bandFromDelta(safeForexDelta?.deltaUsdYi)"
          />
          <MacroKpiCell
            label="环比变动"
            :value="safeForexDelta != null ? (safeForexDelta.deltaUsdYi >= 0 ? '+' : '') + safeForexDelta.deltaUsdYi.toFixed(2) + ' 亿$' : '—'"
          />
          <MacroKpiCell
            label="前月规模"
            :value="safeForexDelta != null ? formatForexYi(safeForexDelta.prev.forexUsdYi) : '—'"
          />
          <MacroKpiCell
            label="数据源"
            value="国家外管局"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          亿美元 · 月末数 · 不含黄金/SDR/IMF 储备头寸；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · 官方储备资产分项（safeOra） -->
      <view v-if="safeOra" class="card macro-card" data-safe-ora>
        <view class="macro-kicker">全国 · 外管局</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">官方储备资产分项</view>
          <view class="muted" style="font-size: 22rpx">{{ safeOra.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="储备合计"
            :value="formatForexYi(safeOra.totalUsdYi)"
            :sub="safeOraDelta != null ? `环比 ${formatDelta(safeOraDelta.totalDelta)} 亿$` : ''"
            :subTrendClass="bandFromDelta(safeOraDelta?.totalDelta)"
          />
          <MacroKpiCell
            label="外汇"
            :value="formatForexYi(safeOra.forexUsdYi)"
            :sub="`占合计 ${safeOraPct(safeOra.forexUsdYi, safeOra.totalUsdYi)}%`"
          />
          <MacroKpiCell
            label="黄金"
            :value="formatForexYi(safeOra.goldUsdYi)"
            :sub="safeOraDelta != null ? `环比 ${formatDelta(safeOraDelta.goldDelta)} 亿$` : ''"
            :subTrendClass="bandFromDelta(safeOraDelta?.goldDelta)"
          />
          <MacroKpiCell
            label="黄金占比"
            :value="safeOraGoldSharePct != null ? safeOraGoldSharePct + '%' : '—'"
          />
          <MacroKpiCell
            label="SDR"
            :value="formatForexYi(safeOra.sdrUsdYi)"
            :sub="`占合计 ${safeOraPct(safeOra.sdrUsdYi, safeOra.totalUsdYi)}%`"
          />
          <MacroKpiCell
            label="IMF 储备"
            :value="formatForexYi(safeOra.imfUsdYi)"
            :sub="`占合计 ${safeOraPct(safeOra.imfUsdYi, safeOra.totalUsdYi)}%`"
          />
          <MacroKpiCell
            label="黄金万盎司"
            :value="safeOra.goldOzWan.toLocaleString()"
          />
          <MacroKpiCell
            label="其他储备"
            :value="formatForexYi(safeOra.otherUsdYi)"
            :sub="`占合计 ${safeOraPct(safeOra.otherUsdYi, safeOra.totalUsdYi)}%`"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          亿美元 · 月末数 · 含外储 + 黄金 + SDR + IMF 储备头寸 + 其他；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · 美元中间价日度（safeUsdMid） -->
      <view v-if="safeUsdMid" class="card macro-card" data-safe-usd-mid>
        <view class="macro-kicker">全国 · 外汇交易中心</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">USD/CNY 中间价</view>
          <view class="muted" style="font-size: 22rpx">{{ safeUsdMid.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="中间价"
            :value="safeUsdMid.usdCny.toFixed(4)"
            subClass="muted"
          />
          <MacroKpiCell
            label="较前日"
            :value="safeUsdMidDelta != null ? (safeUsdMidDelta.delta >= 0 ? '+' : '') + safeUsdMidDelta.delta.toFixed(4) + ' 元' : '—'"
            :subTrendClass="bandFromDelta(safeUsdMidDelta?.delta)"
          />
          <MacroKpiCell
            label="当月均价"
            :value="safeUsdMidMonthAvg != null ? safeUsdMidMonthAvg.avg.toFixed(4) : '—'"
            subClass="muted"
          />
          <MacroKpiCell
            label="EUR 100"
            :value="safeUsdMid.eurPer100.toFixed(2)"
            subClass="muted"
          />
          <MacroKpiCell
            label="HKD 100"
            :value="safeUsdMid.hkdPer100.toFixed(3)"
            subClass="muted"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          日度 · 人民币 / 美元 中间价 + 100 外币兑人民币；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · 外汇市场成交概况（safeFxMarket） -->
      <view v-if="safeFxMarket" class="card macro-card" data-safe-fx-market>
        <view class="macro-kicker">全国 · 外汇交易中心</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">外汇市场成交概况</view>
          <view class="muted" style="font-size: 22rpx">{{ safeFxMarket.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="总成交"
            :value="(safeFxMarket.totalUsdWanYi * 10000).toLocaleString() + ' 亿$ (≈ ' + safeFxMarket.totalUsdWanYi.toFixed(0) + ' 万亿$)'"
            subClass="muted"
          />
          <MacroKpiCell
            label="即期 (RMB)"
            :value="safeFxMarket.spotRmbWanYi.toFixed(2) + ' 万亿¥'"
            subClass="muted"
          />
          <MacroKpiCell
            label="衍生品 (RMB)"
            :value="safeFxMarket.derivativeRmbWanYi.toFixed(2) + ' 万亿¥'"
            subClass="muted"
          />
          <MacroKpiCell
            label="客户/银行间"
            :value="(safeFxMarket.clientRmbWanYi / Math.max(safeFxMarket.interbankRmbWanYi, 0.01)).toFixed(2) + ' 倍'"
            subClass="muted"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          万亿元（CFETS 月报口径）；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · 银行结售汇月度（safeSettle） -->
      <view v-if="safeSettle" class="card macro-card" data-safe-settle>
        <view class="macro-kicker">全国 · 外汇局</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">银行结售汇</view>
          <view class="muted" style="font-size: 22rpx">{{ safeSettle.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="结汇"
            :value="formatForexYi(safeSettle.settleUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="售汇"
            :value="formatForexYi(safeSettle.sellUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="结售汇顺差"
            :value="(safeSettle.surplusUsdYi >= 0 ? '+' : '') + safeSettle.surplusUsdYi.toFixed(2) + ' 亿$'"
            :subTrendClass="bandFromDelta(safeSettle.surplusUsdYi)"
          />
          <MacroKpiCell
            label="涉外收付款顺差"
            :value="(safeSettle.receiptSurplusUsdYi >= 0 ? '+' : '') + safeSettle.receiptSurplusUsdYi.toFixed(2) + ' 亿$'"
            :subTrendClass="bandFromDelta(safeSettle.receiptSurplusUsdYi)"
          />
          <MacroKpiCell
            label="涉外收入"
            :value="formatForexYi(safeSettle.receiptUsdYi)"
            subClass="muted"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          亿美元 · 月度 · 银行代客结售汇 + 涉外收付款；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · 国际收支平衡表（safeBop） -->
      <view v-if="safeBop" class="card macro-card" data-safe-bop>
        <view class="macro-kicker">全国 · 外汇局</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">国际收支平衡表</view>
          <view class="muted" style="font-size: 22rpx">{{ safeBop.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="经常账户"
            :value="formatForexYi(safeBop.currentAccountUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="货物顺差"
            :value="(safeBop.goodsSurplusUsdYi >= 0 ? '+' : '') + safeBop.goodsSurplusUsdYi.toFixed(2) + ' 亿$'"
            :subTrendClass="bandFromDelta(safeBop.goodsSurplusUsdYi)"
          />
          <MacroKpiCell
            label="服务顺差"
            :value="(safeBop.servicesSurplusUsdYi >= 0 ? '+' : '') + safeBop.servicesSurplusUsdYi.toFixed(2) + ' 亿$'"
            :subTrendClass="bandFromDelta(safeBop.servicesSurplusUsdYi)"
          />
          <MacroKpiCell
            label="初次收入"
            :value="(safeBop.primaryIncomeUsdYi >= 0 ? '+' : '') + safeBop.primaryIncomeUsdYi.toFixed(2) + ' 亿$'"
            :subTrendClass="bandFromDelta(safeBop.primaryIncomeUsdYi)"
          />
          <MacroKpiCell
            label="二次收入"
            :value="(safeBop.secondaryIncomeUsdYi >= 0 ? '+' : '') + safeBop.secondaryIncomeUsdYi.toFixed(2) + ' 亿$'"
            :subTrendClass="bandFromDelta(safeBop.secondaryIncomeUsdYi)"
          />
          <MacroKpiCell
            label="资本+金融账户"
            :value="(safeBop.capitalFinancialUsdYi >= 0 ? '+' : '') + safeBop.capitalFinancialUsdYi.toFixed(2) + ' 亿$'"
            :subTrendClass="bandFromDelta(safeBop.capitalFinancialUsdYi)"
          />
          <MacroKpiCell
            label="初步口径"
            :value="safeBop.isPreliminary ? '初步' : '终值'"
            subClass="muted"
          />
          <MacroKpiCell
            label="数据源"
            value="外汇局 季度"
            subClass="muted"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          亿美元 · 季度 · BOP 表；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · 国际投资头寸（safeIip） -->
      <view v-if="safeIip" class="card macro-card" data-safe-iip>
        <view class="macro-kicker">全国 · 外汇局</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">国际投资头寸</view>
          <view class="muted" style="font-size: 22rpx">{{ safeIip.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="对外资产"
            :value="formatForexYi(safeIip.assetsUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="对外负债"
            :value="formatForexYi(safeIip.liabilitiesUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="净头寸"
            :value="(safeIip.netUsdYi >= 0 ? '+' : '') + safeIip.netUsdYi.toFixed(2) + ' 亿$'"
            :subTrendClass="bandFromDelta(safeIip.netUsdYi)"
          />
          <MacroKpiCell
            label="储备资产"
            :value="formatForexYi(safeIip.reserveAssetsUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="FDI 资产"
            :value="formatForexYi(safeIip.fdiAssetsUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="证券投资资产"
            :value="formatForexYi(safeIip.portfolioAssetsUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="FDI 负债"
            :value="formatForexYi(safeIip.fdiLiabUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="数据源"
            value="外汇局 季度"
            subClass="muted"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          亿美元 · 期末数 · IIP；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · 货物服务贸易（safeBopTrade） -->
      <view v-if="safeBopTrade" class="card macro-card" data-safe-bop-trade>
        <view class="macro-kicker">全国 · 外汇局</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">货物服务贸易</view>
          <view class="muted" style="font-size: 22rpx">{{ safeBopTrade.date }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="货物出口"
            :value="formatForexYi(safeBopTrade.goodsExportUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="货物进口"
            :value="formatForexYi(safeBopTrade.goodsImportUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="货物顺差"
            :value="(safeBopTrade.goodsSurplusUsdYi >= 0 ? '+' : '') + safeBopTrade.goodsSurplusUsdYi.toFixed(2) + ' 亿$'"
            :subTrendClass="bandFromDelta(safeBopTrade.goodsSurplusUsdYi)"
          />
          <MacroKpiCell
            label="服务出口"
            :value="formatForexYi(safeBopTrade.servicesExportUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="服务进口"
            :value="formatForexYi(safeBopTrade.servicesImportUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="服务顺差"
            :value="(safeBopTrade.servicesSurplusUsdYi >= 0 ? '+' : '') + safeBopTrade.servicesSurplusUsdYi.toFixed(2) + ' 亿$'"
            :subTrendClass="bandFromDelta(safeBopTrade.servicesSurplusUsdYi)"
          />
          <MacroKpiCell
            label="总出口"
            :value="formatForexYi(safeBopTrade.totalExportUsdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="总顺差"
            :value="(safeBopTrade.totalSurplusUsdYi >= 0 ? '+' : '') + safeBopTrade.totalSurplusUsdYi.toFixed(2) + ' 亿$'"
            :subTrendClass="bandFromDelta(safeBopTrade.totalSurplusUsdYi)"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          亿美元 · 月度 · 居民/非居民口径；≠海关人民币口径货物贸易。
        </view>
      </view>

      <!-- 全国 · 央行金融统计（pbcFinStats） -->
      <view v-if="pbcFinStats" class="card macro-card" data-pbc-fin-stats>
        <view class="macro-kicker">全国 · 人民银行</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">金融统计 · 社融 M2</view>
          <view class="muted" style="font-size: 22rpx">{{ pbcFinStats.period }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="社融存量"
            :value="(pbcFinStats.sfStockWanYi / 10000).toFixed(2) + ' 万万亿¥'"
            :sub="`同比 ${formatPctDelta(pbcFinStats.sfStockYoyPct)}`"
            :subTrendClass="bandFromDelta(pbcFinStats.sfStockYoyPct)"
          />
          <MacroKpiCell
            label="社融增量"
            :value="(pbcFinStats.sfFlowYtdWanYi / 10000).toFixed(2) + ' 万万亿¥'"
            subClass="muted"
          />
          <MacroKpiCell
            label="M2"
            :value="(pbcFinStats.m2WanYi / 10000).toFixed(2) + ' 万万亿¥'"
            :sub="`同比 ${formatPctDelta(pbcFinStats.m2YoyPct)}`"
            :subTrendClass="bandFromDelta(pbcFinStats.m2YoyPct)"
          />
          <MacroKpiCell
            label="M1"
            :value="(pbcFinStats.m1WanYi / 10000).toFixed(2) + ' 万万亿¥'"
            subClass="muted"
          />
          <MacroKpiCell
            label="本外币贷款"
            :value="(pbcFinStats.rmbLoanYtdWanYi / 10000).toFixed(2) + ' 万万亿¥'"
            subClass="muted"
          />
          <MacroKpiCell
            label="住户贷款"
            :value="formatForexYi(pbcFinStats.hhLoanYtdYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="汇率"
            :value="pbcFinStats.usdCny.toFixed(4)"
            subClass="muted"
          />
          <MacroKpiCell
            label="数据源"
            value="人民银行月度"
            subClass="muted"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          万亿元 · 月度 · 社融存量同比反映宏观杠杆；M2/M1 反映货币活化度；≠房价/挂牌/网签/70城。
        </view>
      </view>

      <!-- 全国 · 地区社融（pbcRegionSf 广东） -->
      <view v-if="pbcRegionSf" class="card macro-card" data-pbc-region-sf>
        <view class="macro-kicker">广东 · 人民银行</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">地区社融 · {{ pbcRegionSf.region }}</view>
          <view class="muted" style="font-size: 22rpx">{{ pbcRegionSf.period }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="社融增量"
            :value="formatForexYi(pbcRegionSf.sfFlowYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="人民币贷款"
            :value="formatForexYi(pbcRegionSf.rmbLoanYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="企业债"
            :value="formatForexYi(pbcRegionSf.corpBondYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="政府债"
            :value="formatForexYi(pbcRegionSf.govBondYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="股权融资"
            :value="formatForexYi(pbcRegionSf.equityYi)"
            subClass="muted"
          />
          <MacroKpiCell
            label="占全国社融"
            :value="pbcRegionSfPeers && pbcRegionSfPeers.length > 0 ? (pbcRegionSfPeers[0]!.sfFlowYi / 10000).toFixed(1) + ' 万亿¥ 区域排名' : '—'"
            subClass="muted"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          亿元 · 月度 · 省级社融增量对照；广东长期居首；≠房价/挂牌/网签/70城。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 宏观 · 汇市子页（macro-fx.vue）。
 *
 * 8 张汇市卡从「看板」迁入（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2）：
 *   - safeForex（月末外储规模）
 *   - safeOra（官方储备资产分项）
 *   - safeUsdMid（USD/CNY 中间价）
 *   - safeFxMarket（外汇市场成交概况）
 *   - safeSettle（银行结售汇月度）
 *   - safeBop（BOP 国际收支）
 *   - safeIip（IIP 国际投资头寸）
 *   - safeBopTrade（货物服务贸易月度）
 *
 * 共享 helper：formatForexYi / formatPctDelta / formatDelta / bandFromDelta / safeOraPct
 */
import { computed } from "vue";
import MacroKpiCell from "../../components/MacroKpiCell.vue";
import MacroTabNav from "../../components/MacroTabNav.vue";
import {
  getLatestSafeForex,
  getSafeForexDeltaVsPrev,
  type SafeForexRow
} from "../../local/safeForex";
import {
  getLatestSafeOra,
  getSafeOraDeltaVsPrev,
  getSafeOraGoldShare,
  type SafeOraRow
} from "../../local/safeOra";
import {
  getLatestSafeUsdMid,
  getSafeUsdMidDeltaVsPrev,
  getSafeUsdMidMonthAverage,
  type SafeUsdMidRow
} from "../../local/safeUsdMid";
import {
  getLatestSafeFxMarket,
  type SafeFxMarketRow
} from "../../local/safeFxMarket";
import {
  getLatestSafeSettle,
  type SafeSettleRow
} from "../../local/safeSettle";
import {
  getLatestSafeBop,
  type SafeBopRow
} from "../../local/safeBop";
import {
  getLatestSafeIip,
  type SafeIipRow
} from "../../local/safeIip";
import {
  getLatestSafeBopTrade,
  type SafeBopTradeRow
} from "../../local/safeBopTrade";
import {
  getLatestPbcFinStats,
  type PbcFinStatsRow
} from "../../local/pbcFinStats";
import {
  getLatestPbcRegionSf,
  getPbcRegionSfPeerRanking,
  type PbcRegionSfRow
} from "../../local/pbcRegionSf";

function formatForexYi(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "—";
  return v.toLocaleString() + " 亿$";
}
function formatPctDelta(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}
function formatDelta(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2);
}
function bandFromDelta(v: number | undefined | null): "up" | "down" | "flat" {
  if (v == null || !Number.isFinite(v) || v === 0) return "flat";
  return v > 0 ? "up" : "down";
}
function safeOraPct(part: number, total: number): string {
  if (!(total > 0) || !(part > 0)) return "0.0";
  return ((part / total) * 100).toFixed(1);
}

const safeForex = computed<SafeForexRow | null>(() => getLatestSafeForex());
const safeForexDelta = computed(() => getSafeForexDeltaVsPrev());

const safeOra = computed<SafeOraRow | null>(() => getLatestSafeOra());
const safeOraDelta = computed(() => getSafeOraDeltaVsPrev());
const safeOraGoldSharePct = computed(() => getSafeOraGoldShare(safeOra.value));

const safeUsdMid = computed<SafeUsdMidRow | null>(() => getLatestSafeUsdMid());
const safeUsdMidDelta = computed(() => getSafeUsdMidDeltaVsPrev());
const safeUsdMidMonthAvg = computed(() => getSafeUsdMidMonthAverage());

const safeFxMarket = computed<SafeFxMarketRow | null>(() => getLatestSafeFxMarket());
const safeSettle = computed<SafeSettleRow | null>(() => getLatestSafeSettle());
const safeBop = computed<SafeBopRow | null>(() => getLatestSafeBop());
const safeIip = computed<SafeIipRow | null>(() => getLatestSafeIip());
const safeBopTrade = computed<SafeBopTradeRow | null>(() => getLatestSafeBopTrade());

const pbcFinStats = computed<PbcFinStatsRow | null>(() => getLatestPbcFinStats());
const pbcRegionSf = computed<PbcRegionSfRow | null>(() => getLatestPbcRegionSf());
const pbcRegionSfPeers = computed(() => getPbcRegionSfPeerRanking());
</script>
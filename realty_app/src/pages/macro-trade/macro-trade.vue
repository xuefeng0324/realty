<template>
  <view class="page" :data-realty-theme="realtyTheme" :class="'realty-theme-' + realtyTheme">
    <view class="container">
      <MacroTabNav active="trade" data-macro-tab-nav />

      <!-- 全国 · 海关货物贸易（nbsTrade） -->
      <view v-if="nbsTrade" class="card macro-card" data-nbs-trade>
        <view class="macro-kicker">全国 · 海关货物贸易</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">货物进出口</view>
          <view class="muted" style="font-size: 22rpx">{{ nbsTrade.month }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            :label="nbsTrade.totalMonthYi != null ? '进出口当月' : '进出口累计'"
            :value="formatMacro100m((nbsTrade.totalMonthYi != null ? nbsTrade.totalMonthYi : nbsTrade.totalCumYi) || 0)"
            :sub="`同比 ${formatMacroPct((nbsTrade.totalMonthYi != null ? nbsTrade.totalMonthYoyPct : nbsTrade.totalCumYoyPct) || 0)}`"
            :subTrendClass="macroTrendBand((nbsTrade.totalMonthYi != null ? nbsTrade.totalMonthYoyPct : nbsTrade.totalCumYoyPct) || 0)"
          />
          <MacroKpiCell
            label="出口当月"
            :value="nbsTrade.exportMonthYi != null ? formatMacro100m(nbsTrade.exportMonthYi) : '—'"
            :sub="nbsTrade.exportMonthYoyPct != null ? `同比 ${formatMacroPct(nbsTrade.exportMonthYoyPct)}` : '亿元'"
            :subClass="nbsTrade.exportMonthYoyPct == null ? 'muted' : undefined"
            :subTrendClass="nbsTrade.exportMonthYoyPct != null ? macroTrendBand(nbsTrade.exportMonthYoyPct) : 'flat'"
          />
          <MacroKpiCell
            label="进口当月"
            :value="nbsTrade.importMonthYi != null ? formatMacro100m(nbsTrade.importMonthYi) : '—'"
            :sub="nbsTrade.importMonthYoyPct != null ? `同比 ${formatMacroPct(nbsTrade.importMonthYoyPct)}` : '亿元'"
            :subClass="nbsTrade.importMonthYoyPct == null ? 'muted' : undefined"
            :subTrendClass="nbsTrade.importMonthYoyPct != null ? macroTrendBand(nbsTrade.importMonthYoyPct) : 'flat'"
          />
          <MacroKpiCell
            label="当月顺差"
            :value="nbsTrade.surplusMonthYi != null ? formatMacro100m(nbsTrade.surplusMonthYi) : '—'"
            sub="出口−进口"
            subClass="muted"
          />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          国家统计局国民经济通稿转载海关总署口径（人民币）。海关货物贸易 ≠ 挂牌价、≠ 成交价、≠ 网签、≠ 70 城；与外管局货服贸易（美元、居民/非居民）口径不同。
        </view>
        <button
          v-if="nbsTradeTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-nbs-trade-series-toggle
          :aria-expanded="nbsTradeSeriesExpanded"
          @click="nbsTradeSeriesExpanded = !nbsTradeSeriesExpanded"
        >
          {{ nbsTradeSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="nbsTradeSeriesExpanded">
          <view class="macro-series" data-nbs-trade-series-detail>
            当月进出口同比
            <text v-for="(p, i) in nbsTradeTrend" :key="'trd-' + p.month">
              {{ shortNbsTradeMonthLabel(p.month) }}
              {{
                p.totalMonthYoyPct != null ? formatMacroPct(p.totalMonthYoyPct) : "累计" + formatMacroPct(p.totalCumYoyPct || 0)
              }}<text v-if="i < nbsTradeTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { resolvedThemeRef as realtyTheme } from "../../utils/theme";
/**
 * 宏观 · 贸易子页（macro-trade.vue）。
 *
 * 1 张全国海关货物贸易卡从 dashboard 总览迁入（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2）。
 */
import { computed, ref } from "vue";
import MacroKpiCell from "../../components/MacroKpiCell.vue";
import MacroTabNav from "../../components/MacroTabNav.vue";
import { formatMacro100m, formatMacroPct, macroTrendBand } from "../../utils/format";
import {
  getLatestNbsTrade,
  getNbsTradeTrend,
  shortNbsTradeMonthLabel,
  type NbsTradeRow
} from "../../local/nbsTrade";

const nbsTradeSeriesExpanded = ref(false);
const nbsTrade = computed<NbsTradeRow | null>(() => getLatestNbsTrade());
const nbsTradeTrend = computed(() => getNbsTradeTrend(6));
</script>
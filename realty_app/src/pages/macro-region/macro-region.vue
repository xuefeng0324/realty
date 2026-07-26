<template>
  <view class="page">
    <view class="container">
      <MacroTabNav active="region" data-macro-tab-nav />

      <!-- 广东 · 房地产（市场运行简况） -->
      <view v-if="gdRealEstateBrief" class="card macro-card" data-gd-real-estate-brief>
        <view class="macro-kicker">广东 · 房地产</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">市场运行简况</view>
          <view class="muted" style="font-size: 22rpx">{{ gdRealEstateBrief.periodLabel }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="'开发投资'"
            :value="formatMacro100m(gdRealEstateBrief.investmentYi)"
            :sub="formatMacroPct(gdRealEstateBrief.investmentYoyPct)"
            :subTrendClass="macroTrendBand(gdRealEstateBrief.investmentYoyPct)" />
          <MacroKpiCell
            label="'新房销售额'"
            :value="formatMacro100m(gdRealEstateBrief.salesAmountYi)"
            :sub="formatMacroPct(gdRealEstateBrief.salesAmountYoyPct)"
            :subTrendClass="macroTrendBand(gdRealEstateBrief.salesAmountYoyPct)" />
          <MacroKpiCell
            label="'新房销售面积'"
            :value="formatMacroArea(gdRealEstateBrief.salesAreaWanSqm)"
            :sub="formatMacroPct(gdRealEstateBrief.salesAreaYoyPct)"
            :subTrendClass="macroTrendBand(gdRealEstateBrief.salesAreaYoyPct)" />
          <MacroKpiCell
            label="'珠三角销售面积'"
            :value="formatMacroArea(gdRealEstateBrief.prSalesAreaWanSqm)"
            :sub="gdRealEstateBrief.prInvestmentYi.toLocaleString()" />
        </view>
        <view v-if="gdBriefUnitPrice != null" class="rank-row macro-derived" style="margin-top: 12rpx">
          <text class="muted" style="font-size: 22rpx">派生合同均价</text>
          <text class="rank-val">{{ gdBriefUnitPrice.toLocaleString() }} 元/㎡</text>
        </view>
        <view class="macro-note">
          {{ gdRealEstateBrief.sourceOrg }} · {{ gdRealEstateBrief.publishDate || gdRealEstateBrief.periodLabel }} · 全省合同累计 · 非挂牌/网签
        </view>
        <button
          v-if="gdBriefTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-gd-brief-series-toggle
          :aria-expanded="gdBriefSeriesExpanded"
          @click="gdBriefSeriesExpanded = !gdBriefSeriesExpanded"
        >
          {{ gdBriefSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="gdBriefSeriesExpanded">
          <view class="macro-series" data-gd-brief-series-detail>
            面积同比
            <text v-for="(p, i) in gdBriefTrend" :key="'gd-a-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.salesAreaYoyPct) }}<text v-if="i < gdBriefTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="macro-series" data-gd-brief-series-detail>
            销售额同比
            <text v-for="(p, i) in gdBriefTrend" :key="'gd-s-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.salesAmountYoyPct) }}<text v-if="i < gdBriefTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="macro-series" data-gd-brief-series-detail>
            投资同比
            <text v-for="(p, i) in gdBriefTrend" :key="'gd-i-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.investmentYoyPct) }}<text v-if="i < gdBriefTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <!-- 广东 · 经济运行 -->
      <view v-if="gdEconomy" class="card macro-card" data-gd-economy>
        <view class="macro-kicker">广东 · 宏观经济</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">经济运行</view>
          <view class="muted" style="font-size: 22rpx">{{ gdEconomy.periodLabel }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="'地区生产总值'"
            :value="formatMacro100m(gdEconomy.gdpYi)"
            :sub="formatMacroPct(gdEconomy.gdpYoyPct)"
            :subTrendClass="macroTrendBand(gdEconomy.gdpYoyPct)" />
          <MacroKpiCell
            label="'房开投资同比'"
            :value="formatMacroPct(gdEconomy.reInvestmentYoyPct)"
            :valueTrendClass="macroTrendBand(gdEconomy.reInvestmentYoyPct)"
            :sub="formatMacroPct(gdEconomy.faYoyPct)" />
          <MacroKpiCell
            label="'规上工业同比'"
            :value="formatMacroPct(gdEconomy.industryYoyPct)"
            :valueTrendClass="macroTrendBand(gdEconomy.industryYoyPct)"
            :sub="formatMacroPct(gdEconomy.retailYoyPct)" />
          <MacroKpiCell
            label="'人均可支配收入'"
            :value="formatMacroYuan(gdEconomy.disposableYuan)"
            :sub="formatMacroPct(gdEconomy.disposableNominalYoyPct)"
            :subTrendClass="macroTrendBand(gdEconomy.disposableNominalYoyPct)" />
        </view>
        <view class="macro-note">
          {{ gdEconomy.sourceOrg }} · {{ gdEconomy.publishDate || gdEconomy.periodLabel }} · 不变价 GDP · 非房价
        </view>
        <button
          v-if="gdEconomyHasDetail"
          class="gz-inventory-toggle"
          size="mini"
          data-gd-economy-series-toggle
          :aria-expanded="gdEconomySeriesExpanded"
          @click="gdEconomySeriesExpanded = !gdEconomySeriesExpanded"
        >
          {{ gdEconomySeriesExpanded ? "收起细节" : "城乡·人口·多期" }}
        </button>
        <template v-if="gdEconomySeriesExpanded">
          <view v-if="gdEconomy.urbanDisposableYuan > 0" class="macro-series">
            城镇 {{ formatMacroYuan(gdEconomy.urbanDisposableYuan) }}（{{ formatMacroPct(gdEconomy.urbanNominalYoyPct) }}）
            · 农村 {{ formatMacroYuan(gdEconomy.ruralDisposableYuan) }}（{{ formatMacroPct(gdEconomy.ruralNominalYoyPct) }}）
            · CPI {{ formatMacroPct(gdEconomy.cpiYoyPct) }}
          </view>
          <view v-if="gdEconomyPopulation" class="macro-series">
            {{ gdEconomyPopulation.periodLabel }}末常住
            {{ gdEconomyPopulation.permanentPopWan.toLocaleString() }} 万人
            （{{ gdEconomyPopulation.permanentPopDeltaWan > 0 ? "+" : "" }}{{ gdEconomyPopulation.permanentPopDeltaWan }}）
            · 城镇化 {{ gdEconomyPopulation.urbanizationRatePct }}%
            <template v-if="gdEconomyPopulation.urbanizationRatePp">
              （+{{ gdEconomyPopulation.urbanizationRatePp }} pct）
            </template>
          </view>
          <view v-if="gdEconomyTrend.length > 1" class="macro-series" data-gd-economy-series-detail>
            GDP 同比
            <text v-for="(p, i) in gdEconomyTrend" :key="'econ-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.gdpYoyPct) }}<text v-if="i < gdEconomyTrend.length - 1"> · </text>
            </text>
          </view>
          <view v-if="gdEconomyTrend.length > 1" class="macro-series">
            房开同比
            <text v-for="(p, i) in gdEconomyTrend" :key="'econ-re-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.reInvestmentYoyPct) }}<text v-if="i < gdEconomyTrend.length - 1"> · </text>
            </text>
          </view>
          <view v-if="gdEconomyTrend.length > 1" class="macro-series">
            收入名义同比
            <text v-for="(p, i) in gdEconomyTrend" :key="'econ-disp-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.disposableNominalYoyPct) }}<text v-if="i < gdEconomyTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <!-- 广东 · 固定资产投资 -->
      <view v-if="gdFaInvestment" class="card macro-card" data-gd-fa-investment>
        <view class="macro-kicker">广东 · 投资结构</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">固定资产投资</view>
          <view class="muted" style="font-size: 22rpx">{{ gdFaInvestment.periodLabel }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="'全省固投同比'"
            :value="formatMacroPct(gdFaInvestment.faYoyPct)"
            :valueTrendClass="macroTrendBand(gdFaInvestment.faYoyPct)"
            :sub="'名义 · 不含农户'" />
          <MacroKpiCell
            label="'工业投资同比'"
            :value="formatMacroPct(gdFaInvestment.industryYoyPct)"
            :valueTrendClass="macroTrendBand(gdFaInvestment.industryYoyPct)"
            :sub="formatMacroPct(gdFaInvestment.manufacturingYoyPct)" />
          <MacroKpiCell
            label="'第三产业同比'"
            :value="formatMacroPct(gdFaInvestment.tertiaryYoyPct)"
            :valueTrendClass="macroTrendBand(gdFaInvestment.tertiaryYoyPct)"
            :sub="formatMacroPct(gdFaInvestment.secondaryYoyPct)" />
          <MacroKpiCell
            label="'珠三角同比'"
            :value="formatMacroPct(gdFaInvestment.prYoyPct)"
            :valueTrendClass="macroTrendBand(gdFaInvestment.prYoyPct)"
            :sub="formatMacroPct(gdFaInvestment.eastYoyPct)" />
        </view>
        <view class="macro-note">
          {{ gdFaInvestment.sourceOrg }} · {{ gdFaInvestment.publishDate || gdFaInvestment.periodLabel }} · 同比为主 · 含房开投资
        </view>
        <button
          v-if="gdFaTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-gd-fa-series-toggle
          :aria-expanded="gdFaSeriesExpanded"
          @click="gdFaSeriesExpanded = !gdFaSeriesExpanded"
        >
          {{ gdFaSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="gdFaSeriesExpanded">
          <view class="macro-series" data-gd-fa-series-detail>
            固投同比
            <text v-for="(p, i) in gdFaTrend" :key="'fa-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.faYoyPct) }}<text v-if="i < gdFaTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <!-- 广东 · 建筑业生产运行 -->
      <view v-if="gdConstruction" class="card macro-card" data-gd-construction>
        <view class="macro-kicker">广东 · 施工产值</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">建筑业生产运行</view>
          <view class="muted" style="font-size: 22rpx">{{ gdConstruction.periodLabel }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="'建筑业总产值'"
            :value="formatMacro100m(gdConstruction.totalOutputYi)"
            :sub="formatMacroPct(gdConstruction.totalOutputYoyPct)"
            :subTrendClass="macroTrendBand(gdConstruction.totalOutputYoyPct)" />
          <MacroKpiCell
            label="'房屋建筑业'"
            :value="formatMacro100m(gdConstruction.housingOutputYi)"
            :sub="formatMacroPct(gdConstruction.housingOutputYoyPct)"
            :subTrendClass="macroTrendBand(gdConstruction.housingOutputYoyPct)" />
          <MacroKpiCell
            label="'土木工程'"
            :value="formatMacro100m(gdConstruction.civilOutputYi)"
            :sub="formatMacroPct(gdConstruction.civilOutputYoyPct)"
            :subTrendClass="macroTrendBand(gdConstruction.civilOutputYoyPct)" />
          <MacroKpiCell
            label="'珠三角产值'"
            :value="formatMacro100m(gdConstruction.prOutputYi)"
            :sub="formatMacroPct(gdConstruction.prOutputYoyPct)"
            :subTrendClass="macroTrendBand(gdConstruction.prOutputYoyPct)" />
        </view>
        <view class="macro-note">
          {{ gdConstruction.sourceOrg }} · {{ gdConstruction.publishDate || gdConstruction.periodLabel }} · 资质企业产值 ≠ 商品房成交
        </view>
        <button
          v-if="gdConstructionTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-gd-construction-series-toggle
          :aria-expanded="gdConstructionSeriesExpanded"
          @click="gdConstructionSeriesExpanded = !gdConstructionSeriesExpanded"
        >
          {{ gdConstructionSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="gdConstructionSeriesExpanded">
          <view class="macro-series" data-gd-construction-series-detail>
            总产值同比
            <text v-for="(p, i) in gdConstructionTrend" :key="'gc-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.totalOutputYoyPct) }}<text v-if="i < gdConstructionTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="macro-series" data-gd-construction-series-detail>
            房屋建筑业同比
            <text v-for="(p, i) in gdConstructionTrend" :key="'gh-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.housingOutputYoyPct) }}<text v-if="i < gdConstructionTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 宏观 · 区域子页（macro-region.vue）。
 *
 * 4 张广东卡从 dashboard 总览迁入（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2）：
 *   - 广东 · 房地产（市场运行简况）
 *   - 广东 · 经济运行
 *   - 广东 · 固定资产投资
 *   - 广东 · 建筑业生产运行
 *
 * 共享 helper：formatMacro100m / formatMacroPct / formatMacroArea / formatMacroYuan / macroTrendClass
 * 数据源：realty_app/src/local/store.ts 的 gdMacro 模块
 */
import { computed, ref } from "vue";
import MacroKpiCell from "../../components/MacroKpiCell.vue";
import MacroTabNav from "../../components/MacroTabNav.vue";
import { formatMacro100m, formatMacroArea, formatMacroPct, formatMacroYuan, macroTrendBand } from "../../utils/format";
import {
  getLatestGdRealEstateBrief,
  getGdRealEstateBriefTrend,
  gdBriefImpliedUnitPrice,
  type GdRealEstateBriefRow
} from "../../local/gdRealEstateBrief";
import {
  getLatestGdFaInvestment,
  getGdFaInvestmentTrend,
  type GdFaInvestmentRow
} from "../../local/gdFaInvestment";
import {
  getLatestGdConstruction,
  getGdConstructionTrend,
  gdHousingSharePct,
  type GdConstructionRow
} from "../../local/gdConstruction";
import {
  getLatestGdEconomy,
  getLatestGdEconomyPopulation,
  getGdEconomyTrend,
  type GdEconomyRow
} from "../../local/gdEconomy";

// 5 个多期展开 ref
const gdBriefSeriesExpanded = ref(false);
const gdFaSeriesExpanded = ref(false);
const gdConstructionSeriesExpanded = ref(false);
const gdEconomySeriesExpanded = ref(false);

// 4 张卡的 state（10 个 computed）
const gdRealEstateBrief = computed<GdRealEstateBriefRow | null>(() => getLatestGdRealEstateBrief());
const gdBriefUnitPrice = computed(() => gdBriefImpliedUnitPrice(gdRealEstateBrief.value));
const gdBriefTrend = computed(() => getGdRealEstateBriefTrend(8));

const gdEconomy = computed<GdEconomyRow | null>(() => getLatestGdEconomy());
const gdEconomyTrend = computed(() => getGdEconomyTrend(6));
const gdEconomyPopulation = computed<GdEconomyRow | null>(() => getLatestGdEconomyPopulation());
const gdEconomyHasDetail = computed(() => {
  const e = gdEconomy.value;
  if (!e) return false;
  return (
    e.urbanDisposableYuan > 0 ||
    !!gdEconomyPopulation.value ||
    gdEconomyTrend.value.length > 1
  );
});

const gdFaInvestment = computed<GdFaInvestmentRow | null>(() => getLatestGdFaInvestment());
const gdFaTrend = computed(() => getGdFaInvestmentTrend(6));

const gdConstruction = computed<GdConstructionRow | null>(() => getLatestGdConstruction());
const gdConstructionTrend = computed(() => getGdConstructionTrend(6));
const gdConstructionHousingShare = computed(() => gdHousingSharePct(gdConstruction.value));
</script>
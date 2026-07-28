<template>
  <view class="page" :data-realty-theme="realtyTheme" :class="'realty-theme-' + realtyTheme">
    <view class="container">
      <MacroTabNav active="industry" data-macro-tab-nav />

      <!-- 全国 · 固定资产投资（nbsFaInvestment） -->
      <view v-if="nbsFaInvestment" class="card macro-card" data-nbs-fa-investment>
        <view class="macro-kicker">全国 · 固定资产投资</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">固投基本情况</view>
          <view class="muted" style="font-size: 22rpx">{{ nbsFaInvestment.publishDate }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="固投累计"
            :value="formatMacro100m(nbsFaInvestment.faCny100m)"
            :sub="formatMacroPct(nbsFaInvestment.faYoyPct)"
            :subTrendClass="macroTrendBand(nbsFaInvestment.faYoyPct)" />
          <MacroKpiCell
            label="民间投资同比"
            :value="formatMacroPct(nbsFaInvestment.privateYoyPct)"
            :valueTrendClass="macroTrendBand(nbsFaInvestment.privateYoyPct)"
            :sub="formatMacroPct(nbsFaInvestment.stateYoyPct)" />
          <MacroKpiCell
            label="制造业同比"
            :value="formatMacroPct(nbsFaInvestment.manufacturingYoyPct)"
            :valueTrendClass="macroTrendBand(nbsFaInvestment.manufacturingYoyPct)"
            :sub="formatMacroPct(nbsFaInvestment.equipmentYoyPct)" />
          <MacroKpiCell
            label="第三产业同比"
            :value="formatMacroPct(nbsFaInvestment.tertiaryYoyPct)"
            :valueTrendClass="macroTrendBand(nbsFaInvestment.tertiaryYoyPct)"
            :sub="formatMacroPct(nbsFaInvestment.secondaryYoyPct)" />
        </view>
        <view class="macro-note">
          {{ nbsFaInvestment.period.replace("_to_", "–") }} · 不含农户 · 国家统计局 · 非房价；房开投资见上方房地产卡
        </view>
        <button
          v-if="nbsFaTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-nbs-fa-series-toggle
          :aria-expanded="nbsFaSeriesExpanded"
          @click="nbsFaSeriesExpanded = !nbsFaSeriesExpanded"
        >
          {{ nbsFaSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="nbsFaSeriesExpanded">
          <view class="macro-series" data-nbs-fa-series-detail>
            固投同比
            <text v-for="(p, i) in nbsFaTrend" :key="'nfa-' + p.period">
              {{ shortNbsFaPeriodLabel(p.period) }} {{ formatMacroPct(p.faYoyPct)
              }}<text v-if="i < nbsFaTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="macro-series" data-nbs-fa-series-detail>
            民间同比
            <text v-for="(p, i) in nbsFaTrend" :key="'nfa-p-' + p.period">
              {{ shortNbsFaPeriodLabel(p.period) }} {{ formatMacroPct(p.privateYoyPct)
              }}<text v-if="i < nbsFaTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="macro-series" data-nbs-fa-series-detail>
            制造同比
            <text v-for="(p, i) in nbsFaTrend" :key="'nfa-m-' + p.period">
              {{ shortNbsFaPeriodLabel(p.period) }} {{ formatMacroPct(p.manufacturingYoyPct)
              }}<text v-if="i < nbsFaTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <!-- 全国 · 居民收支（nbsIncome） -->
      <view v-if="nbsIncome" class="card macro-card" data-nbs-income>
        <view class="macro-kicker">全国 · 居民收支</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">收入和消费支出</view>
          <view class="muted" style="font-size: 22rpx">{{ nbsIncome.periodLabel }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="人均可支配收入"
            :value="formatMacroYuan(nbsIncome.disposableYuan)"
            :sub="formatMacroPct(nbsIncome.disposableNominalYoyPct)"
            :subTrendClass="macroTrendBand(nbsIncome.disposableNominalYoyPct)" />
          <MacroKpiCell
            label="城镇可支配收入"
            :value="formatMacroYuan(nbsIncome.urbanDisposableYuan)"
            :sub="formatMacroPct(nbsIncome.urbanNominalYoyPct)"
            :subTrendClass="macroTrendBand(nbsIncome.urbanNominalYoyPct)" />
          <MacroKpiCell
            label="人均消费支出"
            :value="formatMacroYuan(nbsIncome.consumptionYuan)"
            :sub="formatMacroPct(nbsIncome.consumptionNominalYoyPct)"
            :subTrendClass="macroTrendBand(nbsIncome.consumptionNominalYoyPct)" />
          <MacroKpiCell
            label="居住消费"
            :value="formatMacroYuan(nbsIncome.housingConsumptionYuan)"
            :sub="formatMacroPct(nbsIncome.housingConsumptionYoyPct)"
            :subTrendClass="macroTrendBand(nbsIncome.housingConsumptionYoyPct)" />
        </view>
        <view class="macro-note">
          国家统计局 · {{ nbsIncome.publishDate }} · 居住消费 · 非房价；可与广东收入对照
        </view>
        <button
          v-if="nbsIncomeTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-nbs-income-series-toggle
          :aria-expanded="nbsIncomeSeriesExpanded"
          @click="nbsIncomeSeriesExpanded = !nbsIncomeSeriesExpanded"
        >
          {{ nbsIncomeSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="nbsIncomeSeriesExpanded">
          <view class="macro-series">
            农村收入
            {{ formatMacroYuan(nbsIncome.ruralDisposableYuan) }}
            （名义 {{ formatMacroPct(nbsIncome.ruralNominalYoyPct) }}
            · 实际 {{ formatMacroPct(nbsIncome.ruralRealYoyPct) }}）
          </view>
          <view class="macro-series" data-nbs-income-series-detail>
            可支配收入名义同比
            <text v-for="(p, i) in nbsIncomeTrend" :key="'ni-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.disposableNominalYoyPct)
              }}<text v-if="i < nbsIncomeTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="macro-series" data-nbs-income-series-detail>
            居住消费同比
            <text v-for="(p, i) in nbsIncomeTrend" :key="'nih-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.housingConsumptionYoyPct)
              }}<text v-if="i < nbsIncomeTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <!-- 全国 · CPI（nbsCpi） -->
      <view v-if="nbsCpi" class="card macro-card" data-nbs-cpi>
        <view class="macro-kicker">全国 · 居民消费价格</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">CPI（含居住/房租）</view>
          <view class="muted" style="font-size: 22rpx">{{ nbsCpi.month }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="CPI 同比"
            :value="formatMacroPct(nbsCpi.cpiYoyPct)"
            :valueTrendClass="macroTrendBand(nbsCpi.cpiYoyPct)"
            :sub="formatMacroPct(nbsCpi.cpiMomPct)" />
          <MacroKpiCell
            label="居住同比"
            :value="formatMacroPct(nbsCpi.residenceYoyPct)"
            :valueTrendClass="macroTrendBand(nbsCpi.residenceYoyPct)"
            sub="CPI 居住类" />
          <MacroKpiCell
            label="租赁房房租同比"
            :value="formatMacroPct(nbsCpi.rentYoyPct)"
            :valueTrendClass="macroTrendBand(nbsCpi.rentYoyPct)"
            sub="房租 ≠ 房价" />
          <MacroKpiCell
            label="发布日"
            :value="nbsCpi.publishDate"
            sub="国家统计局" />
        </view>
        <view class="macro-note">
          月度 CPI · 居住/房租为消费价格指数分项 · 非挂牌/网签/70城
        </view>
        <button
          v-if="nbsCpiTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-nbs-cpi-series-toggle
          :aria-expanded="nbsCpiSeriesExpanded"
          @click="nbsCpiSeriesExpanded = !nbsCpiSeriesExpanded"
        >
          {{ nbsCpiSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="nbsCpiSeriesExpanded">
          <view class="macro-series" data-nbs-cpi-series-detail>
            CPI 同比
            <text v-for="(p, i) in nbsCpiTrend" :key="'cpi-' + p.month">
              {{ shortNbsCpiMonthLabel(p.month) }} {{ formatMacroPct(p.cpiYoyPct)
              }}<text v-if="i < nbsCpiTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="macro-series" data-nbs-cpi-series-detail>
            房租同比
            <text v-for="(p, i) in nbsCpiTrend" :key="'rent-' + p.month">
              {{ shortNbsCpiMonthLabel(p.month) }} {{ formatMacroPct(p.rentYoyPct)
              }}<text v-if="i < nbsCpiTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <!-- 全国 · PMI（nbsPmi） -->
      <view v-if="nbsPmi" class="card macro-card" data-nbs-pmi>
        <view class="macro-kicker">全国 · 采购经理指数</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">PMI（含建筑业）</view>
          <view class="muted" style="font-size: 22rpx">{{ nbsPmi.month }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="制造业 PMI"
            :value="nbsPmi.mfgPmi.toFixed(1)"
            :valueTrendClass="macroTrendBand(pmiVsThreshold(nbsPmi.mfgPmi))"
            sub="临界点 50" />
          <MacroKpiCell
            label="非制造业"
            :value='nbsPmi.nonMfgBusiness != null ? nbsPmi.nonMfgBusiness.toFixed(1) : "—"'
            :valueTrendClass="macroTrendBand(pmiVsThreshold(nbsPmi.nonMfgBusiness))"
            sub="商务活动" />
          <MacroKpiCell
            label="建筑业"
            :value='nbsPmi.constructionBusiness != null ? nbsPmi.constructionBusiness.toFixed(1) : "—"'
            :valueTrendClass="macroTrendBand(pmiVsThreshold(nbsPmi.constructionBusiness))"
            sub="景气 ≠ 房价" />
          <MacroKpiCell
            label="综合产出"
            :value='nbsPmi.compositePmi != null ? nbsPmi.compositePmi.toFixed(1) : "—"'
            :valueTrendClass="macroTrendBand(pmiVsThreshold(nbsPmi.compositePmi))"
            :sub='nbsPmi.production != null ? nbsPmi.production.toFixed(1) : "—"' />
        </view>
        <view class="macro-note">
          国家统计局采购经理调查 · &gt;50 扩张 / &lt;50 收缩 · 建筑业商务活动 ≠ 挂牌/成交/网签/70城
        </view>
        <button
          v-if="nbsPmiTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-nbs-pmi-series-toggle
          :aria-expanded="nbsPmiSeriesExpanded"
          @click="nbsPmiSeriesExpanded = !nbsPmiSeriesExpanded"
        >
          {{ nbsPmiSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="nbsPmiSeriesExpanded">
          <view class="macro-series" data-nbs-pmi-series-detail>
            制造业 PMI
            <text v-for="(p, i) in nbsPmiTrend" :key="'pmi-mfg-' + p.month">
              {{ shortNbsPurchasingPmiMonthLabel(p.month) }} {{ p.mfgPmi.toFixed(1)
              }}<text v-if="i < nbsPmiTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="macro-series" data-nbs-pmi-series-detail>
            建筑业
            <text v-for="(p, i) in nbsPmiTrend" :key="'pmi-con-' + p.month">
              {{ shortNbsPurchasingPmiMonthLabel(p.month) }}
              {{
                p.constructionBusiness != null ? p.constructionBusiness.toFixed(1) : "—"
              }}<text v-if="i < nbsPmiTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <!-- 全国 · 工业增加值（nbsIndustrial） -->
      <view v-if="nbsIndustrial" class="card macro-card" data-nbs-industrial>
        <view class="macro-kicker">全国 · 工业生产</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">工业增加值</view>
          <view class="muted" style="font-size: 22rpx">{{ nbsIndustrial.month }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="当月同比"
            :value="formatMacroPct(nbsIndustrial.yoyPct)"
            :valueTrendClass="macroTrendBand(nbsIndustrial.yoyPct)"
            :sub='nbsIndustrialDelta != null && nbsIndustrialDelta.yoyDeltaPp > 0 ? "+" : ""'
            :subTrendClass="macroTrendBand(nbsIndustrialDelta?.yoyDeltaPp ?? 0)" />
          <MacroKpiCell
            label="环比"
            :value='nbsIndustrial.momPct != null ? formatMacroPct(nbsIndustrial.momPct) : "—"'
            :valueTrendClass="macroTrendBand(nbsIndustrial.momPct ?? 0)"
            sub="季节调整后" />
          <MacroKpiCell
            label="累计同比"
            :value='nbsIndustrial.ytdYoyPct != null ? formatMacroPct(nbsIndustrial.ytdYoyPct) : "—"'
            :valueTrendClass="macroTrendBand(nbsIndustrial.ytdYoyPct ?? 0)"
            sub="年初至今" />
          <MacroKpiCell
            label="制造业"
            :value='nbsIndustrial.manufacturingYoyPct != null ? formatMacroPct(nbsIndustrial.manufacturingYoyPct) : "—"'
            :valueTrendClass="macroTrendBand(nbsIndustrial.manufacturingYoyPct ?? 0)"
            :sub='nbsIndustrial.miningYoyPct != null ? formatMacroPct(nbsIndustrial.miningYoyPct) : "—"' />
        </view>
        <view v-if="nbsIndustrialHasMaterials" class="stats70-grid" style="margin-top: 8rpx" data-nbs-industrial-materials>
          <MacroKpiCell
            label="'水泥产量同比'"
            :value='nbsIndustrial.cementYoyPct != null ? formatMacroPct(nbsIndustrial.cementYoyPct) : "—"'
            :valueTrendClass="macroTrendBand(nbsIndustrial.cementYoyPct ?? 0)"
            :sub='nbsIndustrial.cementWanT != null ? nbsIndustrial.cementWanT.toLocaleString() + " 万吨" : ""' />
          <MacroKpiCell
            label="'钢材产量同比'"
            :value='nbsIndustrial.steelYoyPct != null ? formatMacroPct(nbsIndustrial.steelYoyPct) : "—"'
            :valueTrendClass="macroTrendBand(nbsIndustrial.steelYoyPct ?? 0)"
            :sub='nbsIndustrial.steelWanT != null ? nbsIndustrial.steelWanT.toLocaleString() + " 万吨" : ""' />
          <MacroKpiCell
            label="'平板玻璃同比'"
            :value='nbsIndustrial.flatGlassYoyPct != null ? formatMacroPct(nbsIndustrial.flatGlassYoyPct) : "—"'
            :valueTrendClass="macroTrendBand(nbsIndustrial.flatGlassYoyPct ?? 0)"
            :sub='nbsIndustrial.cementYtdYoyPct != null ? "水泥累计 " + formatMacroPct(nbsIndustrial.cementYtdYoyPct) : ""' />
          <MacroKpiCell
            label="'粗钢同比'"
            :value='nbsIndustrial.crudeSteelYoyPct != null ? formatMacroPct(nbsIndustrial.crudeSteelYoyPct) : "—"'
            :valueTrendClass="macroTrendBand(nbsIndustrial.crudeSteelYoyPct ?? 0)" />
        </view>
        <view class="macro-note">
          国家统计局规模以上工业增加值（扣除价格因素）· 水泥/钢材/玻璃为产量表分项（建材弱相关，≠房价）· ≠ 挂牌/成交/网签/70城；可与 PMI 对照
        </view>
        <button
          v-if="nbsIndustrialTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-nbs-industrial-series-toggle
          :aria-expanded="nbsIndustrialSeriesExpanded"
          @click="nbsIndustrialSeriesExpanded = !nbsIndustrialSeriesExpanded"
        >
          {{ nbsIndustrialSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="nbsIndustrialSeriesExpanded">
          <view class="macro-series" data-nbs-industrial-series-detail>
            当月同比
            <text v-for="(p, i) in nbsIndustrialTrend" :key="'ind-yoy-' + p.month">
              {{ shortNbsIndustrialMonthLabel(p.month) }} {{ formatMacroPct(p.yoyPct)
              }}<text v-if="i < nbsIndustrialTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <!-- 全国 · 工业企业利润（nbsIndustrialProfit） -->
      <view
        v-if="nbsIndustrialProfit"
        class="card macro-card"
        data-nbs-industrial-profit
      >
        <view class="macro-kicker">全国 · 工业企业效益</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">工业企业利润</view>
          <view class="muted" style="font-size: 22rpx">
            1–{{ Number(nbsIndustrialProfit.month.slice(5)) }}月
          </view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="利润总额"
            :value="formatMacroPct(nbsIndustrialProfit.profitYoyPct)"
            :valueTrendClass="macroTrendBand(nbsIndustrialProfit.profitYoyPct)"
            :sub="nbsIndustrialProfit.profitYi.toLocaleString()" />
          <MacroKpiCell
            label="营收同比"
            :value='nbsIndustrialProfit.revenueYoyPct != null ? formatMacroPct(nbsIndustrialProfit.revenueYoyPct) : "—"'
            :valueTrendClass="macroTrendBand(nbsIndustrialProfit.revenueYoyPct ?? 0)"
            :sub='nbsIndustrialProfit.revenueWanYi != null ? nbsIndustrialProfit.revenueWanYi.toFixed(2) + " 万亿" : "—"' />
          <MacroKpiCell
            label="营收利润率"
            :value='nbsIndustrialProfit.marginPct != null ? nbsIndustrialProfit.marginPct.toFixed(2) + "%" : "—"'
            :sub='(nbsIndustrialProfitDelta?.marginDeltaPp ?? 0) > 0 ? "+" : ""'
            :subTrendClass="macroTrendBand(nbsIndustrialProfitDelta?.marginDeltaPp ?? 0)" />
          <MacroKpiCell
            label="制造业利润"
            :value='nbsIndustrialProfit.manufacturingYoyPct != null ? formatMacroPct(nbsIndustrialProfit.manufacturingYoyPct) : "—"'
            :valueTrendClass="macroTrendBand(nbsIndustrialProfit.manufacturingYoyPct ?? 0)"
            :sub='nbsIndustrialProfit.miningYoyPct != null ? formatMacroPct(nbsIndustrialProfit.miningYoyPct) : "—"' />
        </view>
        <view class="macro-note">
          国家统计局规上工业企业利润（累计口径，通常滞后约 1 个月）· ≠ 挂牌/成交/网签/70城；可与工业增加值 / PMI 对照
        </view>
        <button
          v-if="nbsIndustrialProfitTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-nbs-industrial-profit-series-toggle
          :aria-expanded="nbsIndustrialProfitSeriesExpanded"
          @click="nbsIndustrialProfitSeriesExpanded = !nbsIndustrialProfitSeriesExpanded"
        >
          {{ nbsIndustrialProfitSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="nbsIndustrialProfitSeriesExpanded">
          <view class="macro-series" data-nbs-industrial-profit-series-detail>
            利润同比
            <text v-for="(p, i) in nbsIndustrialProfitTrend" :key="'indp-yoy-' + p.month">
              {{ shortNbsIndustrialProfitMonthLabel(p.month) }}
              {{ formatMacroPct(p.profitYoyPct)
              }}<text v-if="i < nbsIndustrialProfitTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <!-- 全国 · PPI（nbsPpi） -->
      <view v-if="nbsPpi" class="card macro-card" data-nbs-ppi>
        <view class="macro-kicker">全国 · 工业生产者价格</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">PPI（含建材分项）</view>
          <view class="muted" style="font-size: 22rpx">{{ nbsPpi.month }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="PPI 同比"
            :value="formatMacroPct(nbsPpi.ppiYoyPct)"
            :valueTrendClass="macroTrendBand(nbsPpi.ppiYoyPct)"
            :sub="formatMacroPct(nbsPpi.ppiMomPct)" />
          <MacroKpiCell
            label="购进同比"
            :value="formatMacroPct(nbsPpi.purchaseYoyPct)"
            :valueTrendClass="macroTrendBand(nbsPpi.purchaseYoyPct)"
            sub="工业生产者购进" />
          <MacroKpiCell
            label="非金属矿物制品业"
            :value="formatMacroPct(nbsPpi.nonMetalYoyPct)"
            :valueTrendClass="macroTrendBand(nbsPpi.nonMetalYoyPct)"
            sub="建材相关 · ≠房价" />
          <MacroKpiCell
            label="发布日"
            :value="nbsPpi.publishDate"
            sub="国家统计局" />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          月度 PPI · 出厂/购进/建材分项 · 非挂牌/网签/70城
        </view>
        <button
          v-if="nbsPpiTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-nbs-ppi-series-toggle
          :aria-expanded="nbsPpiSeriesExpanded"
          @click="nbsPpiSeriesExpanded = !nbsPpiSeriesExpanded"
        >
          {{ nbsPpiSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="nbsPpiSeriesExpanded">
          <view class="macro-series" data-nbs-ppi-series-detail>
            PPI 同比
            <text v-for="(p, i) in nbsPpiTrend" :key="'ppi-' + p.month">
              {{ shortNbsPpiMonthLabel(p.month) }} {{ formatMacroPct(p.ppiYoyPct)
              }}<text v-if="i < nbsPpiTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="macro-series" data-nbs-ppi-series-detail>
            建材分项同比
            <text v-for="(p, i) in nbsPpiTrend" :key="'nm-' + p.month">
              {{ shortNbsPpiMonthLabel(p.month) }} {{ formatMacroPct(p.nonMetalYoyPct)
              }}<text v-if="i < nbsPpiTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <!-- 全国 · 社消商品类（nbsRetail） -->
      <view v-if="nbsRetail" class="card macro-card" data-nbs-retail>
        <view class="macro-kicker">全国 · 社消商品类</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">建筑装潢 / 家具</view>
          <view class="muted" style="font-size: 22rpx">{{ nbsRetail.month }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="装潢材料当月"
            :value="formatMacro100m(nbsRetail.buildingMonthCny100m)"
            :sub="formatMacroPct(nbsRetail.buildingMonthYoyPct)"
            :subTrendClass="macroTrendBand(nbsRetail.buildingMonthYoyPct)" />
          <MacroKpiCell
            label="装潢材料累计"
            :value="formatMacro100m(nbsRetail.buildingCumCny100m)"
            :sub="formatMacroPct(nbsRetail.buildingCumYoyPct)"
            :subTrendClass="macroTrendBand(nbsRetail.buildingCumYoyPct)" />
          <MacroKpiCell
            label="家具当月"
            :value="formatMacro100m(nbsRetail.furnitureMonthCny100m)"
            :sub="formatMacroPct(nbsRetail.furnitureMonthYoyPct)"
            :subTrendClass="macroTrendBand(nbsRetail.furnitureMonthYoyPct)" />
          <MacroKpiCell
            label="社消总额当月"
            :value="formatMacro100m(nbsRetail.retailMonthCny100m)"
            :sub="formatMacroPct(nbsRetail.retailMonthYoyPct)"
            :subTrendClass="macroTrendBand(nbsRetail.retailMonthYoyPct)" />
        </view>
        <view class="muted" style="margin-top: 12rpx; font-size: 22rpx">
          限额以上商品零售 · 装潢/家具 ≠ 房价 · 国家统计局
        </view>
        <button
          v-if="nbsRetailTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-nbs-retail-series-toggle
          :aria-expanded="nbsRetailSeriesExpanded"
          @click="nbsRetailSeriesExpanded = !nbsRetailSeriesExpanded"
        >
          {{ nbsRetailSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="nbsRetailSeriesExpanded">
          <view class="macro-series" data-nbs-retail-series-detail>
            装潢当月同比
            <text v-for="(p, i) in nbsRetailTrend" :key="'bldg-' + p.month">
              {{ shortNbsRetailMonthLabel(p.month) }} {{ formatMacroPct(p.buildingMonthYoyPct)
              }}<text v-if="i < nbsRetailTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="macro-series" data-nbs-retail-series-detail>
            家具当月同比
            <text v-for="(p, i) in nbsRetailTrend" :key="'furn-' + p.month">
              {{ shortNbsRetailMonthLabel(p.month) }} {{ formatMacroPct(p.furnitureMonthYoyPct)
              }}<text v-if="i < nbsRetailTrend.length - 1"> · </text>
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
 * 宏观 · 产业子页（macro-industry.vue）。
 *
 * 8 张全国 NBS 产业卡从 dashboard 总览迁入（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2）：
 *   - 固定资产投资 / 居民收支 / CPI / PMI / 工业增加值 / 工业企业利润 / PPI / 社消商品类
 */
import { computed, ref } from "vue";
import MacroKpiCell from "../../components/MacroKpiCell.vue";
import MacroTabNav from "../../components/MacroTabNav.vue";
import { formatMacro100m, formatMacroPct, formatMacroYuan, macroTrendClass, macroTrendBand } from "../../utils/format";
import {
  getLatestNbsFaInvestment,
  getNbsFaInvestmentTrend,
  shortNbsFaPeriodLabel,
  type NbsFaInvestmentRow
} from "../../local/nbsFaInvestment";
import {
  getLatestNbsIncome,
  getNbsIncomeTrend,
  type NbsIncomeRow
} from "../../local/nbsIncome";
import {
  getLatestNbsCpi,
  getNbsCpiTrend,
  shortNbsCpiMonthLabel,
  type NbsCpiRow
} from "../../local/nbsCpi";
import {
  getLatestNbsPmi,
  getNbsPmiTrend,
  shortNbsPmiMonthLabel as shortNbsPurchasingPmiMonthLabel,
  type NbsPmiRow
} from "../../local/nbsPmi";
import {
  getLatestNbsIndustrial,
  getNbsIndustrialDeltaVsPrev,
  getNbsIndustrialTrend,
  nbsIndustrialHasBuildingMaterials,
  shortNbsIndustrialMonthLabel,
  type NbsIndustrialRow
} from "../../local/nbsIndustrial";
import {
  getLatestNbsIndustrialProfit,
  getNbsIndustrialProfitDeltaVsPrev,
  getNbsIndustrialProfitTrend,
  shortNbsIndustrialProfitMonthLabel,
  type NbsIndustrialProfitRow
} from "../../local/nbsIndustrialProfit";
import {
  getLatestNbsPpi,
  getNbsPpiTrend,
  shortNbsPpiMonthLabel,
  type NbsPpiRow
} from "../../local/nbsPpi";
import {
  getLatestNbsRetail,
  getNbsRetailTrend,
  shortNbsRetailMonthLabel,
  type NbsRetailRow
} from "../../local/nbsRetail";

// 多期展开 ref（8 张卡 × 1 ref = 8）
const nbsFaSeriesExpanded = ref(false);
const nbsIncomeSeriesExpanded = ref(false);
const nbsCpiSeriesExpanded = ref(false);
const nbsPmiSeriesExpanded = ref(false);
const nbsIndustrialSeriesExpanded = ref(false);
const nbsIndustrialProfitSeriesExpanded = ref(false);
const nbsPpiSeriesExpanded = ref(false);
const nbsRetailSeriesExpanded = ref(false);

// 8 张卡的 state
const nbsFaInvestment = computed<NbsFaInvestmentRow | null>(() => getLatestNbsFaInvestment());
const nbsFaTrend = computed(() => getNbsFaInvestmentTrend(6));

const nbsIncome = computed<NbsIncomeRow | null>(() => getLatestNbsIncome());
const nbsIncomeTrend = computed(() => getNbsIncomeTrend(6));

const nbsCpi = computed<NbsCpiRow | null>(() => getLatestNbsCpi());
const nbsCpiTrend = computed(() => getNbsCpiTrend(6));

const nbsPmi = computed<NbsPmiRow | null>(() => getLatestNbsPmi());
const nbsPmiTrend = computed(() => getNbsPmiTrend(6));

const nbsIndustrial = computed<NbsIndustrialRow | null>(() => getLatestNbsIndustrial());
const nbsIndustrialTrend = computed(() => getNbsIndustrialTrend(6));
const nbsIndustrialDelta = computed(() => getNbsIndustrialDeltaVsPrev());
const nbsIndustrialHasMaterials = computed(() => nbsIndustrialHasBuildingMaterials(nbsIndustrial.value));

const nbsIndustrialProfit = computed<NbsIndustrialProfitRow | null>(() => getLatestNbsIndustrialProfit());
const nbsIndustrialProfitTrend = computed(() => getNbsIndustrialProfitTrend(6));
const nbsIndustrialProfitDelta = computed(() => getNbsIndustrialProfitDeltaVsPrev());

const nbsPpi = computed<NbsPpiRow | null>(() => getLatestNbsPpi());
const nbsPpiTrend = computed(() => getNbsPpiTrend(6));

const nbsRetail = computed<NbsRetailRow | null>(() => getLatestNbsRetail());
const nbsRetailTrend = computed(() => getNbsRetailTrend(6));

// PMI 阈值 helper
function pmiVsThreshold(v: number | null | undefined): number {
  if (v == null) return 0;
  return v - 50;
}
</script>
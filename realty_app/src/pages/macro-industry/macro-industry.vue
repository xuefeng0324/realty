<template>
  <view class="page">
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
          <view class="stats70-cell">
            <text class="cell-label">固投累计</text>
            <text class="cell-value">{{ formatMacro100m(nbsFaInvestment.faCny100m) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsFaInvestment.faYoyPct)">
              同比 {{ formatMacroPct(nbsFaInvestment.faYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">民间投资同比</text>
            <text class="cell-value" :class="macroTrendClass(nbsFaInvestment.privateYoyPct)">
              {{ formatMacroPct(nbsFaInvestment.privateYoyPct) }}
            </text>
            <text class="cell-sub muted">国有控股 {{ formatMacroPct(nbsFaInvestment.stateYoyPct) }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">制造业同比</text>
            <text class="cell-value" :class="macroTrendClass(nbsFaInvestment.manufacturingYoyPct)">
              {{ formatMacroPct(nbsFaInvestment.manufacturingYoyPct) }}
            </text>
            <text class="cell-sub muted">设备工器具 {{ formatMacroPct(nbsFaInvestment.equipmentYoyPct) }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">第三产业同比</text>
            <text class="cell-value" :class="macroTrendClass(nbsFaInvestment.tertiaryYoyPct)">
              {{ formatMacroPct(nbsFaInvestment.tertiaryYoyPct) }}
            </text>
            <text class="cell-sub muted">
              二产 {{ formatMacroPct(nbsFaInvestment.secondaryYoyPct) }}
              <template v-if="nbsFaInvestment.ipYoyPct != null">
                · 知产 {{ formatMacroPct(nbsFaInvestment.ipYoyPct) }}
              </template>
            </text>
          </view>
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
          <view class="stats70-cell">
            <text class="cell-label">人均可支配收入</text>
            <text class="cell-value">{{ formatMacroYuan(nbsIncome.disposableYuan) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsIncome.disposableNominalYoyPct)">
              名义 {{ formatMacroPct(nbsIncome.disposableNominalYoyPct) }}
              · 实际 {{ formatMacroPct(nbsIncome.disposableRealYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">城镇可支配收入</text>
            <text class="cell-value">{{ formatMacroYuan(nbsIncome.urbanDisposableYuan) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsIncome.urbanNominalYoyPct)">
              名义 {{ formatMacroPct(nbsIncome.urbanNominalYoyPct) }}
              · 实际 {{ formatMacroPct(nbsIncome.urbanRealYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">人均消费支出</text>
            <text class="cell-value">{{ formatMacroYuan(nbsIncome.consumptionYuan) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsIncome.consumptionNominalYoyPct)">
              名义 {{ formatMacroPct(nbsIncome.consumptionNominalYoyPct) }}
              · 实际 {{ formatMacroPct(nbsIncome.consumptionRealYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">居住消费</text>
            <text class="cell-value">{{ formatMacroYuan(nbsIncome.housingConsumptionYuan) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsIncome.housingConsumptionYoyPct)">
              同比 {{ formatMacroPct(nbsIncome.housingConsumptionYoyPct) }}
            </text>
          </view>
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
          <view class="stats70-cell">
            <text class="cell-label">CPI 同比</text>
            <text class="cell-value" :class="macroTrendClass(nbsCpi.cpiYoyPct)">
              {{ formatMacroPct(nbsCpi.cpiYoyPct) }}
            </text>
            <text class="cell-sub muted">环比 {{ formatMacroPct(nbsCpi.cpiMomPct) }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">居住同比</text>
            <text class="cell-value" :class="macroTrendClass(nbsCpi.residenceYoyPct)">
              {{ formatMacroPct(nbsCpi.residenceYoyPct) }}
            </text>
            <text class="cell-sub muted">CPI 居住类</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">租赁房房租同比</text>
            <text class="cell-value" :class="macroTrendClass(nbsCpi.rentYoyPct)">
              {{ formatMacroPct(nbsCpi.rentYoyPct) }}
            </text>
            <text class="cell-sub muted">房租 ≠ 房价</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">发布日</text>
            <text class="cell-value" style="font-size: 28rpx">{{ nbsCpi.publishDate }}</text>
            <text class="cell-sub muted">国家统计局</text>
          </view>
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
          <view class="stats70-cell">
            <text class="cell-label">制造业 PMI</text>
            <text class="cell-value" :class="macroTrendClass(pmiVsThreshold(nbsPmi.mfgPmi))">
              {{ nbsPmi.mfgPmi.toFixed(1) }}
            </text>
            <text class="cell-sub muted">临界点 50</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">非制造业</text>
            <text
              class="cell-value"
              :class="macroTrendClass(pmiVsThreshold(nbsPmi.nonMfgBusiness))"
            >
              {{ nbsPmi.nonMfgBusiness != null ? nbsPmi.nonMfgBusiness.toFixed(1) : "—" }}
            </text>
            <text class="cell-sub muted">商务活动</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">建筑业</text>
            <text
              class="cell-value"
              :class="macroTrendClass(pmiVsThreshold(nbsPmi.constructionBusiness))"
            >
              {{
                nbsPmi.constructionBusiness != null
                  ? nbsPmi.constructionBusiness.toFixed(1)
                  : "—"
              }}
            </text>
            <text class="cell-sub muted">景气 ≠ 房价</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">综合产出</text>
            <text
              class="cell-value"
              :class="macroTrendClass(pmiVsThreshold(nbsPmi.compositePmi))"
            >
              {{ nbsPmi.compositePmi != null ? nbsPmi.compositePmi.toFixed(1) : "—" }}
            </text>
            <text class="cell-sub muted">
              生产
              {{ nbsPmi.production != null ? nbsPmi.production.toFixed(1) : "—" }}
              · 订单
              {{ nbsPmi.newOrders != null ? nbsPmi.newOrders.toFixed(1) : "—" }}
            </text>
          </view>
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
          <view class="stats70-cell">
            <text class="cell-label">当月同比</text>
            <text class="cell-value" :class="macroTrendClass(nbsIndustrial.yoyPct)">
              {{ formatMacroPct(nbsIndustrial.yoyPct) }}
            </text>
            <text
              v-if="nbsIndustrialDelta"
              class="cell-sub"
              :class="macroTrendClass(nbsIndustrialDelta.yoyDeltaPp)"
            >
              较上月 {{ nbsIndustrialDelta.yoyDeltaPp > 0 ? "+" : "" }}{{ nbsIndustrialDelta.yoyDeltaPp }} pp
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">环比</text>
            <text
              class="cell-value"
              :class="macroTrendClass(nbsIndustrial.momPct ?? 0)"
            >
              {{ nbsIndustrial.momPct != null ? formatMacroPct(nbsIndustrial.momPct) : "—" }}
            </text>
            <text class="cell-sub muted">季节调整后</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">累计同比</text>
            <text
              class="cell-value"
              :class="macroTrendClass(nbsIndustrial.ytdYoyPct ?? 0)"
            >
              {{
                nbsIndustrial.ytdYoyPct != null ? formatMacroPct(nbsIndustrial.ytdYoyPct) : "—"
              }}
            </text>
            <text class="cell-sub muted">年初至今</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">制造业</text>
            <text
              class="cell-value"
              :class="macroTrendClass(nbsIndustrial.manufacturingYoyPct ?? 0)"
            >
              {{
                nbsIndustrial.manufacturingYoyPct != null
                  ? formatMacroPct(nbsIndustrial.manufacturingYoyPct)
                  : "—"
              }}
            </text>
            <text class="cell-sub muted">
              采矿
              {{
                nbsIndustrial.miningYoyPct != null
                  ? formatMacroPct(nbsIndustrial.miningYoyPct)
                  : "—"
              }}
              · 公用
              {{
                nbsIndustrial.utilitiesYoyPct != null
                  ? formatMacroPct(nbsIndustrial.utilitiesYoyPct)
                  : "—"
              }}
            </text>
          </view>
        </view>
        <view class="macro-note">
          国家统计局规模以上工业增加值（扣除价格因素）· ≠ 挂牌/成交/网签/70城；可与 PMI 对照
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
          <view class="stats70-cell">
            <text class="cell-label">利润总额</text>
            <text class="cell-value" :class="macroTrendClass(nbsIndustrialProfit.profitYoyPct)">
              {{ formatMacroPct(nbsIndustrialProfit.profitYoyPct) }}
            </text>
            <text class="cell-sub muted">
              {{ nbsIndustrialProfit.profitYi.toLocaleString() }} 亿元累计
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">营收同比</text>
            <text
              class="cell-value"
              :class="macroTrendClass(nbsIndustrialProfit.revenueYoyPct ?? 0)"
            >
              {{
                nbsIndustrialProfit.revenueYoyPct != null
                  ? formatMacroPct(nbsIndustrialProfit.revenueYoyPct)
                  : "—"
              }}
            </text>
            <text class="cell-sub muted">
              {{
                nbsIndustrialProfit.revenueWanYi != null
                  ? nbsIndustrialProfit.revenueWanYi.toFixed(2) + " 万亿"
                  : "—"
              }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">营收利润率</text>
            <text class="cell-value">
              {{
                nbsIndustrialProfit.marginPct != null
                  ? nbsIndustrialProfit.marginPct.toFixed(2) + "%"
                  : "—"
              }}
            </text>
            <text
              v-if="nbsIndustrialProfitDelta && nbsIndustrialProfitDelta.marginDeltaPp != null"
              class="cell-sub"
              :class="macroTrendClass(nbsIndustrialProfitDelta.marginDeltaPp)"
            >
              较上期
              {{ nbsIndustrialProfitDelta.marginDeltaPp > 0 ? "+" : ""
              }}{{ nbsIndustrialProfitDelta.marginDeltaPp }} pp
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">制造业利润</text>
            <text
              class="cell-value"
              :class="macroTrendClass(nbsIndustrialProfit.manufacturingYoyPct ?? 0)"
            >
              {{
                nbsIndustrialProfit.manufacturingYoyPct != null
                  ? formatMacroPct(nbsIndustrialProfit.manufacturingYoyPct)
                  : "—"
              }}
            </text>
            <text class="cell-sub muted">
              采矿
              {{
                nbsIndustrialProfit.miningYoyPct != null
                  ? formatMacroPct(nbsIndustrialProfit.miningYoyPct)
                  : "—"
              }}
              · 公用
              {{
                nbsIndustrialProfit.utilitiesYoyPct != null
                  ? formatMacroPct(nbsIndustrialProfit.utilitiesYoyPct)
                  : "—"
              }}
            </text>
          </view>
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
          <view class="stats70-cell">
            <text class="cell-label">PPI 同比</text>
            <text class="cell-value" :class="macroTrendClass(nbsPpi.ppiYoyPct)">
              {{ formatMacroPct(nbsPpi.ppiYoyPct) }}
            </text>
            <text class="cell-sub muted">环比 {{ formatMacroPct(nbsPpi.ppiMomPct) }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">购进同比</text>
            <text class="cell-value" :class="macroTrendClass(nbsPpi.purchaseYoyPct)">
              {{ formatMacroPct(nbsPpi.purchaseYoyPct) }}
            </text>
            <text class="cell-sub muted">工业生产者购进</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">非金属矿物制品业</text>
            <text class="cell-value" :class="macroTrendClass(nbsPpi.nonMetalYoyPct)">
              {{ formatMacroPct(nbsPpi.nonMetalYoyPct) }}
            </text>
            <text class="cell-sub muted">建材相关 · ≠房价</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">发布日</text>
            <text class="cell-value" style="font-size: 28rpx">{{ nbsPpi.publishDate }}</text>
            <text class="cell-sub muted">国家统计局</text>
          </view>
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
          <view class="stats70-cell">
            <text class="cell-label">装潢材料当月</text>
            <text class="cell-value">{{ formatMacro100m(nbsRetail.buildingMonthCny100m) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsRetail.buildingMonthYoyPct)">
              同比 {{ formatMacroPct(nbsRetail.buildingMonthYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">装潢材料累计</text>
            <text class="cell-value">{{ formatMacro100m(nbsRetail.buildingCumCny100m) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsRetail.buildingCumYoyPct)">
              同比 {{ formatMacroPct(nbsRetail.buildingCumYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">家具当月</text>
            <text class="cell-value">{{ formatMacro100m(nbsRetail.furnitureMonthCny100m) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsRetail.furnitureMonthYoyPct)">
              同比 {{ formatMacroPct(nbsRetail.furnitureMonthYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">社消总额当月</text>
            <text class="cell-value">{{ formatMacro100m(nbsRetail.retailMonthCny100m) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsRetail.retailMonthYoyPct)">
              同比 {{ formatMacroPct(nbsRetail.retailMonthYoyPct) }}
            </text>
          </view>
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
/**
 * 宏观 · 产业子页（macro-industry.vue）。
 *
 * 8 张全国 NBS 产业卡从 dashboard 总览迁入（详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2）：
 *   - 固定资产投资 / 居民收支 / CPI / PMI / 工业增加值 / 工业企业利润 / PPI / 社消商品类
 */
import { computed, ref } from "vue";
import MacroTabNav from "../../components/MacroTabNav.vue";
import { formatMacro100m, formatMacroPct, formatMacroYuan, macroTrendClass } from "../../utils/format";
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
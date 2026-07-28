<template>
  <view class="page" :data-realty-theme="realtyTheme" :class="'realty-theme-' + realtyTheme">
    <view class="container">
      <view class="page-header" data-supply-header>
        <view class="page-header-title">供需与土地</view>
        <view class="page-header-sub muted">
          库存 / 计划入市 / 保障房 / 居住用地 · 从总览频道「供需」与金刚区进入 · 非挂牌均价
        </view>
      </view>

      <view class="card">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">当前城市</view>
          <button class="btn" size="mini" @click="pickCity">{{ cityName || "选择城市" }} ▾</button>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据按城展示；无卡表示该城暂未收录对应官方源。
        </view>
      </view>

      <!-- 广州库存 -->
      <view v-if="gzInventory" id="entry-supply" class="card" data-supply-inventory data-gz-inventory>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏗️ 广州新房库存</view>
          <view class="muted" style="font-size: 22rpx">{{ gzInventoryFresh.label }}</view>
        </view>
        <view class="kpi-grid">
          <view class="kpi">
            <text class="kpi-label">可售住宅</text>
            <text class="kpi-value">{{ formatInventoryUnits(gzInventory.availableUnits) }}</text>
            <text v-if="gzInventoryDelta" class="kpi-sub" :class="deltaClass(gzInventoryDelta.availableDelta)">
              较上日 {{ formatDelta(gzInventoryDelta.availableDelta) }}
            </text>
          </view>
          <view class="kpi">
            <text class="kpi-label">未售住宅</text>
            <text class="kpi-value">{{ formatInventoryUnits(gzInventory.unsoldUnits) }}</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">当日签约住宅</text>
            <text class="kpi-value">{{ gzInventory.signedUnits }} 套</text>
          </view>
        </view>
        <view
          v-if="gzInventoryHasNonRes"
          class="kpi-grid"
          style="margin-top: 12rpx"
          data-gz-inventory-nonres
        >
          <view class="kpi">
            <text class="kpi-label">可售商业</text>
            <text class="kpi-value">{{ formatInventoryUnits(gzInventory.availableCommercialUnits) }}</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">可售办公</text>
            <text class="kpi-value">{{ formatInventoryUnits(gzInventory.availableOfficeUnits) }}</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">可售车位</text>
            <text class="kpi-value">{{ formatInventoryUnits(gzInventory.availableParkingUnits) }}</text>
          </view>
        </view>
        <view v-if="gzInventoryHasNonRes" class="summary muted" style="font-size: 22rpx">
          未售 商业 {{ formatInventoryUnits(gzInventory.unsoldCommercialUnits) }}
          · 办公 {{ formatInventoryUnits(gzInventory.unsoldOfficeUnits) }}
          · 车位 {{ formatInventoryUnits(gzInventory.unsoldParkingUnits) }}
          · 当日签约 商 {{ gzInventory.signedCommercialUnits }} / 办 {{ gzInventory.signedOfficeUnits }} / 车
          {{ gzInventory.signedParkingUnits }}
        </view>
        <view v-if="gzInventory.districts[0]" class="summary">
          可售住宅最高：{{ gzInventory.districts[0].district }}
          {{ gzInventory.districts[0].availableUnits.toLocaleString() }} 套
        </view>
        <view class="section-title">分区明细（住宅）</view>
        <view
          v-for="row in gzInventory.districts"
          :key="row.district"
          class="row-line"
          data-gz-inventory-detail
        >
          <text class="row-name">{{ row.district }}</text>
          <text>可售 {{ row.availableUnits.toLocaleString() }}</text>
          <text class="muted">未售 {{ row.unsoldUnits.toLocaleString() }}</text>
          <text class="muted">签约 {{ row.signedUnits }}</text>
        </view>
        <view class="note">
          广州市住建局商品房销售统计。住宅 / 商业 / 办公 / 车位为同一接口分项；可售与未售为不同官方口径；≠挂牌价、≠网签均价。
        </view>
      </view>

      <!-- 深圳计划入市 -->
      <view
        v-if="szPlannedSupply"
        :id="gzInventory ? undefined : 'entry-supply'"
        class="card"
        data-supply-inventory
        data-sz-planned-supply
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏗️ 深圳商品住房计划入市</view>
          <view class="muted" style="font-size: 22rpx">{{ formatSzSupplyPeriod(szPlannedSupply) }}</view>
        </view>
        <view class="kpi-grid">
          <view class="kpi">
            <text class="kpi-label">总套数</text>
            <text class="kpi-value">{{ szPlannedSupply.totalUnits.toLocaleString() }} 套</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">总面积</text>
            <text class="kpi-value">{{ formatArea(szPlannedSupply.totalAreaSqm) }}</text>
            <text class="kpi-sub muted">项目 {{ szPlannedSupply.projectCount }} 个</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">住宅套数</text>
            <text class="kpi-value">{{ szPlannedSupply.residentialUnits.toLocaleString() }} 套</text>
          </view>
        </view>
        <view class="note">
          {{ szPlannedSupply.sourceOrg }} · 截至 {{ szPlannedSupply.asOfDate }} · {{ szPlannedSupply.publishDate }} 公示。
        </view>
      </view>

      <!-- 广州住房建设计划 -->
      <view v-if="gzHousingPlan" class="card" data-gz-housing-plan>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">📋 广州住房建设计划</view>
          <view class="muted" style="font-size: 22rpx">{{ gzHousingPlan.year }} 年</view>
        </view>
        <view class="kpi-grid">
          <view class="kpi">
            <text class="kpi-label">预售面积</text>
            <text class="kpi-value">{{ gzHousingPlan.approvedPresaleAreaWanSqm.toFixed(1) }} 万㎡</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">住宅用地</text>
            <text class="kpi-value">{{ gzHousingPlan.residentialLandHa.toFixed(1) }} 公顷</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">保障房</text>
            <text class="kpi-value">{{ gzHousingPlan.affordableUnitsWan.toFixed(2) }} 万套</text>
          </view>
        </view>
        <view class="note">{{ gzHousingPlan.sourceOrg }} · {{ gzHousingPlan.publishDate || gzHousingPlan.year + " 年" }} 印发。</view>
      </view>

      <!-- 珠海保障房进展 -->
      <view v-if="zhAffordable" class="card" data-zh-affordable>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏠 珠海保障性安居工程</view>
          <view class="muted" style="font-size: 22rpx">
            {{ zhAffordable.year }}-{{ String(zhAffordable.month).padStart(2, "0") }}
          </view>
        </view>
        <view class="kpi-grid">
          <view class="kpi">
            <text class="kpi-label">新开工</text>
            <text class="kpi-value">{{ zhAffordable.startedUnits.toLocaleString() }} 套</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">基本建成</text>
            <text class="kpi-value">{{ zhAffordable.basicallyCompletedUnits.toLocaleString() }} 套</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">竣工</text>
            <text class="kpi-value">{{ zhAffordable.completedUnits.toLocaleString() }} 套</text>
          </view>
        </view>
        <view class="note">官方安居工程进展快报；≠ 商品房成交、≠ 挂牌均价。</view>
      </view>

      <!-- 广州土地 -->
      <view v-if="gzLandSummary" id="entry-land" class="card" data-supply-land data-gz-land-deals>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🗺️ 广州居住用地成交</view>
          <view class="muted" style="font-size: 22rpx">近 {{ gzLandSummary.count }} 宗 · {{ gzLandSummary.latestDate }}</view>
        </view>
        <view class="kpi-grid">
          <view class="kpi">
            <text class="kpi-label">成交面积</text>
            <text class="kpi-value">{{ formatArea(gzLandSummary.totalAreaSqm) }}</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">成交总价</text>
            <text class="kpi-value">{{ formatPrice(gzLandSummary.totalPriceWan) }}</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">样本均价</text>
            <text class="kpi-value" style="font-size: 28rpx">
              {{
                gzLandSummary.avgSurfaceUnitPriceYuan != null
                  ? Math.round(gzLandSummary.avgSurfaceUnitPriceYuan).toLocaleString() + " 元/㎡地"
                  : "—"
              }}
            </text>
          </view>
        </view>
        <view class="section-title">最近成交</view>
        <view v-for="d in gzLandLatest" :key="d.sourceUrl" class="row-line">
          <text class="row-name">
            {{ d.district || "广州" }}
            <text class="muted" v-if="d.dealDate || d.publishDate"> · {{ (d.dealDate || d.publishDate).slice(0, 10) }}</text>
          </text>
          <text>{{ formatPrice(d.priceWan) }}</text>
          <text class="muted">{{ formatArea(d.areaSqm) }}</text>
        </view>
        <view class="note">广州市规划和自然资源局成交公示；土地价款 ≠ 房价均价。</view>
      </view>

      <!-- 深圳土地 -->
      <view
        v-if="szLandSummary"
        :id="gzLandSummary ? undefined : 'entry-land'"
        class="card"
        data-supply-land
        data-sz-land-deals
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🗺️ 深圳居住用地（已成交）</view>
          <view class="muted" style="font-size: 22rpx">近 {{ szLandSummary.count }} 宗 · {{ szLandSummary.latestDate }}</view>
        </view>
        <view class="kpi-grid">
          <view class="kpi">
            <text class="kpi-label">成交面积</text>
            <text class="kpi-value">{{ formatArea(szLandSummary.totalAreaSqm) }}</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">起始价合计</text>
            <text class="kpi-value">{{ formatPrice(szLandSummary.totalStartPriceWan) }}</text>
          </view>
          <view class="kpi">
            <text class="kpi-label">样本起始均价</text>
            <text class="kpi-value" style="font-size: 28rpx">
              {{
                szLandSummary.avgStartSurfaceUnitPriceYuan != null
                  ? Math.round(szLandSummary.avgStartSurfaceUnitPriceYuan).toLocaleString() + " 元/㎡地"
                  : "—"
              }}
            </text>
          </view>
        </view>
        <view class="note">深圳居住用地已成交样本；起始价口径，≠ 房价。</view>
      </view>

      <view v-if="!hasAnyCard" class="card">
        <view class="card-title">暂无供需数据</view>
        <view class="muted">当前城市尚未收录库存 / 计划入市 / 土地成交。可切换广州、深圳或珠海。</view>
      </view>
    </view>

    <view v-if="citySheetOpen" class="sheet-mask" @click="citySheetOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-title">选择城市</view>
        <view
          v-for="c in cityOptions"
          :key="c"
          class="sheet-item"
          :class="{ 'sheet-item--active': c === cityName }"
          @click="selectCity(c)"
        >
          <text>{{ c }}</text>
          <text v-if="c === cityName" class="sheet-check">✓</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { resolvedThemeRef as realtyTheme } from "../../utils/theme";
import {
  getGzInventoryOverview,
  getGzInventoryDayDelta,
  gzInventoryHasNonResidential
} from "../../local/gzNewHouseInventory";
import { assessGzInventoryFreshness } from "../../local/gzInventoryFreshness";
import {
  formatSzSupplyPeriod,
  getLatestSzPlannedSupply
} from "../../local/szPlannedSupply";
import { getLatestGzHousingPlan } from "../../local/gzHousingPlan";
import { getLatestZhAffordableProgress } from "../../local/zhAffordableProgress";
import { getLatestGzLandDeals, summarizeGzLandDeals } from "../../local/gzLandDeals";
import { summarizeSzLandDeals } from "../../local/szLandDeals";
import { useAppStore } from "../../store/app";

const app = useAppStore();
const cityOptions = ["广州", "深圳", "珠海"] as const;
const CITY_ID_BY_NAME: Record<string, number> = { 广州: 1, 深圳: 2, 珠海: 3 };
const CITY_NAME_BY_ID: Record<number, string> = { 1: "广州", 2: "深圳", 3: "珠海" };
const cityName = ref<string>(CITY_NAME_BY_ID[app.cityId] ?? "广州");
const citySheetOpen = ref(false);
const focus = ref<"inventory" | "land" | "">("");

onLoad((q) => {
  const f = String(q?.focus ?? "").trim();
  if (f === "inventory" || f === "land") focus.value = f;
  cityName.value = CITY_NAME_BY_ID[app.cityId] ?? "广州";
});

function pickCity() {
  citySheetOpen.value = true;
}
function selectCity(c: string) {
  cityName.value = c;
  const id = CITY_ID_BY_NAME[c];
  if (id != null) app.setCityId(id);
  citySheetOpen.value = false;
}

const gzInventory = computed(() => (cityName.value === "广州" ? getGzInventoryOverview() : null));
const gzInventoryDelta = computed(() => (gzInventory.value ? getGzInventoryDayDelta() : null));
const gzInventoryHasNonRes = computed(() => gzInventoryHasNonResidential(gzInventory.value));
const gzInventoryFresh = computed(() => assessGzInventoryFreshness(gzInventory.value?.date ?? null));
const szPlannedSupply = computed(() => (cityName.value === "深圳" ? getLatestSzPlannedSupply() : null));
const gzHousingPlan = computed(() => (cityName.value === "广州" ? getLatestGzHousingPlan() : null));
const zhAffordable = computed(() =>
  cityName.value === "珠海" ? getLatestZhAffordableProgress() : null
);
const gzLandSummary = computed(() => (cityName.value === "广州" ? summarizeGzLandDeals() : null));
const gzLandLatest = computed(() => (cityName.value === "广州" ? getLatestGzLandDeals(5) : []));
const szLandSummary = computed(() => (cityName.value === "深圳" ? summarizeSzLandDeals() : null));

const hasAnyCard = computed(
  () =>
    !!(
      gzInventory.value ||
      szPlannedSupply.value ||
      gzHousingPlan.value ||
      zhAffordable.value ||
      gzLandSummary.value ||
      szLandSummary.value
    )
);

function formatInventoryUnits(v: number) {
  return v >= 10000 ? `${(v / 10000).toFixed(1)} 万套` : `${v.toLocaleString()} 套`;
}
function formatArea(sqm: number): string {
  return sqm >= 10000 ? `${(sqm / 10000).toFixed(2)} 万㎡` : `${sqm.toLocaleString()} ㎡`;
}
function formatPrice(wan: number): string {
  return wan >= 10000 ? `${(wan / 10000).toFixed(2)} 亿元` : `${wan.toLocaleString()} 万元`;
}
function formatDelta(v: number): string {
  if (v === 0) return "持平";
  return `${v > 0 ? "+" : ""}${v.toLocaleString()}`;
}
function deltaClass(v: number): string {
  if (v > 0) return "trend-up";
  if (v < 0) return "trend-down";
  return "muted";
}

function scrollToFocus() {
  const id = focus.value === "land" ? "entry-land" : focus.value === "inventory" ? "entry-supply" : "";
  if (!id || typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
}

onMounted(() => {
  nextTick(() => nextTick(scrollToFocus));
});
</script>

<style scoped>
.page-header {
  padding: 8rpx 4rpx 16rpx;
}
.page-header-title {
  font-size: 36rpx;
  font-weight: 700;
}
.page-header-sub {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.45;
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 16rpx;
}
.kpi {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.kpi-label {
  font-size: 20rpx;
  color: var(--color-muted, #94a3b8);
}
.kpi-value {
  font-size: 30rpx;
  font-weight: 700;
}
.kpi-sub {
  font-size: 20rpx;
}
.summary {
  margin-top: 12rpx;
  font-size: 24rpx;
}
.section-title {
  margin-top: 16rpx;
  margin-bottom: 8rpx;
  font-size: 24rpx;
  font-weight: 600;
}
.row-line {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx dashed var(--color-soft-strong, rgba(148, 163, 184, 0.35));
  font-size: 22rpx;
}
.row-name {
  min-width: 140rpx;
  font-weight: 600;
}
.note {
  margin-top: 12rpx;
  font-size: 21rpx;
  color: var(--color-muted, #94a3b8);
  line-height: 1.45;
}
.trend-up {
  color: #ef4444;
}
.trend-down {
  color: #22c55e;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  background: var(--color-card, #0f172a);
  border-radius: 24rpx 24rpx 0 0;
  padding: 24rpx 28rpx 48rpx;
}
.sheet-title {
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: 12rpx;
}
.sheet-item {
  display: flex;
  justify-content: space-between;
  padding: 22rpx 8rpx;
  border-bottom: 1rpx solid var(--color-soft-strong, rgba(148, 163, 184, 0.25));
  font-size: 28rpx;
}
.sheet-item--active {
  color: var(--color-accent, #38bdf8);
  font-weight: 600;
}
.sheet-check {
  font-weight: 700;
}
</style>

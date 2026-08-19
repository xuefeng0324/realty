<template>
  <PageShell>
    <template #header>
      <AppHeader
        eyebrow="MARKET"
        title="行情"
        subtitle="挂牌、网签与指数分开看"
      >
        <template #actions>
          <view class="market-city" aria-label="当前城市">{{ cityName }}</view>
        </template>
      </AppHeader>
    </template>

    <view class="market-intro">
      <text class="market-intro__eyebrow">先看口径，再看变化</text>
      <text class="market-intro__title">读懂市场，不混淆价格与成交</text>
      <text class="market-intro__description">
        三类核心指标各自保留来源与统计含义，帮助你快速判断该看哪一组数据。
      </text>
    </view>

    <view class="market-metric-grid">
      <MetricCard label="房源市场" value="挂牌价" helper="在售房源报价口径" tone="primary" />
      <MetricCard label="真实交易" value="网签量" helper="政府公开登记数量" />
      <MetricCard label="全国趋势" value="70 城指数" helper="国家统计局指数口径" />
    </view>

    <SectionHeader
      eyebrow="EXPLORE"
      title="选择分析方向"
      subtitle="本地市场、全国指数和宏观环境使用各自独立的数据口径。"
    />

    <SegmentedTabs
      v-model="activeSection"
      :items="sectionTabs"
      aria-label="行情分类"
    />

    <view class="market-entry-list">
      <EntityListItem
        v-for="entry in visibleEntries"
        :key="entry.key"
        :eyebrow="entry.eyebrow"
        :title="entry.title"
        :subtitle="entry.subtitle"
        action-text="进入"
        @click="openEntry(entry.path)"
      />
    </view>

    <AsyncState
      v-if="visibleEntries.length === 0"
      status="empty"
      title="当前分类暂无入口"
      description="请选择其他分类继续查看。"
    />
  </PageShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import PageShell from "../../components/PageShell.vue";
import AppHeader from "../../components/AppHeader.vue";
import SegmentedTabs from "../../components/SegmentedTabs.vue";
import MetricCard from "../../components/MetricCard.vue";
import AsyncState from "../../components/AsyncState.vue";
import SectionHeader from "../../components/SectionHeader.vue";
import EntityListItem from "../../components/EntityListItem.vue";
import { useAppStore } from "../../store/app";
import { getCityById } from "../../local/store";
import {
  MARKET_SECTION_TABS,
  marketEntriesFor,
  type MarketSectionKey
} from "../../local/navigation";
import { toErrorMessage } from "../../utils/errorMessage";

const app = useAppStore();
const activeSection = ref<MarketSectionKey>("local");

const sectionTabs = MARKET_SECTION_TABS;
const cityName = computed(() => getCityById(app.cityId)?.cityName ?? "当前城市");
const visibleEntries = computed(() => marketEntriesFor(activeSection.value));

function openEntry(path: string): void {
  uni.navigateTo({
    url: path,
    fail: (error) => {
      uni.showToast({ title: `打开失败：${toErrorMessage(error)}`, icon: "none" });
    }
  });
}
</script>

<style scoped lang="scss">
.market-city {
  min-height: 64rpx;
  padding: 0 var(--space-3, 16rpx);
  border: 1rpx solid var(--color-border-soft);
  border-radius: var(--radius-pill, 999rpx);
  background: var(--color-panel-soft);
  color: var(--color-text-secondary);
  font-size: var(--font-caption, 22rpx);
  line-height: 64rpx;
  white-space: nowrap;
}

.market-intro {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 12rpx);
  padding: var(--space-8, 56rpx) 0 var(--space-5, 32rpx);
}

.market-intro__eyebrow {
  color: var(--color-primary-strong);
  font-size: 21rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.market-intro__title {
  max-width: 680rpx;
  color: var(--color-heading);
  font-size: var(--font-display, 52rpx);
  font-weight: 650;
  line-height: 1.2;
}

.market-intro__description {
  max-width: 680rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-body-sm, 24rpx);
  line-height: 1.65;
}

.market-metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3, 16rpx);
}

.market-entry-list {
  margin-top: var(--space-3, 16rpx);
  padding: 0 var(--space-4, 24rpx);
  border: 1rpx solid var(--color-border-soft);
  border-radius: var(--radius-lg, 24rpx);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.market-entry-list :deep(.entity-list-item:last-child) {
  border-bottom: 0;
}

@media (max-width: 520px) {
  .market-metric-grid {
    grid-template-columns: 1fr;
  }

  .market-intro__title { font-size: 44rpx; }
}
</style>

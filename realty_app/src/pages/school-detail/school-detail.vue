<template>
  <view class="page">
    <view class="container detail-container">
      <view class="quicknav">
        <view class="quick-btn tap-target" role="button" tabindex="0" @click="goBack">← 返回学校查询</view>
        <view class="quick-btn tap-target" role="button" tabindex="0" @click="goDashboard">数据总览</view>
      </view>

      <view v-if="loading" class="card loading-card">正在读取学校数据…</view>
      <view v-else-if="errorMsg" class="card error-state" data-school-error>
        <view class="error-icon">!</view>
        <view class="error-title">学校数据不可用</view>
        <view class="muted">{{ errorMsg }}</view>
        <button class="btn" size="mini" @click="goBack">返回查询</button>
      </view>

      <template v-else-if="school && score">
        <view class="school-hero" data-school-detail>
          <view class="hero-copy">
            <view class="hero-eyebrow">SCHOOL PROFILE · {{ cityName }}</view>
            <view class="hero-title">{{ school.displayName || school.officialName }}</view>
            <view v-if="school.displayName && school.displayName !== school.officialName" class="hero-official">
              官方名称：{{ school.officialName }}
            </view>
            <view class="tag-row">
              <text class="profile-tag">{{ school.schoolType || "类型未标注" }}</text>
              <text v-if="school.provinceKeyFlag" class="profile-tag profile-tag--success">省重点标记</text>
              <text v-if="school.cityKeyFlag" class="profile-tag profile-tag--warn">市重点标记</text>
            </view>
          </view>
          <view class="score-ring" :class="scoreBand">
            <text class="score-value">{{ Math.round(score.trend_score_0_100) }}</text>
            <text class="score-label">趋势分</text>
          </view>
        </view>

        <view class="metrics-grid">
          <view class="metric-card">
            <view class="metric-label">趋势评分</view>
            <view class="metric-value">{{ score.trend_score_0_100.toFixed(1) }}</view>
            <view class="metric-hint">0—100模型分</view>
          </view>
          <view class="metric-card">
            <view class="metric-label">数据置信度</view>
            <view class="metric-value">{{ confidencePercent }}%</view>
            <view class="metric-hint">按字段完整度计算</view>
          </view>
          <view class="metric-card">
            <view class="metric-label">规则版本</view>
            <view class="metric-value metric-value--text">{{ score.rule_version }}</view>
            <view class="metric-hint">本地可复算</view>
          </view>
          <view class="metric-card">
            <view class="metric-label">学校编号</view>
            <view class="metric-value">#{{ school.schoolId }}</view>
            <view class="metric-hint">快照内部标识</view>
          </view>
        </view>

        <view class="card">
          <view class="card-title">评分构成</view>
          <view class="muted section-note">展示实际进入模型的四项输入及其权重，不代表教育主管部门排名。</view>
          <view class="factor-list">
            <view v-for="factor in factors" :key="factor.key" class="factor-row">
              <view class="factor-head">
                <view>
                  <text class="factor-icon">{{ factor.icon }}</text>
                  <text class="factor-name">{{ factor.name }}</text>
                </view>
                <text class="factor-value">{{ factor.value.toFixed(0) }} · 权重 {{ factor.weight }}%</text>
              </view>
              <view class="factor-track"><view class="factor-fill" :style="{ width: `${factor.value}%` }"></view></view>
            </view>
          </view>
        </view>

        <view class="card source-card">
          <view class="card-title">数据说明</view>
          <view class="source-row"><text>数据形态</text><text>应用内置/远程一致快照</text></view>
          <view class="source-row">
            <text>学校资料来源</text>
            <text>{{ school.sourceKind === "OFFICIAL" ? "政府逐校数据" : school.sourceKind === "CURATED" ? "人工整理样本" : "来源未分级" }}</text>
          </view>
          <view class="source-row"><text>逐校来源链接</text><text>{{ school.sourceUrl || "当前快照未绑定" }}</text></view>
          <view class="source-row"><text>最近核验日期</text><text>{{ school.verifiedAt || "当前快照未记录" }}</text></view>
          <view class="source-row"><text>评分方法</text><text>办学水平55% + 集团化20% + 区县均衡15% + 变化趋势10%</text></view>
          <view class="source-row"><text>缺失处理</text><text>{{ fallbackCount }} 项使用规则默认值</text></view>
          <view class="source-warning">
            重点学校标记与模型输入来自当前数据快照，只用于找房信息辅助，不应视为官方招生资格、学区划分或学校排名。入学政策请以当地教育主管部门当年公告为准。
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { getSchoolFutureScore } from "../../local/queries";
import { getCityById, getSchoolById } from "../../local/store";
import type { LocalSchool } from "../../local/types";
import type { SchoolFutureScoreResponse } from "../../api/contracts";
import { toErrorMessage } from "../../utils/errorMessage";

const school = ref<LocalSchool | null>(null);
const score = ref<SchoolFutureScoreResponse | null>(null);
const loading = ref(true);
const errorMsg = ref("");

const cityName = computed(() => school.value ? (getCityById(school.value.cityId)?.cityName || "城市未标注") : "");
const confidencePercent = computed(() => Math.round((score.value?.confidence_score ?? 0) * 100));
const fallbackCount = computed(() => score.value?.feature_contrib_json?.missing_fallbacks?.length ?? 0);
const scoreBand = computed(() => {
  const value = score.value?.trend_score_0_100 ?? 0;
  return value >= 80 ? "score-ring--high" : value >= 60 ? "score-ring--mid" : "score-ring--low";
});
const factors = computed(() => {
  const inputs = score.value?.feature_contrib_json?.inputs_used ?? {};
  return [
    { key: "latest", icon: "◈", name: "最新办学水平", value: Number(inputs.latest_level_score ?? 0), weight: 55 },
    { key: "group", icon: "◇", name: "集团化办学", value: Number(inputs.group_school_bonus ?? 0), weight: 20 },
    { key: "district", icon: "◎", name: "区县均衡", value: Number(inputs.district_balance_bonus ?? 0), weight: 15 },
    { key: "trend", icon: "↗", name: "近两期变化", value: Number(inputs.trend_delta_score ?? 0), weight: 10 }
  ];
});

async function loadSchool(id: number) {
  loading.value = true;
  errorMsg.value = "";
  try {
    const item = getSchoolById(id);
    if (!item) throw new Error("未找到该学校，请返回后重新搜索");
    school.value = item;
    score.value = await getSchoolFutureScore({ schoolId: id });
  } catch (e) {
    school.value = null;
    score.value = null;
    errorMsg.value = toErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

function goBack() {
  uni.navigateBack({ fail: () => uni.switchTab({ url: "/pages/school/school" }) });
}

function goDashboard() {
  uni.switchTab({ url: "/pages/dashboard/dashboard" });
}

onLoad((query?: Record<string, string>) => {
  const id = Number(query?.id);
  if (!Number.isInteger(id) || id <= 0) {
    loading.value = false;
    errorMsg.value = "学校编号无效";
    return;
  }
  loadSchool(id);
});
</script>

<style lang="scss" scoped>
.detail-container { padding-bottom: 40rpx; }
.quicknav { display: flex; gap: 12rpx; margin-bottom: 18rpx; }
.quick-btn { padding: 10rpx 16rpx; border: 1rpx solid var(--color-border); border-radius: 999rpx; background: var(--color-surface); color: var(--color-text-secondary); font-size: 21rpx; }
.school-hero { display: flex; justify-content: space-between; align-items: center; gap: 28rpx; padding: 34rpx; border: 1rpx solid var(--color-border); border-radius: 24rpx; background: linear-gradient(135deg, rgba(34, 197, 94, 0.16), var(--color-surface) 62%); box-shadow: var(--shadow-card); }
.hero-copy { min-width: 0; }
.hero-eyebrow { color: var(--color-primary); font-size: 19rpx; font-weight: 700; letter-spacing: 2rpx; }
.hero-title { margin-top: 10rpx; color: var(--color-heading); font-size: 40rpx; font-weight: 750; line-height: 1.3; }
.hero-official { margin-top: 8rpx; color: var(--color-text-secondary); font-size: 22rpx; }
.tag-row { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 18rpx; }
.profile-tag { padding: 6rpx 13rpx; border-radius: 999rpx; background: var(--color-surface-raised); color: var(--color-text-secondary); font-size: 20rpx; }
.profile-tag--success { background: rgba(34,197,94,.14); color: var(--color-primary); }
.profile-tag--warn { background: rgba(245,158,11,.14); color: #d97706; }
.score-ring { display: flex; flex: 0 0 132rpx; width: 132rpx; height: 132rpx; flex-direction: column; align-items: center; justify-content: center; border: 10rpx solid rgba(14,165,233,.22); border-radius: 50%; background: var(--color-surface-raised); }
.score-ring--high { border-color: rgba(34,197,94,.45); }
.score-ring--mid { border-color: rgba(14,165,233,.42); }
.score-ring--low { border-color: rgba(245,158,11,.42); }
.score-value { color: var(--color-heading); font-size: 42rpx; font-weight: 750; line-height: 1; }
.score-label { margin-top: 5rpx; color: var(--color-muted); font-size: 19rpx; }
.metrics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14rpx; margin: 18rpx 0; }
.metric-card { padding: 20rpx; border: 1rpx solid var(--color-border); border-radius: 16rpx; background: var(--color-surface); box-shadow: var(--shadow-card); }
.metric-label { color: var(--color-muted); font-size: 20rpx; }
.metric-value { margin-top: 7rpx; color: var(--color-heading); font-size: 32rpx; font-weight: 700; }
.metric-value--text { overflow: hidden; font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.metric-hint { margin-top: 4rpx; color: var(--color-text-secondary); font-size: 18rpx; }
.section-note { margin-top: -4rpx; font-size: 21rpx; }
.factor-list { margin-top: 18rpx; }
.factor-row + .factor-row { margin-top: 18rpx; }
.factor-head { display: flex; justify-content: space-between; gap: 16rpx; color: var(--color-text); font-size: 22rpx; }
.factor-icon { margin-right: 8rpx; color: var(--color-primary); }
.factor-value { color: var(--color-muted); font-variant-numeric: tabular-nums; }
.factor-track { height: 12rpx; margin-top: 9rpx; overflow: hidden; border-radius: 999rpx; background: var(--color-surface-raised); }
.factor-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #0ea5e9, var(--color-primary)); }
.source-row { display: flex; justify-content: space-between; gap: 24rpx; padding: 13rpx 0; border-bottom: 1rpx solid var(--color-border); color: var(--color-text-secondary); font-size: 21rpx; }
.source-row text:first-child { flex: 0 0 auto; color: var(--color-muted); }
.source-row text:last-child { text-align: right; }
.source-warning { margin-top: 18rpx; padding: 16rpx; border-radius: 12rpx; background: rgba(245,158,11,.1); color: var(--color-text-secondary); font-size: 20rpx; line-height: 1.65; }
.loading-card { padding: 60rpx; text-align: center; color: var(--color-muted); }
.error-state { padding: 60rpx 30rpx; text-align: center; }
.error-icon { width: 72rpx; height: 72rpx; margin: 0 auto; border-radius: 50%; background: rgba(239,68,68,.14); color: var(--color-danger); font-size: 42rpx; line-height: 72rpx; }
.error-title { margin: 18rpx 0 8rpx; color: var(--color-heading); font-size: 29rpx; font-weight: 650; }
.error-state .btn { margin-top: 20rpx; }

@media (max-width: 720px) {
  .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
  .school-hero { align-items: flex-start; padding: 26rpx; }
  .hero-title { font-size: 34rpx; }
  .score-ring { flex-basis: 106rpx; width: 106rpx; height: 106rpx; border-width: 8rpx; }
  .score-value { font-size: 34rpx; }
  .factor-head, .source-row { flex-direction: column; gap: 5rpx; }
  .source-row text:last-child { text-align: left; }
}
</style>

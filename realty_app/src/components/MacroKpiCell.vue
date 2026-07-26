<template>
  <view class="stats70-cell" :data-macro-kpi="label">
    <text class="cell-label">{{ label }}</text>
    <text class="cell-value">{{ value }}</text>
    <text
      v-if="sub"
      class="cell-sub"
      :class="subClass ?? (subTrendClass ? 'stats70-' + subTrendClass : '')"
    >
      <slot name="sub">{{ sub }}</slot>
    </text>
  </view>
</template>

<script setup lang="ts">
/**
 * 宏观 KPI 单元格（MacroKpiCell.vue）。
 *
 * 替换 dashboard 与 macro-* 子页内重复的 `<view class="stats70-cell">…</view>` 模板。
 * 用法：
 *   <MacroKpiCell label="开发投资" :value="formatMacro100m(x)" :sub="`同比 ${...}`" :subTrendClass="trend" />
 *   <MacroKpiCell label="备注" value="—" sub-muted><template #sub>任意</template></MacroKpiCell>
 */
defineProps<{
  label: string;
  value: string;
  sub?: string;
  subClass?: string;
  subTrendClass?: "up" | "down" | "flat";
}>();
</script>
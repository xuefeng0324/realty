<template>
  <view
    class="page page-shell"
    :class="[
      `page-shell--${variant}`,
      `realty-theme-${realtyTheme}`,
      { 'page-shell--safe-top': safeTop }
    ]"
    :data-realty-theme="realtyTheme"
    :style="rootStyle"
  >
    <slot name="header" />

    <view
      class="page-shell__content"
      :class="{ 'page-shell__content--padded': padded }"
    >
      <AsyncState
        v-if="state !== 'ready'"
        :status="state"
        :title="stateTitle"
        :description="stateDescription"
        :action-text="stateActionText"
        :compact="!isBlocking"
        @action="$emit('state-action')"
      />
      <slot v-if="!isBlocking" />
    </view>

    <slot name="overlay" />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AsyncState from "./AsyncState.vue";
import { resolvedThemeRef } from "../utils/theme";
import { THEME_CSS_VARS } from "../utils/themeTokens";

type PageShellState = "ready" | "loading" | "empty" | "error" | "offline" | "stale" | "refreshing";
type PageShellVariant = "default" | "wide" | "fullscreen" | "overlay";

const props = withDefaults(
  defineProps<{
    variant?: PageShellVariant;
    state?: PageShellState;
    stateTitle?: string;
    stateDescription?: string;
    stateActionText?: string;
    padded?: boolean;
    safeTop?: boolean;
    maxWidth?: string;
  }>(),
  {
    variant: "default",
    state: "ready",
    stateTitle: "",
    stateDescription: "",
    stateActionText: "",
    padded: true,
    safeTop: false,
    maxWidth: "1180px"
  }
);

defineEmits<{ "state-action": [] }>();

const realtyTheme = resolvedThemeRef;
const isBlocking = computed(() =>
  ["loading", "empty", "error", "offline"].includes(props.state)
);
const rootStyle = computed<Record<string, string>>(() => ({
  ...THEME_CSS_VARS[realtyTheme.value],
  "--page-shell-max-width": props.maxWidth,
  "color-scheme": realtyTheme.value
}));
</script>

<style scoped lang="scss">
.page-shell {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow-x: hidden;
  background: var(--color-bg);
  color: var(--color-text);
}

.page-shell--safe-top {
  padding-top: var(--safe-area-top, 0px);
}

.page-shell__content {
  width: 100%;
  max-width: var(--page-shell-max-width);
  margin: 0 auto;
  padding-bottom: calc(var(--space-5, 32rpx) + var(--safe-area-bottom, 0px));
}

.page-shell__content--padded {
  padding-right: calc(var(--content-padding, 24rpx) + var(--safe-area-right, 0px));
  padding-left: calc(var(--content-padding, 24rpx) + var(--safe-area-left, 0px));
}

.page-shell--fullscreen,
.page-shell--overlay {
  min-height: 100%;
}

.page-shell--fullscreen .page-shell__content,
.page-shell--overlay .page-shell__content {
  max-width: none;
  padding: 0;
}
</style>

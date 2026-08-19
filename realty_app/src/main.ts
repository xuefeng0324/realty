import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { loadErudaInDev } from "./utils/erudaLoader";

export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  return { app };
}

// dev 下仅 `?eruda=1` 显式启用，避免浮层覆盖原生 TabBar / 干扰 E2E。
void loadErudaInDev();

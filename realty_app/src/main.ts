import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { loadErudaInDev } from "./utils/erudaLoader";

export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  return { app };
}

// dev 环境注入 eruda 控制台；prod 构建时被 tree-shake 剥离
void loadErudaInDev();
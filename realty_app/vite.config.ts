import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://uniapp.dcloud.net.cn/tutorial/migration-to-vue3.html
export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5174,
    host: "0.0.0.0"
  },
  css: {
    preprocessorOptions: {
      scss: {
        // 0.90.0: 显式启用 modern API，消除 dart-sass legacy JS API deprecation warning
        // （@dcloudio/vite-plugin-uni 3.0.0-4030620241128001 仍未主动开启 modern 默认）
        api: "modern-compiler",
        silenceDeprecations: ["legacy-js-api"]
      }
    }
  }
});
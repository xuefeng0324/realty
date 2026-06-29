import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://uniapp.dcloud.net.cn/tutorial/migration-to-vue3.html
export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5174,
    host: "0.0.0.0"
  }
});
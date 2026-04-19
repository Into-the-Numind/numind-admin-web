import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // 加载环境变量（与 numind-web-v3 保持一致的 VITE_PROXY_TARGET 约定）
    const env = loadEnv(mode, process.cwd(), "");
    return {
        plugins: [vue()],
        resolve: {
            alias: {
                "@": fileURLToPath(new URL("./src", import.meta.url)),
            },
        },
        server: {
            port: 5174,
            proxy: {
                "/api": {
                    // 本地开发默认直连 localhost 后端；E2E 或无本地 Go 环境时
                    // 用 VITE_PROXY_TARGET 指向 dev（如 http://49.233.219.254:9091）。
                    target: env.VITE_PROXY_TARGET || "http://localhost:9099",
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/api/, ""),
                },
            },
        },
        build: {
            outDir: "dist",
            sourcemap: "hidden",
        },
    };
});

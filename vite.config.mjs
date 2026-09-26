import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.PORTFOLIO_APP_PUBLIC_PATH || "/",
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        // The static host serves .mjs as application/octet-stream, which browsers
        // reject when PDF.js loads its module worker. Keep the worker content but
        // publish it with the .js extension so it receives application/javascript.
        assetFileNames: (asset) => {
          const isPdfWorker = asset.names?.some((name) => name.endsWith("pdf.worker.min.mjs"));
          return isPdfWorker ? "assets/[name]-[hash].js" : "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    // 本地预览没有 Python 服务时，把 /api/chat 安全转发到已部署的同一套云端链路。
    // 这里只在 Vite 开发服务器生效，API 密钥仍保留在云端函数环境变量中。
    proxy: {
      "/api/yuanbai/game": {
        target: process.env.YUANBAI_GAME_API_ORIGIN || "http://123.56.162.88",
        changeOrigin: true,
        rewrite: (path) => process.env.YUANBAI_GAME_API_ORIGIN ? path : `/yuanbai-game${path}`,
        configure: (proxy) => proxy.on("proxyReq", (req) => req.setHeader("Origin", "https://apps-demo.muyang23333.top")),
      },
      "/api/chat": {
        target: "https://apps-demo.muyang23333.top",
        changeOrigin: true,
        rewrite: () => "/api/yuanbai/chat",
      },
    },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});

import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const proxyApiTarget =
    env.VITE_PROXY_API_TARGET?.trim() || "http://localhost:4000";

  return {
    envDir: repoRoot,
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@packages": fileURLToPath(new URL("../packages", import.meta.url)),
      },
    },
    server: {
      fs: {
        allow: [repoRoot],
      },
      proxy: {
        "/api": {
          target: proxyApiTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      globals: true,
    },
  };
});

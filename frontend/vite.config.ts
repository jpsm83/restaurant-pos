import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const proxyApiTarget =
    env.VITE_PROXY_API_TARGET?.trim() || "http://localhost:4000";
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN?.trim();
  const sentryRelease =
    env.VITE_SENTRY_RELEASE?.trim() ||
    env.SENTRY_RELEASE?.trim() ||
    "restaurant-pos-frontend@0.0.0";

  return {
    envDir: repoRoot,
    build: {
      // Hidden maps are uploaded by the Sentry plugin, then deleted. Without a
      // token there is nothing to upload, so production builds emit no maps.
      sourcemap: sentryAuthToken ? "hidden" : false,
    },
    plugins: [
      react(),
      ...(sentryAuthToken
        ? sentryVitePlugin({
            org: "personal-4oz",
            project: "restaurant-pos-frontend",
            authToken: sentryAuthToken,
            release: { name: sentryRelease },
            sourcemaps: {
              filesToDeleteAfterUpload: ["./dist/**/*.map"],
            },
          })
        : []),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
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

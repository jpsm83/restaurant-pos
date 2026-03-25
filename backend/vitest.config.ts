import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Global test settings
    globals: true,
    environment: "node",
    
    // Test file patterns
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    
    // Setup files run before each test file
    setupFiles: ["./tests/setup.ts"],
    
    // Timeouts
    // MongoMemoryReplSet creation can take longer on first download (especially in CI-like environments).
    testTimeout: 120000,
    hookTimeout: 120000,
    
    // Coverage configuration
    // Disable coverage output so Vitest doesn't generate `backend/coverage/` during regular runs.
    coverage: { enabled: false },
    
    // Run tests sequentially for database operations (Vitest 4: also forces a single worker).
    fileParallelism: false,
    maxWorkers: 1,
  },
  
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@shared": resolve(__dirname, "../packages/shared/src"),
    },
  },
});

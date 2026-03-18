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
    testTimeout: 30000,
    hookTimeout: 30000,
    
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/models/legacy/**",
        "src/**/*.d.ts",
      ],
    },
    
    // Run tests sequentially for database operations
    fileParallelism: false,
  },
  
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@shared": resolve(__dirname, "../packages/shared/src"),
    },
  },
});

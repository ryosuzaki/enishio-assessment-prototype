import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 結合テスト（実DBを要する）は別設定へ分ける。ここへ混ぜると
    // DBの無い環境で `npm run test` が落ちるようになる。
    exclude: ["**/node_modules/**", "**/.next/**", "src/**/*.integration.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});

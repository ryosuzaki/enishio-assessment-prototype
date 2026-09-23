import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * 結合テスト専用の設定。
 *
 * 既定の `vitest.config.ts`（`npm run test`）は **DBもAPIキーも無しで走る**ことを
 * 保っている。こちらは逆に、**実際の PostgreSQL へ書きに行く**ものだけを集める。
 * 混ぜると、DBが無い環境で単体テストが落ちるようになる。
 *
 * LLM 呼び出しは結合テスト側でもモックする。課金の発生する経路を CI に入れない。
 *
 *   docker compose up -d
 *   npm run prisma:push
 *   npm run test:integration
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // DATABASE_URL を .env から読む（CI では環境変数が既に入っているので上書きしない）
    setupFiles: ["dotenv/config"],
    // 同一DBを複数ファイルで奪い合わせない
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  // 提案書用スクリーンショットの取得は「テスト」ではなく生成処理である。
  // 既定の実行（npm run test:e2e → chromium プロジェクト）に混ぜると、CIで走るたびに
  // docs/screenshots/ を上書きしてしまうため、別プロジェクトへ分けている。
  projects: [
    {
      name: "chromium",
      testIgnore: ["**/capture-screenshots.spec.ts", "**/capture-video.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "capture",
      testMatch: "**/capture-screenshots.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // README 用の動作確認動画。スクリーンショットと同じ理由で既定の実行から外す
      name: "video",
      testMatch: "**/capture-video.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

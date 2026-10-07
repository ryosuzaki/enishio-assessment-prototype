import { test, expect } from "@playwright/test";
import { installMockApi } from "./support/mock-api";
import { submitReviewToDecision } from "./support/review-flow";

/**
 * 演習の場面が替わったら、ページの先頭から見せる。意思決定の画面は縦に長く、確定ボタンを
 * 押す時点で下までスクロールしている。位置がそのまま残ると、診断画面の見出しと評点が
 * 画面の上に切れて始まる。
 */
test("意思決定から診断画面へ替わったとき、ページの先頭に戻る", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await installMockApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "演習を開始する" }).click();
  await submitReviewToDecision(page);
  await page.locator("input[value='remand']").check();

  const submit = page.getByRole("button", { name: "判定を確定して採点する" });
  await submit.scrollIntoViewIfNeeded();
  const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
  // このテストが意味を持つのは、確定ボタンを押す時点で実際に下へスクロールしているとき
  expect(await scrollY()).toBeGreaterThan(0);

  await submit.click();
  await expect(page.getByText("XAI診断（構造化採点パイプラインによる2段階採点）")).toBeVisible();
  await expect.poll(scrollY).toBe(0);
});

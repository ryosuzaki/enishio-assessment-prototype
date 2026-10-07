import { test, expect } from "@playwright/test";
import { installMockApi } from "./support/mock-api";
import { sendMessage } from "./support/review-flow";

/**
 * 対話は受講者の最初の入力から始まる。AIエージェントは受講者の指示に応じて話す側で、
 * 自分からレビューを依頼したり、話し始めたりしない。前提変化の通知も、AIエージェントの
 * 発言ではなく進行役の発言として出す。
 */
test.describe("対話の始まりと発言者", () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await page.goto("/");
    await page.getByRole("button", { name: "演習を開始する" }).click();
    await expect(page.getByTestId("draft-code-editor")).toBeVisible();
  });

  test("開始直後のチャット欄には発言がなく、案内だけが出る", async ({ page }) => {
    await expect(page.getByTestId("chat-empty-hint")).toBeVisible();
    // 発言者のラベルが1つも無い（AIエージェントが先に話していない）
    await expect(page.getByText("あなた（受講者）")).toHaveCount(0);
    await expect(page.getByText("AIエージェント", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/レビューをお願いします/)).toHaveCount(0);
  });

  test("最初の発言は受講者であり、送ると案内が消える", async ({ page }) => {
    await page.getByPlaceholder(/AIエージェントに指示・指摘を入力/).fill("Redisの単一障害点について考慮が必要です。");
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByText("ご指摘ありがとうございます。Redisのフェイルオーバー時").first()).toBeVisible();
    await expect(page.getByTestId("chat-empty-hint")).toHaveCount(0);
  });

  test("前提変化の通知は、AIエージェントではなく進行役の発言として出る", async ({ page }) => {
    // 深掘りに3回答えて、検証を提出する
    for (let i = 1; i <= 4; i += 1) {
      await sendMessage(page, `指摘${i}: Redisの単一障害点について考慮が必要です。`, { expectProbe: true });
    }
    await page.getByTestId("review-action-button").click();

    const notice = page.getByText(/【⚡ 緊急仕様変更・追加要件の通知】/);
    await expect(notice).toBeVisible();
    // 吹き出しの直前にある話者ラベルを読む
    await expect(notice.locator("xpath=preceding-sibling::span")).toHaveText("進行役");
  });
});

import { expect, type Page } from "@playwright/test";

/**
 * 検証の提出から意思決定までの手順（固定データ用）。
 *
 * 受講者は、進行役の深掘りに最低3回答えると「検証を提出する」を押せる。押すと進行役が前提変化を
 * 出し、受講者が応答すると「最終判断へ進む」で意思決定へ進める `[D-135]`。
 * 深掘りは、固定データの進行役が受講者の発言ごとに1回出す。
 */

/** 受講者として1回発言する。AIエージェントの応答（と、出るなら進行役の深掘り）が返るまで待つ */
export async function sendMessage(page: Page, text: string, options: { expectProbe: boolean }) {
  const input = page.getByPlaceholder(/AIエージェントに指示・指摘を入力/);
  await input.fill(text);
  const turn = page.waitForResponse((r) => r.url().includes("/api/dialogue/turn"));
  const probe = options.expectProbe
    ? page.waitForResponse((r) => r.url().includes("/api/dialogue/probe"))
    : null;
  await page.getByRole("button", { name: "送信" }).click();
  await turn;
  if (probe) await probe;
}

const MESSAGES = [
  "Redisの単一障害点（SPOF）およびPCI DSS要件に対する耐障害性について考慮が必要です。",
  "指摘の根拠は、受入基準の耐障害性要件です。フォールバック処理を検討してください。",
  "障害時の挙動は、フェイルクローズを基本に、監査ログへ残す内容も決めてください。",
  "正常系の検証は十分か、テストも見直してください。",
];

/**
 * 深掘りに3回答えて検証を提出し、前提変化に応答して、意思決定の画面へ進む。
 * 最初の発言は呼び出し側で済ませてよい（`alreadySent` に回数を渡す）。
 */
export async function submitReviewToDecision(page: Page, options: { alreadySent?: number } = {}) {
  const alreadySent = options.alreadySent ?? 0;
  // 4回目の発言までで、深掘りへの回答が3回になる（1回目の発言には深掘りがまだ無い）
  for (let i = alreadySent; i < 4; i += 1) {
    await sendMessage(page, MESSAGES[i], { expectProbe: true });
  }

  const action = page.getByTestId("review-action-button");
  await expect(action).toHaveText("検証を提出する");
  await expect(action).toBeEnabled();
  await action.click();

  // 提出すると、進行役が前提変化を出す。名前が替わり、応答するまで押せない
  await expect(page.getByText("緊急仕様変更・追加要件が通知されました")).toBeVisible();
  await expect(action).toHaveText("最終判断へ進む");
  await expect(action).toBeDisabled();

  await sendMessage(page, "追加要件を踏まえて、VIP加盟店だけ縮退運転を許可する方針へ組み直してください。", {
    expectProbe: false,
  });
  await expect(action).toBeEnabled();
  await action.click();
  await expect(page.getByText("場面4：意思決定")).toBeVisible();
}

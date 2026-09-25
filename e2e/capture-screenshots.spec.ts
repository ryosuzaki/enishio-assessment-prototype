import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { installMockApi } from "./support/mock-api";

test.describe("Capture Proposal UI Screenshots (High DPI)", () => {
  // A4 Word提出用：幅1280px、高DPI（deviceScaleFactor: 2）
  test.use({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });

  const screenshotsDir = path.resolve(process.cwd(), "docs/screenshots");

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
  });

  test("全STEPのUIスクリーンショットをdocs/screenshots/へ高解像度出力する", async ({ page }) => {
    // 01. 初期画面 (Init Step)
    await page.goto("/");
    // 見出しと副題は別の行に分けてある（`[D-102]`：h1 に括弧付きの長い副題を抱かせない）
    await expect(page.locator("h1")).toContainText("実務演習セッション");
    await expect(page.getByText("AI同僚とのコードレビュー演習")).toBeVisible();
    // 計測ログは既定で閉じている。提出用の画面では開いた状態を撮る
    await page.getByRole("button", { name: "計測ログを表示" }).click();
    await expect(page.getByText("計測ログ", { exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "01-init.png"),
      fullPage: true,
    });

    // 02. アンカー出題・段階1（採用可否）[D-83]
    // 共通アンカー評価は独立タブ。出題項目IDは供給源（運用バンク / 同梱サンプル）で
    // 変わるため決め打ちせず、選択済みラジオの value から拾う
    await page.getByRole("navigation", { name: "画面の切り替え" }).getByRole("button", { name: "固定設問（SCT型）" }).click();
    const anchorRadio = page.locator("input[name='anchorItem']:checked");
    await expect(anchorRadio).toBeAttached();
    const selectedAnchorId = await anchorRadio.inputValue();
    await page
      .getByRole("button", { name: "この設問を体験する" })
      .click();
    await expect(page.getByText(/段階 1（全体判断）/)).toBeVisible();
    await expect(page.getByText(new RegExp(`固定設問: ${selectedAnchorId}`))).toBeVisible();
    await page.locator("input[name='stage1']").nth(1).check();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "02-anchor-question.png"),
      fullPage: true,
    });

    // 段階2（懸念領域）→ 段階3（前提変化への判断更新）➔ 確信度評定
    await page.getByRole("button", { name: "この判断で確定する" }).click();
    const capStage2 = page.locator("input[name='stage2']").first();
    if (await capStage2.isVisible().catch(() => false)) {
      await capStage2.check();
      await page.getByRole("button", { name: "次へ" }).click();
    }
    // 02b. 段階3（前提変化の注入）。SCT型の核であり、静的選択式には無かった段 [D-83]
    await expect(page.getByText(/段階 3（前提変化への判断更新）/)).toBeVisible();
    await expect(page.getByText("新しい情報が入りました")).toBeVisible();
    // 「変わらない」(0) を選ぶ。段階3' との差分を 0（保持）として見せるため
    await page.locator("input[name='stage3']").nth(2).check();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "02b-anchor-stage3-premise-shift.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "確信度評定へ" }).click();

    // 02c. 段階3'（新情報を含まない反論）。付いている項目でだけ現れる
    const capStage3bOptions = page.locator("input[name='stage3b']");
    if (await capStage3bOptions.first().isVisible().catch(() => false)) {
      await expect(page.getByText("AI同僚からの反論")).toBeVisible();
      // 段階3と同じ「変わらない」(0) を選ぶ。差分0＝保持を撮る
      await capStage3bOptions.nth(2).check();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: path.join(screenshotsDir, "02c-anchor-stage3b-pushback.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: "確信度評定へ" }).click();
    }
    await expect(page.getByText("確信度の自己評定（5段階）")).toBeVisible();
    await page.getByRole("button", { name: /4\s*やや自信あり/ }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "03-anchor-confidence.png"),
      fullPage: true,
    });

    // アンカー送信 ➔ 動的2ペイン対話セッション
    await page.getByRole("button", { name: "回答を送信して記録する" }).click();
    await expect(page.getByText("固定設問の回答を記録しました")).toBeVisible();
    // 03b. 回答の控え。正誤は返さない [D-83]
    await expect(page.getByTestId("anchor-answer-record")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "03b-anchor-record.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "実務演習セッションを体験する" }).click();

    // 実務演習セッションタブの初期画面から課題提示へ進む
    await page
      .getByRole("button", { name: "演習を開始する" })
      .click();

    // 2ペインの表示確認
    await expect(page.getByText("【第1ペイン】開発Issue ＆ チーム情報")).toBeVisible();
    await expect(page.getByText("【第2ペイン】成果物ドラフト")).toBeVisible();
    await expect(page.getByText("【第2ペイン】検証パネル")).toHaveCount(0);

    // コード引用機能の確認（エディタから選択してチャットに引用）
    const quoteBtn = page.getByTestId("quote-code-btn");
    await expect(quoteBtn).toBeVisible();

    const codeEditor = page.getByTestId("draft-code-editor");
    await codeEditor.evaluate((el: HTMLTextAreaElement) => {
      el.setSelectionRange(0, 35);
    });
    await quoteBtn.click();
    await expect(page.getByText("コードをチャット欄に引用しました")).toBeVisible();

    // AI同僚へメッセージ送信
    const promptInput = page.getByPlaceholder(/AI同僚に指示・指摘を入力/);
    await promptInput.fill(
      "Redisの単一障害点（SPOF）およびPCI DSS要件に対する耐障害性について考慮が必要です。フォールバック処理の実装を検討してください。"
    );
    await page.getByRole("button", { name: "送信" }).click();
    await expect(
      page.getByText("ご指摘ありがとうございます。Redisのフェイルオーバー時").first()
    ).toBeVisible();
    await expect(page.getByText("その判断の前提（SPOFリスク）を、仕様のどの記述")).toBeVisible();

    // 2発話目で進行役側が前提変化を撃つ [D-100]。撃たれた手番には深掘りを重ねない
    await promptInput.fill(
      "一般加盟店はPCI DSS監査に従いフェイルクローズを維持する方針で修正してください。"
    );
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByText("緊急仕様変更・追加要件が通知されました")).toBeVisible();

    // 04. 動的対話画面 (2-Pane Dialogue with Code Quoting)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "04-dialogue.png"),
      fullPage: true,
    });

    // 05. CFF暫定判断 (Force Decision First & Mandatory Justification)
    await page.getByRole("button", { name: "レビュー完了 ➔ 暫定判断へ進む" }).click();
    await expect(page.getByText("場面4：意思決定")).toBeVisible();
    await page.locator("input[value='remand']").check();
    const justificationTextarea = page.getByPlaceholder(
      /進行役の要約に補足や微調整がある場合のみ入力/
    );
    await justificationTextarea.fill(
      "Redis障害時の単一障害点リスクおよびPCI DSS第3条・第6条の暗号化・監査要件への適合性において重大な懸念が残るため、フォールバック機構とログ出力の拡充を指示し差し戻しと判定する。"
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "05-decision.png"),
      fullPage: true,
    });

    // 06. 構造化採点パイプライン 2段階採点結果（XAIレポート）
    await page.getByRole("button", { name: "判定を確定して採点する" }).click();
    await expect(page.getByText("XAI診断（構造化採点パイプラインによる2段階採点）")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Band 3: 前提摘発・要件検証行動" })).toBeVisible();
    await expect(page.getByTestId("discrepancy-highlighting-block")).toBeVisible();
    await expect(page.getByText("判定の根拠", { exact: true })).toBeVisible();
    await expect(page.getByText("次に伸ばすところ")).toBeVisible();
    await expect(page.getByText(/抽出された検証行動（採点パイプライン第1段の出力）/)).toBeVisible();

    // 異議申立導線の入力
    await page.locator("input[value='too_low']").check();
    const disputeTextarea = page.getByPlaceholder(/異議の理由を具体的に記述してください/);
    await disputeTextarea.fill(
      "ターン2でのPCI DSS要件に対する指摘およびチャットでの該当コード引用行動が、より高位のBand 4基準に該当すると考えます。"
    );

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "06-xai-report.png"),
      fullPage: true,
    });

    // 07. 組織・受講管理ダッシュボード（Viability・モックUI）
    const dashboardTabBtn = page.getByRole("navigation", { name: "画面の切り替え" }).getByRole("button", { name: /組織ダッシュボード/ });
    await dashboardTabBtn.click();
    await expect(page.locator("h1")).toContainText("組織・受講管理ダッシュボード");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "07-organization-dashboard.png"),
      fullPage: true,
    });

    // 08. 受講者スキルカルテ（Viability・モックUI）
    const profileTabBtn = page.getByRole("navigation", { name: "画面の切り替え" }).getByRole("button", { name: /受講者カルテ/ });
    await profileTabBtn.click();
    await expect(page.locator("h1")).toContainText("佐藤 拓也 さんのスキルカルテ");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "08-learner-profile.png"),
      fullPage: true,
    });

    // 09. シナリオ分析＆エキスパート事後講評（デブリーフィング）
    const galleryTabBtn = page.getByRole("navigation", { name: "画面の切り替え" }).getByRole("button", { name: /事後講評/ });
    await galleryTabBtn.click();
    await expect(page.locator("h1")).toContainText("シナリオ分析＆エキスパート検証戦略");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "09-benchmark-gallery.png"),
      fullPage: true,
    });
  });
});

import { test, expect } from "@playwright/test";

test.describe("Assessment Prototype End-to-End Flow", () => {
  test.beforeEach(async ({ page }) => {
    // データベースおよび外部LLM APIへの依存を排除するルートモック
    await page.route("**/api/session/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          sessionId: "mock-session-001",
          sessionSeq: 1,
          learnerId: "mock-learner-001",
        }),
      });
    });

    await page.route("**/api/anchor", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            responseId: "mock-resp-001",
            anchorStatus: "pretest",
            scored: false,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/dialogue/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          flawCount: 3,
          normalSpanCount: 2,
        }),
      });
    });

    await page.route("**/api/dialogue/turn", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          assistantTurnSeq: 2,
          assistantMessage:
            "ご指摘ありがとうございます。Redisのフェイルオーバー時とPCI DSS要件を考慮し、フォールバック機構を追加修正します。",
          isInterlockTriggered: false,
          updatedArtifact:
            "// 修正版コードドラフト\nimport { Request, Response } from 'express';\n// Redis障害時フォールバック実装済み",
        }),
      });
    });

    await page.route("**/api/dialogue/preliminary-judgement", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          judgementId: "mock-prelim-001",
        }),
      });
    });

    await page.route("**/api/dialogue/focus", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
        }),
      });
    });

    await page.route("**/api/dialogue/evaluate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          ratingId: "mock-rating-e2e-001",
          isPendingHumanReview: false,
          ratingCategory: 3,
          levelLabel: "Band 3: 前提摘発・要件検証行動",
          scoringConfidence: 0.88,
          evidenceSummary:
            "受講者はRedis障害時の単一障害点リスクおよびPCI DSS要件との乖離を的確に指摘し、AI同僚に適切な修正指示を出している。",
          diagnosticFeedback:
            "セキュリティ制約と高可用性のトレードオフを意識した優れた検証行動が確認できました。",
          evidenceComponents: [
            {
              turn_index: 2,
              quoted_span: "Redisの単一障害点について考慮が必要です",
              component_type: "FLAW_IDENTIFICATION",
              injected_flaw_id: "FLAW-01",
              rationale_summary: "Redis障害時の耐障害性要件違反を指摘",
            },
          ],
          scorerModelVersion: "claude-opus-5/extract-v2/score-v2",
        }),
      });
    });

    await page.route("**/api/feedback", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          feedbackId: "mock-feedback-001",
        }),
      });
    });
  });

  test("初期画面の読み込みとアンカー項目・動的課題の選択肢が表示される", async ({ page }) => {
    await page.goto("/");

    // 画面タイトル・ヘッダー確認
    await expect(page.locator("h1")).toContainText("評価的判断力 動的アセスメント＆テレメトリ基盤");
    await expect(page.getByText("未踏アドバンスト審査用 縦切りプロトタイプ")).toBeVisible();

    // アンカー項目のドロップダウン（全20項目）
    const anchorSelect = page.locator("select").first();
    await expect(anchorSelect).toBeVisible();
    const anchorOptions = anchorSelect.locator("option");
    await expect(anchorOptions).toHaveCount(20);

    // 動的課題のドロップダウン
    const taskSelect = page.locator("select").nth(1);
    await expect(taskSelect).toBeVisible();
    const taskOptions = taskSelect.locator("option");
    expect(await taskOptions.count()).toBeGreaterThanOrEqual(1);

    // 右カラムのテレメトリパネル
    await expect(page.getByText("Live Telemetry Monitor")).toBeVisible();
    await expect(page.getByText("Connected")).toBeVisible();
  });

  test("アンカー出題 → 設問回答 → 確信度評定 → 送信完了の一連のフローが動作する", async ({ page }) => {
    await page.goto("/");

    // セッション開始
    const startButton = page.getByRole("button", { name: "セッションを開始する（アンカー出題へ）" });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 設問1（anchor_q1）
    await expect(page.getByText(/設問 1 \/ 2/)).toBeVisible();
    await expect(page.getByText(/共通アンカー項目: ANCHOR-A-01/)).toBeVisible();

    // 設問1の選択肢を1つ選ぶ
    const q1FirstOption = page.locator("input[name='q1']").first();
    await q1FirstOption.check();
    await page.getByRole("button", { name: "設問2へ進む" }).click();

    // 設問2（anchor_q2）
    await expect(page.getByText(/設問 2 \/ 2/)).toBeVisible();
    const q2FirstOption = page.locator("input[name='q2']").first();
    await q2FirstOption.check();
    await page.getByRole("button", { name: "確信度評定へ" }).click();

    // 確信度自己評定（anchor_conf）
    await expect(page.getByText("確信度の自己評定（5段階）")).toBeVisible();
    // 確信度「4」を選択
    await page.getByRole("button", { name: /4\s*やや自信あり/ }).click();

    // アンカー送信
    const submitAnchorBtn = page.getByRole("button", { name: "アンカー回答を送信・記録する" });
    await submitAnchorBtn.click();

    // アンカー完了画面（anchor_complete）
    await expect(page.getByText("共通アンカー項目の記録が完了しました")).toBeVisible();
    await expect(page.getByText("anchor_status = pretest")).toBeVisible();
  });

  test("動的3ペイン対話 → CFF暫定判断 → AutoSCORE採点 → XAIレポート表示の全フローが完走する", async ({ page }) => {
    await page.goto("/");

    // 1. アンカーフローを通過
    await page.getByRole("button", { name: "セッションを開始する（アンカー出題へ）" }).click();
    await page.locator("input[name='q1']").first().check();
    await page.getByRole("button", { name: "設問2へ進む" }).click();
    await page.locator("input[name='q2']").first().check();
    await page.getByRole("button", { name: "確信度評定へ" }).click();
    await page.getByRole("button", { name: /4\s*やや自信あり/ }).click();
    await page.getByRole("button", { name: "アンカー回答を送信・記録する" }).click();

    // 2. 動的課題対話セッションへ進む
    await page.getByRole("button", { name: "動的対話セッションへ進む" }).click();

    // 3ペインの表示確認
    await expect(page.getByText("【第1ペイン】業務要件と制約条件")).toBeVisible();
    await expect(page.getByText("【第2ペイン】成果物ドラフト")).toBeVisible();
    await expect(page.getByText("【第3ペイン】検証パネル")).toBeVisible();
    await expect(page.getByText("AI同僚との対話・修正指示（マルチターン対話）")).toBeVisible();

    // 検証パネルへコードスパンを追加
    const focusInput = page.getByPlaceholder("検証対象とするコード断片・キーワード");
    await focusInput.fill("redis.get(merchantId)");
    await page.getByRole("button", { name: "検証パネルへ追加" }).click();
    await expect(page.locator("span.bg-purple-500\\/20", { hasText: "#1" })).toBeVisible();
    await expect(page.getByText("redis.get(merchantId)")).toBeVisible();

    // AI同僚へメッセージ送信
    const promptInput = page.getByPlaceholder(/AI同僚に指示・指摘を入力/);
    await promptInput.fill("Redisの単一障害点について考慮が必要です");
    await page.getByRole("button", { name: "送信" }).click();

    // AI同僚の返答が表示されたことを確認
    await expect(page.getByText("ご指摘ありがとうございます。Redisのフェイルオーバー時")).toBeVisible();

    // 3. レビュー完了 ➔ 暫定判断（CFF）へ進む
    await page.getByRole("button", { name: "レビュー完了 ➔ 暫定判断へ進む" }).click();

    // CFF画面の確認
    await expect(page.getByText("CFF: Force Decision First & Mandatory Justification")).toBeVisible();
    await expect(page.getByText("成果物の最終判定と判断理由の言語化")).toBeVisible();

    // 差し戻しを選択
    await page.locator("input[value='remand']").check();
    // 自己評点 Band 3 を選択
    await page.getByRole("button", { name: /Band 3\s*前提摘発/ }).click();
    // 判断理由を入力
    const justificationTextarea = page.getByPlaceholder(/承認または差し戻しと判断した具体的な根拠・理由を記述/);
    await justificationTextarea.fill("Redis障害時のフォールバックおよびPCI DSS要件の観点で修正が必要であるため差し戻し。");

    // 4. 暫定判断を確定し、AI評価を実行
    await page.getByRole("button", { name: "暫定判断を確定し、AI評価を実行する" }).click();

    // 5. XAIレポート画面の確認
    await expect(page.getByText("AutoSCORE 2段階評価結果（XAIレポート）")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Band 3: 前提摘発・要件検証行動" })).toBeVisible();
    await expect(page.getByText("これは開発中の推定器による「暫定値」です")).toBeVisible();
    await expect(page.getByText("判定根拠（Evidence Summary）")).toBeVisible();
    await expect(page.getByText("形成的診断アドバイス（Diagnostic Feedback）")).toBeVisible();
    await expect(page.getByText("抽出された受講者の検証行動スパン")).toBeVisible();
    await expect(page.getByText("評点に対する異議申立・フィードバック")).toBeVisible();

    // 異議申立の入力と送信テスト
    await page.locator("input[value='too_low']").check();
    const disputeTextarea = page.getByPlaceholder(/異議の理由を具体的に記述してください/);
    await disputeTextarea.fill("ターン2での指摘事項がより高精度に反映されるべきと考えます。");
    await page.getByRole("button", { name: "異議を申し立てる（記録）" }).click();

    await expect(page.getByText("異議申立が `score_feedback` テーブルへ記録されました")).toBeVisible();
    await expect(page.getByText("W1〜W5 全フロー縦切り動作完了")).toBeVisible();

    // トップへ戻るボタンの動作確認
    await page.getByRole("button", { name: "← トップへ戻り最初からやり直す" }).click();
    await expect(page.locator("h1")).toContainText("評価的判断力 動的アセスメント＆テレメトリ基盤");
  });
});

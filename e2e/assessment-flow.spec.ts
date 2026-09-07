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

    await page.route("**/api/dialogue/probe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          probeIssued: true,
          probeMove: "trace_grounding",
          probeText: "その指摘は業務要件のどの部分から来ていますか？",
          stateEstimate: [
            { target: "premise_articulation", status: "partial", basis: "単一障害点への言及はあるが前提の明示は無い" },
            { target: "tradeoff_reasoning", status: "not_elicited", basis: "トレードオフの言及はまだ無い" },
            { target: "requirement_grounding", status: "elicited", basis: "耐障害性要件への言及がある" },
            { target: "normal_span_discrimination", status: "not_elicited", basis: "正常箇所への言及はまだ無い" },
            { target: "robustness_under_changed_premise", status: "not_elicited", basis: "What-ifはまだ投げていない" },
          ],
          selectionRationale: "premise_articulation と tradeoff_reasoning が未取得のため、根拠の出所を辿る問いを選んだ",
          mediatorModelVersion: "claude-sonnet-4-5/probe-v1",
          probeTurnSeq: 3,
          probesSoFar: 1,
        }),
      });
    });

    await page.route("**/api/session/blur", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, recorded: true }),
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
          confidenceThreshold: 0.7,
          isDemoThresholdOverride: false,
          evidenceSummary:
            "受講者はRedis障害時の単一障害点リスクおよびPCI DSS要件との乖離を的確に指摘し、AI同僚に適切な修正指示を出している。",
          diagnosticFeedback:
            "セキュリティ制約と高可用性のトレードオフを意識した優れた検証行動が確認できました。",
          evidenceComponents: [
            {
              turn_index: 2,
              quoted_span: "Redisの単一障害点について考慮が必要です",
              component_type: "flaw_detection",
              grounding: "tied_to_requirement",
              injected_flaw_id: "FLAW-01",
              rationale_summary: "Redis障害時の耐障害性要件違反を指摘",
            },
          ],
          probeConsistency: {
            score: 0.82,
            rationale: "進行役の問いかけに対し、直前の指摘と整合する理由づけを述べていた",
          },
          scorerModelVersion: "claude-sonnet-4-5/extract-v5/score-v3",
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
    await expect(page.getByText("評価的判断力 動的アセスメント 縦切りプロトタイプ")).toBeVisible();

    // アンカー項目のドロップダウン。
    // 項目数は供給源によって変わる（運用バンク20項目 / リポジトリ同梱の公開デモ用サンプル）。
    // GET /api/anchor はモックせず実ルートを叩いているため、ここで件数を決め打ちすると
    // 運用バンクを持つ手元と、持たないCIのどちらかで必ず落ちる。「空でないこと」を見る。
    const anchorSelect = page.locator("select").first();
    await expect(anchorSelect).toBeVisible();
    // 項目はマウント後に GET /api/anchor で埋まる。件数を数えるだけの expect は
    // リトライしないので、先に「埋まったこと」を待てる web-first assertion を置く
    // （選択肢が空のあいだ select は disabled になる）。
    await expect(anchorSelect).toBeEnabled();
    await expect(anchorSelect).not.toHaveValue("");
    expect(await anchorSelect.locator("option").count()).toBeGreaterThanOrEqual(1);

    // 動的課題のドロップダウン
    const taskSelect = page.locator("select").nth(1);
    await expect(taskSelect).toBeVisible();
    const taskOptions = taskSelect.locator("option");
    expect(await taskOptions.count()).toBeGreaterThanOrEqual(1);

    // 右カラムのテレメトリパネル
    await expect(page.getByText("Live Telemetry Monitor")).toBeVisible();
    await expect(page.getByText("Connected")).toBeVisible();
  });

  test("同梱サンプルへフォールバックした場合、運用バンクではないことが画面に明示される", async ({ page }) => {
    // 運用バンク（src/data/anchors.json）を持たない環境＝公開リポジトリのcloneを再現する。
    // サンプル2項目を運用20項目に見せてはならない（README「主張を増やさない」）。
    await page.route("**/api/anchor?*", async (route) => await route.continue());
    await page.route("**/api/anchor", async (route) => {
      if (route.request().method() !== "GET") return await route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: 2,
          bankSource: "demo_sample",
          anchors: [
            { anchor_id: "ANCHOR-DEMO-A-01", family: "A", title: "【公開デモ用】検索結果キャッシュの導入" },
            { anchor_id: "ANCHOR-DEMO-B-01", family: "B", title: "【公開デモ用】障害振り返り文書の自動生成" },
          ],
        }),
      });
    });

    await page.goto("/");

    await expect(page.getByTestId("anchor-bank-source-badge")).toHaveText("公開デモ用サンプル");
    await expect(page.getByText("出題する共通アンカー項目（全2項目から選択）")).toBeVisible();
    await expect(page.getByText(/運用中の共通アンカー項目バンク（20項目）は、受検者への事前露出を避けるため公開していません/)).toBeVisible();
  });

  test("アンカー出題 → 設問回答 → 確信度評定 → 送信完了の一連のフローが動作する", async ({ page }) => {
    await page.goto("/");

    // 出題される項目IDは供給源によって変わるため、選択中の値を読んでから進む。
    // 読む前に、項目が埋まって select が有効になるのを待つ。
    const anchorSelect = page.locator("select").first();
    await expect(anchorSelect).toBeEnabled();
    const selectedAnchorId = await anchorSelect.inputValue();
    expect(selectedAnchorId).not.toBe("");

    // セッション開始
    const startButton = page.getByRole("button", { name: "セッションを開始する（アンカー出題へ）" });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 設問1（anchor_q1）。出題されるのは init 画面で選択されていた項目である。
    await expect(page.getByText(/設問 1 \/ 2/)).toBeVisible();
    await expect(page.getByText(new RegExp(`共通アンカー項目: ${selectedAnchorId}`))).toBeVisible();

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

    // 1. アンカーフローを通過（項目が読み込まれるまで待ってから開始する）
    await expect(page.locator("select").first()).toBeEnabled();
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

    // 2.5 媒介プローブ（ソクラテス型深掘り・What-if注入、MVP 2.1 ステップ7・8）の確認。
    // AI同僚の応答後に自動で1手打たれ、状態推定パネルと進行役の発話がログに現れる。
    await expect(page.getByTestId("mediation-state-panel")).toBeVisible();
    await expect(page.getByText("その指摘は業務要件のどの部分から来ていますか？")).toBeVisible();
    await expect(page.getByText("進行役（媒介プローブ）")).toBeVisible();
    await expect(page.getByText(/この推定を踏まえて選んだ手/)).toBeVisible();

    // 3. レビュー完了 ➔ 暫定判断（CFF）へ進む
    await page.getByRole("button", { name: "レビュー完了 ➔ 暫定判断へ進む" }).click();

    // CFF画面の確認
    await expect(page.getByText("CFF: Force Decision First & Mandatory Justification")).toBeVisible();
    await expect(page.getByText("成果物の最終判定と判断理由の言語化")).toBeVisible();

    // 差し戻しを選択
    await page.locator("input[value='remand']").check();
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
    await expect(page.getByTestId("probe-consistency-block")).toBeVisible();
    await expect(page.getByTestId("probe-consistency-block")).toContainText("0.82");
    await expect(page.getByText("評点に対する異議申立・フィードバック")).toBeVisible();

    // 共通アンカー並置提示ブロック [D-60, P-16] の表示確認
    await expect(page.getByTestId("anchor-parallel-report-block")).toBeVisible();
    await expect(page.getByTestId("anchor-parallel-report-block")).toContainText("共通アンカー課題（別の測定量・並置提示）");
    await expect(page.getByTestId("anchor-parallel-report-block")).toContainText("固定刺激（無得点記録・尺度較正用）");
    await expect(page.getByTestId("anchor-parallel-report-block")).toContainText("本プロトタイプでは θ を算出していません");

    // CFF Discrepancy Highlighting の表示確認
    await expect(page.getByTestId("discrepancy-highlighting-block")).toBeVisible();
    await expect(page.getByTestId("prelim-action-display")).toContainText("差し戻し (Remand)");
    await expect(page.getByTestId("matched-flaws-count")).toContainText("1件 (FLAW-01)");
    await expect(page.getByTestId("action-collate-message")).toContainText("受講者の「差し戻し」判断と、AI採点器が抽出した仕込み不備");

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

  test("CFF Discrepancy Highlighting（事前採否判断と抽出された不備指摘の対比）が動作する", async ({ page }) => {
    // 評価APIのレスポンスを評点Band 2に差し替えるモック
    await page.route("**/api/dialogue/evaluate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          ratingId: "mock-rating-diff-001",
          isPendingHumanReview: false,
          ratingCategory: 2,
          levelLabel: "Band 2: 表層的修正・定型指摘",
          scoringConfidence: 0.88,
          confidenceThreshold: 0.7,
          isDemoThresholdOverride: false,
          evidenceSummary: "受講者は基本的な指摘を行ったが、根本的なアーキテクチャ欠陥への追及は部分的であった。",
          diagnosticFeedback: "単一障害点の指摘にとどまらず、フェイルオーバーの具体的な復旧手順まで提案を深めると高評価に繋がります。",
          evidenceComponents: [
            {
              turn_index: 1,
              quoted_span: "Redisの単一障害点について考慮が必要です",
              component_type: "SurfaceVerification",
              injected_flaw_id: "FLAW-02",
              rationale_summary: "単一障害点について言及",
            },
          ],
          scorerModelVersion: "claude-opus-5/extract-v1/score-v1",
        }),
      });
    });

    await page.goto("/");
    await expect(page.locator("select").first()).toBeEnabled();
    await page.getByRole("button", { name: "セッションを開始する（アンカー出題へ）" }).click();
    await page.locator("input[name='q1']").first().check();
    await page.getByRole("button", { name: "設問2へ進む" }).click();
    await page.locator("input[name='q2']").first().check();
    await page.getByRole("button", { name: "確信度評定へ" }).click();
    await page.getByRole("button", { name: /5\s*非常に確信/ }).click();
    await page.getByRole("button", { name: "アンカー回答を送信・記録する" }).click();
    await expect(page.getByText("共通アンカー項目の記録が完了しました")).toBeVisible();
    await page.getByRole("button", { name: "動的対話セッションへ進む" }).click();

    // 1ターン対話
    const promptInput = page.getByPlaceholder(/AI同僚に指示・指摘を入力/);
    await promptInput.fill("Redisの単一障害点について考慮が必要です");
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByText("ご指摘ありがとうございます。Redisのフェイルオーバー時")).toBeVisible();

    // CFF画面へ
    await page.getByRole("button", { name: "レビュー完了 ➔ 暫定判断へ進む" }).click();
    await page.locator("input[value='remand']").check();
    const justificationTextarea = page.getByPlaceholder(/承認または差し戻しと判断した具体的な根拠・理由を記述/);
    await justificationTextarea.fill("高可用性設計とフェイルオーバー要件を提示し、全面的に差し戻したため。");
    await page.getByRole("button", { name: "暫定判断を確定し、AI評価を実行する" }).click();

    // XAIレポート画面での乖離ハイライト確認
    await expect(page.getByTestId("anchor-parallel-report-block")).toBeVisible();
    await expect(page.getByTestId("discrepancy-highlighting-block")).toBeVisible();
    await expect(page.getByTestId("prelim-action-display")).toContainText("差し戻し (Remand)");
    await expect(page.getByTestId("matched-flaws-count")).toContainText("1件 (FLAW-02)");
    await expect(page.getByTestId("action-collate-message")).toContainText("受講者の「差し戻し」判断と、AI採点器が抽出した仕込み不備");
    await expect(page.getByTestId("prelim-justification-display")).toContainText("高可用性設計とフェイルオーバー要件を提示し、全面的に差し戻したため。");
  });

  test("pending_human（評点保留）のデモ用閾値上書きが画面に明示される", async ({ page }) => {
    // 確信度自体は高い（0.85）が、デモ用に閾値を引き上げたため保留になったケース。
    // scoring_confidence は変更していないことが画面上の注記からも分かることを確認する。
    await page.route("**/api/dialogue/evaluate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          ratingId: "mock-rating-pending-001",
          isPendingHumanReview: true,
          ratingCategory: null,
          levelLabel: null,
          scoringConfidence: 0.85,
          confidenceThreshold: 0.99,
          isDemoThresholdOverride: true,
          evidenceSummary: "",
          diagnosticFeedback: "",
          evidenceComponents: [],
          probeConsistency: null,
          scorerModelVersion: "claude-sonnet-4-5/extract-v5/score-v3",
        }),
      });
    });

    await page.goto("/");
    await expect(page.locator("select").first()).toBeEnabled();
    await page.getByRole("button", { name: "セッションを開始する（アンカー出題へ）" }).click();
    await page.locator("input[name='q1']").first().check();
    await page.getByRole("button", { name: "設問2へ進む" }).click();
    await page.locator("input[name='q2']").first().check();
    await page.getByRole("button", { name: "確信度評定へ" }).click();
    await page.getByRole("button", { name: /4\s*やや自信あり/ }).click();
    await page.getByRole("button", { name: "アンカー回答を送信・記録する" }).click();
    await page.getByRole("button", { name: "動的対話セッションへ進む" }).click();

    const promptInput = page.getByPlaceholder(/AI同僚に指示・指摘を入力/);
    await promptInput.fill("Redisの単一障害点について考慮が必要です");
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByText("ご指摘ありがとうございます。Redisのフェイルオーバー時")).toBeVisible();

    await page.getByRole("button", { name: "レビュー完了 ➔ 暫定判断へ進む" }).click();
    await page.locator("input[value='approve']").check();
    const justificationTextarea = page.getByPlaceholder(/承認または差し戻しと判断した具体的な根拠・理由を記述/);
    await justificationTextarea.fill("デモ用の保留経路確認。");
    await page.getByRole("button", { name: "暫定判断を確定し、AI評価を実行する" }).click();

    await expect(page.getByText("評点保留（人間の確認待ち）")).toBeVisible();
    await expect(page.getByText("採点器の確信度が閾値（0.99）を下回ったため（0.85）")).toBeVisible();
    await expect(page.getByTestId("demo-threshold-override-note")).toContainText(
      "採点器が実際に返した確信度（0.85）自体は変更していません"
    );
  });

  test("① 組織・受講管理ダッシュボードの表示と受講者一覧・教育成果・演習遷移が動作する", async ({ page }) => {
    await page.goto("/");

    // 組織・受講管理ダッシュボードタブへの切替
    const dashboardTabBtn = page.getByRole("button", { name: /① 組織.*ダッシュボード/ });
    await expect(dashboardTabBtn).toBeVisible();
    await dashboardTabBtn.click();

    // 画面タイトルとKPIカードの確認
    await expect(page.locator("h1")).toContainText("組織・受講管理ダッシュボード");
    await expect(page.getByText("受検完了エンジニア")).toBeVisible();
    await expect(page.getByText("Band 3.4", { exact: true })).toBeVisible();
    await expect(page.getByText("盲従バイアス克服率")).toBeVisible();

    // 受講者一覧テーブルと教育成果パネルの確認
    await expect(page.getByText("受講者一覧・スキル到達度カルテ")).toBeVisible();
    await expect(page.getByText("佐藤 拓也", { exact: true })).toBeVisible();
    await expect(page.getByText("バイアス克服・教育成果（Before / After）")).toBeVisible();
    await expect(page.getByText("マネージャー向け推奨育成アクション")).toBeVisible();

    // 部門別定着サマリーと助成金CSV出力セクション
    await expect(page.getByText("部門別 運用・定着サマリー（サブ集計）")).toBeVisible();
    await expect(page.getByText("受講履歴・学習時間データ（助成金・社内報告用CSV）")).toBeVisible();

    // CTAボタンによる実務演習セッションへの遷移
    const startCta = page.getByRole("button", { name: "演習セッションを開始" });
    await expect(startCta).toBeVisible();
    await startCta.click();

    // セッションタブに戻り、初期画面が表示されていることを確認
    await expect(page.locator("h1")).toContainText("評価的判断力 動的アセスメント＆テレメトリ基盤");
    await expect(page.getByRole("button", { name: "セッションを開始する（アンカー出題へ）" })).toBeVisible();
  });

  test("② 受講者スキルカルテの表示と4領域・12観点・協働アプローチ特性・演習遷移が動作する", async ({ page }) => {
    await page.goto("/");

    // 受講者スキルカルテタブへの切替
    const profileTabBtn = page.getByRole("button", { name: /② 受講者スキルカルテ/ });
    await expect(profileTabBtn).toBeVisible();
    await profileTabBtn.click();

    // 受講者名とプロフィールヘッダー確認
    await expect(page.locator("h1")).toContainText("佐藤 拓也 さんのスキルカルテ");
    await expect(page.getByText("決済基盤チーム / シニアエンジニア")).toBeVisible();
    await expect(page.getByText("動的コンピテンシー到達度（4領域・12サブ観点）")).toBeVisible();

    // 4領域の到達度判定
    await expect(page.getByText(/① 評価的判断力/).first()).toBeVisible();
    await expect(page.getByText(/② 高次認知/).first()).toBeVisible();

    // AI協働アプローチ特性 ＆ 適正依存バランス
    await expect(page.getByText("AI協働アプローチ特性 ＆ 適正依存バランス")).toBeVisible();
    await expect(page.getByText("特性: 堅牢性重視スタイル（High Resilience）")).toBeVisible();
    await expect(page.getByText("協働活用効率 (CAR)")).toBeVisible();

    // 実務直結チェックリスト
    await expect(page.getByText("実務直結チェックリスト（Tomorrow's Takeaways）")).toBeVisible();

    // 過去セッション履歴テーブル
    await expect(page.getByText("過去セッション演習履歴")).toBeVisible();
    await expect(page.getByText("決済トランザクションの冪等性・障害時キャッシュ")).toBeVisible();

    // 実務演習開始ボタンによる演習セッションへの遷移
    const startExerciseBtn = page.getByRole("button", { name: "実務演習を開始" });
    await expect(startExerciseBtn).toBeVisible();
    await startExerciseBtn.click();

    // セッション画面に戻り、初期画面が表示されていることを確認
    await expect(page.locator("h1")).toContainText("評価的判断力 動的アセスメント＆テレメトリ基盤");
    await expect(page.getByRole("button", { name: "セッションを開始する（アンカー出題へ）" })).toBeVisible();
  });
});


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

    // 前提変化（場面3）は受講者ではなくサーバ側が撃つ。1回目は「まだ撃たない」、
    // 2回目で注入を返し、**発火時点がクライアント操作では動かない**ことを固定する [D-100]。
    let premiseShiftCalls = 0;
    await page.route("**/api/dialogue/premise-shift", async (route) => {
      premiseShiftCalls += 1;
      if (premiseShiftCalls < 2) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            injected: false,
            reason: "trigger_turn_not_reached",
            userTurnCount: 1,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          injected: true,
          injectedAtTurn: 5,
          forced: false,
          shiftId: "shift-fintech-vip-fallback",
          title: "【緊急仕様変更】セール時の最優先（VIP）加盟店フォールバック特例",
          announcement: "【🚨 緊急仕様変更の発生】SREおよび事業部門より緊急告知",
          newRequirement: "VIP加盟店に限り最大30秒の縮退運転を許可すること",
          notification:
            "【⚡ 緊急仕様変更・追加要件の通知】\n【🚨 緊急仕様変更の発生】SREおよび事業部門より緊急告知\n\nこれに伴い、以下の追加要件を満たす必要があります：\n「VIP加盟店に限り最大30秒の縮退運転を許可すること」",
          userTurnCount: 2,
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

  test("初期画面の読み込みと動的課題の選択肢が表示され、5タブナビゲーションが動作する", async ({ page }) => {
    await page.goto("/");

    // 画面タイトル・ヘッダー確認
    await expect(page.locator("h1")).toContainText("動的実務演習セッション");
    await expect(page.getByText("動的コンピテンシー アセスメント＆テレメトリ基盤")).toBeVisible();

    // 5タブナビゲーションの存在確認
    await expect(page.getByRole("button", { name: "実務演習セッション（3ペイン動的対話）" })).toBeVisible();
    await expect(page.getByRole("button", { name: "共通アンカー評価（固定尺度・SCT型）" })).toBeVisible();
    await expect(page.getByRole("button", { name: /① 組織.*ダッシュボード/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /② 受講者スキルカルテ/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /③ エキスパート事後講評/ })).toBeVisible();

    // 動的課題のドロップダウン
    const taskSelect = page.locator("select").first();
    await expect(taskSelect).toBeVisible();
    const taskOptions = taskSelect.locator("option");
    expect(await taskOptions.count()).toBeGreaterThanOrEqual(1);

    // 右カラムのテレメトリパネル
    await expect(page.getByText("Live Telemetry Monitor")).toBeVisible();
    await expect(page.getByText("Connected")).toBeVisible();
  });

  test("同梱サンプルへフォールバックした場合、運用バンクではないことが画面に明示される", async ({ page }) => {
    // 運用バンク（src/data/anchors.v2.json / src/data/anchors.json）を持たない環境＝公開リポジトリのcloneを再現する。
    // サンプル項目（公開デモ用）を運用20項目に見せてはならない（README「主張を増やさない」）。
    await page.route("**/api/anchor?*", async (route) => await route.continue());
    await page.route("**/api/anchor", async (route) => {
      if (route.request().method() !== "GET") return await route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: 2,
          bankSource: "demo_sample_v2",
          anchors: [
            { anchor_id: "ANCHOR-V2-A-01", family: "A", title: "【公開デモ用】検索結果キャッシュの導入", format_version: "v2-sct" },
            { anchor_id: "ANCHOR-V2-B-01", family: "B", title: "【公開デモ用】ストーリーポイントによる相対見積もりの導入", format_version: "v2-sct" },
          ],
        }),
      });
    });

    await page.goto("/?tab=anchor");

    await expect(page.getByTestId("anchor-bank-source-badge")).toHaveText("公開デモ用サンプル");
    await expect(page.getByText("出題する共通アンカー項目（全2項目から選択）")).toBeVisible();
    await expect(
      page.getByText(/運用中の共通アンカー項目バンクは、受検者への事前露出を避けるため公開していません/)
    ).toBeVisible();
    // 3項目のうち1項目は類型C（不備なし）であることを画面が明示する [D-83]
    await expect(page.getByText(/類型C（仕込んだ不備が無い項目）/)).toBeVisible();
  });

  test("アンカー出題 → 4段回答 → 確信度評定 → 送信完了の一連のフローが動作する", async ({ page }) => {
    await page.goto("/?tab=anchor");

    // 出題される項目IDは供給源によって変わるため、ラジオボタンの存在を待つ
    const firstAnchorRadio = page.locator("input[name='anchorItem']").first();
    await expect(firstAnchorRadio).toBeVisible();
    await firstAnchorRadio.check();
    const selectedAnchorId = await firstAnchorRadio.inputValue();
    expect(selectedAnchorId).not.toBe("");

    // アンカー体験開始
    const startButton = page.getByRole("button", { name: "このアンカー項目を体験する（4段階疑似対話を開始）" });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 出題されるのは選択されていた項目である。
    await expect(page.getByText(new RegExp(`共通アンカー項目: ${selectedAnchorId}`))).toBeVisible();

    // 段階1（採用可否）。選択肢に答えを含めない [D-83]
    await expect(page.getByText(/段階 1（全体判断）/)).toBeVisible();
    await page.locator("input[name='stage1']").nth(1).check();
    await page.getByRole("button", { name: "この判断で確定する" }).click();

    // 段階2（懸念領域）。類型C の項目では出題されない
    const stage2Radio = page.locator("input[name='stage2']").first();
    if (await stage2Radio.isVisible().catch(() => false)) {
      await stage2Radio.check();
      await page.getByRole("button", { name: "次へ" }).click();
    }

    // 段階3（前提変化への判断更新）
    await expect(page.getByText(/段階 3（前提変化への判断更新）/)).toBeVisible();
    await expect(page.getByText("新しい情報が入りました")).toBeVisible();
    await page.locator("input[name='stage3']").first().check();
    await page.getByRole("button", { name: "確信度評定へ" }).click();

    // 段階3'（新情報を含まない反論）。付いている項目でだけ現れる [D-83]
    const stage3bRadio = page.locator("input[name='stage3b']").first();
    if (await stage3bRadio.isVisible().catch(() => false)) {
      await expect(page.getByText("AI同僚からの反論")).toBeVisible();
      await stage3bRadio.check();
      await page.getByRole("button", { name: "確信度評定へ" }).click();
    }

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
    // 正誤もパネル分布も受検者へ返さない [D-83]
    await expect(page.getByText("この区間は採点されません。結果も返りません。")).toBeVisible();
    // デュアル導線の確認
    await expect(page.getByRole("button", { name: "別のアンカー項目を試す" })).toBeVisible();
    await expect(page.getByRole("button", { name: "実務演習セッションを体験する" })).toBeVisible();
  });

  /**
   * 分岐は「見えていたら答える」で通してしまうと、サイレントにスキップされても
   * テストが通る。段階3'（新情報を含まない反論）と類型C（段階2を出題しない）は
   * どちらも分岐であり、**出ることと出ないことの両方**を明示的に押さえる [D-83]。
   *
   * 同梱サンプル固有の項目IDを名指しするため、運用バンクが入っている環境では skip する。
   */
  async function selectAnchorOrSkip(page: import("@playwright/test").Page, anchorId: string) {
    const radio = page.locator(`input[name='anchorItem'][value='${anchorId}']`);
    const hasRadio = (await radio.count()) > 0;
    test.skip(!hasRadio, `${anchorId} は同梱サンプル固有の項目。運用バンク環境では検証しない`);
    await radio.check();
  }

  test("段階3'（新情報を含まない反論）が設定された項目では、反論画面が必ず出る", async ({
    page,
  }) => {
    await page.goto("/?tab=anchor");
    await selectAnchorOrSkip(page, "ANCHOR-V2-A-01");
    await page.getByRole("button", { name: "このアンカー項目を体験する（4段階疑似対話を開始）" }).click();

    await expect(page.getByText(/段階 1（全体判断）/)).toBeVisible();
    // 「条件付きで採用してよい」を選ぶ
    await page.locator("input[name='stage1']").nth(1).check();
    await page.getByRole("button", { name: "この判断で確定する" }).click();

    // この項目は類型Cではないので段階2が出る
    await expect(page.getByText(/段階 2（懸念の所在）/)).toBeVisible();
    await page.locator("input[name='stage2']").first().check();
    await page.getByRole("button", { name: "次へ" }).click();

    await expect(page.getByText(/段階 3（前提変化への判断更新）/)).toBeVisible();
    await expect(page.getByText("新しい情報が入りました")).toBeVisible();
    // 「変わらない」(0) を選ぶ
    await page.locator("input[name='stage3']").nth(2).check();
    await page.getByRole("button", { name: "確信度評定へ" }).click();

    // 段階3': 反論画面が確かに出る
    await expect(page.getByText(/段階 4（反論への応答）/)).toBeVisible();
    await expect(page.getByText("AI同僚からの反論")).toBeVisible();
    // 総段数を出していない（出すと段階3' の有無が最初から読めてしまう）
    await expect(page.getByText(/段階 \d+ \/ \d+/)).toHaveCount(0);

    // 段階3と同じ「変わらない」を選ぶ＝差分0＝保持
    await page.locator("input[name='stage3b']").nth(2).check();
    await page.getByRole("button", { name: "確信度評定へ" }).click();

    await expect(page.getByText("確信度の自己評定（5段階）")).toBeVisible();
    await page.getByRole("button", { name: /4\s*やや自信あり/ }).click();
    await page.getByRole("button", { name: "アンカー回答を送信・記録する" }).click();

    await expect(page.getByText("共通アンカー項目の記録が完了しました")).toBeVisible();
    // 設計注記に段階3' の採点方式が出る（受検者向けではなく開発者・審査員向け）
    await expect(page.getByText(/stage3b − stage3/)).toBeVisible();
  });

  test("類型C（仕込んだ不備が無い項目）では段階2を出題せず、段階3' も無い", async ({ page }) => {
    await page.goto("/?tab=anchor");
    await selectAnchorOrSkip(page, "ANCHOR-V2-C-01");
    await page.getByRole("button", { name: "このアンカー項目を体験する（4段階疑似対話を開始）" }).click();

    await expect(page.getByText(/段階 1（全体判断）/)).toBeVisible();
    // 不備が無い項目なので「そのまま採用してよい」が正答にあたる
    await page.locator("input[name='stage1']").first().check();
    await page.getByRole("button", { name: "この判断で確定する" }).click();

    // 段階2は飛ぶ。懸念領域を問うこと自体が「不備がある」というヒントになるため
    await expect(page.getByText(/段階 3（前提変化への判断更新）/)).toBeVisible();
    await expect(page.locator("input[name='stage2']")).toHaveCount(0);

    await page.locator("input[name='stage3']").nth(2).check();
    await page.getByRole("button", { name: "確信度評定へ" }).click();

    // この項目に段階3' は無い。確信度へ直行する
    await expect(page.getByText("確信度の自己評定（5段階）")).toBeVisible();
    await expect(page.locator("input[name='stage3b']")).toHaveCount(0);
  });

  test("動的3ペイン対話（セッション内前提変化含む） → CFF暫定判断 → AutoSCORE採点 → XAIレポート表示の全フローが完走する", async ({ page }) => {
    await page.goto("/");

    // 1. 実務演習セッションを直接開始
    const startSessionBtn = page.getByRole("button", { name: "実務演習セッションを開始する（課題提示へ）" });
    await expect(startSessionBtn).toBeVisible();
    await startSessionBtn.click();

    // 3ペインの表示確認
    await expect(page.getByText("【第1ペイン】開発Issue ＆ チーム情報")).toBeVisible();
    await expect(page.getByText("【第2ペイン】成果物ドラフト")).toBeVisible();
    await expect(page.getByText("【第3ペイン】検証パネル")).toBeVisible();
    await expect(page.getByText("AI同僚との対話・修正指示（マルチターン対話）")).toBeVisible();

    // 検証パネルへコードスパンを追加
    const focusInput = page.getByPlaceholder("検証対象とするコード断片・キーワード");
    await focusInput.fill("redis.get(merchantId)");
    await page.getByRole("button", { name: "検証パネルへ追加" }).click();
    // 見た目のクラス名ではなく testid で掴む（配色はデザイン移行で変わるため。[D-101]）
    await expect(page.getByTestId("focus-item-seq").filter({ hasText: "#1" })).toBeVisible();
    await expect(page.getByText("redis.get(merchantId)")).toBeVisible();

    // 場面3 前提変化：**受講者が発生させるボタンは存在しない** [D-100]
    await expect(page.getByRole("button", { name: /緊急仕様変更を発生させる/ })).toHaveCount(0);

    // AI同僚へメッセージ送信（1回目）
    const promptInput = page.getByPlaceholder(/AI同僚に指示・指摘を入力/);
    await promptInput.fill("Redisの単一障害点について考慮が必要です");
    await page.getByRole("button", { name: "送信" }).click();

    // AI同僚の返答が表示されたことを確認
    await expect(
      page.getByText("ご指摘ありがとうございます。Redisのフェイルオーバー時").first()
    ).toBeVisible();

    // 媒介プローブの確認
    await expect(page.getByTestId("mediation-state-panel")).toBeVisible();
    await expect(page.getByText("その指摘は業務要件のどの部分から来ていますか？")).toBeVisible();
    await expect(page.getByText("進行役（媒介プローブ）")).toBeVisible();
    await expect(page.getByText(/この推定を踏まえて選んだ手/)).toBeVisible();

    // この時点ではまだ前提変化は撃たれていない（サーバ側がしきい値未達と判定した）
    await expect(page.getByText("緊急仕様変更・追加要件が通知されました")).toHaveCount(0);

    // 2回目の発話で、進行役側の判定により前提変化が自動注入される
    await promptInput.fill("フェイルクローズの方針で修正してください。PCI DSS要件を優先します");
    await page.getByRole("button", { name: "送信" }).click();

    await expect(page.getByText("緊急仕様変更・追加要件が通知されました")).toBeVisible();
    await expect(page.getByText(/【⚡ 緊急仕様変更・追加要件の通知】/)).toBeVisible();

    // 2. レビュー完了 ➔ 暫定判断（CFF）へ進む
    await page.getByRole("button", { name: "レビュー完了 ➔ 暫定判断へ進む" }).click();

    // CFF画面の確認
    await expect(page.getByText("CFF: Force Decision First & Mandatory Justification")).toBeVisible();
    await expect(page.getByText("成果物の最終判定と判断理由の言語化")).toBeVisible();

    // 修正要求 (remand) を選択
    await page.locator("input[value='remand']").check();
    // 判断理由を入力
    const justificationTextarea = page.getByPlaceholder(/進行役の要約に補足|承認または.*と判断した具体的な根拠/);
    await justificationTextarea.fill("Redis障害時のフォールバックおよびPCI DSS要件の観点で修正が必要であるため修正要求。");

    // 3. 暫定判断を確定し、AI評価を実行
    await page.getByRole("button", { name: "暫定判断を確定し、AI評価を実行する" }).click();

    // 4. XAIレポート画面の確認
    await expect(page.getByText("AutoSCORE 2段階評価結果（XAIレポート）")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Band 3: 前提摘発・要件検証行動" })).toBeVisible();
    await expect(page.getByText("これは開発中の推定器による「暫定値」です")).toBeVisible();
    await expect(page.getByText("判定根拠（Evidence Summary）")).toBeVisible();
    await expect(page.getByText("形成的診断アドバイス（Diagnostic Feedback）")).toBeVisible();
    await expect(page.getByText("抽出された受講者の検証行動スパン")).toBeVisible();
    await expect(page.getByTestId("probe-consistency-block")).toBeVisible();
    await expect(page.getByTestId("probe-consistency-block")).toContainText("0.82");
    await expect(page.getByText("評点に対する異議申立・フィードバック")).toBeVisible();

    // 動的コンピテンシー4領域サマリーカードの確認
    await expect(page.getByText("動的コンピテンシー 4領域の観測サマリー（提案書準拠）")).toBeVisible();
    await expect(page.getByText("① 評価的判断力")).toBeVisible();
    await expect(page.getByText("② 高次認知・動的思考")).toBeVisible();
    await expect(page.getByText("③ 対話的共創力")).toBeVisible();
    await expect(page.getByText("④ メタ認知・適応力")).toBeVisible();

    // CFF Discrepancy Highlighting の表示確認
    await expect(page.getByTestId("discrepancy-highlighting-block")).toBeVisible();
    await expect(page.getByTestId("prelim-action-display")).toContainText("修正要求 (Request Changes)");
    await expect(page.getByTestId("matched-flaws-count")).toContainText("1件 (FLAW-01)");
    await expect(page.getByTestId("action-collate-message")).toContainText("受講者の「修正要求」判断と、AI採点器が抽出した仕込み不備");

    // 異議申立の入力と送信テスト
    await page.locator("input[value='too_low']").check();
    const disputeTextarea = page.getByPlaceholder(/異議の理由を具体的に記述してください/);
    await disputeTextarea.fill("ターン2での指摘事項がより高精度に反映されるべきと考えます。");
    await page.getByRole("button", { name: "異議を申し立てる（記録）" }).click();

    await expect(page.getByText("異議申立が `score_feedback` テーブルへ記録されました")).toBeVisible();
    await expect(page.getByText("W1〜W5 全フロー縦切り動作完了")).toBeVisible();

    // トップへ戻るボタンの動作確認
    await page.getByRole("button", { name: "← トップへ戻り最初からやり直す" }).click();
    await expect(page.locator("h1")).toContainText("動的実務演習セッション");
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
    const startSessionBtn = page.getByRole("button", { name: "実務演習セッションを開始する（課題提示へ）" });
    await expect(startSessionBtn).toBeVisible();
    await startSessionBtn.click();

    // 1ターン対話
    const promptInput = page.getByPlaceholder(/AI同僚に指示・指摘を入力/);
    await promptInput.fill("Redisの単一障害点について考慮が必要です");
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByText("ご指摘ありがとうございます。Redisのフェイルオーバー時")).toBeVisible();

    // CFF画面へ
    await page.getByRole("button", { name: "レビュー完了 ➔ 暫定判断へ進む" }).click();
    await page.locator("input[value='remand']").check();
    const justificationTextarea = page.getByPlaceholder(/進行役の要約に補足|承認または.*と判断した具体的な根拠/);
    await justificationTextarea.fill("高可用性設計とフェイルオーバー要件を提示し、全面的に修正要求としたため。");
    await page.getByRole("button", { name: "暫定判断を確定し、AI評価を実行する" }).click();

    // XAIレポート画面での乖離ハイライト確認
    await expect(page.getByTestId("discrepancy-highlighting-block")).toBeVisible();
    await expect(page.getByTestId("prelim-action-display")).toContainText("修正要求 (Request Changes)");
    await expect(page.getByTestId("matched-flaws-count")).toContainText("1件 (FLAW-02)");
    await expect(page.getByTestId("action-collate-message")).toContainText("受講者の「修正要求」判断と、AI採点器が抽出した仕込み不備");
    await expect(page.getByTestId("prelim-justification-display")).toContainText("高可用性設計とフェイルオーバー要件を提示し、全面的に修正要求としたため。");
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
    const startSessionBtn = page.getByRole("button", { name: "実務演習セッションを開始する（課題提示へ）" });
    await expect(startSessionBtn).toBeVisible();
    await startSessionBtn.click();

    const promptInput = page.getByPlaceholder(/AI同僚に指示・指摘を入力/);
    await promptInput.fill("Redisの単一障害点について考慮が必要です");
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByText("ご指摘ありがとうございます。Redisのフェイルオーバー時")).toBeVisible();

    await page.getByRole("button", { name: "レビュー完了 ➔ 暫定判断へ進む" }).click();
    await page.locator("input[value='approve']").check();
    const justificationTextarea = page.getByPlaceholder(/進行役の要約に補足|承認または.*と判断した具体的な根拠/);
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
    await expect(page.locator("h1")).toContainText("動的実務演習セッション");
    await expect(page.getByRole("button", { name: "実務演習セッションを開始する（課題提示へ）" })).toBeVisible();
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
    await expect(page.locator("h1")).toContainText("動的実務演習セッション");
    await expect(page.getByRole("button", { name: "実務演習セッションを開始する（課題提示へ）" })).toBeVisible();
  });

  test("③ エキスパート事後講評の表示・トラップ解剖・攻略ルート・観測事実対比・ピン留め・演習遷移が動作する", async ({ page }) => {
    await page.goto("/");

    // エキスパート事後講評タブへの切替
    const debriefingTabBtn = page.getByRole("button", { name: /③ エキスパート事後講評/ });
    await expect(debriefingTabBtn).toBeVisible();
    await debriefingTabBtn.click();

    // 画面ヘッダーと各レイヤーの確認
    await expect(page.locator("h1")).toContainText("シナリオ分析＆エキスパート検証戦略");
    await expect(page.getByText("課題トラップ構造の解剖")).toBeVisible();
    await expect(page.getByText("上位者の攻略ルート分岐図")).toBeVisible();
    await expect(page.getByText("動的コンピテンシー別・上位者アクションと観測事実")).toBeVisible();

    // 攻略ルートの表示確認
    await expect(page.getByText("ルートA").first()).toBeVisible();
    await expect(page.getByText("ルートB").first()).toBeVisible();
    await expect(page.getByText("ルートC").first()).toBeVisible();

    // 動的コンピテンシー別アクションと観測状況の確認
    await expect(page.getByText("評価的判断力").first()).toBeVisible();
    await expect(page.getByText("ログ観測あり").first()).toBeVisible();
    await expect(page.getByText("未観測").first()).toBeVisible();

    // 自律的な「参考になった」ピン留めボタンの動作テスト
    const bookmarkBtn = page.getByRole("button", { name: /参考になった（ピン留めして保存）/ }).first();
    await expect(bookmarkBtn).toBeVisible();
    await bookmarkBtn.click();
    await expect(page.getByText("参考になった（ピン留め中）").first()).toBeVisible();

    // フィルター操作（未観測のみ表示）
    const notObservedFilterBtn = page.getByRole("button", { name: /未観測/ });
    await expect(notObservedFilterBtn).toBeVisible();
    await notObservedFilterBtn.click();

    // 課題の演習開始ボタンを押してセッション画面へ遷移
    const startExerciseBtn = page.getByRole("button", { name: "この課題を解いてみる" });
    await expect(startExerciseBtn).toBeVisible();
    await startExerciseBtn.click();

    // セッションタブに戻ることを確認
    await expect(page.locator("h1")).toContainText("動的実務演習セッション");
    await expect(page.getByRole("button", { name: "実務演習セッションを開始する（課題提示へ）" })).toBeVisible();
  });
});



import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

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
    // 外部LLM APIやDBを不要にするルートモック
    await page.route("**/api/session/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          sessionId: "mock-session-screenshot-001",
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
            "// 修正版コードドラフト（フェイルオーバー機構追加）\nimport { Request, Response } from 'express';\nimport { redisClient } from './redis';\n\nexport async function handlePayment(req: Request, res: Response) {\n  try {\n    // Redisキャッシュ参照（フォールバック付き）\n    const cachedMerchant = await redisClient.get(req.body.merchantId);\n    if (!cachedMerchant) {\n      // DB直接参照フォールバック\n      return await fetchFromPrimaryDb(req.body.merchantId);\n    }\n    return res.json({ status: 'ok', data: cachedMerchant });\n  } catch (err) {\n    // フォールバックと監査ログ出力\n    console.error('Redis failover triggered:', err);\n    return await fetchFromPrimaryDb(req.body.merchantId);\n  }\n}",
        }),
      });
    });

    // probe / blur は未モックのままだと DB へ抜けて例外になる（スクリーンショットが
    // 崩れる原因になるため塞ぐ）。
    // 前提変化は進行役側が撃つ [D-100]。スクリーンショットには注入後の状態（緊急要件バナー）を
    // 写す。**モックしないと dev ビルド限定の手動発火ボタンが提案書用の画像に写り込む。**
    let premiseShiftCalls = 0;
    await page.route("**/api/dialogue/premise-shift", async (route) => {
      premiseShiftCalls += 1;
      if (premiseShiftCalls < 2) {
        // 1発話目では撃たない。深掘りと前提変化バナーの両方を1枚に収めるため
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
          injectedAtTurn: 4,
          forced: false,
          shiftId: "shift-fintech-vip-fallback",
          title: "【緊急仕様変更】セール時の最優先（VIP）加盟店フォールバック特例とレイテンシ要件の厳格化",
          announcement:
            "【🚨 緊急仕様変更の発生】SREおよび事業部門より緊急告知：『来週の大型セールにおいて、特定の大手加盟店（VIP）については決済全停止を避けるため、Redis障害時でもローカルキャッシュによる最大30秒のフォールバックを許容する例外ポリシーが承認されました』",
          newRequirement:
            "4. 【緊急追加要件】VIP加盟店（ヘッダー x-merchant-vip: true）に限り、Redis瞬断・障害時でもローカルインメモリキャッシュによる最大30秒の縮退運転を許可し決済受付を継続すること。",
          notification:
            "【⚡ 緊急仕様変更・追加要件の通知】\n【🚨 緊急仕様変更の発生】SREおよび事業部門より緊急告知：『来週の大型セールにおいて、特定の大手加盟店（VIP）については決済全停止を避けるため、Redis障害時でもローカルキャッシュによる最大30秒のフォールバックを許容する例外ポリシーが承認されました』\n\nこれに伴い、以下の追加要件を満たす必要があります：\n「4. 【緊急追加要件】VIP加盟店（ヘッダー x-merchant-vip: true）に限り、Redis瞬断・障害時でもローカルインメモリキャッシュによる最大30秒の縮退運転を許可し決済受付を継続すること。」\n\n現在の設計やコードで問題がないか、確認と修正方針の指示をお願いします！",
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
          probeText: "その判断の前提（SPOFリスク）を、仕様のどの記述およびコードのどの箇所から導きましたか。",
          stateEstimate: [
            { target: "premise_articulation", status: "partial", basis: "単一障害点への言及はあるが根拠仕様の特定が途上" },
            { target: "tradeoff_reasoning", status: "not_elicited", basis: "可用性と一貫性のトレードオフは未言及" },
            { target: "requirement_grounding", status: "elicited", basis: "PCI DSS要件と耐障害性要件を名指しで引用" },
            { target: "normal_span_discrimination", status: "not_elicited", basis: "正常箇所の弁別は未実施" },
            { target: "robustness_under_changed_premise", status: "not_elicited", basis: "前提変化時の挙動検証は未実施" },
          ],
          selectionRationale: "前提の言語化と要件紐づけをさらに深掘りするため、根拠の文脈を問う手を選択",
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
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route("**/api/dialogue/preliminary-judgement", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          judgementId: "mock-prelim-screenshot-001",
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
          ratingId: "mock-rating-screenshot-001",
          isPendingHumanReview: false,
          ratingCategory: 3,
          levelLabel: "Band 3: 前提摘発・要件検証行動",
          scoringConfidence: 0.88,
          evidenceSummary:
            "受講者はRedis障害時の単一障害点リスクおよびPCI DSS要件との乖離を的確に指摘し、AI同僚に適切な修正指示を出している。また検証パネルを用いて該当コードスパンを明示的に抽出・特定した。",
          diagnosticFeedback:
            "セキュリティ制約と高可用性のトレードオフを意識した優れた検証行動が確認できました。今後は例外発生時の監査ログ追跡性にも着目すると、より高位の評価に到達します。",
          evidenceComponents: [
            {
              turn_index: 2,
              quoted_span: "Redisの単一障害点（SPOF）およびPCI DSS要件に対する耐障害性について考慮が必要です",
              component_type: "FLAW_IDENTIFICATION",
              injected_flaw_id: "FLAW-01",
              rationale_summary: "Redis障害時の耐障害性・単一障害点要件違反を指摘",
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
          feedbackId: "mock-feedback-screenshot-001",
        }),
      });
    });
  });

  test("全STEPのUIスクリーンショットをdocs/screenshots/へ高解像度出力する", async ({ page }) => {
    // 01. 初期画面 (Init Step)
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("動的実務演習セッション（AI同僚協働・レビュー対話）");
    await expect(page.getByText("Live Telemetry Monitor")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "01-init.png"),
      fullPage: true,
    });

    // 02. アンカー出題・段階1（採用可否）[D-83]
    // 共通アンカー評価は独立タブ。出題項目IDは供給源（運用バンク / 同梱サンプル）で
    // 変わるため決め打ちせず、選択済みラジオの value から拾う
    await page.getByRole("button", { name: /共通アンカー評価/ }).click();
    const anchorRadio = page.locator("input[name='anchorItem']:checked");
    await expect(anchorRadio).toBeAttached();
    const selectedAnchorId = await anchorRadio.inputValue();
    await page
      .getByRole("button", { name: "このアンカー項目を体験する（4段階疑似対話を開始）" })
      .click();
    await expect(page.getByText(/段階 1（全体判断）/)).toBeVisible();
    await expect(page.getByText(new RegExp(`共通アンカー項目: ${selectedAnchorId}`))).toBeVisible();
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

    // アンカー送信 ➔ 動的3ペイン対話セッション (Dynamic 3-Pane Dialogue)
    await page.getByRole("button", { name: "アンカー回答を送信・記録する" }).click();
    await expect(page.getByText("共通アンカー項目の記録が完了しました")).toBeVisible();
    await page.getByRole("button", { name: "実務演習セッションを体験する" }).click();

    // 実務演習セッションタブの初期画面から課題提示へ進む
    await page
      .getByRole("button", { name: "実務演習セッションを開始する（課題提示へ）" })
      .click();

    // 3ペインの表示確認
    await expect(page.getByText("【第1ペイン】開発Issue ＆ チーム情報")).toBeVisible();
    await expect(page.getByText("【第2ペイン】成果物ドラフト")).toBeVisible();
    await expect(page.getByText("【第3ペイン】検証パネル")).toBeVisible();

    // 第3ペイン（検証パネル）へアイテムを追加
    const focusInput = page.getByPlaceholder("検証対象とするコード断片・キーワード");
    await focusInput.fill("redis.get(merchantId)");
    await page.getByRole("button", { name: "検証パネルへ追加" }).click();
    await expect(page.locator("span.bg-purple-500\\/20", { hasText: "#1" })).toBeVisible();

    await focusInput.fill("merchant.pci_dss_compliant");
    await page.getByRole("button", { name: "検証パネルへ追加" }).click();
    await expect(page.locator("span.bg-purple-500\\/20", { hasText: "#2" })).toBeVisible();

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

    // 04. 3ペイン対話画面 (3-Pane Dialogue)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "04-dialogue-3pane.png"),
      fullPage: true,
    });

    // 05. CFF暫定判断 (Force Decision First & Mandatory Justification)
    await page.getByRole("button", { name: "レビュー完了 ➔ 暫定判断へ進む" }).click();
    await expect(page.getByText("CFF: Force Decision First & Mandatory Justification")).toBeVisible();
    await page.locator("input[value='remand']").check();
    const justificationTextarea = page.getByPlaceholder(
      /進行役の要約に補足や微調整がある場合のみ入力/
    );
    await justificationTextarea.fill(
      "Redis障害時の単一障害点リスクおよびPCI DSS第3条・第6条の暗号化・監査要件への適合性において重大な懸念が残るため、フォールバック機構とログ出力の拡充を指示し差し戻しと判定する。"
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "05-cff.png"),
      fullPage: true,
    });

    // 06. AutoSCORE 2段階採点結果（XAIレポート）
    await page.getByRole("button", { name: "暫定判断を確定し、AI評価を実行する" }).click();
    await expect(page.getByText("AutoSCORE 2段階評価結果（XAIレポート）")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Band 3: 前提摘発・要件検証行動" })).toBeVisible();
    await expect(page.getByTestId("discrepancy-highlighting-block")).toBeVisible();
    await expect(page.getByText("判定根拠（Evidence Summary）")).toBeVisible();
    await expect(page.getByText("形成的診断アドバイス（Diagnostic Feedback）")).toBeVisible();
    await expect(page.getByText("抽出された受講者の検証行動スパン")).toBeVisible();

    // 異議申立導線の入力
    await page.locator("input[value='too_low']").check();
    const disputeTextarea = page.getByPlaceholder(/異議の理由を具体的に記述してください/);
    await disputeTextarea.fill(
      "ターン2でのPCI DSS要件に対する指摘および検証パネルでのコードスパン抽出行動が、より高位のBand 4基準に該当すると考えます。"
    );

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "06-xai-report.png"),
      fullPage: true,
    });

    // 07. 組織・受講管理ダッシュボード（Viability・モックUI）
    const dashboardTabBtn = page.getByRole("button", { name: /① 組織.*ダッシュボード/ });
    await dashboardTabBtn.click();
    await expect(page.locator("h1")).toContainText("組織・受講管理ダッシュボード");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "07-organization-dashboard.png"),
      fullPage: true,
    });

    // 08. 受講者スキルカルテ（Viability・モックUI）
    const profileTabBtn = page.getByRole("button", { name: /② 受講者スキルカルテ/ });
    await profileTabBtn.click();
    await expect(page.locator("h1")).toContainText("佐藤 拓也 さんのスキルカルテ");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "08-learner-profile.png"),
      fullPage: true,
    });

    // 09. シナリオ分析＆エキスパート事後講評（デブリーフィング）
    const galleryTabBtn = page.getByRole("button", { name: /③ エキスパート事後講評/ });
    await galleryTabBtn.click();
    await expect(page.locator("h1")).toContainText("シナリオ分析＆エキスパート検証戦略");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotsDir, "09-benchmark-gallery.png"),
      fullPage: true,
    });
  });
});

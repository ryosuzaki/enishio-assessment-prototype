import type { Page } from "@playwright/test";

/**
 * 提案書用のスクリーンショット・動画撮影で使う API モック。
 * 外部 LLM API や DB を呼ばずに、演習セッションを最初から最後まで同じ応答で進められる。
 * （固定設問の GET だけは実 DB の同梱サンプルを読む）
 */
export async function installMockApi(page: Page) {
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
          "受講者はRedis障害時の単一障害点リスクおよびPCI DSS要件との乖離を的確に指摘し、該当コードを引用してAI同僚に適切な修正指示を出している。",
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
        // 実採点器の既定値（src/lib/llm.ts の DEFAULT_LLM_MODEL と getScorerModelVersion）に合わせる
        scorerModelVersion: "gpt-5.6-luna/extract-v7/score-v3",
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
}

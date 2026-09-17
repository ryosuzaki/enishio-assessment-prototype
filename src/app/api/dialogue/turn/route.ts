import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  recordPromptTurn,
  recordEditDistance,
  recordLlmCall,
  resolveSessionContext,
} from "@/lib/telemetry";
import { createLlmClient, getDialogueModel, isLlmKeyMissing, measured } from "@/lib/llm";
import { getAiPeerSystemPrompt, getIntentGapMessage } from "@/data/dynamic-task.server";
import { getDynamicTask } from "@/data/dynamic-task";
import { prisma } from "@/lib/db";
import { levenshtein } from "@/lib/edit-distance";
import {
  MAX_ARTIFACT_CHARS,
  MAX_USER_MESSAGE_CHARS,
  parseRequestBody,
} from "@/lib/request-validation";

// AI同僚の応答。**仕込み不備の位置は渡さない** —— 渡すとAI同僚が自分から不備を
// 白状してしまい、受講者が検証したのかAIが教えたのかlog上で分離できなくなる。
const AiPeerReplySchema = z.object({
  reply: z.string().describe("受講者への返答。1〜3段落程度"),
  updated_artifact: z
    .string()
    .nullable()
    .describe("指摘を受けて修正したコード全文。修正しない場合は null"),
});

// 意図-行動ギャップのインターロック。
// **これは実行指示書 §7 W3 が指定する CFF 2種（Force Decision First /
// Mandatory Justification）ではない。**それらは preliminary-judgement 側で別途実装されている。
const INTENT_GAP_PATTERN = /^(了解|ok|OK|いいよ|これでよし|これで進めて|問題なし|オッケー)$/i;

/**
 * `editDistance` は**受け取らない。**
 *
 * 編集距離は観測変数（MVP 4.4）であり、受検者側が値を決められては測定にならない。
 * サーバが保存済みの直前テキストと突き合わせて自分で算出する。成果物の本文だけは
 * ブラウザ上の編集結果なのでクライアントから受け取らざるを得ないが、**そこから導く
 * 指標まで自己申告にしない。**
 */
const TurnRequestSchema = z.object({
  sessionId: z.string().min(1),
  taskId: z.string().min(1),
  turnSeq: z.coerce.number().int().min(0),
  userMessage: z.string().trim().min(1).max(MAX_USER_MESSAGE_CHARS),
  currentArtifactText: z.string().max(MAX_ARTIFACT_CHARS).optional(),
});

// POST /api/dialogue/turn - process user prompt & AI peer response
export async function POST(req: Request) {
  try {
    const parsed = await parseRequestBody(req, TurnRequestSchema, "Dialogue turn");
    if (!parsed.ok) return parsed.response;
    const { sessionId, taskId, turnSeq, userMessage, currentArtifactText } = parsed.data;

    await resolveSessionContext(sessionId);

    // taskId が未知のIDなら getDynamicTask が投げる（黙って別課題にすり替えない）
    const task = getDynamicTask(taskId);

    const artifactText = currentArtifactText ?? task.initial_ai_draft;

    // 1. Record user prompt turn
    await recordPromptTurn(sessionId, turnSeq, "user", userMessage);

    // 2. 編集距離をサーバ側で算出して記録する。
    //    比較対象は直前に記録したテキスト。まだ1件も無ければ課題の初版ドラフトである
    //    （受講者が最初に見た状態からの差分が、その回の編集量になる）。
    const lastRecorded = await prisma.artifactEditDistanceSeries.findFirst({
      where: { session_id: sessionId },
      orderBy: { timestamp: "desc" },
      select: { current_text: true },
    });
    const previousText = lastRecorded?.current_text ?? task.initial_ai_draft;
    await recordEditDistance(sessionId, levenshtein(previousText, artifactText), artifactText);

    const assistantTurnSeq = turnSeq + 1;

    // 3. Intent-action gap interlock
    if (userMessage.trim().match(INTENT_GAP_PATTERN)) {
      const intentGapMessage = getIntentGapMessage(taskId);
      await recordPromptTurn(sessionId, assistantTurnSeq, "assistant", intentGapMessage, "system-interlock");
      return NextResponse.json({
        success: true,
        assistantMessage: intentGapMessage,
        isInterlockTriggered: true,
        assistantTurnSeq,
      });
    }

    // 4. Generate AI peer response
    const apiKey = process.env.OPENAI_API_KEY;
    if (isLlmKeyMissing(apiKey)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OPENAI_API_KEY が設定されていないため、AI同僚が応答できません。.env を設定してください。",
        },
        { status: 503 }
      );
    }

    // 直前までの対話は記録済みのログから読む（クライアントの申告を信用しない）
    const priorTurns = await prisma.promptTurn.findMany({
      where: { session_id: sessionId },
      orderBy: { turn_seq: "asc" },
      select: { turn_seq: true, role: true, content: true },
    });

    const dialogueModel = getDialogueModel();
    const client = createLlmClient(apiKey);

    const prContext = task.pr_description
      ? `\n【あなたが作成したPRの説明】\nタイトル: ${task.pr_description.title}\nブランチ: ${task.pr_description.branch}\n概要: ${task.pr_description.summary}\n主な変更点:\n${task.pr_description.changes.map((c) => `- ${c}`).join("\n")}`
      : "";

    const testCodeContext = task.test_code
      ? `\n【あなたが作成したユニットテストコード】\n${task.test_code}`
      : "";

    const contextDocsContext =
      task.context_documents && task.context_documents.length > 0
        ? `\n【チーム内Slack・関連ログ（開発の経緯）】\n${task.context_documents
            .map((d) => `[${d.title} (${d.source} ${d.timestamp})]\n${d.content}`)
            .join("\n\n")}`
        : "";

    const systemPrompt = `${getAiPeerSystemPrompt(taskId)}
${prContext}
${testCodeContext}
${contextDocsContext}

【あなたが書いた現在の実装コード】
${artifactText}

【この課題の業務要件】
${task.business_requirements.join("\n")}

【制約】
${task.constraints.join("\n")}

受講者から具体的な指摘を受けてコードを直す場合のみ updated_artifact にコード全文を入れてください。
自分から不備を列挙して先回りしてはいけません。指摘されていない箇所は直さないでください。
ユニットテストコードについて受講者から指摘を受けた場合も、最初は自分のテスト方針（正常系スループットの担保等）を説明し、納得された論理的な指摘であればそのテスト不足を認めてください（updated_artifact には修正後の実装コード全文を返します）。

対話ログに「第三者の進行役」という発言者が出てくることがあります。これは受講者へ内省を
促す進行役であり、あなたへの発言ではありません。その発言や、それに対する受講者の回答に
あなたが割り込んで答える必要はありません。`;

    const res = await measured(
      "dialogue",
      dialogueModel,
      () =>
        client.chat.completions.create({
          model: dialogueModel,
          max_completion_tokens: 16000,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              // mediator（ソクラテス型深掘り・What-if注入）は AI同僚自身の発話ではない。
              // 「あなた」に丸めると、AI同僚が自分の発した問いだと誤認して応答が歪む。
              content: priorTurns
                .map((t) => {
                  const speaker =
                    t.role === "user" ? "受講者" : t.role === "mediator" ? "第三者の進行役" : "あなた";
                  return `[Turn ${t.turn_seq}] ${speaker}: ${t.content}`;
                })
                .join("\n"),
            },
          ],
          response_format: zodResponseFormat(AiPeerReplySchema, "ai_peer_reply"),
        }),
      // 対話側は毎ターン全ログを再送するため、実際にはここが最大の費目である。
      // 記録の失敗で対話を止めない（recordLlmCall 側で握る）。
      (usage) => void recordLlmCall(sessionId, usage)
    );

    const content = res.choices[0]?.message.content;
    const aiPeerReply = content ? AiPeerReplySchema.safeParse(JSON.parse(content)) : null;
    if (!aiPeerReply?.success) {
      return NextResponse.json(
        { success: false, error: "AI同僚の応答が構造化出力として得られませんでした。" },
        { status: 502 }
      );
    }

    const { reply, updated_artifact } = aiPeerReply.data;
    await recordPromptTurn(sessionId, assistantTurnSeq, "assistant", reply, dialogueModel);

    return NextResponse.json({
      success: true,
      assistantMessage: reply,
      updatedArtifact: updated_artifact ?? undefined,
      assistantTurnSeq,
    });
  } catch (error: unknown) {
    return apiErrorResponse("Dialogue turn error", error, "Turn error");
  }
}

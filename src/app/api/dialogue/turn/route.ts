import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { recordPromptTurn, recordEditDistance, resolveSessionContext } from "@/lib/telemetry";
import { getAiPeerSystemPrompt, getIntentGapMessage } from "@/data/dynamic-task.server";
import { getDynamicTask } from "@/data/dynamic-task";
import { prisma } from "@/lib/db";

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

// POST /api/dialogue/turn - process user prompt & AI peer response
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, taskId, turnSeq, userMessage, currentArtifactText, editDistance } = body;

    if (!sessionId || !taskId || !userMessage) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
    }
    await resolveSessionContext(sessionId);

    // taskId が未知のIDなら getDynamicTask が投げる（黙って別課題にすり替えない）
    const task = getDynamicTask(taskId);

    const artifactText =
      typeof currentArtifactText === "string" ? currentArtifactText : task.initial_ai_draft;

    // 1. Record user prompt turn
    await recordPromptTurn(sessionId, Number(turnSeq), "user", userMessage);

    // 2. Record artifact edit distance if present
    if (typeof editDistance === "number") {
      await recordEditDistance(sessionId, editDistance, artifactText);
    }

    const assistantTurnSeq = Number(turnSeq) + 1;

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
    if (!apiKey || apiKey === "your-openai-api-key-here") {
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

    const dialogueModel = process.env.DIALOGUE_MODEL || process.env.LLM_MODEL || "gpt-5.6-luna";
    const client = new OpenAI({ apiKey });
    const systemPrompt = `${getAiPeerSystemPrompt(taskId)}

【あなたが書いた現在のコード】
${artifactText}

【この課題の業務要件】
${task.business_requirements.join("\n")}

【制約】
${task.constraints.join("\n")}

受講者から具体的な指摘を受けてコードを直す場合のみ updated_artifact にコード全文を入れてください。
自分から不備を列挙して先回りしてはいけません。指摘されていない箇所は直さないでください。

対話ログに「第三者の進行役」という発言者が出てくることがあります。これは受講者へ内省を
促す進行役であり、あなたへの発言ではありません。その発言や、それに対する受講者の回答に
あなたが割り込んで答える必要はありません。`;

    const res = await client.chat.completions.create({
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
    });

    const content = res.choices[0]?.message.content;
    const parsed = content ? AiPeerReplySchema.safeParse(JSON.parse(content)) : null;
    if (!parsed?.success) {
      return NextResponse.json(
        { success: false, error: "AI同僚の応答が構造化出力として得られませんでした。" },
        { status: 502 }
      );
    }

    const { reply, updated_artifact } = parsed.data;
    await recordPromptTurn(sessionId, assistantTurnSeq, "assistant", reply, dialogueModel);

    return NextResponse.json({
      success: true,
      assistantMessage: reply,
      updatedArtifact: updated_artifact ?? undefined,
      assistantTurnSeq,
    });
  } catch (error: any) {
    console.error("Dialogue turn error:", error);
    return NextResponse.json({ success: false, error: error.message || "Turn error" }, { status: 500 });
  }
}

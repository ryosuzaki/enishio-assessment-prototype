import { NextResponse } from "next/server";
import { recordPreliminaryJudgement, resolveSessionContext } from "@/lib/telemetry";

/**
 * POST /api/dialogue/preliminary-judgement
 *
 * Force Decision First & Mandatory Justification (CFF) [MVP 2.5, 4.4, T-17b]
 * 受講者自身の暫定判断（承認/差し戻し、自己評価点、必須理由記述）を記録する。
 * 空白のみの理由はサーバ側でも厳格に拒否する。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, stepId, action, selfEstimatedScore, justification } = body;

    if (!sessionId || !action || selfEstimatedScore === undefined || justification === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required preliminary judgement fields" },
        { status: 400 }
      );
    }

    if (typeof justification !== "string" || justification.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "理由の記述は必須です（承認・差し戻しのいずれでも省略不可・Mandatory Justification）",
        },
        { status: 400 }
      );
    }

    const scoreNum = Number(selfEstimatedScore);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 5) {
      return NextResponse.json(
        { success: false, error: "自己評価スコアは 0〜5 の範囲で指定してください" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "remand") {
      return NextResponse.json(
        { success: false, error: "判定アクションは 'approve' または 'remand' を指定してください" },
        { status: 400 }
      );
    }

    await resolveSessionContext(sessionId);

    const record = await recordPreliminaryJudgement({
      sessionId,
      stepId: stepId || "step-dynamic-fintech-01",
      action,
      selfEstimatedScore: scoreNum,
      justification: justification.trim(),
    });

    return NextResponse.json({
      success: true,
      judgementId: record.id,
      action: record.action,
      selfEstimatedScore: record.self_estimated_score,
      recordedAt: record.created_at,
    });
  } catch (error: any) {
    console.error("Preliminary judgement recording error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record preliminary judgement" },
      { status: 500 }
    );
  }
}

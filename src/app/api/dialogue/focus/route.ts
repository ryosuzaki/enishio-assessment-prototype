import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { parseRequestBody } from "@/lib/request-validation";
import { recordVerificationFocusSequence, resolveSessionContext } from "@/lib/telemetry";

/**
 * POST /api/dialogue/focus
 *
 * Verification Focus Sequence [MVP 4.4, T-17b]
 * 受講者が成果物のどの箇所を検証対象として選択したかとその順序（focus_seq）を記録する。
 * ※ 採点器へは渡さず、Stage 1 以降のプロセス分析資産として保存する。
 *
 * **ボディは Zod で縛る。**以前はここだけ素通しで、配列かどうかしか見ずに
 * `createMany` へ渡していた。採点へ回らない記録であっても、型の混じった行が入れば
 * 後からプロセス分析に使えなくなる。
 */
const FocusItemSchema = z.object({
  focusSeq: z.number().int().min(0),
  lineStart: z.number().int().min(0).nullable().optional(),
  lineEnd: z.number().int().min(0).nullable().optional(),
  selectedText: z.string().trim().min(1).max(5_000),
  note: z.string().max(2_000).nullable().optional(),
});

const FocusRequestSchema = z.object({
  sessionId: z.string().min(1),
  // 1セッションの検証箇所が200を超えることは実務上ない。上限が無いと際限なく積める。
  focusItems: z.array(FocusItemSchema).max(200),
});

export async function POST(req: Request) {
  try {
    const parsed = await parseRequestBody(req, FocusRequestSchema, "Verification focus sequence");
    if (!parsed.ok) return parsed.response;
    const { sessionId, focusItems } = parsed.data;

    await resolveSessionContext(sessionId);

    const count = await recordVerificationFocusSequence(sessionId, focusItems);

    return NextResponse.json({
      success: true,
      recordedCount: count,
    });
  } catch (error: unknown) {
    return apiErrorResponse(
      "Verification focus sequence recording error",
      error,
      "Failed to record verification focus sequence"
    );
  }
}

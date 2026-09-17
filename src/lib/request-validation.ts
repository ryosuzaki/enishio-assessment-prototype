import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * リクエストボディの検証。
 *
 * **LLM の出力は Zod で縛っているのに、受講者から届くボディは素通しだった。**
 * アセスメントである以上、外から来る値のほうが疑わしい。出力側と同じ道具で同じだけ縛る。
 *
 * ここで長さの上限も置く。上限が無いと (a) 巨大なテキストがそのまま LLM プロンプトへ入って
 * 課金が青天井になり、(b) `prompt_turns` に際限なく積まれる。
 */

/** 受講者の1発言。これを超える長さは実務のレビューコメントではない。 */
export const MAX_USER_MESSAGE_CHARS = 8_000;

/** 成果物コード全文。同梱課題のドラフトは2,000字弱なので十分な余裕がある。 */
export const MAX_ARTIFACT_CHARS = 60_000;

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * ボディを読んでスキーマへ通す。失敗したら 400 の応答を組み立てて返す。
 *
 * **Zod のエラー文をそのままクライアントへ返さない。**内部のフィールド名や構造が
 * そのまま出るうえ、この課題自身が「内部情報をレスポンスへ載せる不備」を受講者に
 * 見抜かせる設問を含んでいる（`src/lib/api-error.ts` と同じ理由）。詳細はサーバログへ。
 */
export async function parseRequestBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
  context: string
): Promise<ParsedBody<z.infer<T>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "リクエストボディが JSON として読めません。" },
        { status: 400 }
      ),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    console.error(`${context}: リクエストボディがスキーマに適合しません:`, parsed.error.message);
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "リクエストの内容が不正です。", invalidRequest: true },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

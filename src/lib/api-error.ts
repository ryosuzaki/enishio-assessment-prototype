import { NextResponse } from "next/server";

/**
 * API の失敗応答。
 *
 * **例外の `message` をそのままクライアントへ返さない。**握り潰さず sanitize する理由は、
 * この課題自身が「内部エラーをレスポンスボディへ載せる不備」を受講者に見抜かせる設問を
 * 含んでいるためである（`src/data/dynamic-task.ts` 類型A）。出題側が同じ不備を踏んでいては
 * 設問が成立しない。加えて Prisma の例外はメッセージにテーブル名・カラム名・接続文字列の
 * 断片を含むことがあり、スタックまで含めれば実装の内部構造がそのまま外へ出る。
 *
 * 受講者へ見せてよいのは、こちらが文面を書いた業務エラー（`ScoringUnavailableError` 等）だけ。
 * 想定外の例外は汎用文へ丸め、原因はサーバログにだけ残す。
 */

/** 文面を自分で書いたエラー。message をそのまま返してよい。 */
const CLIENT_SAFE_ERROR_NAMES = new Set([
  "ScoringUnavailableError",
  "MediationUnavailableError",
]);

export function isClientSafeError(error: unknown): error is Error {
  return error instanceof Error && CLIENT_SAFE_ERROR_NAMES.has(error.name);
}

export function errorMessageFor(error: unknown, fallback: string): string {
  return isClientSafeError(error) ? error.message : fallback;
}

/**
 * 失敗応答を組み立てる。`context` はサーバログの見出しにだけ使う。
 *
 * @param extra ステータス以外に足したいフィールド（`stage` や `scoringUnavailable` 等）
 */
export function apiErrorResponse(
  context: string,
  error: unknown,
  fallback: string,
  init: { status?: number; extra?: Record<string, unknown> } = {}
): NextResponse {
  console.error(`${context}:`, error);
  return NextResponse.json(
    { success: false, error: errorMessageFor(error, fallback), ...(init.extra ?? {}) },
    { status: init.status ?? 500 }
  );
}

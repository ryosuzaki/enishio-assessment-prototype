/** catch した値から表示用の文言を取り出す。サーバ専用の依存を持たない（クライアントからも使う）。 */
export function messageOf(error: unknown, fallback = "不明なエラーが発生しました"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

/** Prisma のエラーコード（P2002 等）を取り出す。該当しなければ undefined。 */
export function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

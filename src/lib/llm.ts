import OpenAI from "openai";

/**
 * LLM クライアントの生成と、呼び出し1回ぶんの使用量の取り出し。
 *
 * # なぜ使用量を測るか
 *
 * `scorer_model_version` を全評点へ残すほど追跡可能性にこだわっておきながら、
 * **1セッションにいくらかかるかを自分のログから答えられなかった。**原価を見積もる場面
 * （申請書の費用計画、公開デモの上限設計）で、毎回推測するはめになる。
 *
 * # なぜタイムアウトとリトライを明示するか
 *
 * 既定任せだと、応答が返らないときにリクエストがぶら下がり続ける。採点は受講者を
 * 待たせる経路なので、待つ上限はこちら側で決める。
 */

/** 1回の呼び出しの上限。採点は受講者を待たせるので無限には待たない。 */
export const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 120_000;

/** SDK 側の自動リトライ回数（429・5xx・接続断が対象）。 */
export const LLM_MAX_RETRIES = Number.isFinite(Number(process.env.LLM_MAX_RETRIES))
  ? Number(process.env.LLM_MAX_RETRIES)
  : 2;

/**
 * 既定モデル。**ここ1箇所だけに置く。**
 * 以前は evaluator / mediator / turn ルート / 検証スクリプトの4箇所に同じ文字列が
 * 散っていた。「モデル非依存に設計してある」と謳うなら、既定値も1箇所でなければならない。
 */
export const DEFAULT_LLM_MODEL = "gpt-5.6-luna";

/** 用途別の環境変数 → `LLM_MODEL` → 既定値、の順で解決する。 */
export function resolveModel(purposeSpecific: string | undefined): string {
  return purposeSpecific || process.env.LLM_MODEL || DEFAULT_LLM_MODEL;
}

/** AI同僚の応答モデル（`DIALOGUE_MODEL`）。 */
export function getDialogueModel(): string {
  return resolveModel(process.env.DIALOGUE_MODEL);
}

export function createLlmClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, timeout: LLM_TIMEOUT_MS, maxRetries: LLM_MAX_RETRIES });
}

/** APIキーが実質未設定か。`.env.example` のプレースホルダも未設定として扱う。 */
export function isLlmKeyMissing(apiKey: string | undefined): apiKey is undefined {
  return !apiKey || apiKey === "your-openai-api-key-here";
}

/** どの用途の呼び出しか。原価をこの単位で割り付ける。 */
export type LlmPurpose = "dialogue" | "probe" | "extract" | "score";

export interface LlmUsage {
  purpose: LlmPurpose;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  /**
   * 推論トークン。`completionTokens` の内数であり、課金上も出力側に含まれる。
   * **別立てで記録する。**見えている出力が短いのに請求が膨らむ原因がここなので、
   * 合算してしまうと「なぜ高いのか」が後から分からなくなる。
   */
  reasoningTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
}

/** SDK のレスポンスから使用量を取り出す。欠けていても呼び出し自体は失敗させない。 */
export function usageFrom(
  res: unknown,
  purpose: LlmPurpose,
  model: string,
  latencyMs: number
): LlmUsage {
  const usage = (res as { usage?: Record<string, unknown> } | null)?.usage;
  const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
  const details = usage?.completion_tokens_details as Record<string, unknown> | undefined;

  return {
    purpose,
    model,
    promptTokens: num(usage?.prompt_tokens),
    completionTokens: num(usage?.completion_tokens),
    reasoningTokens: num(details?.reasoning_tokens),
    totalTokens: num(usage?.total_tokens),
    latencyMs,
  };
}

/** 呼び出しを計測して包む。`onUsage` が無ければ何も記録しない（ライブラリ側はDBを知らない）。 */
export async function measured<T>(
  purpose: LlmPurpose,
  model: string,
  call: () => Promise<T>,
  onUsage?: (usage: LlmUsage) => void
): Promise<T> {
  const startedAt = Date.now();
  const res = await call();
  onUsage?.(usageFrom(res, purpose, model, Date.now() - startedAt));
  return res;
}

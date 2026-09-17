import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { getInjectedFlaws, getRubricHint } from "@/data/dynamic-task.server";
import { getDynamicTask } from "@/data/dynamic-task";
import {
  createLlmClient,
  isLlmKeyMissing,
  measured,
  resolveModel,
  type LlmUsage,
} from "@/lib/llm";

// Stage 1 Schema: Evidence Components Extraction [MVP 2.6, W4]
export const EvidenceComponentSchema = z.object({
  turn_index: z.number(),
  quoted_span: z.string().describe("受講者の発言または指示の該当箇所（XAIハイライトの原材料）"),
  component_type: z.enum([
    "premise_identification",       // 暗黙の前提・トレードオフの言語化
    "flaw_detection",              // 仕込まれた不備の具体的指摘
    "false_positive_critique",     // 正常箇所への過剰指摘（誤認）
    "blind_acceptance",            // AI出力への無批判な受容・追従
    "unclear_instruction",         // 曖昧・具体性のない指示
    "alternative_design_proposal", // 代替アーキテクチャやフォールバック設計の具体的提示（バンド5対応）
  ]),
  grounding: z
    .enum(["none", "asserted", "tied_to_requirement"])
    .describe(
      "受講者の指摘が業務要件・制約・前提に接続されているかの客観的観測事実" +
        "（none: 根拠・接続なし, asserted: 単なる違和感・主張の表明にとどまる, tied_to_requirement: 業務要件やシステム制約・前提条件と具体的に接続されている）"
    ),
  injected_flaw_id: z
    .string()
    .nullable()
    .describe(
      "対応する基準マップ上のID。仕込み不備（is_flaw=true）と正常箇所（is_flaw=false）の" +
        "どちらにも付けること。基準マップのどれにも該当しない一般的な検証行動のみ null。" +
        "正常箇所への過剰指摘（false_positive_critique）には、その正常箇所のIDを必ず入れる" +
        "——入れないと適正依存の指標（MVP 2.3）が算出できない。"
    ),
  rationale_summary: z.string().describe("抽出理由の簡潔な要約"),
});

export const EvidenceExtractionOutputSchema = z.object({
  components: z.array(EvidenceComponentSchema),
  identified_flaws_count: z.number(),
  avoided_false_positives: z
    .boolean()
    .describe(
      "受講者が正常箇所（is_flaw=false）を明示的に正当と判断した場合のみ true。" +
        "正常箇所に一切言及がない場合は判断材料がないため false にすること。"
    ),
  // ソクラテス型深掘り（MVP 2.1 ステップ7）への応答の一貫性（MVP 4.4）。
  // 深掘りが1手も入っていないログでは null を返させる。0 は「一貫していなかった」であり、
  // 「そもそも問うていない」とは別である。
  probe_consistency: z
    .object({
      score: z
        .number()
        .min(0)
        .max(1)
        .nullable()
        .describe(
          "MEDIATOR の問いに対する受講者の応答が、それ以前の自身の発言と整合しているか。" +
            "MEDIATOR の発話が1件も無い場合は必ず null にすること（0 にしない）。"
        ),
      rationale: z.string().describe("そう判断した理由。MEDIATOR の発話が無い場合はその旨を書く"),
    })
    .describe("深掘りへの応答の一貫性。判定材料が無ければ score は null"),
});

export type EvidenceExtractionOutput = z.infer<typeof EvidenceExtractionOutputSchema>;

// Stage 2 Schema: Axis 4 Band Scoring (0..5 Band) [MVP 2.6, W4]
//
// level_label はスキーマに含めない。バンドとラベルを別フィールドで返させると
// rating_category=2 と "Level 5" のような相互矛盾が構造的に起こりうるため、
// ラベルは rating_category から一意に導出する。
export const ScoringOutputSchema = z.object({
  axis_id: z.literal("axis_4"),
  rating_category: z.number().int().min(0).max(5).describe("軸4の能力バンド（0:未達 〜 5:卓越・多角性）"),
  scoring_confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("この判定の確信度。0.7未満は人間の確認へ回されるため、迷う場合は低く申告すること"),
  evidence_summary: z.string().describe("評価の根拠要約。抽出済み根拠に無いことを書かないこと"),
  diagnostic_feedback: z.string().describe("受講者向けの形成的診断アドバイス"),
});

export type ScoringOutput = z.infer<typeof ScoringOutputSchema>;

export const AXIS4_LEVEL_LABELS = [
  "Level 0: 無批判受容 / 判定不能",
  "Level 1: 盲目的追従（AI出力を無検証で承認）",
  "Level 2: 漠然とした違和感（指摘が曖昧・理由不詳）",
  "Level 3: 前提・トレードオフの具体的言語化（不備の正確な摘発）",
  "Level 4: 卓越（多角的な視点・非機能要件と正常箇所の正確な弁別）",
  "Level 5: 指導的検証力（修正コードの提示と長期的ガバナンス評価）",
] as const;

export function levelLabelFor(ratingCategory: number): string {
  return AXIS4_LEVEL_LABELS[ratingCategory] ?? AXIS4_LEVEL_LABELS[0];
}

// モデルID＋プロンプト版の複合文字列（実行指示書 §5）。プロンプトを直したら必ず上げる。
// v3: extractEvidence/computeBandScore を taskId 引数化し、ルーブリックをタスク非依存の
// 一般記述へ書き換えたため v2 から更新（T-06a）。
// 採点モデルの選定設定（設定ファイル / 環境変数から動的取得）
// 最先端水準の性能帯の中から費用対効果（コストパフォーマンス）の高いモデルを選定可能
export function getScorerModel(): string {
  return resolveModel(process.env.EVALUATOR_MODEL);
}

// v5: component_type に alternative_design_proposal を追加し、grounding（none/asserted/tied_to_requirement）を追加してルーブリック各バンドとの観測対応を整備（T-29）。
// v6: 提出されたユニットテスト（task.test_code）の検証漏れ・異常系欠落の指摘を不備検知として評価できるようプロンプトとコンテキストを拡充。
export function getScorerModelVersion(): string {
  return `${getScorerModel()}/extract-v6/score-v3`;
}

// v4: 第1段階に probe_consistency を追加し、injected_flaw_id を正常箇所にも付けさせる
// 仕様へ変更した（MVP 2.3 の適正依存指標の算出に必要）。MEDIATOR ロールの扱いも明記した。
// v5: component_type に alternative_design_proposal を追加し、grounding（none/asserted/tied_to_requirement）を追加してルーブリック各バンドとの観測対応を整備（T-29）。
export const SCORER_MODEL_VERSION = getScorerModelVersion();

// これを下回った判定は rater_type = "pending_human" として記録し、スコアを確定させない（W4-3）
export const HITL_CONFIDENCE_THRESHOLD = 0.7;

/**
 * デモ用の閾値上書き。デモの場で `pending_human` 経路を意図的に実演するためのもの。
 *
 * `scoring_confidence`（モデルの自己申告値）そのものは一切改変しない。変わるのは
 * 「確定させるかどうか」を決める運用パラメータ側だけである。**推測で保留を装う
 * のではない**——第2エージェントが実際に返した確信度は、上書きの有無にかかわらず
 * そのまま `ratings.scoring_confidence` へ記録される。
 *
 * `.env` に `HITL_DEMO_CONFIDENCE_THRESHOLD`（0〜1）を設定したときのみ有効になる。
 * 未設定なら通常どおり `HITL_CONFIDENCE_THRESHOLD`（0.7）を使う。
 */
export function resolveConfidenceThreshold(): { threshold: number; isDemoOverride: boolean } {
  const raw = process.env.HITL_DEMO_CONFIDENCE_THRESHOLD;
  if (!raw) return { threshold: HITL_CONFIDENCE_THRESHOLD, isDemoOverride: false };

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    console.warn(
      `HITL_DEMO_CONFIDENCE_THRESHOLD の値が不正です（0〜1の数値ではありません: "${raw}"）。既定値 ${HITL_CONFIDENCE_THRESHOLD} を使います。`
    );
    return { threshold: HITL_CONFIDENCE_THRESHOLD, isDemoOverride: false };
  }
  return { threshold: parsed, isDemoOverride: true };
}

// const MODEL は getScorerModel() から動的に取得
const MAX_TOKENS = 16000; // 実行指示書 §6.3。低く見積もると途中で切れる

/**
 * 採点が実行できないことを表す。**推測で代替スコアを出してはならない。**
 *
 * キーワード一致等のローカル発見的手法でスコアを埋めると、(a) 単語の出現を検証行動と
 * 誤って測り、(b) LLMが走っていないのに rater_type="llm" のログが残って
 * scorer_model_version による追跡可能性が崩れる。採点しないほうが正確である。
 */
export class ScoringUnavailableError extends Error {
  readonly stage: "extract" | "score";
  constructor(stage: "extract" | "score", message: string) {
    super(message);
    this.name = "ScoringUnavailableError";
    this.stage = stage;
  }
}

function getClient(stage: "extract" | "score"): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (isLlmKeyMissing(apiKey)) {
    throw new ScoringUnavailableError(
      stage,
      "OPENAI_API_KEY が設定されていないため採点できません。.env を設定してください。"
    );
  }
  // タイムアウトとリトライは既定任せにしない（`src/lib/llm.ts`）。採点は受講者を待たせる経路である。
  return createLlmClient(apiKey);
}

/**
 * 構造化出力の取り出し。スキーマ検証に通らなければ ScoringUnavailableError を投げる。
 * ここで握りつぶして推測値を返すと、採点できなかったことが記録に残らなくなる。
 */
function parseStructured<T extends z.ZodTypeAny>(
  content: string | null | undefined,
  schema: T,
  stage: "extract" | "score",
  label: string
): z.infer<T> {
  if (!content) {
    throw new ScoringUnavailableError(stage, `${label}の構造化出力が得られませんでした。`);
  }
  const validated = schema.safeParse(JSON.parse(content));
  if (!validated.success) {
    throw new ScoringUnavailableError(
      stage,
      `${label}の構造化出力がスキーマに適合しませんでした: ${validated.error.message}`
    );
  }
  return validated.data;
}

/**
 * AutoSCORE Stage 1: Extract evidence spans from dialogue and diff
 */
export async function extractEvidence(
  transcript: { turnSeq: number; role: string; content: string }[],
  finalArtifact: string,
  taskId: string,
  onUsage?: (usage: LlmUsage) => void
): Promise<EvidenceExtractionOutput> {
  const client = getClient("extract");
  const injectedFlaws = getInjectedFlaws(taskId);
  const task = getDynamicTask(taskId);

  const promptText = `
あなたは教育心理測定学に基づくアセスメントの「第1段階：根拠抽出パーサー」です。
以下の受講者とAI同僚の対話ログおよび最終成果物を分析し、受講者の【評価的判断・検証行動】に該当するスパンを客観的に抽出してください。

【重要な抽出規則】
- 抽出するのは「受講者が実際に行った判断」だけです。単語が出現しただけの発言（質問・雑談・無関係な数値への言及）を検証行動として抽出してはいけません。
- 「Redisとは何ですか」のような知識を尋ねる発言は検証行動ではありません。
- quoted_span は発言全文ではなく、根拠となる該当箇所だけを切り出してください。
- 実装コードの不備だけでなく、受講者が「ユニットテストコードの検証漏れ・異常系テストの欠落（正常系のみ通過する設計の罠）」を具体的に指摘した場合も、関連する仕込み不備（injected_flaw_id）の flaw_detection または premise_identification として抽出してください。
- avoided_false_positives は、受講者が正常箇所を明示的に「これは妥当だ」と判断した場合のみ true です。言及が無い場合は false です。
- ログには MEDIATOR という役割の発話が混じることがあります。これは受講者の判断を**引き出すための問い**（ソクラテス型深掘り・What-if注入）であり、正解を教えるヒントではありません。**MEDIATOR の発話そのものを受講者の検証行動として抽出してはいけません。**抽出対象はあくまで USER（受講者）の発言です。
- probe_consistency は、MEDIATOR の問いに対する USER の応答が、それ以前の USER 自身の発言と整合しているかの判定です。**MEDIATOR の発話がログに1件も無い場合は score を null にしてください。**

【課題シナリオと仕込み不備の基準マップ】
${JSON.stringify(injectedFlaws, null, 2)}
${task.test_code ? `\n【課題に含まれるユニットテストコード（正常系のみ通過する設計の罠が含まれうる）】\n${task.test_code}\n` : ""}
【対話ログ】
${transcript.map((t) => `[Turn ${t.turnSeq}] ${t.role.toUpperCase()}: ${t.content}`).join("\n")}

【受講者が確定した最終成果物】
${finalArtifact}
`;

  const model = getScorerModel();
  const res = await measured(
    "extract",
    model,
    () =>
      client.chat.completions.create({
        model,
        max_completion_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: promptText }],
        response_format: zodResponseFormat(EvidenceExtractionOutputSchema, "evidence_extraction"),
      }),
    onUsage
  );

  return parseStructured(
    res.choices[0]?.message.content,
    EvidenceExtractionOutputSchema,
    "extract",
    "第1段階（根拠抽出）"
  );
}

/**
 * AutoSCORE Stage 2: Band score based strictly on structured evidence components
 *
 * 入力は第1段階の構造化出力のみ。対話ログの生テキストは渡さない（実行指示書 §6.1-2）。
 */
export async function computeBandScore(
  evidence: EvidenceExtractionOutput,
  taskId: string,
  onUsage?: (usage: LlmUsage) => void
): Promise<ScoringOutput> {
  const client = getClient("score");
  const rubricHint = getRubricHint(taskId);

  const promptText = `
あなたは教育測定学に基づくアセスメントの「第2段階：動的コンピテンシー（評価的判断・適応力）バンド採点器」です。
第1段階で抽出された【構造化根拠データ】のみを入力として、受講者の動的コンピテンシー（前提・トレードオフの可視化力、不備摘発、過剰指摘回避、適応力）を0〜5バンドで厳密に判定してください。

【第1段階の構造化根拠データ】
${JSON.stringify(evidence, null, 2)}

【動的コンピテンシー ルーブリック基準（タスク非依存の一般記述）】
- Level 0: 判定材料が無い（根拠要素が空、または検証行動が1件も抽出されていない）
- Level 1: AIの提案を無批判に受け入れている（blind_acceptance がある）
- Level 2: 不備の存在には気づいているが、理由やトレードオフが言語化できず曖昧（grounding が "asserted" または "none" で止まっている）
- Level 3: 業務要件・制約から生じる前提やトレードオフのリスクを具体的に指摘できている（grounding が "tied_to_requirement" の flaw_detection や premise_identification がある）
- Level 4: 不備を正確に指摘しつつ、正常だが疑わしい箇所を過剰指摘せず**明示的に正当と判断している**（avoided_false_positives が true）
- Level 5: 代替アーキテクチャやフォールバック設計を明確に指示できている（alternative_design_proposal がある）

【この課題固有の着眼点（参考。ルーブリックの判定基準そのものではない）】
${rubricHint}

【厳守事項】
- 抽出された根拠に無い事実を evidence_summary に書いてはいけません。受講者が正常箇所に言及していないなら「正常箇所を正しく弁別した」と書いてはいけません。
- 判定に迷う場合は scoring_confidence を低く申告してください。低確信度の判定は人間の確認へ回されます。推測でバンドを確定させないでください。
`;

  const model = getScorerModel();
  const res = await measured(
    "score",
    model,
    () =>
      client.chat.completions.create({
        model,
        max_completion_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: promptText }],
        response_format: zodResponseFormat(ScoringOutputSchema, "band_scoring"),
      }),
    onUsage
  );

  return parseStructured(
    res.choices[0]?.message.content,
    ScoringOutputSchema,
    "score",
    "第2段階（バンド採点）"
  );
}

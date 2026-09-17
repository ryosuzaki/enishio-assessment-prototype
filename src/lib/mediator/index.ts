/**
 * ソクラテス型深掘り・What-if注入のプローブ選択器（MVP 2.1 ステップ7・8）。
 *
 * ## これが何であって、何でないか
 *
 * **媒介の機能は elicitation（誘出）であって intervention-for-growth ではない** `[D-28]`。
 * 深掘りは教えるためではなく引き出すためにある。成果物だけを見ても受講者が実際に
 * 考えたかは分からず、突っ込んで初めて見える。
 *
 * **仕込み不備へ向かう固定ヒント梯子を作ってはならない。** `[D-28]` は graduated prompt
 * （Interventionist DA の4〜5段階の固定ヒントツリー）を明示的に却下している——
 * 正解が単一に定まらない業務判断では「正解へ向かう梯子」を定義できず、仕込んだ誤りへ
 * 向かう梯子にすれば答え鍵つきのテストになって `[P-08]` に正面から反するからである。
 *
 * **したがって選択器に `injected_flaw_map`（正答鍵）を渡さない。** このモジュールは
 * `dynamic-task.server.ts` を import しない。渡してしまえば、どれだけ問い方を工夫しても
 * 「モデルが知っている正解へ誘導する装置」になる。
 *
 * ## 状態推定が推定しているもの
 *
 * 「正解までの距離」ではない。**動的コンピテンシー ルーブリックが求める根拠のうち、どれがまだ
 * 受講者から引き出せていないか**である。次に打つ手はこの推定に応じて変わる。
 * これが「固定の項目セットを持たず、走行中の状態推定に応じて次に問う内容が変わる」の実体である。
 *
 * ## やってはいけないこと
 *
 * - 深掘りの前後で判断がどれだけ変わったかを得点にしない（`[D-29]` が差分スコアを禁止）。
 *   採点対象は変化量ではなく**採用・棄却の理由の質**である。
 * - ZPD に依拠した表現を画面・ドキュメントへ書かない（`[D-29]` `[P-12]`）。
 * - 受講者を集めて一貫性の分布を測らない（`[P-17]`）。ここは実装であって実験ではない。
 */
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  createLlmClient,
  isLlmKeyMissing,
  measured,
  resolveModel,
  type LlmUsage,
} from "@/lib/llm";

/** 動的コンピテンシーのルーブリックが要求する根拠のカテゴリ。状態推定はこの単位で行う。 */
export const EVIDENCE_TARGETS = [
  "premise_articulation",
  "tradeoff_reasoning",
  "requirement_grounding",
  "normal_span_discrimination",
  "robustness_under_changed_premise",
] as const;

export const EVIDENCE_TARGET_LABELS: Record<(typeof EVIDENCE_TARGETS)[number], string> = {
  premise_articulation: "提案に置かれた暗黙の前提の言語化",
  tradeoff_reasoning: "前提から生じるトレードオフ・リスクの説明",
  requirement_grounding: "指摘を業務要件・制約のどこに紐づけているか",
  normal_span_discrimination: "疑わしく見える箇所を正当と判断できているか",
  robustness_under_changed_premise: "前提が変わったときに判断がどう変わるか",
};

/** 打てる手。`none` は「十分に引き出せているので問わない」を明示的に選ぶための選択肢。 */
export const PROBE_MOVES = [
  "deepen_rationale",
  "trace_grounding",
  "what_if",
  "self_report_gap",
  "scope_refocus",
  "test_scenario_probe",
  "none",
] as const;

export type ProbeMove = (typeof PROBE_MOVES)[number];

export const PROBE_MOVE_LABELS: Record<ProbeMove, string> = {
  deepen_rationale: "深掘り：なぜそう判断したか",
  trace_grounding: "深掘り：その根拠は文脈のどこから来ているか",
  what_if: "What-if 注入：前提が変わったら指摘は変わるか",
  self_report_gap: "自己申告：見落とした観点はあるか",
  scope_refocus: "視座の引き上げ：非機能要件・運用基準の観点で懸念はあるか",
  test_scenario_probe: "異常系の想起：本番障害を防ぐためにどんなテストシナリオを想定すべきか",
  none: "問わない（十分に引き出せている）",
};

export const EvidenceTargetStateSchema = z.object({
  target: z.enum(EVIDENCE_TARGETS),
  status: z
    .enum(["elicited", "partial", "not_elicited"])
    .describe(
      "elicited: 受講者自身の言葉で十分に引き出せている / partial: 触れているが根拠や理由が曖昧 / " +
        "not_elicited: まだ引き出せていない"
    ),
  basis: z.string().describe("そう推定した根拠。受講者の発言のどこを見たか"),
});

export const ProbeSelectionSchema = z.object({
  state_estimate: z
    .array(EvidenceTargetStateSchema)
    .describe("現時点の状態推定。5つの根拠カテゴリすべてについて必ず返すこと"),
  probe_move: z.enum(PROBE_MOVES).describe("この状態推定を踏まえて次に打つ手"),
  probe_text: z
    .string()
    .describe(
      "受講者へ投げる問いの本文。1〜2文。probe_move が none のときは空文字にすること。" +
        "**答えや正解の所在をほのめかしてはならない。**受講者自身の判断を言わせる問いにすること。"
    ),
  selection_rationale: z
    .string()
    .describe("なぜこの手を選んだか。どの根拠カテゴリが未取得だからか、を明示すること（監査用）"),
});

export type ProbeSelection = z.infer<typeof ProbeSelectionSchema>;

// メディエーターモデルの選定設定（設定ファイル / 環境変数から動的取得）
export function getMediatorModel(): string {
  return resolveModel(process.env.MEDIATOR_MODEL);
}

export function getMediatorModelVersion(): string {
  return `${getMediatorModel()}/probe-v2`;
}

// モデルID＋プロンプト版。方針を変えたら必ず上げる。
export const MEDIATOR_MODEL_VERSION = getMediatorModelVersion();
const MAX_TOKENS = 8000;

/** 1セッションあたりの深掘りの上限（MVP 2.1 ステップ7は「3〜4ターン」を必須としている）。 */
export const MAX_PROBES_PER_SESSION = 4;

/**
 * 深掘りを実行できないことを表す。**推測でそれらしい問いを作らない。**
 * ローカルの定型文で代替すると「走行中の状態推定に応じて問いが変わる」が偽になり、
 * mediation_probes に固定文言のログが残って媒介方針の追跡可能性が崩れる。
 */
export class MediationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediationUnavailableError";
  }
}

const SYSTEM_PROMPT = `あなたは業務判断のアセスメントにおける「メディエーター（進行役・技術面接ファシリテーター）」です。
受講者がAI同僚の成果物をレビューしている対話に割り込み、**受講者自身の思考と判断を引き出す問い**を1つだけ投げます。

【あなたの役割の境界（最重要）】
- あなたの目的は**引き出すこと（elicitation）と視座の交通整理（facilitation）**であって、**正解コードを教えること・特定の欠陥箇所を直接指示すること**ではありません。
- あなたはこの成果物にどんな不備があるかを**知りません。** 推測して特定のコード行（「○行目を見ましたか」等）を示唆することは厳禁です。
- あなたが提供してよいのは、「特定の答え」ではなく**「思考のレンズ・視座（非機能要件、異常系テスト、運用背景）」**です。

【打てる手】
- deepen_rationale: 受講者が下した判断について「なぜそう判断したか」を言わせる
- trace_grounding: 「その根拠は業務要件・制約・チーム情報のどこから来ているか」を言わせる
- what_if: 「前提がこう変わったら、その指摘は変わるか」を問う（前提の変更はあなたが具体的に指定する）
- self_report_gap: 「自分が見落としているかもしれない観点は何か」を自己申告させる
- scope_refocus: 受講者がコードスタイルや変数名などの些細な表面上の議論に執着（迷走）している場合、「スタイルの議論は一旦置き、システムの非機能要件（可用性・耐障害性・セキュリティ等）やチーム運用基準の観点で他に気になる点はあるか」と視座を一段引き上げる
- test_scenario_probe: 受講者が正常系のフローしか見ていなかったり、十分に検証しないまま安易にApproveしようとしている場合、「本番リリースで障害を防ぐため、どんな異常系シナリオ（外部サービスのダウン、通信の再送・重複、急激な高負荷など）を検証すべきか」とテスト観点の想起を促す
- none: 5つの根拠カテゴリが十分に引き出せている、または受講者がまだ何も判断を述べていないため問う材料がない

【状態推定】
5つの根拠カテゴリそれぞれについて、受講者自身の言葉でどこまで引き出せているかを推定してください。
**推定は「正解にどれだけ近いか」ではありません。「受講者の判断とその理由がどれだけ言語化されたか」です。**
まだ引き出せていないカテゴリのうち、いま問うのが自然なものを1つ選んで手を決めてください。

【問いの作り方】
- 1〜2文。詰問にしない。受講者の直前の発言や文脈に自然に接続する。
- 答えや特定の行番号を絶対に言わない。
- 受講者がまだ何の判断も述べていない極初期（ターン1で挨拶や確認のみ）では none を選び、問いを投げないでください。無から理由は引き出せません。`;

/**
 * 対話ログの現状から、次に打つ手と状態推定を返す。
 *
 * @param transcript 受講者・AI同僚・過去のメディエーターの全ターン。**正答鍵は渡さない。**
 * @param businessRequirements 受講者にも提示済みの業務要件（画面に出ているもののみ）
 * @param constraints 受講者にも提示済みの制約（画面に出ているもののみ）
 * @param contextDocuments 受講者も閲覧できる共有ドキュメント情報（タイトルと種別のみ）
 * @param probesSoFar これまでに投げた手（同じ手を続けて打たないため）
 */
export async function selectProbe(params: {
  transcript: { turnSeq: number; role: string; content: string }[];
  businessRequirements: string[];
  constraints: string[];
  contextDocuments?: { title: string; type: string }[];
  probesSoFar: ProbeMove[];
  onUsage?: (usage: LlmUsage) => void;
}): Promise<ProbeSelection> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (isLlmKeyMissing(apiKey)) {
    throw new MediationUnavailableError(
      "OPENAI_API_KEY が設定されていないため深掘りを実行できません。.env を設定してください。"
    );
  }

  const client = createLlmClient(apiKey);

  const contextDocsText =
    params.contextDocuments && params.contextDocuments.length > 0
      ? `\n\n【チーム内で共有されている関連ドキュメント（受講者も閲覧可能）】\n` +
        params.contextDocuments.map((d) => `- [${d.type}] ${d.title}`).join("\n")
      : "";

  const promptText = `【受講者にも提示されている業務要件】
${params.businessRequirements.join("\n")}

【受講者にも提示されている制約】
${params.constraints.join("\n")}${contextDocsText}

【これまでの対話】
${params.transcript
  .map((t) => `[Turn ${t.turnSeq}] ${t.role.toUpperCase()}: ${t.content}`)
  .join("\n")}

【これまでに投げた手】
${params.probesSoFar.length > 0 ? params.probesSoFar.join(" → ") : "（まだ1手も投げていない）"}

現時点の状態推定と、次に打つ手を1つ決めてください。同じ手を続けて打たないでください。`;

  const model = getMediatorModel();
  const res = await measured(
    "probe",
    model,
    () =>
      client.chat.completions.create({
        model,
        max_completion_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: promptText },
        ],
        response_format: zodResponseFormat(ProbeSelectionSchema, "probe_selection"),
      }),
    params.onUsage
  );

  const content = res.choices[0]?.message.content;
  if (!content) {
    throw new MediationUnavailableError("プローブ選択の構造化出力が得られませんでした。");
  }
  const validated = ProbeSelectionSchema.safeParse(JSON.parse(content));
  if (!validated.success) {
    throw new MediationUnavailableError(
      `プローブ選択の構造化出力がスキーマに適合しませんでした: ${validated.error.message}`
    );
  }
  return validated.data;
}

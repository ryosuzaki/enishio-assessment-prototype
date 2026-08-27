import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DEMO_DYNAMIC_TASK } from "@/data/dynamic-task";

// Stage 1 Schema: Evidence Components Extraction [MVP 2.6, W4]
export const EvidenceComponentSchema = z.object({
  turn_index: z.number(),
  quoted_span: z.string().describe("受講者の発言または指示の該当箇所（XAIハイライトの原材料）"),
  component_type: z.enum([
    "premise_identification",    // 暗黙の前提・トレードオフの言語化
    "flaw_detection",           // 仕込まれた不備の具体的指摘
    "false_positive_critique",  // 正常箇所への過剰指摘（誤認）
    "blind_acceptance",         // AI出力への無批判な受容・追従
    "unclear_instruction",      // 曖昧・具体性のない指示
  ]),
  injected_flaw_id: z.string().nullable().describe("対応する仕込み不備ID（正常箇所または該当なしはnull）"),
  rationale_summary: z.string().describe("抽出理由の簡潔な要約"),
});

export const EvidenceExtractionOutputSchema = z.object({
  components: z.array(EvidenceComponentSchema),
  identified_flaws_count: z.number(),
  avoided_false_positives: z.boolean(),
});

export type EvidenceExtractionOutput = z.infer<typeof EvidenceExtractionOutputSchema>;

// Stage 2 Schema: Axis 4 Band Scoring (0..5 Band) [MVP 2.6, W4]
export const ScoringOutputSchema = z.object({
  axis_id: z.literal("axis_4"),
  rating_category: z.number().int().min(0).max(5).describe("軸4の能力バンド（0:未達 〜 5:卓越・多角性）"),
  level_label: z.enum([
    "Level 0: 無批判受容 / 判定不能",
    "Level 1: 盲目的追従（AI出力を無検証で承認）",
    "Level 2: 漠然とした違和感（指摘が曖昧・理由不詳）",
    "Level 3: 前提・トレードオフの具体的言語化（不備の正確な摘発）",
    "Level 4: 卓越（多角的な視点・非機能要件と正常箇所の正確な弁別）",
    "Level 5: 指導的検証力（修正コードの提示と長期的ガバナンス評価）",
  ]),
  evidence_summary: z.string().describe("評価の根拠要約"),
  diagnostic_feedback: z.string().describe("受講者向けの形成的診断アドバイス"),
});

export type ScoringOutput = z.infer<typeof ScoringOutputSchema>;

export const SCORER_MODEL_VERSION = "claude-opus-5/extract-v1/score-v1";

/**
 * AutoSCORE Stage 1: Extract evidence spans from dialogue and diff
 */
export async function extractEvidence(
  transcript: { turnSeq: number; role: string; content: string }[],
  finalArtifact: string
): Promise<EvidenceExtractionOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Fallback heuristic parser if API key is not yet set in environment
  if (!apiKey || apiKey === "your-anthropic-api-key-here") {
    return fallbackExtractEvidence(transcript, finalArtifact);
  }

  const client = new Anthropic({ apiKey });

  const promptText = `
あなたは教育心理測定学に基づくアセスメントの「第1段階：根拠抽出パーサー」です。
以下の受講者とAI同僚の対話ログおよび最終成果物を分析し、受講者の【評価的判断・検証行動】に該当するスパンを客観的に抽出してください。

【課題シナリオと仕込み不備の基準マップ】
${JSON.stringify(DEMO_DYNAMIC_TASK.injected_flaws, null, 2)}

【対話ログ】
${transcript.map((t) => `[Turn ${t.turnSeq}] ${t.role.toUpperCase()}: ${t.content}`).join("\n")}

【受講者が確定した最終成果物】
${finalArtifact}
`;

  try {
    const res = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: promptText }],
      output_config: { format: zodOutputFormat(EvidenceExtractionOutputSchema) },
    });

    if (res.parsed_output) {
      return res.parsed_output;
    }
  } catch (error) {
    console.error("LLM Extraction failed, falling back to local extractor:", error);
  }

  return fallbackExtractEvidence(transcript, finalArtifact);
}

/**
 * AutoSCORE Stage 2: Band score based strictly on structured evidence components
 */
export async function computeBandScore(
  evidence: EvidenceExtractionOutput
): Promise<ScoringOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === "your-anthropic-api-key-here") {
    return fallbackComputeScore(evidence);
  }

  const client = new Anthropic({ apiKey });

  const promptText = `
あなたは教育測定学に基づくアセスメントの「第2段階：軸4 バンド採点器」です。
第1段階で抽出された【構造化根拠データ】のみを入力として、受講者の「前提・トレードオフの可視化力（軸4）」を0〜5バンドで厳密に判定してください。

【第1段階の構造化根拠データ】
${JSON.stringify(evidence, null, 2)}

【軸4 ルーブリック基準】
- Level 0〜1: AIの提案を無批判に受け入れる、または指摘が全く見当たらない
- Level 2: 不備の存在には気づいているが、理由やトレードオフが言語化できず曖昧
- Level 3: トークン失効（強制ログアウト）や単一障害点のリスクを具体的に指摘できている
- Level 4: 不備を正確に指摘しつつ、正常箇所（過去キー許容）を過剰指摘せず正当に承認している
- Level 5: 代替アーキテクチャやフォールバック設計を明確に指示できている
`;

  try {
    const res = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: promptText }],
      output_config: { format: zodOutputFormat(ScoringOutputSchema) },
    });

    if (res.parsed_output) {
      return res.parsed_output;
    }
  } catch (error) {
    console.error("LLM Scoring failed, falling back to local scoring:", error);
  }

  return fallbackComputeScore(evidence);
}

/**
 * Deterministic local fallback for Stage 1 evidence extraction
 */
function fallbackExtractEvidence(
  transcript: { turnSeq: number; role: string; content: string }[],
  finalArtifact: string
): EvidenceExtractionOutput {
  const components: z.infer<typeof EvidenceComponentSchema>[] = [];
  const userTurns = transcript.filter((t) => t.role === "user");

  let foundTokenFlaw = false;
  let foundSPOFFlaw = false;
  let attackedValidKey = false;

  userTurns.forEach((t) => {
    const text = t.content;

    // Check token revocation flaw (FLAW-01)
    if (text.includes("トークン") || text.includes("失効") || text.includes("JWT") || text.includes("ログアウト") || text.includes("ブラックリスト") || text.includes("PCI")) {
      foundTokenFlaw = true;
      components.push({
        turn_index: t.turnSeq,
        quoted_span: text,
        component_type: "premise_identification",
        injected_flaw_id: "FLAW-01",
        rationale_summary: "トークン失効チェックのスキップによるセキュリティ前提・結果整合性リスクを指摘",
      });
    }

    // Check Redis SPOF flaw (FLAW-02)
    if (text.includes("Redis") || text.includes("SPOF") || text.includes("単一障害点") || text.includes("500") || text.includes("フォールバック") || text.includes("耐障害")) {
      foundSPOFFlaw = true;
      components.push({
        turn_index: t.turnSeq,
        quoted_span: text,
        component_type: "flaw_detection",
        injected_flaw_id: "FLAW-02",
        rationale_summary: "Redis障害時に決済API全体が500エラーで停止する耐障害性不備を指摘",
      });
    }

    // Check if user incorrectly attacked valid rotation logic (VALID-01)
    if (text.includes("過去2世代") || text.includes("古いキーを許可するな") || text.includes("x-key-version")) {
      attackedValidKey = true;
      components.push({
        turn_index: t.turnSeq,
        quoted_span: text,
        component_type: "false_positive_critique",
        injected_flaw_id: "VALID-01",
        rationale_summary: "鍵ローテーションの正常なフェイルセーフ設計に対する過剰指摘（誤認）",
      });
    }

    // Blind acceptance check
    if (text.match(/^(了解|ok|OK|これで良い|問題なし|進めて)$/)) {
      components.push({
        turn_index: t.turnSeq,
        quoted_span: text,
        component_type: "blind_acceptance",
        injected_flaw_id: null,
        rationale_summary: "AIの出力に対する無批判な承認",
      });
    }
  });

  return {
    components,
    identified_flaws_count: (foundTokenFlaw ? 1 : 0) + (foundSPOFFlaw ? 1 : 0),
    avoided_false_positives: !attackedValidKey,
  };
}

/**
 * Deterministic local fallback for Stage 2 scoring
 */
function fallbackComputeScore(evidence: EvidenceExtractionOutput): ScoringOutput {
  const flaws = evidence.identified_flaws_count;
  const noFalsePositive = evidence.avoided_false_positives;

  if (flaws >= 2 && noFalsePositive) {
    return {
      axis_id: "axis_4",
      rating_category: 4,
      level_label: "Level 4: 卓越（多角的な視点・非機能要件と正常箇所の正確な弁別）",
      evidence_summary: "トークン失効のセキュリティリスクとRedis障害時の可用性リスクの双方を正確に指摘し、正常な鍵ローテーション設計を誤認せずに弁別しました。",
      diagnostic_feedback: "セキュリティと耐障害性のトレードオフをバランス良く看破できています。今後はより具体的なフォールバック実装（インメモリサーキットブレーカー等）の指示を試みてください。",
    };
  } else if (flaws >= 1) {
    return {
      axis_id: "axis_4",
      rating_category: 3,
      level_label: "Level 3: 前提・トレードオフの具体的言語化（不備の正確な摘発）",
      evidence_summary: "AI同僚のコードに含まれる主要なトレードオフ（セキュリティまたは耐障害性）の隠蔽を具体的に指摘できています。",
      diagnostic_feedback: "主要なリスクへの指摘は的確です。システム全体の高可用性（SPOF対策）など、非機能要件の他側面にも目を向けるとさらに評価が高まります。",
    };
  } else if (evidence.components.some((c) => c.component_type === "blind_acceptance")) {
    return {
      axis_id: "axis_4",
      rating_category: 1,
      level_label: "Level 1: 盲目的追従（AI出力を無検証で承認）",
      evidence_summary: "AI同僚のドラフトに含まれる重大なセキュリティ・可用性の不備を検知できず、無批判に承認しました。",
      diagnostic_feedback: "AIの生成コードには、一見動くように見えてもセキュリティや耐障害性の前提が隠蔽されていることがあります。前提条件を疑う習慣をつけましょう。",
    };
  }

  return {
    axis_id: "axis_4",
    rating_category: 2,
    level_label: "Level 2: 漠然とした違和感（指摘が曖昧・理由不詳）",
    evidence_summary: "違和感についての言及は見られますが、具体的なトレードオフや不備の論理的根拠が十分に言語化されていません。",
    diagnostic_feedback: "「なんとなくおかしい」と感じた部分について、「なぜそれが業務要件やセキュリティ基準に反するのか」を言語化して指示を出してみましょう。",
  };
}

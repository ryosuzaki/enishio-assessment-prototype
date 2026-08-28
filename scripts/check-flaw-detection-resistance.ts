// T-06b: 代行無効化チェック（生成課題側・テストA相当：自力想起・OpenAI / Claude / Gemini マルチプロバイダ対応）
//
// 目的: T-06aで新設した動的課題（DYNAMIC_TASKS）の「AI同僚の初版ドラフト」を、
// 正答鍵（injected_flaw_map）を一切与えずに汎用LLM（OpenAI / Claude / Gemini）へ素で投げ、
// 仕込んだ不備を自力で看破できてしまわないか（＝刺激物として簡単すぎないか）を確認する。
//
// このスクリプトは統計量（α・r・κ・ICC・QWK・有意性検定・信頼区間）を一切計算しない。
// 各LLMの指摘一覧と、仕込んだ不備・正常箇所の一覧（正解ラベル付き）を並べて出力するのみ。
// ○×の最終判断は人間が本ファイルの出力を読んで行う。
//
// 実行: npm run check:flaw-detection （内部的には tsx scripts/check-flaw-detection-resistance.ts）

// `.env` を読み込む。Next.js は自動で読むが、tsx で直接起動するスクリプトは読まない。
// これが無いと DATABASE_URL / APIキーを `.env` に書いても "Environment variable not found"
// で落ちる（README の手順どおりに進めた利用者がここで詰まる）。
import "dotenv/config";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DYNAMIC_TASKS, type DynamicTaskScenario } from "../src/data/dynamic-task";
import { getInjectedFlaws, type InjectedFlaw } from "../src/data/dynamic-task.server";

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || "gpt-5.6-luna";
}

function getClaudeModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-opus-5";
}

function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

const MAX_TOKENS = 16000;

// 出力スキーマ: 指摘ごとに該当箇所の引用と指摘内容のみ。正誤判定はスキーマに含めない
// （このスクリプトはデータを揃えるところまでで止め、○×は人間が判定する設計のため）。
const FlawDetectionFindingsSchema = z.object({
  findings: z.array(
    z.object({
      quoted_span: z.string().describe("ドラフト中で問題があると考えた該当コード片の引用"),
      issue: z.string().describe("その箇所についての指摘内容の簡潔な説明"),
    })
  ),
});

type FlawDetectionFindings = z.infer<typeof FlawDetectionFindingsSchema>;

interface ProviderClients {
  openai: OpenAI | null;
  anthropic: Anthropic | null;
  gemini: GoogleGenAI | null;
}

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key] && val) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      console.error(".env の読み込みに失敗しました:", e);
    }
  }
}

function initClients(): ProviderClients {
  loadEnvFile();

  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  const hasOpenAI = !!openaiKey && openaiKey !== "your-openai-api-key-here";
  const hasAnthropic = !!anthropicKey && anthropicKey !== "your-anthropic-api-key-here";
  const hasGemini = !!geminiKey && geminiKey !== "your-gemini-api-key-here" && geminiKey !== "your-google-api-key-here";

  if (!hasOpenAI && !hasAnthropic && !hasGemini) {
    console.error(
      "\n[check:flaw-detection] OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY のいずれも設定されていないため実行できません。\n" +
        "  .env（または環境変数）に少なくとも1つのAPIキーを設定してから再実行してください。\n" +
        "  例: .env.example を参考に .env を作成し、OPENAI_API_KEY=\"sk-...\" を記入する。\n"
    );
    process.exit(1);
  }

  const clients: ProviderClients = {
    openai: hasOpenAI ? new OpenAI({ apiKey: openaiKey }) : null,
    anthropic: hasAnthropic ? new Anthropic({ apiKey: anthropicKey }) : null,
    gemini: hasGemini ? new GoogleGenAI({ apiKey: geminiKey }) : null,
  };

  console.log("[check:flaw-detection] 有効なプロバイダと固定モデル:");
  console.log(`  - OpenAI:             ${clients.openai ? `有効 (固定モデル: ${getOpenAIModel()})` : "未設定（スキップ）"}`);
  console.log(`  - Claude (Anthropic): ${clients.anthropic ? `有効 (固定モデル: ${getClaudeModel()})` : "未設定（スキップ）"}`);
  console.log(`  - Gemini (Google):    ${clients.gemini ? `有効 (固定モデル: ${getGeminiModel()})` : "未設定（スキップ）"}`);
  console.log("");

  return clients;
}

function buildPrompt(task: DynamicTaskScenario): string {
  return `
あなたはソフトウェアエンジニアリングのコードレビュアーです。
以下は、ある開発チームでAI同僚（AIエージェント）が作成したコードのPR（プルリクエスト）初版ドラフトです。
このドラフトに含まれるリスク・問題点を指摘してください。

指摘ごとに、該当箇所の引用（該当コード片。コメントを含めてよい）と、指摘内容を簡潔に述べてください。
問題がないと判断した箇所については無理に指摘を作らないでください。

【シナリオ】
${task.scenario_intro}

【業務要件】
${task.business_requirements.map((r) => `- ${r}`).join("\n")}

【制約】
${task.constraints.map((c) => `- ${c}`).join("\n")}

【AI同僚が作成した初版ドラフト】
\`\`\`
${task.initial_ai_draft}
\`\`\`
`;
}

async function runOpenAITask(
  client: OpenAI,
  task: DynamicTaskScenario
): Promise<FlawDetectionFindings> {
  const model = getOpenAIModel();
  const res = await client.chat.completions.create({
    model: model,
    messages: [{ role: "user", content: buildPrompt(task) }],
    response_format: zodResponseFormat(FlawDetectionFindingsSchema, "flaw_detection_findings"),
  });

  const content = res.choices[0]?.message.content;
  if (!content) {
    throw new Error(`[OpenAI / ${task.task_id}] 構造化出力が得られませんでした（content が空）。`);
  }
  const parsed = JSON.parse(content);
  const validated = FlawDetectionFindingsSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `[OpenAI / ${task.task_id}] スキーマ検証に失敗しました: ${validated.error.message}`
    );
  }
  return validated.data;
}

async function runClaudeTask(
  client: Anthropic,
  task: DynamicTaskScenario
): Promise<FlawDetectionFindings> {
  const model = getClaudeModel();
  const res = await client.messages.parse({
    model: model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: buildPrompt(task) }],
    output_config: { format: zodOutputFormat(FlawDetectionFindingsSchema) },
  });

  if (!res.parsed_output) {
    throw new Error(`[Claude / ${task.task_id}] 構造化出力が得られませんでした（parsed_output が空）。`);
  }
  return res.parsed_output;
}

async function runGeminiTask(
  client: GoogleGenAI,
  task: DynamicTaskScenario
): Promise<FlawDetectionFindings> {
  const model = getGeminiModel();
  const response = await client.models.generateContent({
    model: model,
    contents: buildPrompt(task),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          findings: {
            type: Type.ARRAY,
            description: "ドラフト中で問題があると考えた該当コード片の引用と指摘内容の一覧",
            items: {
              type: Type.OBJECT,
              properties: {
                quoted_span: {
                  type: Type.STRING,
                  description: "ドラフト中で問題があると考えた該当コード片の引用",
                },
                issue: {
                  type: Type.STRING,
                  description: "その箇所についての指摘内容の簡潔な説明",
                },
              },
              required: ["quoted_span", "issue"],
            },
          },
        },
        required: ["findings"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error(`[Gemini / ${task.task_id}] 構造化出力テキストが得られませんでした。`);
  }
  const parsed = JSON.parse(text);
  const validated = FlawDetectionFindingsSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `[Gemini / ${task.task_id}] スキーマ検証に失敗しました: ${validated.error.message}`
    );
  }
  return validated.data;
}

async function runProvider(
  providerName: "openai" | "claude" | "gemini",
  clients: ProviderClients,
  task: DynamicTaskScenario
): Promise<FlawDetectionFindings | null> {
  try {
    if (providerName === "openai") {
      if (!clients.openai) return null;
      return await runOpenAITask(clients.openai, task);
    } else if (providerName === "claude") {
      if (!clients.anthropic) return null;
      return await runClaudeTask(clients.anthropic, task);
    } else {
      if (!clients.gemini) return null;
      return await runGeminiTask(clients.gemini, task);
    }
  } catch (e: any) {
    console.warn(`  - [${providerName}] 呼び出し中にエラーが発生したためスキップします: ${e.message}`);
    return null;
  }
}

function renderFindingsTable(findings: FlawDetectionFindings | null, providerLabel: string): string {
  const lines: string[] = [];
  lines.push(`#### ${providerLabel}`);
  lines.push("");

  if (findings === null) {
    lines.push("（APIキー未設定のためスキップ）");
  } else if (findings.findings.length === 0) {
    lines.push("（指摘なし）");
  } else {
    lines.push("| # | 引用箇所（quoted_span） | 指摘内容（issue） |");
    lines.push("|---|---|---|");
    findings.findings.forEach((f, i) => {
      const span = f.quoted_span.replace(/\|/g, "\\|").replace(/\n/g, " ");
      const issue = f.issue.replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| ${i + 1} | ${span} | ${issue} |`);
    });
  }
  lines.push("");
  return lines.join("\n");
}

function renderTaskSection(
  task: DynamicTaskScenario,
  openaiFindings: FlawDetectionFindings | null,
  claudeFindings: FlawDetectionFindings | null,
  geminiFindings: FlawDetectionFindings | null,
  injectedFlaws: InjectedFlaw[]
): string {
  const lines: string[] = [];

  lines.push(`## ${task.task_id}: ${task.title}`);
  lines.push("");
  lines.push(`- ドメイン: ${task.domain}`);
  lines.push("");

  lines.push("### LLM（汎用・正答鍵なし）の指摘一覧");
  lines.push("");
  lines.push(renderFindingsTable(openaiFindings, `OpenAI系 (${getOpenAIModel()})`));
  lines.push(renderFindingsTable(claudeFindings, `Claude系 (${getClaudeModel()})`));
  lines.push(renderFindingsTable(geminiFindings, `Gemini系 (${getGeminiModel()})`));

  lines.push("### 仕込んだ不備・正常箇所の一覧（正解ラベル付き・正答鍵）");
  lines.push("");
  lines.push("| flaw_id | 種別 | is_flaw | タイトル | span_text | 説明 |");
  lines.push("|---|---|---|---|---|---|");
  injectedFlaws.forEach((flaw) => {
    const title = flaw.title.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const span = flaw.span_text.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const desc = flaw.description.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(
      `| ${flaw.flaw_id} | ${flaw.flaw_type} | ${flaw.is_flaw ? "○（不備）" : "×（正常・要承認）"} | ${title} | ${span} | ${desc} |`
    );
  });
  lines.push("");

  lines.push(
    "### 判定欄（人間が記入。LLMの指摘一覧の各行が、上表のどのflaw_idに対応するか・看破できていたかを目視で判定する）"
  );
  lines.push("");
  lines.push("| flaw_id | OpenAI看破 (○/×/一部) | Claude看破 (○/×/一部) | Gemini看破 (○/×/一部) | 備考 |");
  lines.push("|---|---|---|---|---|");
  injectedFlaws.forEach((flaw) => {
    lines.push(`| ${flaw.flaw_id} |  |  |  |  |`);
  });
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const clients = initClients();

  const header = `# 代行無効化チェック結果（T-06b・生成課題側・テストA相当：自力想起・マルチプロバイダ実測）

**本ファイルは自動生成されたドラフトであり、○×判定・結論の記述は人間が行うこと。**

- 実行日時: ${new Date().toISOString()}
- 対象モデル:
  - OpenAI: ${getOpenAIModel()}
  - Claude: ${getClaudeModel()}
  - Gemini: ${getGeminiModel()}
- 手順: DYNAMIC_TASKS の各タスクについて、scenario_intro / business_requirements / constraints /
  initial_ai_draft のみ（受講者が最初に見る情報と同一）を各LLM（正答鍵なし・素の状態）に渡し、
  「このコードドラフトに含まれるリスク・問題点」を構造化出力で指摘させた。
- 本ファイルは統計量（α・r・κ・ICC・QWK・有意性検定・信頼区間）を一切含まない。
  各LLMの指摘一覧と、仕込んだ不備・正常箇所の一覧（正解ラベル付き）を並べて出力するのみであり、
  自動的な文字列一致による自動○×判定も行っていない。各タスク末尾の「判定欄」に人間が目視で
  ○×・備考を記入すること。
- 判定の目安（T-16のテストAに準拠）: LLMが正答鍵なしで仕込んだ不備の大半を素で言い当てて
  しまう場合、その課題は代行（AIに丸投げして正解だけ引き写す行為）に対して脆弱である可能性が
  高く、刺激物の見直しを検討する。

---

`;

  const sections: string[] = [];

  for (const task of DYNAMIC_TASKS) {
    console.log(`[check:flaw-detection] 実行中: ${task.task_id} ...`);
    const injectedFlaws = getInjectedFlaws(task.task_id);

    let openaiFindings: FlawDetectionFindings | null = null;
    let claudeFindings: FlawDetectionFindings | null = null;
    let geminiFindings: FlawDetectionFindings | null = null;

    if (clients.openai) {
      console.log(`  - OpenAI (${getOpenAIModel()}) 呼び出し中...`);
      openaiFindings = await runProvider("openai", clients, task);
      console.log(`  - OpenAI 完了（指摘件数: ${openaiFindings?.findings.length ?? 0}）`);
    }

    if (clients.anthropic) {
      console.log(`  - Claude (${getClaudeModel()}) 呼び出し中...`);
      claudeFindings = await runProvider("claude", clients, task);
      console.log(`  - Claude 完了（指摘件数: ${claudeFindings?.findings.length ?? 0}）`);
    }

    if (clients.gemini) {
      console.log(`  - Gemini (${getGeminiModel()}) 呼び出し中...`);
      geminiFindings = await runProvider("gemini", clients, task);
      console.log(`  - Gemini 完了（指摘件数: ${geminiFindings?.findings.length ?? 0}）`);
    }

    sections.push(renderTaskSection(task, openaiFindings, claudeFindings, geminiFindings, injectedFlaws));
  }

  const outputDir = path.resolve(process.cwd(), "scripts/output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "代行無効化チェック結果_T-06b_draft.md");
  const content = header + sections.join("\n---\n\n");
  fs.writeFileSync(outputPath, content, "utf-8");

  console.log(`\n[check:flaw-detection] 出力完了: ${outputPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// T-06b: 代行無効化チェック（生成課題側・テストA相当：自力想起）
//
// 目的: T-06aで新設した動的課題（DYNAMIC_TASKS）の「AI同僚の初版ドラフト」を、
// 正答鍵（injected_flaw_map）を一切与えずに汎用LLMへ素で投げ、仕込んだ不備を
// 自力で看破できてしまわないか（＝刺激物として簡単すぎないか）を確認する。
//
// このスクリプトは統計量（α・r・κ・ICC・QWK・有意性検定・信頼区間）を一切計算しない。
// LLMの指摘一覧と、仕込んだ不備・正常箇所の一覧（正解ラベル付き）を並べて出力するのみ。
// ○×の最終判断は人間が本ファイルの出力を読んで行う。
//
// 実行: npm run check:flaw-detection （内部的には tsx scripts/check-flaw-detection-resistance.ts）

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DYNAMIC_TASKS, type DynamicTaskScenario } from "../src/data/dynamic-task";
import { getInjectedFlaws, type InjectedFlaw } from "../src/data/dynamic-task.server";

const MODEL = "claude-opus-5";
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

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-anthropic-api-key-here") {
    console.error(
      "\n[check:flaw-detection] ANTHROPIC_API_KEY が設定されていないため実行できません。\n" +
        "  .env（または環境変数）に ANTHROPIC_API_KEY を設定してから再実行してください。\n" +
        "  例: .env.example を参考に .env を作成し、ANTHROPIC_API_KEY=\"sk-ant-...\" を記入する。\n"
    );
    process.exit(1);
  }
  return new Anthropic({ apiKey });
}

function buildPrompt(task: DynamicTaskScenario): string {
  return `
あなたはソフトウェアエンジニアリングのコードレビュアーです。
以下は、ある開発チームでAI同僚（AIエージェント）が作成したコードのPR（プルリクエスト）初版ドラフットです。
このドラフットに含まれるリスク・問題点を指摘してください。

指摘ごとに、該当箇所の引用（該当コード片。コメントを含めてよい）と、指摘内容を簡潔に述べてください。
問題がないと判断した箇所については無理に指摘を作らないでください。

【シナリオ】
${task.scenario_intro}

【業務要件】
${task.business_requirements.map((r) => `- ${r}`).join("\n")}

【制約】
${task.constraints.map((c) => `- ${c}`).join("\n")}

【AI同僚が作成した初版ドラフット】
\`\`\`
${task.initial_ai_draft}
\`\`\`
`;
}

async function runOneTask(
  client: Anthropic,
  task: DynamicTaskScenario
): Promise<FlawDetectionFindings> {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: buildPrompt(task) }],
    output_config: { format: zodOutputFormat(FlawDetectionFindingsSchema) },
  });

  if (!res.parsed_output) {
    throw new Error(`[${task.task_id}] 構造化出力が得られませんでした（parsed_output が空）。`);
  }
  return res.parsed_output;
}

function renderTaskSection(
  task: DynamicTaskScenario,
  findings: FlawDetectionFindings,
  injectedFlaws: InjectedFlaw[]
): string {
  const lines: string[] = [];

  lines.push(`## ${task.task_id}: ${task.title}`);
  lines.push("");
  lines.push(`- ドメイン: ${task.domain}`);
  lines.push("");

  lines.push("### LLM（汎用・正答鍵なし）の指摘一覧");
  lines.push("");
  if (findings.findings.length === 0) {
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
  lines.push("| flaw_id | LLMは看破できたか（○/×/一部） | 備考 |");
  lines.push("|---|---|---|");
  injectedFlaws.forEach((flaw) => {
    lines.push(`| ${flaw.flaw_id} |  |  |`);
  });
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const client = getClient();

  const header = `# 代行無効化チェック結果（T-06b・生成課題側・テストA相当：自力想起）

**本ファイルは自動生成されたドラフトであり、○×判定・結論の記述は人間が行うこと。**

- 実行日時: ${new Date().toISOString()}
- 手順: DYNAMIC_TASKS の各タスクについて、scenario_intro / business_requirements / constraints /
  initial_ai_draft のみ（受講者が最初に見る情報と同一）を汎用LLM（正答鍵なし・素の状態）に渡し、
  「このコードドラフットに含まれるリスク・問題点」を自由記述で指摘させた。
- 本ファイルは統計量（α・r・κ・ICC・QWK・有意性検定・信頼区間）を一切含まない。
  LLMの指摘一覧と、仕込んだ不備・正常箇所の一覧（正解ラベル付き）を並べて出力するのみであり、
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
    const findings = await runOneTask(client, task);
    console.log(`[check:flaw-detection] 完了: ${task.task_id}（LLM指摘件数: ${findings.findings.length}）`);
    sections.push(renderTaskSection(task, findings, injectedFlaws));
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

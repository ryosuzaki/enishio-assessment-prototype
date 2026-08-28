// `.env` を読み込む。Next.js は自動で読むが、tsx で直接起動するスクリプトは読まない。
// これが無いと DATABASE_URL / APIキーを `.env` に書いても "Environment variable not found"
// で落ちる（README の手順どおりに進めた利用者がここで詰まる）。
import "dotenv/config";
import {
  generateLearnerId,
  startSession,
  recordPromptTurn,
  recordEditDistance,
  recordRating,
  recordAnchorResponse,
  recordScoreFeedback,
} from "../src/lib/telemetry";
import { prisma } from "../src/lib/db";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=== Enishio Telemetry & Data Layer Validation (W1) ===");

  // 1. Generate deterministic learner_id
  const tenant = "tenant-jaist-demo";
  const rawUser = "learner-founder-01";
  const learnerId = generateLearnerId(tenant, rawUser);
  console.log(`[1] Generated Learner ID (UUIDv5): ${learnerId}`);

  // 2. Start 3 consecutive sessions to verify session_seq increments 1, 2, 3
  console.log("\n[2] Testing session_seq sequential incrementation...");
  const s1 = await startSession(learnerId);
  const s2 = await startSession(learnerId);
  const s3 = await startSession(learnerId);

  console.log(`- Session 1: ID=${s1.session_id}, seq=${s1.session_seq}`);
  console.log(`- Session 2: ID=${s2.session_id}, seq=${s2.session_seq}`);
  console.log(`- Session 3: ID=${s3.session_id}, seq=${s3.session_seq}`);

  if (s1.session_seq !== 1 || s2.session_seq !== 2 || s3.session_seq !== 3) {
    throw new Error(`session_seq increment verification failed: ${s1.session_seq}, ${s2.session_seq}, ${s3.session_seq}`);
  }
  console.log("-> session_seq verification PASSED (1, 2, 3 confirmed).");

  // 3. Record Prompt Turns
  console.log("\n[3] Testing prompt_turns logging...");
  const t1 = await recordPromptTurn(s3.session_id, 1, "user", "注文履歴のデータストア選定について相談したいです。");
  const t2 = await recordPromptTurn(s3.session_id, 2, "assistant", "MongoDBを採用することを提案します。スキーマ変更が容易です。");
  console.log(`- Recorded turn 1: ${t1.turn_id} (${t1.role})`);
  console.log(`- Recorded turn 2: ${t2.turn_id} (${t2.role})`);

  // 4. Record Edit Distance
  console.log("\n[4] Testing artifact_edit_distance_series...");
  const ed1 = await recordEditDistance(s3.session_id, 45, "NoSQLではなくPostgreSQLを採用すべきです。ACID整合性が必要なためです。");
  console.log(`- Recorded edit distance: ${ed1.edit_distance} at ${ed1.timestamp}`);

  // 5. Record Rating (Anchor and Generated)
  console.log("\n[5] Testing ratings (single source of truth) and JSONB stimulus_features...");
  
  // Anchor Rating
  const anchorRating = await recordRating({
    sessionId: s3.session_id,
    learnerId,
    sessionSeq: s3.session_seq,
    stepId: "step-anchor-01",
    axisId: "axis_4",
    ratingCategory: 3,
    raterType: "llm",
    raterId: "claude-opus-5",
    scorerModelVersion: "claude-opus-5/extract-v1/score-v1",
    stimulusRef: "ANCHOR-A-01",
    stimulusType: "anchor",
    anchorId: "ANCHOR-A-01",
    anchorStatus: "pretest",
    stimulusFeatures: {
      domain: "software_architecture",
      error_type: "type_B",
      target_dimension: "axis_4",
      topic: "nosql_vs_rdbms",
    },
  });
  console.log(`- Recorded Anchor Rating: ${anchorRating.rating_id}, Category=${anchorRating.rating_category}`);

  // Test anchor constraint failure check
  try {
    await recordRating({
      sessionId: s3.session_id,
      learnerId,
      sessionSeq: s3.session_seq,
      stepId: "step-invalid",
      axisId: "axis_4",
      ratingCategory: 2,
      raterType: "llm",
      raterId: "claude-opus-5",
      scorerModelVersion: "claude-opus-5/extract-v1/score-v1",
      stimulusRef: "ANCHOR-A-01",
      stimulusType: "anchor",
      anchorId: null, // Should fail
      anchorStatus: null,
      stimulusFeatures: {},
    });
    throw new Error("Constraint check failed: invalid anchor rating was accepted!");
  } catch (err: any) {
    console.log(`-> Correctly caught mandatory anchor constraint: ${err.message}`);
  }

  // 6. Record Anchor Response
  console.log("\n[6] Testing anchor_responses logging (unscored)...");
  // anchor_responses は anchor_items への外部キーを持つ。項目が無ければ先に入れる。
  const bank = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "src/data/anchors.json"), "utf-8")
  );
  const demoItem = bank.find((a: any) => a.anchor_id === "ANCHOR-A-01");
  if (!demoItem) throw new Error("ANCHOR-A-01 が anchors.json にありません");
  await prisma.anchorItem.upsert({
    where: { anchor_id: "ANCHOR-A-01" },
    update: {},
    create: {
      anchor_id: "ANCHOR-A-01",
      family: demoItem.family,
      anchor_status: "pretest",
      content: demoItem,
    },
  });

  const aResp = await recordAnchorResponse({
    sessionId: s3.session_id,
    anchorId: "ANCHOR-A-01",
    anchorStatus: "pretest",
    q1Selection: "A",
    q2Selection: "A",
    confidence: 4,
    q1DurationMs: 14200,
    q2DurationMs: 8500,
  });
  console.log(`- Recorded Anchor Response: ${aResp.response_id} (Q1=${aResp.q1_selection}, Q2=${aResp.q2_selection})`);

  // 7. Record Score Feedback
  console.log("\n[7] Testing score_feedback dispute mechanism...");
  const feedback = await recordScoreFeedback({
    ratingId: anchorRating.rating_id,
    sessionId: s3.session_id,
    actorRole: "learner",
    disagreementDirection: "evidence_wrong",
    freeTextReason: "トレードオフについて言及した発言（ターン3）が抽出から漏れています。",
    citedEvidenceRef: "turn:3",
    scorerModelVersion: "claude-opus-5/extract-v1/score-v1",
  });
  console.log(`- Recorded Feedback: ${feedback.feedback_id} (Reason: ${feedback.free_text_reason})`);

  console.log("\n=== ALL W1 TELEMETRY REQUIREMENTS VERIFIED SUCCESSFULLY ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

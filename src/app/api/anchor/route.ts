import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { recordAnchorResponse, resolveSessionContext } from "@/lib/telemetry";
import { prisma } from "@/lib/db";

interface AnchorOption {
  key: string;
  text: string;
  note?: string;
}

interface AnchorRecord {
  anchor_id: string;
  family: string;
  anchor_status?: string;
  title: string;
  metadata: string;
  intro: string;
  proposal: string;
  hidden_premise?: string;
  cheat_notes?: string;
  distractor_notes?: string;
  confidence_scale?: string;
  q1: { question: string; options: AnchorOption[] };
  q2: { question: string; options: AnchorOption[] };
}

/**
 * アンカー項目バンクを実行時に読む。
 *
 * **`src/data/anchors.json` はこのリポジトリに含まれない**（.gitignore）。
 * 20項目の本文と設計意図は運用中の項目バンクそのものであり、公開すると受検者が
 * 事前に読めてしまう（項目露出。MVP 2.6.2 が監視指標に据えているリスク）。
 * 生成は `npm run parse:anchors`（隣の enishio-education リポジトリの Markdown から）。
 *
 * 静的 import にすると、ファイルが無いだけでビルドが落ちる。実行時読み込みにして
 * 「バンクが未投入である」ことを利用者へ伝えられるようにしている。
 */
function loadAnchorBank(): AnchorRecord[] {
  const jsonPath = path.resolve(process.cwd(), "src/data/anchors.json");
  if (!fs.existsSync(jsonPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as AnchorRecord[];
  } catch (e) {
    console.error("anchors.json の読み込みに失敗しました:", e);
    return [];
  }
}

const BANK_MISSING_MESSAGE =
  "アンカー項目バンクが投入されていません。'npm run parse:anchors' を実行してください" +
  "（隣の enishio-education リポジトリのチェックアウトが必要です）。";

/**
 * 受検者へ返してよい形へ落とす。
 *
 * `note`（"正解 / レベル3" 等）・`hidden_premise`・`cheat_notes`・`distractor_notes` は
 * **項目の正答鍵と設計意図である。**画面に描画しなくてもレスポンスに含めれば
 * DevTools から読めるため、サーバ側で落とす。
 */
function toLearnerFacingAnchor(a: AnchorRecord) {
  const stripOptions = (opts: AnchorOption[]) => opts.map((o) => ({ key: o.key, text: o.text }));
  return {
    anchor_id: a.anchor_id,
    family: a.family,
    title: a.title,
    intro: a.intro,
    proposal: a.proposal,
    confidence_scale: a.confidence_scale,
    q1: { question: a.q1.question, options: stripOptions(a.q1.options) },
    q2: { question: a.q2.question, options: stripOptions(a.q2.options) },
  };
}

// GET /api/anchor - list or get a specific anchor item
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anchorId = searchParams.get("id");
  const anchors = loadAnchorBank();

  if (anchors.length === 0) {
    return NextResponse.json({ success: false, error: BANK_MISSING_MESSAGE }, { status: 503 });
  }

  if (anchorId) {
    const found = anchors.find((a) => a.anchor_id === anchorId);
    if (!found) {
      return NextResponse.json({ success: false, error: "Anchor not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, anchor: toLearnerFacingAnchor(found) });
  }

  const summaries = anchors.map((a) => ({
    anchor_id: a.anchor_id,
    family: a.family,
    title: a.title,
  }));

  return NextResponse.json({ success: true, count: anchors.length, anchors: summaries });
}

// POST /api/anchor - record response
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, anchorId, q1Selection, q2Selection, confidence, q1DurationMs, q2DurationMs } =
      body;

    if (!sessionId || !anchorId || !q1Selection || !q2Selection) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }
    await resolveSessionContext(sessionId);

    const item = await prisma.anchorItem.findUnique({
      where: { anchor_id: anchorId },
      select: { anchor_status: true },
    });
    if (!item) {
      return NextResponse.json(
        {
          success: false,
          error: `anchor_items に ${anchorId} がありません。'npm run seed:anchors' を実行してください。`,
        },
        { status: 409 }
      );
    }

    // アンカーは無得点で記録する [MVP 2.6.2, D-51]。
    //
    // **ratings（評点の正本）には行を作らない。**アンカーには評点が存在しないため、
    // rating_category に 0 を入れるとルーブリック上の「Level 0: 無批判受容」と
    // 区別できなくなり、将来の較正（D-51 の基準関連相関）を汚す。
    // 学習者・session_seq は anchor_responses → sessions を辿れば復元できる。
    const responseRecord = await recordAnchorResponse({
      sessionId,
      anchorId,
      anchorStatus: item.anchor_status,
      q1Selection,
      q2Selection,
      confidence: Number(confidence) || 3,
      q1DurationMs: Number(q1DurationMs) || 0,
      q2DurationMs: Number(q2DurationMs) || 0,
    });

    return NextResponse.json({
      success: true,
      responseId: responseRecord.response_id,
      anchorStatus: responseRecord.anchor_status,
      scored: false,
    });
  } catch (error: any) {
    console.error("Anchor response error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record anchor response" },
      { status: 500 }
    );
  }
}

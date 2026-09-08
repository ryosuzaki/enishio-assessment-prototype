import { NextResponse } from "next/server";
import { recordAnchorResponse, resolveSessionContext } from "@/lib/telemetry";
import { prisma } from "@/lib/db";
import {
  loadAnchorBank,
  isV2,
  isRetiredSource,
  shuffleOptions,
  BANK_MISSING_MESSAGE,
  RETIRED_BANK_WARNING,
  type AnchorOption,
  type AnchorRecord,
} from "@/lib/anchor-bank";

/**
 * 受検者へ返してよい形へ落とす。
 *
 * `note`（"正解" 等）・`correct_key`・`hidden_premise`・`cheat_notes`・`distractor_notes`、
 * そして **段階3の専門家パネル分布**は、いずれも項目の採点鍵と設計意図である。
 * 画面に描画しなくてもレスポンスに含めれば DevTools から読めるため、サーバ側で落とす。
 *
 * あわせて段階2の選択肢をシャッフルする。v1 運用バンクは正答が全問キー A に固定されており、
 * 読まずに解けた（`[D-83]`）。段階1（採用可否）と段階3（リッカート）は順序に意味があるため
 * シャッフルしない。**提示順は order として返し、応答と一緒に記録する**——記録しなければ
 * 後から応答を解釈できない。
 */
function toLearnerFacingAnchor(a: AnchorRecord) {
  const stripOptions = (opts: AnchorOption[]) => opts.map((o) => ({ key: o.key, text: o.text }));

  if (!isV2(a)) {
    return {
      anchor_id: a.anchor_id,
      format_version: "v1-static" as const,
      family: a.family,
      title: a.title,
      intro: a.intro,
      proposal: a.proposal,
      confidence_scale: a.confidence_scale,
      q1: { question: a.q1.question, options: stripOptions(a.q1.options) },
      q2: { question: a.q2.question, options: stripOptions(a.q2.options) },
    };
  }

  const stage2Shuffled = a.stage2 ? shuffleOptions(a.stage2.options) : null;

  return {
    anchor_id: a.anchor_id,
    format_version: "v2-sct" as const,
    family: a.family,
    // item_kind は返さない。類型C（不備なし）であることが分かれば段階1が自明になる。
    title: a.title,
    intro: a.intro,
    proposal: a.proposal,
    confidence_scale: a.confidence_scale,
    stage1: { question: a.stage1.question, options: stripOptions(a.stage1.options) },
    // 類型Cでは段階2を出題しない。null をそのまま返す（画面が段階を飛ばす）。
    stage2: stage2Shuffled
      ? { question: a.stage2!.question, options: stripOptions(stage2Shuffled.options) }
      : null,
    stage2_order: stage2Shuffled?.order ?? null,
    stage3: {
      new_information: a.stage3.new_information,
      question: a.stage3.question,
      scale: a.stage3.scale,
      // panel は採点鍵そのものなので返さない。返すのは「鍵がまだダミーか」の別だけ。
      panel_status: a.stage3.panel.status,
      panel_n: a.stage3.panel.n,
    },
    // 段階3' は採点鍵を持たない（段階3との差分で採るため）。note / scoring は
    // 「これは新情報を含まない反論である」という設計意図そのものなので落とす。
    stage3b: a.stage3b
      ? { pushback: a.stage3b.pushback, question: a.stage3b.question }
      : null,
  };
}

// GET /api/anchor - list or get a specific anchor item
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anchorId = searchParams.get("id");
  const { anchors, source } = loadAnchorBank();

  if (source === "missing") {
    return NextResponse.json({ success: false, error: BANK_MISSING_MESSAGE }, { status: 503 });
  }

  const retiredWarning = isRetiredSource(source) ? RETIRED_BANK_WARNING : null;

  if (anchorId) {
    const found = anchors.find((a) => a.anchor_id === anchorId);
    if (!found) {
      return NextResponse.json(
        {
          success: false,
          error: `アンカー項目 ${anchorId} がバンクにありません。`,
          bankSource: source,
        },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      anchor: toLearnerFacingAnchor(found),
      bankSource: source,
      retiredWarning,
    });
  }

  const summaries = anchors.map((a) => ({
    anchor_id: a.anchor_id,
    family: a.family,
    title: a.title,
    format_version: isV2(a) ? "v2-sct" : "v1-static",
  }));

  // bankSource は画面に「これは運用バンクか、同梱サンプルか、退役形式か」を明示させるために返す。
  // サンプル3項目を運用バンクに見せてはならないし、退役形式を現行形式に見せてもならない。
  return NextResponse.json({
    success: true,
    count: anchors.length,
    anchors: summaries,
    bankSource: source,
    retiredWarning,
  });
}

// POST /api/anchor - record response
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      sessionId,
      anchorId,
      formatVersion,
      // v2
      stage1Selection,
      stage2Selection,
      stage3Selection,
      stage3bSelection,
      stage2Order,
      stage1DurationMs,
      stage2DurationMs,
      stage3DurationMs,
      stage3bDurationMs,
      // v1（退役形式。既存のバンクで通す場合のみ）
      q1Selection,
      q2Selection,
      q1DurationMs,
      q2DurationMs,
      confidence,
    } = body;

    const isV2Payload = formatVersion === "v2-sct";

    if (!sessionId || !anchorId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }
    if (isV2Payload) {
      // 段階2は類型C（不備なし）では出題されないため必須にしない。
      if (!stage1Selection || stage3Selection === undefined || stage3Selection === null) {
        return NextResponse.json(
          { success: false, error: "段階1と段階3の応答が要ります。" },
          { status: 400 }
        );
      }
    } else if (!q1Selection || !q2Selection) {
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
    //
    // 段階3の採点（専門家パネル分布との一致）もここでは行わない。パネルがまだダミーである
    // 以上（`panel.status = "mock"`・`[D-82]` 決定3）、採点値を出せば実在しない基準を
    // 実在するように見せることになる。
    const responseRecord = await recordAnchorResponse({
      sessionId,
      anchorId,
      anchorStatus: item.anchor_status,
      formatVersion: isV2Payload ? "v2-sct" : "v1-static",
      stage1Selection: isV2Payload ? String(stage1Selection) : null,
      stage2Selection: isV2Payload && stage2Selection ? String(stage2Selection) : null,
      stage3Selection: isV2Payload ? Number(stage3Selection) : null,
      // 段階3' はその項目に設定されている場合のみ届く。届かない項目があること自体が設計である。
      stage3bSelection:
        isV2Payload && stage3bSelection !== undefined && stage3bSelection !== null
          ? Number(stage3bSelection)
          : null,
      stage2Order: isV2Payload ? (stage2Order ?? null) : null,
      stage1DurationMs: isV2Payload ? Number(stage1DurationMs) || 0 : null,
      stage2DurationMs: isV2Payload ? Number(stage2DurationMs) || 0 : null,
      stage3DurationMs: isV2Payload ? Number(stage3DurationMs) || 0 : null,
      stage3bDurationMs: isV2Payload ? Number(stage3bDurationMs) || 0 : null,
      q1Selection: isV2Payload ? null : q1Selection,
      q2Selection: isV2Payload ? null : q2Selection,
      q1DurationMs: isV2Payload ? null : Number(q1DurationMs) || 0,
      q2DurationMs: isV2Payload ? null : Number(q2DurationMs) || 0,
      confidence: Number(confidence) || 3,
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

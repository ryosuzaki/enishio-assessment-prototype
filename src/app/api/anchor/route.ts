import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { recordAnchorResponse, recordRating } from "@/lib/telemetry";

function getAnchors() {
  try {
    const jsonPath = path.resolve(process.cwd(), "src/data/anchors.json");
    if (fs.existsSync(jsonPath)) {
      return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading anchors.json:", e);
  }
  return [];
}

// GET /api/anchor - list or get random/specific anchor item
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anchorId = searchParams.get("id");
  const anchors = getAnchors();

  if (anchorId) {
    const found = anchors.find((a: any) => a.anchor_id === anchorId);
    if (!found) {
      return NextResponse.json({ success: false, error: "Anchor not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, anchor: found });
  }

  // Return list of all anchor items (summary metadata)
  const summaries = anchors.map((a: any) => ({
    anchor_id: a.anchor_id,
    family: a.family,
    title: a.title,
    metadata: a.metadata,
  }));

  return NextResponse.json({ success: true, count: anchors.length, anchors: summaries });
}

// POST /api/anchor - record response
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      sessionId,
      learnerId,
      sessionSeq,
      anchorId,
      q1Selection,
      q2Selection,
      confidence,
      q1DurationMs,
      q2DurationMs,
    } = body;

    if (!sessionId || !anchorId || !q1Selection || !q2Selection) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Record response details in anchor_responses
    const responseRecord = await recordAnchorResponse({
      sessionId,
      anchorId,
      q1Selection,
      q2Selection,
      confidence: Number(confidence) || 3,
      q1DurationMs: Number(q1DurationMs) || 0,
      q2DurationMs: Number(q2DurationMs) || 0,
    });

    // 2. Record unscored pretest rating in ratings table [MVP 2.6.2, 4.1.1, D-51]
    const ratingRecord = await recordRating({
      sessionId,
      learnerId: learnerId || "anonymous-learner",
      sessionSeq: Number(sessionSeq) || 1,
      stepId: `anchor-step-${anchorId}`,
      axisId: "axis_4",
      ratingCategory: 0, // Unscored pretest rating (0 indicates placeholder/uncalibrated)
      raterType: "human",
      raterId: learnerId || "anonymous-learner",
      scorerModelVersion: "anchor-pretest-unscored/v1",
      stimulusRef: anchorId,
      stimulusType: "anchor",
      anchorId,
      anchorStatus: "pretest",
      stimulusFeatures: {
        domain: anchorId.includes("-A-") ? "software_architecture" : "business_process",
        error_type: "type_B",
        target_dimension: "axis_4",
      },
    });

    return NextResponse.json({
      success: true,
      responseId: responseRecord.response_id,
      ratingId: ratingRecord.rating_id,
    });
  } catch (error: any) {
    console.error("Anchor response error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record anchor response" },
      { status: 500 }
    );
  }
}

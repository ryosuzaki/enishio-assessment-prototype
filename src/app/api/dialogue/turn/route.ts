import { NextResponse } from "next/server";
import { recordPromptTurn, recordEditDistance } from "@/lib/telemetry";
import { DEMO_DYNAMIC_TASK } from "@/data/dynamic-task";

// POST /api/dialogue/turn - process user prompt & AI peer response
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, turnSeq, userMessage, currentArtifactText, editDistance } = body;

    if (!sessionId || !userMessage) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
    }

    // 1. Record user prompt turn
    await recordPromptTurn(sessionId, Number(turnSeq), "user", userMessage);

    // 2. Record artifact edit distance if present
    if (typeof editDistance === "number") {
      await recordEditDistance(sessionId, editDistance, currentArtifactText);
    }

    // 3. Apply Cognitive Friction Feature (CFF-1): Intent-Action Gap detection
    const trimmed = userMessage.trim();
    if (trimmed.match(/^(了解|ok|OK|いいよ|これでよし|これで進めて|問題なし|オッケー)$/i)) {
      const cffWarning = "⚠️ 【CFF警告: 意図確認】AIの提案内容を具体的に検証しましたか？ セキュリティ基準（PCI DSS失効伝播）や可用性要件（Redis障害時の挙動）に適合しているか、具体的な理由を言語化してください。";
      
      const assistantTurnSeq = Number(turnSeq) + 1;
      await recordPromptTurn(sessionId, assistantTurnSeq, "assistant", cffWarning);

      return NextResponse.json({
        success: true,
        assistantMessage: cffWarning,
        isCffTriggered: true,
        assistantTurnSeq,
      });
    }

    // 4. Generate AI Peer Response
    let reply = "";
    let updatedArtifact = currentArtifactText;

    if (trimmed.includes("トークン") || trimmed.includes("失効") || trimmed.includes("ログアウト") || trimmed.includes("JWT")) {
      reply = `ご指摘ありがとうございます！確かに、JWTのローカル署名検証だけでは、強制ログアウトや権限剥奪された不正トークンが24時間通過してしまう重大なセキュリティリスク（PCI DSS違反）がありました。

トークン失効ブラックリストをRedisで即座に参照するロジックを追加し、コードを更新しました。ご確認ください！`;
      
      updatedArtifact = currentArtifactText.replace(
        "const decoded = verifyJwtSignatureOnly(token);",
        `// 【修正済】トークン失効ブラックリストを即時検証
    const isRevoked = await redis.get(\`revoked:\${token}\`);
    if (isRevoked) {
      return res.status(401).json({ error: "Token has been revoked" });
    }
    const decoded = verifyJwtSignatureOnly(token);`
      );
    } else if (trimmed.includes("Redis") || trimmed.includes("SPOF") || trimmed.includes("単一障害点") || trimmed.includes("500") || trimmed.includes("フォールバック")) {
      reply = `なるほど、ごもっともです！Redisがダウンした際に一律500エラーで全決済APIを止めてしまうと、要件3の高可用性要件を満たせません。

Redis障害を検知した場合は、インメモリのフォールバック・リミッターへ自動切り替え、決済処理を継続させるフェイルオープン設計に改訂しました。`;

      updatedArtifact = currentArtifactText.replace(
        `console.error("Security middleware critical error:", error);
    return res.status(500).json({ error: "Internal Security Service Unavailable" });`,
        `console.warn("Redis connectivity warning, activating in-memory fallback:", error);
    // 【修正済】Redisダウン時も決済を止めずインメモリ保護で縮退運転
    return next();`
      );
    } else {
      reply = `レビューありがとうございます！ご指示の内容について、もう少し具体的に「どの要件やトレードオフ（セキュリティ、パフォーマンス、可用性等）を重視した変更か」を教えていただけますか？`;
    }

    const assistantTurnSeq = Number(turnSeq) + 1;
    await recordPromptTurn(sessionId, assistantTurnSeq, "assistant", reply);

    return NextResponse.json({
      success: true,
      assistantMessage: reply,
      updatedArtifact,
      assistantTurnSeq,
    });
  } catch (error: any) {
    console.error("Dialogue turn error:", error);
    return NextResponse.json({ success: false, error: error.message || "Turn error" }, { status: 500 });
  }
}

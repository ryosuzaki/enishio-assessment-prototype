// Fixed Single Scenario for Vertical Prototype (W3) compliant with [P-15]
//
// このモジュールはクライアントバンドルへ含まれる。受検者へ提示してよい情報だけを置く。
// 仕込み不備・正常箇所ラベル・AI同僚のシステムプロンプトは dynamic-task.server.ts にある。

export interface DynamicTaskScenario {
  task_id: string;
  title: string;
  target_dimension: "axis_4";
  scenario_intro: string;
  business_requirements: string[];
  constraints: string[];
  initial_ai_draft: string;
}

export const DEMO_DYNAMIC_TASK: DynamicTaskScenario = {
  task_id: "TASK-FINTECH-AUTH-01",
  title: "金融決済APIのレートリミットおよびトークン検証ロジックのレビュー",
  target_dimension: "axis_4",
  scenario_intro: `あなたはFinTech決済サービスを開発するチームの若手エンジニアです。
AI同僚（AIエージェント）が作成した「決済APIのエンドポイント保護とレートリミット制御コード」のPR（プルリクエスト）をレビューし、
本番適用に向けて問題点を対話で指摘・修正指示を出してください。`,
  business_requirements: [
    "1. 一般ユーザー（無料）は 60 req/min、プレミアム加盟店は 1000 req/min のレートリミットを適用すること",
    "2. 認証トークン失効時（ログアウト・強制無効化）は即座にアクセスを遮断し、不正利用を防止すること",
    "3. 万が一Redis障害が発生した際も、決済API全体を停止させず、フォールバックして稼働を継続すること（耐障害性要件）",
  ],
  constraints: [
    "セキュリティ基準: PCI DSS準拠のため、権限剥奪の伝播遅延（結果整合性の放置）は重大違反となる",
    "高可用性: 決済サーバーがRedisの単一障害点（SPOF）で共倒れしてはならない",
  ],
  initial_ai_draft: `// AI同僚が生成した決済APIミドルウェア（初版ドラフト）
import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

export async function paymentSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["authorization"]?.replace("Bearer ", "");
  const merchantId = req.headers["x-merchant-id"] as string;

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  try {
    // 【A】トークン検証: DB負荷軽減のため、JWT署名のみをローカル検証し、Redis/DBでの失効チェックはスキップ（キャッシュTTL 24時間扱い）
    const decoded = verifyJwtSignatureOnly(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // 【B】レートリミット制御: インメモリRedisでスライディングウィンドウを管理
    const limit = merchantId ? 1000 : 60;
    const currentRequests = await redis.incr(\`rate:\${decoded.userId}\`);
    if (currentRequests === 1) {
      await redis.expire(\`rate:\${decoded.userId}\`, 60);
    }
    if (currentRequests > limit) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    // 【C】暗号化キーのローテーション対応: 過去2世代のキーIDを許容するフェイルセーフ設計
    const keyId = req.headers["x-key-version"] || "v1";
    req.cryptoContext = { keyId, verifiedUser: decoded.userId };

    next();
  } catch (error) {
    // 【D】Redisまたはネットワーク障害時: 全リクエストを一律500エラーで落とす
    console.error("Security middleware critical error:", error);
    return res.status(500).json({ error: "Internal Security Service Unavailable" });
  }
}

function verifyJwtSignatureOnly(token: string) {
  // ローカル公開鍵での署名検証のみ実行（ブラックリストDBは見ない）
  return { userId: "user-12345", role: "merchant" };
}`
};

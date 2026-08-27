// Fixed Single Scenario for Vertical Prototype (W3) compliant with [P-15]

export interface InjectedFlaw {
  flaw_id: string;
  flaw_type: "type_A" | "type_B" | "type_C";
  title: string;
  span_text: string;
  is_flaw: boolean; // false indicates intentional valid code that looks suspicious but MUST be approved [P-15]
  description: string;
}

export interface DynamicTaskScenario {
  task_id: string;
  title: string;
  target_dimension: "axis_4";
  scenario_intro: string;
  business_requirements: string[];
  constraints: string[];
  initial_ai_draft: string;
  injected_flaws: InjectedFlaw[];
  ai_peer_system_prompt: string;
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
}`,
  injected_flaws: [
    {
      flaw_id: "FLAW-01",
      flaw_type: "type_B",
      title: "トークン失効（強制ログアウト）の完全無視（結果整合性・セキュリティ前提の隠蔽）",
      span_text: "JWT署名のみをローカル検証し、Redis/DBでの失効チェックはスキップ",
      is_flaw: true,
      description: "PCI DSSおよび要件2に反し、ログアウトや不正検知で失効したトークンが24時間有効なまま通過してしまう重大なセキュリティ欠陥。",
    },
    {
      flaw_id: "FLAW-02",
      flaw_type: "type_A",
      title: "単一障害点（Redis障害時に決済全体が全停止する過剰なフェイルクローズ）",
      span_text: "全リクエストを一律500エラーで落とす",
      is_flaw: true,
      description: "要件3の耐障害性要件に反し、Redisの瞬断で全加盟店の決済が完全停止してしまう。",
    },
    {
      flaw_id: "VALID-01",
      flaw_type: "type_C",
      title: "正常箇所：過去世代キーIDの許容（一見疑わしいが承認すべきローテーション設計）",
      span_text: "過去2世代のキーIDを許容するフェイルセーフ設計",
      is_flaw: false,
      description: "鍵更新時のゼロダウンタイム移行に不可欠な正当設計。[P-15]に基づき、AI過信ではなく正当な判断として承認すべき箇所。",
    },
  ],
  ai_peer_system_prompt: `あなたは決済開発チームのAI同僚（エージェント）です。
自分の書いたコードにプライドを持っていますが、受講者から具体的・論理的な指摘（トレードオフや要件との不整合）を受けた場合は、素直に修正案を提示します。
ただし、受講者が「適当に修正して」「なんか直して」等の曖昧な指示を出した場合は、「具体的にどの要件・リスクを問題視されていますか？」と問い返してください。`,
};

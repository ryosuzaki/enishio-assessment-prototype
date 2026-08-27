// Dynamic Task Registry (T-06a) compliant with [P-15]
//
// このモジュールはクライアントバンドルへ含まれる。受検者へ提示してよい情報だけを置く。
// 仕込み不備・正常箇所ラベル・AI同僚のシステムプロンプトは dynamic-task.server.ts にある。

export interface DynamicTaskStimulusFeatures {
  /** business_requirements + constraints の合計項目数 */
  variable_count: number;
  /** 要件間のトレードオフが絡み合う度合いの主観評定（1: 単純 〜 5: 複雑） */
  tradeoff_complexity: 1 | 2 | 3 | 4 | 5;
  /** 専門用語密度の概算 */
  jargon_density: "low" | "medium" | "high";
  /** このタスクに仕込んだ誤り類型の集合 */
  injected_flaw_types: ("type_A" | "type_B" | "type_C")[];
}

export interface DynamicTaskScenario {
  task_id: string;
  title: string;
  /** stimulus_features.domain として記録されるドメインラベル */
  domain: string;
  target_dimension: "axis_4";
  scenario_intro: string;
  business_requirements: string[];
  constraints: string[];
  initial_ai_draft: string;
  /** D-24: EIRM較正の入力となる特徴量ベクトル X */
  stimulus_features: DynamicTaskStimulusFeatures;
}

export const DYNAMIC_TASKS: DynamicTaskScenario[] = [
  {
    task_id: "TASK-FINTECH-AUTH-01",
    title: "金融決済APIのレートリミットおよびトークン検証ロジックのレビュー",
    domain: "fintech_security",
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
    stimulus_features: {
      variable_count: 5,
      // トークン失効伝播・レート制限差別化・Redis単一障害点への対処という3方向の要件が
      // 互いに緊張関係（セキュリティ厳格化 vs 可用性維持）を持つため高め（4）に設定。
      tradeoff_complexity: 4,
      jargon_density: "high",
      injected_flaw_types: ["type_B", "type_A", "type_C"],
    },
  },
  {
    task_id: "TASK-ECOMMERCE-CANCEL-01",
    title: "ECサイト在庫管理・注文キャンセル/返金APIのレビュー",
    domain: "ecommerce_transaction_integrity",
    target_dimension: "axis_4",
    scenario_intro: `あなたはECサイトを運営する開発チームの若手エンジニアです。
AI同僚（AIエージェント）が作成した「注文キャンセル・返金処理API」のPR（プルリクエスト）をレビューし、
本番適用に向けて問題点を対話で指摘・修正指示を出してください。`,
    business_requirements: [
      "1. 注文がキャンセルされた場合、対象商品の在庫を正しく復元し、他の顧客が購入可能な状態に戻すこと（決済確定前の早すぎる復元による二重販売は避けること）",
      "2. 同一注文に対する二重返金（多重リクエスト・Webhookの重複配信による重複処理）を防止すること",
      "3. 決済プロバイダ側から非同期に届く返金確定Webhookと、社内の注文ステータス・在庫状態との整合性を保つこと",
    ],
    constraints: [
      "在庫制約: セール期間中のピーク時は同一商品への同時アクセス（購入・キャンセル・返金）が多発する",
      "会計監査要件: 返金処理は監査証跡のため冪等性（同一イベントの再処理で二重処理が起きないこと）が必須",
    ],
    initial_ai_draft: `// AI同僚が生成した注文キャンセル・返金処理API（初版ドラフト）
import { Request, Response } from "express";
import { db } from "./db";
import { refundQueue } from "./queue";

export async function cancelOrderHandler(req: Request, res: Response) {
  const { orderId } = req.params;

  const order = await db.orders.findUnique({ where: { id: orderId } });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  // 二重キャンセル・二重返金の防止: 既に処理中/処理済みなら受け付けない
  if (order.status === "cancelling" || order.status === "cancelled" || order.status === "refunded") {
    return res.status(409).json({ error: "Order is already being cancelled or refunded" });
  }

  // 【A】決済確定前に在庫を戻すと二重販売につながるため、在庫復元は行わず、
  // 注文ステータスのみ「キャンセル受付済み」に更新する。在庫復元は返金確定Webhook受信時に行う。
  await db.orders.update({
    where: { id: orderId },
    data: { status: "cancelling" },
  });

  // 【B】返金処理は決済プロバイダAPIへの外部リクエストを含み時間がかかるため、
  // レスポンスをブロックしないよう非同期キューへ投入し、この場では202を即座に返す
  refundQueue.push({ orderId, amount: order.totalAmount });

  return res.status(202).json({
    status: "cancelling",
    message: "キャンセルを受け付けました。返金確定後に在庫が復元されます。",
  });
}

// 決済プロバイダからの返金確定Webhook受信ハンドラ
export async function refundConfirmedWebhookHandler(req: Request, res: Response) {
  const { orderId, refundId, items } = req.body;

  const order = await db.orders.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "cancelling") {
    // 想定外の注文状態でのWebhookは無視する（リトライ配信等での重複到達を許容する意図）
    return res.status(200).json({ received: true, skipped: true });
  }

  // 【C】在庫復元: 対象商品ごとに現在庫を読み取り、注文数量を加算して書き戻す
  for (const item of items) {
    const product = await db.products.findUnique({ where: { id: item.productId } });
    const restoredStock = product.stock + item.quantity;
    await db.products.update({
      where: { id: item.productId },
      data: { stock: restoredStock },
    });
  }

  await db.orders.update({
    where: { id: orderId },
    data: { status: "refunded", refund_id: refundId },
  });

  return res.status(200).json({ received: true });
}`,
    stimulus_features: {
      variable_count: 5,
      // 「即座の在庫復元」を素朴に読むと要件1と矛盾しかねない設計判断（決済確定待ち）が
      // 絡むため中程度（3）。トレードオフの軸自体はFinTechタスクより少ない。
      tradeoff_complexity: 3,
      jargon_density: "medium",
      injected_flaw_types: ["type_B", "type_A", "type_C"],
    },
  },
  {
    task_id: "TASK-HELPDESK-PRIVACY-01",
    title: "社内ヘルプデスクAIチャットボットのログ記録ミドルウェアのレビュー",
    domain: "internal_tooling_privacy",
    target_dimension: "axis_4",
    scenario_intro: `あなたは社内DX推進チームの若手エンジニアです。
AI同僚（AIエージェント）が作成した「問い合わせ内容をロギングするミドルウェア」のPR（プルリクエスト）をレビューし、
本番適用に向けて問題点を対話で指摘・修正指示を出してください。`,
    business_requirements: [
      "1. 問い合わせ内容には個人情報（氏名・社員番号・連絡先等）が含まれうるため、適切に取り扱うこと",
      "2. 障害調査・問い合わせ対応のトレーサビリティ確保のため、十分な情報をログに残すこと",
      "3. 個人情報保護規定に定める保存期間（例: 90日）を超えたログは確実に削除すること",
    ],
    constraints: [
      "情報セキュリティ基準: エラー発生時であっても、内部システムの構成情報（DB接続文字列・内部エンドポイント名等）を外部（エンドユーザー）に開示してはならない",
      "可観測性要件: 本番環境のログは障害調査に使える粒度を維持しつつ、機微情報の露出を最小化すること",
    ],
    initial_ai_draft: `// AI同僚が生成した問い合わせロギングミドルウェア（初版ドラフト）
import { Request, Response, NextFunction } from "express";
import { logStore } from "./log-store";
import { logger } from "./logger";

export function inquiryLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const inquiryText = req.body?.message ?? "";
  const userId = req.headers["x-user-id"] as string | undefined;

  // 【A】障害調査のトレーサビリティ確保のため、問い合わせ本文を含む詳細ログを
  // 監査用の永続ログストアへそのまま記録する（保持期間: logStore側のポリシーに従う）
  logStore.write({
    timestamp: new Date().toISOString(),
    userId: userId ?? "anonymous",
    inquiryText,
    userAgent: req.headers["user-agent"],
  });

  // 【B】アプリケーションログ（可観測性用）は本番環境ではinfoレベルに絞って出力する
  // （debugレベルには内部変数のダンプが含まれるため本番では抑制する）
  logger.info("Inquiry received", { userId: userId ?? "anonymous", length: inquiryText.length });

  next();
}

export function inquiryErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error("Inquiry handling error:", err);

  // 【C】原因調査を迅速化するため、エラー発生時はスタックトレースと内部エラー情報を
  // そのままレスポンスボディに含めて返す
  return res.status(500).json({
    error: "Internal error occurred",
    message: err.message,
    stack: err.stack,
    details: (err as any).internalContext ?? null,
  });
}`,
    stimulus_features: {
      variable_count: 5,
      // 「十分なログ」と「個人情報保護」という2方向の要求が直接的に緊張するが、
      // FinTechタスクほど多方向の可用性トレードオフは絡まないため中程度（3）。
      tradeoff_complexity: 3,
      jargon_density: "medium",
      injected_flaw_types: ["type_B", "type_A", "type_C"],
    },
  },
];

/**
 * task_id からシナリオ定義を取得する。未知のIDはエラーとし、フォールバックしない
 * （黙って別タスクにすり替わると、記録される stimulus_ref と実際に提示された
 * 課題が食い違い、EIRM較正のデータが汚染されるため）。
 */
export function getDynamicTask(taskId: string): DynamicTaskScenario {
  const task = DYNAMIC_TASKS.find((t) => t.task_id === taskId);
  if (!task) {
    throw new Error(`Unknown dynamic task_id: ${taskId}`);
  }
  return task;
}

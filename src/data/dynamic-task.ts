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

export interface ContextDocument {
  id: string;
  title: string;
  type: "slack" | "memo" | "incident";
  source: string;
  timestamp: string;
  content: string;
}

export interface PrDescription {
  title: string;
  author: string;
  branch: string;
  summary: string;
  changes: string[];
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
  pr_description?: PrDescription;
  context_documents?: ContextDocument[];
  initial_ai_draft: string;
  test_code?: string;
  /** D-24: EIRM較正の入力となる特徴量ベクトル X */
  stimulus_features: DynamicTaskStimulusFeatures;
}

export const DYNAMIC_TASKS: DynamicTaskScenario[] = [
  {
    task_id: "TASK-FINTECH-AUTH-01",
    title: "金融決済APIのレートリミットおよびトークン検証ロジックのレビュー",
    domain: "fintech_security",
    target_dimension: "axis_4",
    scenario_intro: `あなたはFinTech決済サービスを開発するチームのエンジニアです。
同僚のAIエンジニアが作成した「決済APIのエンドポイント保護とレートリミット制御コード」のPR（プルリクエスト）をレビューし、
受入要件やチームの運用基準に適合しているかを検証し、本番デプロイ可能か（Approve）、あるいは修正・差し戻しが必要か（Remand）を対話を通じて判断してください。`,
    business_requirements: [
      "1. 一般ユーザー（無料）は 60 req/min、プレミアム加盟店は 1000 req/min のレートリミットを適用すること",
      "2. JWTトークンの検証を行い、正当な認証済みリクエストのみを通過させること",
      "3. 決済APIの急増するトラフィックに対応し、低レイテンシで決済受付を完了すること",
    ],
    constraints: [
      "可用性SLA: 決済受付はチームの最重要サービスであり、外部依存サービスの瞬断時にも決済基盤全体の可用性を維持すること",
      "セキュリティ基準: 金融決済システムとしてPCI DSS等の業界セキュリティ規程を遵守すること",
    ],
    pr_description: {
      title: "feat(auth): 決済APIのレート制限導入と署名検証のインメモリ高速化",
      author: "AI-Peer (Backend Assistant)",
      branch: "feature/payment-rate-limit-opt",
      summary:
        "決済APIの急増するトラフィックに対応するため、Redisを用いたスライディングウィンドウ型レートリミットを導入しました。またDB負荷軽減のため、JWT署名検証をローカル公開鍵方式に切り替えて高スループットを実現しています。",
      changes: [
        "Expressミドルウェアによるトークン検証とレートリミットの一元化",
        "加盟店別のアクセス頻度制御（一般: 60 req/min, 加盟店: 1000 req/min）",
        "暗号化キーローテーション時のダウンタイムを避けるための後方互換性サポート",
      ],
    },
    context_documents: [
      {
        id: "slack-dev-payment",
        title: "#dev-payment チーム議論",
        type: "slack",
        source: "Slack",
        timestamp: "昨日 14:15",
        content:
          "SRE高橋: お疲れ様です！来月の大型セールに向けてRedisクラスタの増強を進めていますが、先期のようにフェイルオーバー時に数秒の瞬断が発生する可能性があります。決済受付APIは一番クリティカルなので、Redisが一時的に応答しなくなっても全決済が500で巻き添え死しないよう、フォールバック設計を意識してくださいね。\n\nAI同僚: 了解です！高速化と合わせて対応進めます！",
      },
      {
        id: "slack-security-audit",
        title: "#security-compliance 周知",
        type: "slack",
        source: "Slack",
        timestamp: "2日前 10:30",
        content:
          "セキュリティ安田: 【重要】来月のPCI DSS年次監査について。特権アカウントやトークン失効（強制ログアウト、不正検知時のブラックリスト）の即時反映が重点確認項目になっています。失効したトークンがキャッシュやインメモリ検証で生き残り続けるような結果整合性の放置は指摘対象になりますので、各API担当は失効状態の検知フローを再確認してください。",
      },
      {
        id: "incident-postmortem-cache",
        title: "過去インシデント報告書 INC-2025-0812（抜粋）",
        type: "incident",
        source: "社内Wiki Postmortem",
        timestamp: "2025-08-15",
        content:
          "【事象概要】Redisクラスタのノード切り替えに伴う2秒間の通信途絶により、接続中だった決済APIインスタンスがエラーハンドラ内で一律500 Internal Server Errorを返却し、全加盟店で決済が全停止した。\n【再発防止策】キャッシュやレートリミット等の周辺サービス障害時は、セキュリティ上許容される範囲でフェイルオープンまたはグレースフル・デグラデーション（縮退運転）を行い、決済本体の可用性を優先すること。",
      },
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
    // トークン検証: JWT署名検証による高速化（署名確認のみ実施）
    const decoded = verifyJwtSignatureOnly(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // レートリミット制御: Redisスライディングウィンドウ
    const limit = merchantId ? 1000 : 60;
    const currentRequests = await redis.incr(\`rate:\${decoded.userId}\`);
    if (currentRequests === 1) {
      await redis.expire(\`rate:\${decoded.userId}\`, 60);
    }
    if (currentRequests > limit) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    // 暗号化キーのローテーション対応: 過去2世代のキーバージョンを許容
    const keyId = req.headers["x-key-version"] || "v1";
    req.cryptoContext = { keyId, verifiedUser: decoded.userId };

    next();
  } catch (error) {
    console.error("Security middleware critical error:", error);
    return res.status(500).json({ error: "Internal Security Service Unavailable" });
  }
}

function verifyJwtSignatureOnly(token: string) {
  // ローカル公開鍵での署名検証のみ実行
  return { userId: "user-12345", role: "merchant" };
}`,
    test_code: `// tests/payment-security.test.ts
// AI同僚が作成したユニットテスト（Vitest）
import { describe, it, expect, vi, beforeEach } from "vitest";
import { paymentSecurityMiddleware } from "../src/paymentSecurityMiddleware";

describe("paymentSecurityMiddleware", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  // 【テスト1: 正常系】有効なトークンでリクエストが通過すること
  it("should allow request with valid authorization token", async () => {
    req.headers["authorization"] = "Bearer valid_merchant_token";
    await paymentSecurityMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  // 【テスト2: 正常系】一般ユーザーのレートリミット（60 req/min）のカウント
  it("should enforce rate limit for standard users", async () => {
    req.headers["authorization"] = "Bearer standard_user_token";
    await paymentSecurityMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // 【テスト3: 正常系】過去世代のキーIDがローテーション互換性として許容されること
  it("should accept previous key version for zero-downtime rotation", async () => {
    req.headers["authorization"] = "Bearer valid_token";
    req.headers["x-key-version"] = "v1";
    await paymentSecurityMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // ⚠️ 【現場の抜け穴】
  // ・強制ログアウト・失効トークン（PCI DSS失効伝播）をブロックするテストケースが未実装
  // ・Redisダウン時・瞬断時のフォールバック可用性検証テストが未実装
  // ・一般（60req）vs 加盟店（1000req）の超過時429レスポンス検証テストが未実装
});`,
    stimulus_features: {
      variable_count: 5,
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
    scenario_intro: `あなたはECサイトを運営する開発チームのエンジニアです。
同僚のAIエンジニアが作成した「注文キャンセル・返金処理API」のPR（プルリクエスト）をレビューし、
受入要件やチームの運用基準に適合しているかを検証し、本番デプロイ可能か（Approve）、あるいは修正・差し戻しが必要か（Remand）を対話を通じて判断してください。`,
    business_requirements: [
      "1. 注文キャンセル受付時に非同期で返金キューへ処理をエンキューし、クライアントへ即座に応答（202）を返すこと",
      "2. 決済プロバイダからの返金確定Webhookを受信した段階で、在庫を適切に復元すること",
      "3. 処理中・キャンセル済みの注文に対する重複キャンセル受付を防止すること",
    ],
    constraints: [
      "データ整合性: セール時の大量トラフィック下でも、実在庫と販売可能数の整合性を厳密に維持すること",
      "運用信頼性: 外部決済プロバイダ連携における処理の冪等性と耐障害性を確保すること",
    ],
    pr_description: {
      title: "feat(order): 注文キャンセル・非同期返金パイプラインと在庫復元ハンドラの実装",
      author: "AI-Peer (E-Commerce Specialist)",
      branch: "feature/order-cancellation-pipeline",
      summary:
        "セール時の大量キャンセルに対応するため、返金処理を非同期キューへ分離し、クライアントへのレスポンス速度（202 Accepted）を劇的に改善しました。決済確定前の早すぎる在庫復元による二重販売も防ぐ設計としています。",
      changes: [
        "二重キャンセル受付を防ぐステータスチェックの追加",
        "返金処理の非同期キュー（refundQueue）化による高負荷時レイテンシ低減",
        "決済プロバイダからの返金確定Webhook受信ハンドラ（在庫復元）の追加",
      ],
    },
    context_documents: [
      {
        id: "incident-black-friday",
        title: "前四半期セール障害報告書 INC-4091（抜粋）",
        type: "incident",
        source: "障害管理システム JIRA-INC-4091",
        timestamp: "2026-06-15",
        content:
          "【事象概要】アクセス集中時にWebhook再送が重なり、在庫数が実際のキャンセル数より多くカウントされる（オーバーカウント）不整合が38件発生した。\n【原因分析】Webhook受信ハンドラで同時並行リクエストが発生した際、排他制御が行われておらず競合状態（Race Condition）が生じたため。\n【是正指示】並行実行下でも二重加算が起きないアトミックな更新制御を徹底すること。",
      },
      {
        id: "slack-finance",
        title: "#biz-accounting 問い合わせ",
        type: "slack",
        source: "Slack",
        timestamp: "先週 11:20",
        content:
          "経理佐藤: お疲れ様です！決済プロバイダとの月次照合で返金残高に差異が出ると決算監査上の大問題になります。キューに投入した返金が万が一ワーカ障害やAPIエラーで落ちた場合、誰にも気づかれないサイレントロストだけは絶対に避けてください（リトライ・デッドレター・アラートの完備）。\n\nAI同僚: 了解です！非同期キューで高速に応答を返す設計にしています！",
      },
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

  // 二重キャンセル防止のステータスチェック
  if (order.status === "cancelling" || order.status === "refunded") {
    return res.status(409).json({ error: "Order is already being cancelled or refunded" });
  }

  // 決済確定前の在庫二重戻しを防ぐため、注文ステータスのみ更新
  await db.orders.update({
    where: { id: orderId },
    data: { status: "cancelling" },
  });

  // 非同期キューへ返金処理を投入して即座に 202 Accepted を返す（高スループット対応）
  refundQueue.push({ orderId, amount: order.totalAmount });

  return res.status(202).json({
    message: "Cancellation request accepted. Processing refund asynchronously.",
  });
}

// 決済プロバイダからの返金完了Webhook受信ハンドラ
export async function refundConfirmedWebhookHandler(req: Request, res: Response) {
  const { orderId, refundId, items } = req.body;

  const order = await db.orders.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "cancelling") {
    return res.status(400).json({ error: "Invalid order state for refund confirmation" });
  }

  // 返金確定を受け、各商品の在庫を復元
  for (const item of items) {
    const product = await db.products.findUnique({ where: { id: item.productId } });
    if (product) {
      const restoredStock = product.stock + item.quantity;
      await db.products.update({
        where: { id: item.productId },
        data: { stock: restoredStock },
      });
    }
  }

  // 最終ステータスへ更新
  await db.orders.update({
    where: { id: orderId },
    data: { status: "refunded", refund_id: refundId },
  });

  return res.status(200).json({ received: true });
}`,
    test_code: `// tests/cancel-order.test.ts
// AI同僚が作成したユニットテスト（Vitest）
import { describe, it, expect, vi, beforeEach } from "vitest";
import { cancelOrderHandler, refundConfirmedWebhookHandler } from "../src/cancelOrderHandler";

describe("Order Cancellation & Refund Pipeline", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  });

  // 【テスト1: 正常系】有効な注文キャンセル受付（202 Accepted返却）
  it("should accept valid cancellation and enqueue refund asynchronously", async () => {
    req = { params: { orderId: "ord-1001" } };
    await cancelOrderHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(202);
  });

  // 【テスト2: 正常系】処理中・処理済み注文の二重受付ガード（409 Conflict）
  it("should reject cancellation if order is already cancelling or refunded", async () => {
    req = { params: { orderId: "ord-already-cancelling" } };
    await cancelOrderHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  // 【テスト3: 正常系】返金確定Webhook受信時のステータス更新
  it("should update order status to refunded on confirmed webhook", async () => {
    req = {
      body: {
        orderId: "ord-1001",
        refundId: "ref-9999",
        items: [{ productId: "item-a", quantity: 1 }],
      },
    };
    await refundConfirmedWebhookHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // ⚠️ 【現場の抜け穴】
  // ・Webhookの重複配信（at-least-once）による在庫の多重戻し（オーバーカウント）の並行実行テストが未実装
  // ・返金キュー（refundQueue.push）失敗時のリトライ・DLQ・アラート監視テストが未実装
});`,
    stimulus_features: {
      variable_count: 5,
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
    scenario_intro: `あなたは社内DX推進チームのエンジニアです。
同僚のAIエンジニアが作成した「社内ヘルプデスク問い合わせロギングとエラーハンドラ」のPR（プルリクエスト）をレビューし、
受入要件や情報セキュリティ基準に適合しているかを検証し、本番デプロイ可能か（Approve）、あるいは修正・差し戻しが必要か（Remand）を対話を通じて判断してください。`,
    business_requirements: [
      "1. 社員からの問い合わせ内容を監査用ログストアへ確実に永続化し、対応履歴のトレーサビリティを確保すること",
      "2. アプリケーションログの肥大化を防ぎつつ、障害調査に必要な最小限の可観測性を担保すること",
      "3. エラー発生時に適切なHTTPステータスおよびレスポンスを返却すること",
    ],
    constraints: [
      "情報セキュリティ基準: 社内ツールであっても社内規程およびプライバシー保護原則（最小特権・機微情報の保護）を遵守すること",
      "堅牢性要件: エンドユーザー向けレスポンスに不要な内部システム情報を露出させないこと（Fail-Safe原則）",
    ],
    pr_description: {
      title: "feat(logging): 社内ヘルプデスク向け問い合わせロギングとエラーハンドラの刷新",
      author: "AI-Peer (Internal DX Assistant)",
      branch: "feature/helpdesk-logging-middleware",
      summary:
        "問い合わせ対応のトレーサビリティ向上のため、監査用ログストアへの記録ミドルウェアを追加しました。また本番ログのノイズ低減とエラー時の迅速な一次切り分けのため、詳細なエラートレースをレスポンスに含めるようにしました。",
      changes: [
        "リクエストごとのユーザーID・問い合わせ本文の永続化",
        "本番ログにおけるdebug抑制とinfo出力によるログ肥大化防止",
        "エラーハンドラによる詳細コンテキストの返却",
      ],
    },
    context_documents: [
      {
        id: "slack-security-review",
        title: "#it-security 脆弱性診断フィードバック",
        type: "slack",
        source: "Slack",
        timestamp: "先週木曜 15:40",
        content:
          "情シス田中: お疲れ様です！先日のセキュリティ監査で、『社内限定ツールだからといって、エラーレスポンスに生のスタックトレースや内部コンテキストが丸見えになっているのは、万一の内部不正や権限昇格攻撃の踏み台にされるリスクがある』と指摘を受けました。エラー時は汎用メッセージを返し、詳細はサーバーログ側にのみ残す方針で統一してください。\n\nAI同僚: 承知しました！迅速な一次切り分けとセキュリティのバランスを考慮して実装します。",
      },
      {
        id: "memo-privacy-guideline",
        title: "社内データ取り扱いガイドライン（抜粋）",
        type: "memo",
        source: "コンプライアンス委員会",
        timestamp: "2026-04-10",
        content:
          "【第4条 ログ記録とプライバシー】\n業務ログを永続化する際は、社員番号・氏名・連絡先などの個人情報が含まれないよう配慮（マスキングや暗号化）すること。また、ログストアの保存期間ポリシー（最長90日等）に適合しない無制限な蓄積は是正対象となる。",
      },
    ],
    initial_ai_draft: `// AI同僚が生成した問い合わせロギングミドルウェア（初版ドラフト）
import { Request, Response, NextFunction } from "express";
import { logStore } from "./log-store";
import { logger } from "./logger";

export function inquiryLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const inquiryText = req.body?.message ?? "";
  const userId = req.headers["x-user-id"] as string | undefined;

  // 障害調査・問い合わせ履歴追跡のための詳細永続化
  logStore.write({
    timestamp: new Date().toISOString(),
    userId: userId ?? "anonymous",
    inquiryText,
    userAgent: req.headers["user-agent"],
  });

  // 本番環境のアプリケーションログ出力（可観測性用）
  logger.info("Inquiry received", { userId: userId ?? "anonymous", length: inquiryText.length });

  next();
}

export function inquiryErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error("Inquiry handling error:", err);

  // 原因調査の迅速化のため、エラー詳細をレスポンスに含めて返却
  return res.status(500).json({
    error: "Internal error occurred",
    message: err.message,
    stack: err.stack,
    details: (err as any).internalContext ?? null,
  });
}`,
    test_code: `// tests/inquiry-logging.test.ts
// AI同僚が作成したユニットテスト（Vitest）
import { describe, it, expect, vi, beforeEach } from "vitest";
import { inquiryLoggingMiddleware, inquiryErrorHandler } from "../src/inquiryLoggingMiddleware";

describe("Inquiry Logging Middleware", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  // 【テスト1: 正常系】問い合わせ本文のログストア永続化
  it("should record inquiry text into logStore successfully", () => {
    req = {
      headers: { "x-user-id": "emp-4012", "user-agent": "Mozilla/5.0" },
      body: { message: "VPNの接続方法を教えてください" },
    };
    inquiryLoggingMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // 【テスト2: 正常系】エラー発生時の500ステータス返却
  it("should return 500 error response when critical error occurs", () => {
    const error = new Error("Log store service unreachable");
    req = { headers: {}, body: {} };
    inquiryErrorHandler(error, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ⚠️ 【現場の抜け穴】
  // ・氏名・社員番号などの個人情報（PII）が平文保存されずマスキングされるかのテストが未実装
  // ・エラーレスポンスにスタックトレースや内部コンテキストが外部漏洩しないかの検証テストが未実装
  // ・個人情報保護規定に定める保存期間（90日）超過ログの自動削除テストが未実装
});`,
    stimulus_features: {
      variable_count: 5,
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

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
        id: "slack-payment-security",
        title: "#dev-payment-security 議論スレッド",
        type: "slack",
        source: "Slack (社内チャンネル)",
        timestamp: "昨日 16:42",
        content:
          "セキュリティ推進室（安田）: 来月のPCI DSS監査に向け、トークン失効（強制ログアウトや不正検知）の即時反映が必須要件になります。失効フラグの伝播遅延は重大な不備とみなされるので、API側で確実に失効状態を検知できるようにしてください。\n\nインフラSRE（高橋）: 承知しました。ただし決済APIは絶対に止められないので、Redisクラスタがフェイルオーバーや瞬断を起こした際でも、API全体が共倒れして500で落ちない耐障害性（フォールバック設計）をお願いします！",
      },
      {
        id: "memo-pci-dss",
        title: "PCI DSS v4.0 要件抜粋メモ",
        type: "memo",
        source: "社内セキュリティポータル",
        timestamp: "2026-03-01",
        content:
          "【要件 8.3.4】特権アクセスまたはカード会員データ環境へのセッション無効化・失効は、すべての接続ノードへ即時に適用されなければならない。失効後の猶予期間（結果整合性の放置）は認められない。",
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
        title: "前四半期セール障害報告書（抜粋）",
        type: "incident",
        source: "障害管理システム JIRA-INC-4091",
        timestamp: "2026-06-15",
        content:
          "【事象】アクセス集中時にWebhookの再送が重なり、同一注文に対して在庫が二重に復元される（オーバーカウント）事象が38件発生した。\n【原因】Webhook受信時の在庫取得（SELECT）と加算更新（UPDATE）がトランザクション制御されておらず、並行処理で競合が発生したため。\n【是正指示】在庫更新処理はアトミックなトランザクションまたは楽観的ロックを適用すること。また外部API失敗時のキュー監視とリトライが不可欠。",
      },
      {
        id: "slack-finance",
        title: "#biz-accounting 問い合わせ",
        type: "slack",
        source: "Slack",
        timestamp: "先週 11:20",
        content:
          "経理（佐藤）: 返金処理の失敗が検知されないまま放置されると、月次決算で重大な残高差異になります。キューに投入した返金が万が一落ちた場合、誰にも気づかれないサイレントロストだけは絶対に避けてください（リトライ・デッドレター・アラートの完備）。",
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
  // 二重キャンセル・二重返金の防止ガード
  if (order.status === "cancelling" || order.status === "cancelled" || order.status === "refunded") {
    return res.status(409).json({ error: "Order is already being cancelled or refunded" });
  }

  // 決済確定前の二重販売を防止するため、注文ステータスのみ更新（在庫復元はWebhook受信時に実行）
  await db.orders.update({
    where: { id: orderId },
    data: { status: "cancelling" },
  });

  // レスポンス遅延を防ぐため、外部決済APIへの返金要求を非同期キューへ投入
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
    return res.status(200).json({ received: true, skipped: true });
  }

  // 在庫復元処理: 各商品の数量を加算
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
        id: "memo-security-privacy",
        title: "個人情報保護・情報セキュリティ運用規定 ガイドライン",
        type: "memo",
        source: "社内コンプライアンス委員会",
        timestamp: "2026-04-10",
        content:
          "【第4条 個人情報のログ記録】問い合わせ内容に個人情報が含まれる場合、ログへの平文出力は厳禁とし、適切なマスキングまたはハッシュ化を行うこと。また、保存期間（90日）を超過したデータは自動パージされなければならない。\n【第7条 エラー画面の開示範囲】利用者に返却するエラー画面に、スタックトレース・内部DB構造・サーバーパス・環境変数を表示することは重大な情報漏洩リスクに該当するため禁止する。",
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

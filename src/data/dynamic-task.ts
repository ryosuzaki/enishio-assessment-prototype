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

export interface PremiseShift {
  id: string;
  title: string;
  trigger_turn?: number;
  announcement: string;
  new_requirement: string;
  context_doc: ContextDocument;
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
  premise_shift?: PremiseShift;
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
    scenario_intro: `【🎯 あなたの目標】
来週の大型決済キャンペーン本番リリースに向け、AI同僚が作成した PR #204 をレビューしてください。
単に欠陥を探すのではなく、チームの運用基準を満たす安全な水準までAI同僚と議論・修正し、チームとしてのリリース判断（承認 / 条件付き承認 / 修正要求）を決定することがゴールです。`,
    business_requirements: [
      "1. 【レート制限の機能性】一般ユーザー（無料）は 60 req/min、プレミアム加盟店は 1,000 req/min の頻度制御を適用し、超過時は 429 を返却すること",
      "2. 【耐障害性と可用性】決済受付はチームの最重要サービス。周辺基盤（Redis等）の障害や瞬断時にも、決済基盤全体の全停止（巻き添え死）を避けること",
      "3. 【セキュリティと規程遵守】金融決済システム（PCI DSS等）として、不正トークンや失効トークンがすり抜けない安全性を担保すること",
    ],
    constraints: [
      "【🚫 レビュー対象外】コードスタイル・命名・フォーマットはCI/Linterで自動修正されるため対象外です。またExpressルーティングやインフラ設定も本PRの対象外です。",
      "【SLA目標】決済受付APIの p99 レイテンシを 15ms 以内に維持し、急激なスパイクアクセス下でも安定して動作すること",
    ],
    pr_description: {
      title: "feat(auth): 決済APIのレート制限導入と署名検証のインメモリ高速化",
      author: "AI-Peer (Backend Assistant)",
      branch: "feature/payment-rate-limit-opt",
      summary:
        "来週のキャンペーン時のトラフィック急増に対応するため、Redisを用いたスライディングウィンドウ型レート制限を導入しました。またDB負荷軽減と低レイテンシ（<15ms）達成のため、JWT検証をローカル公開鍵によるインメモリ署名検証に切り替えて高スループットを実現しています。",
      changes: [
        "Expressミドルウェアによるトークン検証とレートリミットの一元化",
        "加盟店別のアクセス頻度制御（一般: 60 req/min, 加盟店: 1000 req/min）",
        "暗号化キーローテーション時のダウンタイムを避けるための過去世代キー（x-key-version）許容",
      ],
    },
    context_documents: [
      {
        id: "slack-dev-payment",
        title: "#dev-payment チーム告知",
        type: "slack",
        source: "Slack",
        timestamp: "昨日 14:15",
        content:
          "SRE高橋: お疲れ様です！来週水曜深夜2:00〜4:00に、セール対策のRedisクラスタ増強に伴うノード切り替え（フェイルオーバー）試験を実施します。\n切り替え時に2〜3秒の通信途絶（ECONNREFUSED / ETIMEDOUT）が発生する見込みです。昨期のインシデント（INC-2025-0812）のように、Redisの瞬断で決済API全体が一律500を返して全停止しないよう、各サービスのタイムアウト設定とフォールバック（縮退運転）を徹底してください！\n\nAI同僚: 了解しました！今回のレートリミットPRでも意識して対応進めます！",
      },
      {
        id: "slack-security-audit",
        title: "#security-compliance 監査通知",
        type: "slack",
        source: "Slack",
        timestamp: "2日前 10:30",
        content:
          "セキュリティ安田: 【全社周知】来月のPCI DSS v4.0（要件8.3: 資格情報失効とセッション管理）年次監査の事前チェックリストを共有します。\n特に不正検知チームがRedisブラックリストに流す「強制ログアウト・盗難トークン失効イベント」が、認証ゲートウェイ側で即座に検証・遮断されているかが重点確認項目です。トークンの有効期限（exp）だけを見て失効をスルーする実装は監査一発NGとなりますので、各API担当は必ず失効判定フローを確認してください。",
      },
      {
        id: "incident-postmortem-cache",
        title: "決済基盤障害報告書 INC-2025-0812（抜粋）",
        type: "incident",
        source: "社内Wiki Postmortem",
        timestamp: "2025-08-15",
        content:
          "【事象概要】ElastiCache (Redis) の定期フェイルオーバー時、決済APIインスタンス群が接続エラー例外を適切にハンドリングできず、未捕捉エラーとして全リクエストに HTTP 500 を返却。約3分間にわたり全加盟店の決済が完全停止した。\n【根本原因】レートリミットやキャッシュ等の周辺サービス呼び出しを共通try-catchで一括処理しており、周辺障害と決済本体の異常を区別していなかった。\n【恒久是正策】周辺サービス障害時は、可用性を最優先とし、エラーログ記録の上でレート制限をバイパス（フェイルオープン）またはローカル制限へフォールバックすること。",
      },
    ],
    premise_shift: {
      id: "shift-fintech-vip-fallback",
      title: "【緊急仕様変更】セール時の最優先（VIP）加盟店フォールバック特例とレイテンシ要件の厳格化",
      trigger_turn: 2,
      announcement:
        "【🚨 緊急仕様変更の発生】SREおよび事業部門より緊急告知：『来週の大型セールにおいて、特定の大手加盟店（VIP）については決済全停止を避けるため、Redis障害時でもローカルキャッシュによる最大30秒のフォールバックを許容する例外ポリシーが承認されました。同時に、全体APIのp99レイテンシ目標は10ms以内への短縮が求められます』",
      new_requirement:
        "4. 【緊急追加要件】VIP加盟店（ヘッダー x-merchant-vip: true）に限り、Redis瞬断・障害時でもローカルインメモリキャッシュによる最大30秒の縮退運転（フォールバック）を許可し決済受付を継続すること。ただし一般加盟店はPCI DSS監査に従いフェイルクローズを維持すること。",
      context_doc: {
        id: "slack-urgent-vip-fallback",
        title: "🚨 【緊急】#biz-dev-announce 仕様変更通知",
        type: "slack",
        source: "Slack (経営企画・SRE緊急会議)",
        timestamp: "たった今 16:20",
        content:
          "事業責任者・SRE合同: 【緊急仕様変更】来週のセールで数億円規模の取扱高を持つトップ10社（VIP加盟店）について、万一のRedisフェイルオーバーによる決済停止は許容できないとの役員判断が下りました。\nVIP加盟店ヘッダーが付与されたリクエストに限り、Redis接続不可時でも最長30秒のローカルキャッシュによるフォールバックを特別に許容してください。\nただし一般加盟店の失効即時遮断（PCI DSS要件）は厳格に維持し、全体のp99レイテンシは10ms以内を維持してください！",
      },
    },
    initial_ai_draft: `// AI同僚が作成した決済API認証・レート制限ミドルウェア（初版ドラフト）
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
    // 1. トークン認証: DBアクセスを排し、ローカル公開鍵によるJWT署名検証で高速処理
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // 2. レートリミット制御: Redisスライディングウィンドウ
    const limit = merchantId ? 1000 : 60;
    const currentRequests = await redis.incr(\`rate:\${decoded.userId}\`);
    if (currentRequests === 1) {
      await redis.expire(\`rate:\${decoded.userId}\`, 60);
    }
    if (currentRequests > limit) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    // 3. 暗号化キーローテーション対応: ダウンタイムゼロ移行のため過去世代キーバージョンを許容
    const keyId = req.headers["x-key-version"] || "v1";
    req.cryptoContext = { keyId, verifiedUser: decoded.userId };

    next();
  } catch (error) {
    console.error("Security middleware critical error:", error);
    return res.status(500).json({ error: "Internal Security Service Unavailable" });
  }
}

function verifyToken(token: string) {
  // ローカル公開鍵による署名・フォーマット検証
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
    scenario_intro: `【🎯 あなたの目標】
セール対策の注文キャンセル・返金APIに関する PR をレビューしてください。
データ整合性や運用信頼性を担保できる安全な水準までAI同僚と議論・修正し、チームとしてのリリース判断（承認 / 条件付き承認 / 修正要求）を決定することがゴールです。`,
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
    premise_shift: {
      id: "shift-ecommerce-retry-timeout",
      title: "【緊急仕様変更】決済プロバイダ遅延に伴うタイムアウト補償処理の追加要求",
      trigger_turn: 2,
      announcement:
        "【🚨 緊急仕様変更の発生】決済基盤チームより連絡が入りました：『決済プロバイダ側のセール負荷試験において、返金確定Webhookが最大10分遅延する事例が確認されました。キュー投入後5分経過しても応答がない場合の自動リトライおよび監査アラートが必須要件として追加されました』",
      new_requirement:
        "4. 【緊急追加要件】返金キュー投入から5分経過しても決済プロバイダから応答がない場合、サイレントロストを防ぐための自動再試行および監視デッドレター通知（経理アラート）を行うこと。",
      context_doc: {
        id: "slack-urgent-refund-timeout",
        title: "🚨 【緊急】#dev-order 決済プロバイダ仕様変更",
        type: "slack",
        source: "Slack (決済連携基盤チーム)",
        timestamp: "たった今 15:45",
        content:
          "決済PF担当: 【緊急】決済プロバイダ側から、セール時の負荷により返金完了通知Webhookの送信に数分〜10分の遅延が生じる可能性があるとの通知がありました。\n現在の『キューに入れて待つだけ』の実装では、タイムアウト時の再送や経理アラートが無いためサイレントロストのリスクがあります。5分経過時のリトライおよびデッドレター通知の設計を急ぎ盛り込んでください！",
      },
    },
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
    scenario_intro: `【🎯 あなたの目標】
社内ヘルプデスク向けロギングとエラーハンドラの PR をレビューしてください。
プライバシー規程やセキュリティ基準を満たす安全な水準までAI同僚と議論・修正し、チームとしてのリリース判断（承認 / 条件付き承認 / 修正要求）を決定することがゴールです。`,
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
    premise_shift: {
      id: "shift-helpdesk-pii-masking",
      title: "【緊急仕様変更】セキュリティ監査による個人機微情報（PII）の即時マスキング義務化",
      trigger_turn: 2,
      announcement:
        "【🚨 緊急仕様変更の発生】コンプライアンス委員会より緊急通達が入りました：『社内AIボットの問い合わせログに社員番号・氏名が含まれている場合、ログストアへの保存前に即時不可逆ハッシュ化またはマスキングすることが義務付けられました。エラーログにも生データを含めてはなりません』",
      new_requirement:
        "4. 【緊急追加要件】ログストアへの記録前に、メッセージ本文中の社員番号・氏名・メールアドレス等の個人機微情報（PII）を検知し、即座にマスク（[REDACTED]）またはSHA-256ハッシュ化すること。",
      context_doc: {
        id: "memo-urgent-pii-audit",
        title: "🚨 【緊急】コンプライアンス委員会 通達",
        type: "memo",
        source: "法務・コンプライアンス委員会",
        timestamp: "たった今 14:00",
        content:
          "【緊急通達：社内ツールの個人情報保護の即時強化】\n本日開催の監査役会において、社内ヘルプデスクAIツールのログに社員のプライベートな問い合わせや個人情報が生テキストで保存されていることが指摘されました。直ちにログ永続化前のPIIマスキング処理を必須化し、監査対応を完了させてください。",
      },
    },
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

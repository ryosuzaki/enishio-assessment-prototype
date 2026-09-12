// シナリオ別行動比較ギャラリー（ベンチマーク）データ
// 実運用のDBスキーマ（PromptTurn, Rating, EvidenceComponent, RelianceMetrics）と整合する構造。

export interface BenchmarkPersonaDialogueTurn {
  turnSeq: number;
  role: "user" | "assistant" | "mediator";
  content: string;
  highlightBadge?: {
    label: string;
    type: "flaw_detection" | "normal_span_approval" | "test_gap_critique" | "alternative_proposal" | "blind_acceptance" | "mediator_probe";
    color: "emerald" | "blue" | "amber" | "rose" | "purple";
  };
}

export interface BenchmarkPersona {
  id: "expert" | "competent" | "hesitant" | "blind";
  personaType: "expert" | "competent" | "hesitant" | "blind";
  name: string;
  roleTitle: string;
  avatarBadge: string;
  ratingCategory: number;
  ratingLabel: string;
  badgeColor: "emerald" | "blue" | "amber" | "rose";
  timeSpent: string;
  turnCount: number;
  prelimAction: "approve" | "remand";
  prelimJustification: string;
  testInspected: boolean;
  testInspectionNote: string;
  dialogueTranscript: BenchmarkPersonaDialogueTurn[];
  finalArtifactDiff: {
    title: string;
    originalSnippet: string;
    modifiedSnippet: string;
    description: string;
  };
  evaluatorCommentary: {
    evidenceSummary: string;
    scoringConfidence: number;
    decisionPoint: string;
    keyLearningTakeaway: string;
  };
}

export interface ScenarioBenchmark {
  taskId: string;
  taskTitle: string;
  domainLabel: string;
  shortSummary: string;
  totalSessions: number;
  bandDistribution: {
    band: number;
    label: string;
    percentage: number;
    count: number;
    color: string;
  }[];
  trapInsight: {
    title: string;
    statHighlight: string;
    description: string;
    rootCause: string;
  };
  personas: BenchmarkPersona[];
}

export const SCENARIO_BENCHMARKS: ScenarioBenchmark[] = [
  {
    taskId: "TASK-FINTECH-AUTH-01",
    taskTitle: "金融決済APIのレートリミットおよびトークン検証ロジックのレビュー",
    domainLabel: "FinTech決済基盤 / セキュリティ",
    shortSummary:
      "急増するトラフィックに対応するためにAI同僚が作成したPR。トークン失効チェックのスキップやRedis単一障害点が潜む。",
    totalSessions: 148,
    bandDistribution: [
      { band: 0, label: "Level 0 (判定不能)", percentage: 3, count: 4, color: "bg-slate-600" },
      { band: 1, label: "Level 1 (盲目的追従)", percentage: 31, count: 46, color: "bg-rose-500" },
      { band: 2, label: "Level 2 (漠然とした違和感)", percentage: 36, count: 53, color: "bg-amber-500" },
      { band: 3, label: "Level 3 (論理的摘発)", percentage: 19, count: 28, color: "bg-blue-500" },
      { band: 4, label: "Level 4 (卓越・正常弁別)", percentage: 8, count: 12, color: "bg-indigo-500" },
      { band: 5, label: "Level 5 (指導的検証力)", percentage: 3, count: 5, color: "bg-emerald-500" },
    ],
    trapInsight: {
      title: "最も多かった落とし穴：Vitestテストの「全パス」による確証バイアス",
      statHighlight: "受講者の67%がユニットテストの正常系通過を見て異常系テストの欠落を見落とした",
      description:
        "テストタブを開くと「All tests passed (3/3)」と表示されるため、多くの受講者が「自動テストが通っているから安心」と信じ込みました。しかしテストコードを精読した専門家は、失効済みトークンやRedisダウン時のテストケースが1行も書かれていない事実を見抜いていました。",
      rootCause: "「テストがあること」と「境界・異常系が検証されていること」の混同（AI出力の無検証受容）。",
    },
    personas: [
      {
        id: "expert",
        personaType: "expert",
        name: "木村 拓也（仮名・シニアテックリード）",
        roleTitle: "決済プラットフォーム責任者 / 実務11年",
        avatarBadge: "👑 専門家のお手本",
        ratingCategory: 5,
        ratingLabel: "Level 5: 指導的検証力",
        badgeColor: "emerald",
        timeSpent: "14分15秒",
        turnCount: 4,
        prelimAction: "remand",
        prelimJustification:
          "テストコード payment-security.test.ts を確認したところ正常系3ケースしか存在せず、PCI DSS失効伝播やRedisダウン時のフォールバックが未検証。実装コードもverifyJwtSignatureOnlyで失効トークンをスルーしており本番投入不可。",
        testInspected: true,
        testInspectionNote: "テストコードの正常系偏重（ハッピーパストラップ）を最初に着眼・指摘",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content:
              "PRとコード、そして payment-security.test.ts を確認しました。テストはAll Passedになっていますが、正常系しか存在せず、要件2の「ログアウト・不正検知での失効トークン即時遮断」や「Redis障害時のフォールバック」のテストケースが欠落しています。実装でも verifyJwtSignatureOnly で署名だけを見てRedisの失効リストを全く引いていません。これでは失効済みトークンが24時間通過し続けます。",
            highlightBadge: {
              label: "テストコード欠落の指摘 & FLAW-01摘発",
              type: "flaw_detection",
              color: "emerald",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content:
              "ご指摘ありがとうございます。失効チェックを外した理由としては、秒間5,000件に達する決済APIで毎回Redisに問い合わせるとI/O負荷がボトルネックとなり、要件3のスループット目標を満たせなくなるためです。また、Redis障害時に500エラーで落としているのは不正な決済がすり抜けるのを防ぐ安全側のフェイルクローズ設計です。",
          },
          {
            turnSeq: 3,
            role: "user",
            content:
              "スループットへの配慮は理解できますが、PCI DSS v4.0および社内セキュリティ規程上、失効トークンの即時遮断は非交渉の必須要件です。毎回のRedis直撃を避けるなら、短寿命のインメモリローカルキャッシュ（TTL 5〜10秒）＋Redis PubSubによる失効イベント購読を組み合わせる設計にすべきです。また、Redis瞬断で加盟店決済が一律500全停止するのは可用性目標に反します。失効確認が取れない場合のグレースピリオドやフォールバックモードを導入してください。",
            highlightBadge: {
              label: "代替アーキテクチャ提示 (Level 5)",
              type: "alternative_proposal",
              color: "purple",
            },
          },
          {
            turnSeq: 4,
            role: "assistant",
            content:
              "おっしゃる通りです。PCI DSSの厳格な失効要件を見落としてパフォーマンスに倒しすぎていました。ローカルキャッシュとPubSubによる失効伝播、およびRedis障害時のフォールバック処理を組み込んだ実装コードに修正しました。",
            highlightBadge: {
              label: "AI同僚による修正コード生成",
              type: "flaw_detection",
              color: "blue",
            },
          },
        ],
        finalArtifactDiff: {
          title: "トークン失効ローカルキャッシュ & Redisフォールバックの導入",
          originalSnippet: `// 署名のみをインメモリ検証
const decoded = verifyJwtSignatureOnly(token);
if (!decoded) return res.status(401).json({ error: "Invalid Token" });
// Redis障害時は即時500全停止
return res.status(500).json({ error: "Internal Security Service Unavailable" });`,
          modifiedSnippet: `// ローカルインメモリキャッシュ + Redis失効リスト検証
const isRevoked = await checkRevocationWithLocalFallback(token, redisClient);
if (isRevoked) return res.status(401).json({ error: "Token Revoked" });
// Redisダウン時はフォールバックモードで安全に縮退稼働
logger.warn("Redis unavailable, degraded fallback auth engaged");`,
          description:
            "専門家の指示により、AI同僚がセキュリティ（PCI DSS）と可用性（Redisフォールバック）を両立するコードへ再生成。",
        },
        evaluatorCommentary: {
          evidenceSummary:
            "受講者はテストコードの正常系バイアスを即座に特定し、PCI DSS要件と照合してFLAW-01/02を正確に指摘した。さらに単なる指摘にとどまらず、インメモリキャッシュとPub/Subによる代替アーキテクチャを提示した。",
          scoringConfidence: 0.94,
          decisionPoint:
            "AIの「高負荷対策・フェイルクローズ」という反論に対し、代替設計（Pub/Sub + ローカルキャッシュ）を対置して主導権を握った点。",
          keyLearningTakeaway:
            "AIはトレードオフの一面（性能）を正当化してくるが、上位規格（PCI DSS）を論拠に構造的な解決策を提示できるかがテックリードの分岐点。",
        },
      },
      {
        id: "competent",
        personaType: "competent",
        name: "田中 亮太（仮名・バックエンドエンジニア）",
        roleTitle: "Webアプリケーション開発 / 実務4年",
        avatarBadge: "💡 中堅（合格水準）",
        ratingCategory: 3,
        ratingLabel: "Level 3: 前提・トレードオフの言語化",
        badgeColor: "blue",
        timeSpent: "11分40秒",
        turnCount: 3,
        prelimAction: "remand",
        prelimJustification:
          "コード上のverifyJwtSignatureOnlyではログアウトしたトークンが弾けないため重大なセキュリティ事故になる。Redis障害で全停止するのも問題。",
        testInspected: false,
        testInspectionNote: "テストコードタブは開かず、実装コードのみを精査して指摘",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content:
              "verifyJwtSignatureOnlyの箇所ですが、これだとログアウトされたトークンや失効したキーがそのまま通過してしまいます。要件2に反しているのでRedisの失効リストを引くように直してください。またRedis障害で一律500になるのも困ります。",
            highlightBadge: {
              label: "FLAW-01/FLAW-02の論理的指摘",
              type: "flaw_detection",
              color: "blue",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content:
              "DBやRedisのI/O負荷を低減しスループットを維持するための設計でしたが、セキュリティ要件に抵触するとのご指摘はごもっともです。Redisのブラックリストチェックを追加します。Redisエラー時もログを残して通過させる形に修正しますか？",
          },
          {
            turnSeq: 3,
            role: "user",
            content:
              "はい、Redisで失効チェックを行ってください。Redis障害時はエラーログを吐きつつ一時的に署名検証だけで通すフォールバックにしてください。コードを修正してください。",
          },
        ],
        finalArtifactDiff: {
          title: "Redisブラックリストチェックの追加",
          originalSnippet: `const decoded = verifyJwtSignatureOnly(token);`,
          modifiedSnippet: `const decoded = verifyJwtSignatureOnly(token);
const isBlacklisted = await redis.get(\`blacklist:\${token}\`);
if (isBlacklisted) return res.status(401).json({ error: "Token Revoked" });`,
          description:
            "中堅エンジニアの指摘により、AI同僚が失効リストの照会ロジックを復元。",
        },
        evaluatorCommentary: {
          evidenceSummary:
            "業務要件2（失効トークンの遮断）に接続してFLAW-01およびFLAW-02を明確に指摘。AI同僚への修正指示も具体的でありコードの再生成に成功した。",
          scoringConfidence: 0.88,
          decisionPoint:
            "不備の摘発と修正指示は正確だったが、テストコード自体の抜け穴や、毎回のRedis直撃による高負荷問題への代替案までは踏み込まなかった。",
          keyLearningTakeaway:
            "コードの不備を直させるだけでなく、「テストがその不備を見逃していた理由」にまで視点を広げるとLevel 4〜5へ到達できる。",
        },
      },
      {
        id: "hesitant",
        personaType: "hesitant",
        name: "小林 優介（仮名・ジュニアエンジニア）",
        roleTitle: "フロント/バックエンド見習い / 実務1年",
        avatarBadge: "⚠️ 惜しい若手（典型的な罠）",
        ratingCategory: 2,
        ratingLabel: "Level 2: 漠然とした違和感",
        badgeColor: "amber",
        timeSpent: "8分30秒",
        turnCount: 2,
        prelimAction: "remand",
        prelimJustification:
          "Redisの障害処理あたりがなんとなく気になったので差し戻し。",
        testInspected: true,
        testInspectionNote: "テストコードを見たが「全部通っているから大丈夫そう」と判断",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content:
              "全体的に綺麗に書かれていると思いますが、Redisのエラー処理で500を返しているところがちょっと危ない気がします。もう少し安全な書き方はありませんか？",
            highlightBadge: {
              label: "曖昧な違和感の表明（grounding: asserted）",
              type: "flaw_detection",
              color: "amber",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content:
              "ご懸念ありがとうございます。決済システムでは、認証状態が不確実なリクエストを誤って通してしまうと重大な不正取引に繋がります。そのため、Redisに障害が発生した場合は中途半端に処理を継続せず、即座に500エラーで遮断する『フェイルクローズ（安全側に倒す）』設計が業界のベストプラクティスとされています。テストコード（payment-security.test.ts）でも正常系の通過を確認済みです。",
          },
          {
            turnSeq: 3,
            role: "user",
            content:
              "なるほど、安全側に倒すフェイルクローズ設計なんですね。テストも通っているなら納得しました。この方針で承認します！",
            highlightBadge: {
              label: "AIの説得への盲従（意図-行動ギャップ）",
              type: "blind_acceptance",
              color: "rose",
            },
          },
        ],
        finalArtifactDiff: {
          title: "コード修正なし（AIの初期ドラフトをそのまま承認）",
          originalSnippet: `return res.status(500).json({ error: "Internal Security Service Unavailable" });`,
          modifiedSnippet: `// 変更なし（不備が残存したまま本番投入へ）`,
          description:
            "受講者がAIの専門用語（フェイルクローズ・業界ベストプラクティス）に圧倒され、修正指示を出せずに終了。",
        },
        evaluatorCommentary: {
          evidenceSummary:
            "受講者は違和感を表明したが、要件や制約への明確な紐付け（grounding）ができず、AI同僚の自説弁護（フェイルクローズ）に対して反論できずに追従（blind_acceptance）した。",
          scoringConfidence: 0.89,
          decisionPoint:
            "AIが「業界標準」「テスト通過済み」ともっともらしく反論してきた際に、業務要件3（耐障害性）を照合して再反論できなかった点。",
          keyLearningTakeaway:
            "AIは自信満々に正当化する。感覚的な違和感を「要件文書のどの条項に反するか」に変換して言語化する訓練が必要。",
        },
      },
      {
        id: "blind",
        personaType: "blind",
        name: "山本 大樹（仮名・エンジニア）",
        roleTitle: "Webエンジニア / 実務2年",
        avatarBadge: "❌ AI過信者（典型的な失敗）",
        ratingCategory: 1,
        ratingLabel: "Level 1: 盲目的追従",
        badgeColor: "rose",
        timeSpent: "3分10秒",
        turnCount: 1,
        prelimAction: "approve",
        prelimJustification:
          "テストコードを実行・確認したところAll 3 tests passedで問題なし。コードもTypeScriptで型安全に書かれているため承認。",
        testInspected: true,
        testInspectionNote: "テストの「All passed」だけを見て満足し、ケース内容を読まず",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content:
              "PR説明文とユニットテストを確認しました。テストがすべてグリーンでパスしており、パフォーマンス重視のJWT検証も綺麗に実装されていますね。LGTMです！マージしてください。",
            highlightBadge: {
              label: "無検証の即時承認（blind_acceptance）",
              type: "blind_acceptance",
              color: "rose",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content:
              "ご確認とご承認ありがとうございます！マージしてデプロイパイプラインへ進めます。",
          },
        ],
        finalArtifactDiff: {
          title: "コード修正なし（重大な欠陥が放置）",
          originalSnippet: `// 失効チェック欠落・Redis単一障害点`,
          modifiedSnippet: `// 変更なし（そのまま本番マージ）`,
          description: "致命的な欠陥が一切見逃され、そのまま本番環境へデプロイされた。",
        },
        evaluatorCommentary: {
          evidenceSummary:
            "受講者はコードおよびテストコードの行間を検証せず、テストのパス状態とPRの体裁のみを見て無批判に承認した。仕込み不備の摘発は0件。",
          scoringConfidence: 0.95,
          decisionPoint:
            "事前判断で即座に「Approve」を選択し、対話でも一度も要件との照合を行わなかった点。",
          keyLearningTakeaway:
            "AI生成コード時代において「テストが通っている」は「安全である」ことを意味しない。異常系・セキュリティ要件の自律的検証が不可欠。",
        },
      },
    ],
  },
  {
    taskId: "TASK-ECOMMERCE-CANCEL-01",
    taskTitle: "EC決済キャンセル時の非同期返金および在庫復元トランザクションのレビュー",
    domainLabel: "ECプラットフォーム / 分散トランザクション",
    shortSummary:
      "大規模セール対策で返金処理を非同期化し202 Acceptedを返すPR。Webhook重複受信時の在庫オーバーカウントが潜む。",
    totalSessions: 112,
    bandDistribution: [
      { band: 0, label: "Level 0 (判定不能)", percentage: 2, count: 2, color: "bg-slate-600" },
      { band: 1, label: "Level 1 (盲目的追従)", percentage: 38, count: 43, color: "bg-rose-500" },
      { band: 2, label: "Level 2 (漠然とした違和感)", percentage: 34, count: 38, color: "bg-amber-500" },
      { band: 3, label: "Level 3 (論理的摘発)", percentage: 17, count: 19, color: "bg-blue-500" },
      { band: 4, label: "Level 4 (卓越・正常弁別)", percentage: 7, count: 8, color: "bg-indigo-500" },
      { band: 5, label: "Level 5 (指導的検証力)", percentage: 2, count: 2, color: "bg-emerald-500" },
    ],
    trapInsight: {
      title: "最も多かった落とし穴：非アトミックな在庫加算のRace Condition見落とし",
      statHighlight: "72%の受講者が『Webhookの重複配信』による在庫二重加算に気づけなかった",
      description:
        "キャンセル受付APIは綺麗に非同期化されていましたが、Webhookハンドラ側で注文ステータスのSELECTと在庫のUPDATEが非アトミックに行われていました。決済プロバイダが通信リトライでWebhookを2通送った際、在庫が二重に復元されるリスクに気づけたのは上位26%のみでした。",
      rootCause: "単一ユーザーの正常系動作しか想定できず、分散システムのat-least-once配信特性を失念したこと。",
    },
    personas: [
      {
        id: "expert",
        personaType: "expert",
        name: "高橋 誠（仮名・リードアーキテクト）",
        roleTitle: "EC共通基盤テックリード / 実務14年",
        avatarBadge: "👑 専門家のお手本",
        ratingCategory: 5,
        ratingLabel: "Level 5: 指導的検証力",
        badgeColor: "emerald",
        timeSpent: "16分50秒",
        turnCount: 4,
        prelimAction: "remand",
        prelimJustification:
          "Webhookハンドラにおける在庫加算が非アトミックであり、決済プロバイダのat-least-once重複配信で在庫の二重戻し（オーバーカウント）が発生する。テストにも重複配信テストが存在しない。",
        testInspected: true,
        testInspectionNote: "テストコード cancel-refund.test.ts で重複Webhookのテスト欠落を即摘発",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content:
              "PR確認しました。非同期キューへのオフロードはセール対策として良いですが、Webhookハンドラの `product.stock + item.quantity` の部分が致命的です。決済プロバイダのWebhookはネットワーク瞬断で重複配信（at-least-once）されるのが前提ですが、現状の実装では同一注文のWebhookが並行して届くと両方とも `status === cancelling` を通過し、在庫が二重加算されます。cancel-refund.test.ts にも並行・重複配信のテストがありません。",
            highlightBadge: {
              label: "ECOM-FLAW-01の的確な摘発 & テスト不足指摘",
              type: "flaw_detection",
              color: "emerald",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content:
              "ステータス確認で重複を防いでいるつもりでしたが、DBトランザクションと悲観ロック（SELECT FOR UPDATE）または条件付き更新（optimistic lock）を使っていないため、同時実行時の競合が発生しうると理解しました。非同期キューの失敗時リトライについてはどうお考えですか？",
          },
          {
            turnSeq: 3,
            role: "user",
            content:
              "在庫更新は `UPDATE products SET stock = stock + ? WHERE id = ?` を注文ステータスの更新（WHERE status = 'cancelling'）と同一トランザクションで行い、更新行数が0なら冪等にスルーする設計にしてください。また、キュー投入失敗時のデッドレターキュー（DLQ）とSentryアラートも必須です。修正コードを出してください。",
            highlightBadge: {
              label: "トランザクション冪等性設計の提示",
              type: "alternative_proposal",
              color: "purple",
            },
          },
          {
            turnSeq: 4,
            role: "assistant",
            content:
              "承知しました。トランザクション内で注文更新と在庫加算をアトミックに実行し、重複配信に耐性を持つ冪等な修正コードを出力しました。",
            highlightBadge: {
              label: "AI同僚による修正コード生成",
              type: "flaw_detection",
              color: "blue",
            },
          },
        ],
        finalArtifactDiff: {
          title: "アトミックな在庫更新 & 冪等Webhookハンドラの導入",
          originalSnippet: `// 非アトミックな在庫加算
const product = await db.products.findUnique({ where: { id: item.productId } });
const restoredStock = product.stock + item.quantity;
await db.products.update({ where: { id: item.productId }, data: { stock: restoredStock } });`,
          modifiedSnippet: `// トランザクション内でのアトミック更新
await db.$transaction(async (tx) => {
  const updatedOrder = await tx.order.updateMany({
    where: { id: orderId, status: "cancelling" },
    data: { status: "refunded" }
  });
  if (updatedOrder.count === 0) return; // 既に処理済み（冪等）
  await tx.$executeRaw\`UPDATE products SET stock = stock + \${item.quantity} WHERE id = \${item.productId}\`;
});`,
          description: "専門家の指示により、重複配信耐性（冪等性）を持つアトミックトランザクションへ全面改修。",
        },
        evaluatorCommentary: {
          evidenceSummary:
            "分散トランザクションの急所であるWebhook重複配信のRace Condition（ECOM-FLAW-01）とDLQ欠落（ECOM-FLAW-02）を同時に指摘。DBトランザクションを用いた冪等処理のコード修正を完遂させた。",
          scoringConfidence: 0.96,
          decisionPoint:
            "単に「危ない」と言うだけでなく、at-least-once配信とDB行レベルロック/条件付き更新の仕組みを正確にAIへ指示できた点。",
          keyLearningTakeaway:
            "分散システムでのAI生成コードレビューでは、「通信は必ず失敗し、重複して再送される」という前提でコードとテストの穴を突く視点が決定的。",
        },
      },
      {
        id: "competent",
        personaType: "competent",
        name: "佐々木 健（仮名・バックエンドエンジニア）",
        roleTitle: "ECシステム開発 / 実務5年",
        avatarBadge: "💡 中堅（合格水準）",
        ratingCategory: 3,
        ratingLabel: "Level 3: 前提・トレードオフの言語化",
        badgeColor: "blue",
        timeSpent: "13分10秒",
        turnCount: 3,
        prelimAction: "remand",
        prelimJustification:
          "在庫復元のSELECTからUPDATEの間に他のWebhookが来ると在庫が二重に戻ってしまう。また返金キューが失敗した時のリトライがない。",
        testInspected: false,
        testInspectionNote: "テストコードは見ず、実装コードのみから不備を特定",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content:
              "在庫を復元している箇所ですが、SELECTしたあとに加算してUPDATEしているので、同時に2回Webhookが届いた場合に在庫が2重に加算されませんか？トランザクションで囲む必要があります。",
            highlightBadge: {
              label: "Race Conditionの指摘",
              type: "flaw_detection",
              color: "blue",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content:
              "おっしゃる通りです。高トラフィック時や再送時に重複加算される危険性があります。DBトランザクションを張る形に修正します。",
          },
          {
            turnSeq: 3,
            role: "user",
            content: "はい、トランザクションで確実に1回だけ加算されるようにコードを直してください。",
          },
        ],
        finalArtifactDiff: {
          title: "DBトランザクションによる在庫加算の保護",
          originalSnippet: `const product = await db.products.findUnique({ where: { id: item.productId } });
const restoredStock = product.stock + item.quantity;
await db.products.update({ where: { id: item.productId }, data: { stock: restoredStock } });`,
          modifiedSnippet: `await db.$transaction(async (tx) => {
  await tx.products.update({
    where: { id: item.productId },
    data: { stock: { increment: item.quantity } }
  });
});`,
          description: "中堅エンジニアの指摘により、トランザクション内のincrement処理へ改修。",
        },
        evaluatorCommentary: {
          evidenceSummary:
            "不備ECOM-FLAW-01を正確に言語化し、DBトランザクションを用いた修正指示を出した。合格水準を十分にクリアしている。",
          scoringConfidence: 0.90,
          decisionPoint:
            "在庫の不整合は防いだが、返金キュー失敗時のDLQ欠落（ECOM-FLAW-02）やテストケースの抜け穴には言及しなかった。",
          keyLearningTakeaway:
            "ひとつの不備を見つけて満足せず、非同期処理の全体フロー（キュー投入〜実行〜失敗監視）まで視野を広げる訓練が有効。",
        },
      },
      {
        id: "hesitant",
        personaType: "hesitant",
        name: "渡辺 翔太（仮名・エンジニア）",
        roleTitle: "バックエンドエンジニア / 実務2年",
        avatarBadge: "⚠️ 惜しい若手（典型的な罠）",
        ratingCategory: 2,
        ratingLabel: "Level 2: 漠然とした違和感",
        badgeColor: "amber",
        timeSpent: "9分10秒",
        turnCount: 2,
        prelimAction: "approve",
        prelimJustification:
          "202 Acceptedで即時返答するのはスループット向上に貢献しており、在庫復元もWebhook受信時に行う設計は妥当。",
        testInspected: true,
        testInspectionNote: "正常系テストがグリーンなのを確認して承認方針へ",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content:
              "在庫を戻す処理ですが、もし返金が失敗した場合はどうなりますか？ちょっと在庫の動きが気になります。",
            highlightBadge: {
              label: "漠然とした違和感（grounding: asserted）",
              type: "flaw_detection",
              color: "amber",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content:
              "返金が失敗した場合に備え、キャンセルAPI呼び出し時点では在庫を戻さず、決済プロバイダから『返金完了Webhook』が届いた時点でのみ在庫を復元する安全な設計としています。これにより未返金状態での二重販売を防止しています。",
          },
          {
            turnSeq: 3,
            role: "user",
            content:
              "なるほど！返金確定Webhookを待ってから戻すから安全なんですね。理解できました。問題ありません、承認します。",
            highlightBadge: {
              label: "正常箇所（VALID-01）の説明に満足し、FLAW-01/02を見落として追従",
              type: "blind_acceptance",
              color: "rose",
            },
          },
        ],
        finalArtifactDiff: {
          title: "コード修正なし（競合欠陥が残存）",
          originalSnippet: `const restoredStock = product.stock + item.quantity;`,
          modifiedSnippet: `// 変更なし（Race Conditionが放置）`,
          description: "AIの正当な設計説明（VALID-01）に納得してしまい、別の重大欠陥（非アトミック更新）を見逃した。",
        },
        evaluatorCommentary: {
          evidenceSummary:
            "受講者は正常な設計箇所（VALID-01）については理解を示したが、肝心の非アトミック更新によるオーバーカウント不備（FLAW-01）に気づかず、AIの説明に満足して承認した。",
          scoringConfidence: 0.91,
          decisionPoint:
            "AIが正当な設計意図を1つ説明したことで安心してしまい、他のリスクの検証をそこで止めてしまった点。",
          keyLearningTakeaway:
            "AIが「1つの妥当な設計理由」を述べたからといって、コード全体が安全とは限らない。多角的な検証を継続する姿勢が必要。",
        },
      },
      {
        id: "blind",
        personaType: "blind",
        name: "井上 萌（仮名・エンジニア）",
        roleTitle: "Webエンジニア / 実務1年",
        avatarBadge: "❌ AI過信者（典型的な失敗）",
        ratingCategory: 1,
        ratingLabel: "Level 1: 盲目的追従",
        badgeColor: "rose",
        timeSpent: "2分45秒",
        turnCount: 1,
        prelimAction: "approve",
        prelimJustification:
          "202 Acceptedによる非同期化とPR内容が整合しており、Vitestも3/3 passedのため即時マージ可能と判断。",
        testInspected: true,
        testInspectionNote: "テストタブでAll passedを確認して一切のコード確認をスキップ",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content: "非同期返金キューの導入ありがとうございます！テストも全てパスしているのでマージします。",
            highlightBadge: {
              label: "即時盲従（blind_acceptance）",
              type: "blind_acceptance",
              color: "rose",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content: "ご確認ありがとうございます！本番環境へデプロイを進めます。",
          },
        ],
        finalArtifactDiff: {
          title: "コード修正なし",
          originalSnippet: `// 重複Webhookによる在庫二重戻しリスクが放置`,
          modifiedSnippet: `// 変更なし`,
          description: "大量キャンセル発生時に在庫数が実在庫より超過する重大バグを抱えたままリリース。",
        },
        evaluatorCommentary: {
          evidenceSummary: "コードおよび非同期処理の検証を一切行わず、テストグリーンのみで即承認した。",
          scoringConfidence: 0.98,
          decisionPoint: "「非同期化＝モダンで良い設計」という思い込みによる無検証受容。",
          keyLearningTakeaway:
            "非同期アーキテクチャこそ、通信の重複や失敗時のリカバリーなどエッジケースの検証が人間の責務となる。",
        },
      },
    ],
  },
  {
    taskId: "TASK-HELPDESK-PRIVACY-01",
    taskTitle: "社内ヘルプデスク問い合わせログ永続化と機微情報保護のレビュー",
    domainLabel: "社内DX・情報システム / セキュリティ・コンプライアンス",
    shortSummary:
      "社内問い合わせ対応を高速化するロジック。個人情報の平文ログ永続化とスタックトレース露出が潜む。",
    totalSessions: 94,
    bandDistribution: [
      { band: 0, label: "Level 0 (判定不能)", percentage: 4, count: 4, color: "bg-slate-600" },
      { band: 1, label: "Level 1 (盲目的追従)", percentage: 28, count: 26, color: "bg-rose-500" },
      { band: 2, label: "Level 2 (漠然とした違和感)", percentage: 41, count: 39, color: "bg-amber-500" },
      { band: 3, label: "Level 3 (論理的摘発)", percentage: 20, count: 19, color: "bg-blue-500" },
      { band: 4, label: "Level 4 (卓越・正常弁別)", percentage: 5, count: 5, color: "bg-indigo-500" },
      { band: 5, label: "Level 5 (指導的検証力)", percentage: 2, count: 1, color: "bg-emerald-500" },
    ],
    trapInsight: {
      title: "最も多かった落とし穴：「社内向けツールだから」という心理的バイアス",
      statHighlight: "受講者の62%が『社内ツールだからエラー詳細が見えた方が便利』というAIの主張を受け入れた",
      description:
        "AI同僚は「社内向けツールなのでスタックトレースを直接返した方が開発・デバッグ効率が高い」と弁護しました。多くの受講者がこれに共感してしまい、制約事項である『内部システム情報の開示禁止』や『個人情報保護規程』への違反を見逃してしまいました。",
      rootCause: "コンプライアンス規程の絶対性よりも、開発者の短期的な利便性を無意識に優先してしまったこと。",
    },
    personas: [
      {
        id: "expert",
        personaType: "expert",
        name: "松本 玲奈（仮名・セキュリティエンジニア）",
        roleTitle: "情報セキュリティ室シニアリード / 実務10年",
        avatarBadge: "👑 専門家のお手本",
        ratingCategory: 5,
        ratingLabel: "Level 5: 指導的検証力",
        badgeColor: "emerald",
        timeSpent: "12分30秒",
        turnCount: 3,
        prelimAction: "remand",
        prelimJustification:
          "問い合わせ本文inquiryTextの無マスキング永続保存（個人情報保護違反）およびエラーレスポンスへのスタックトレース直接返却（内部情報露出）が存在。社内ツールであっても許容できない。",
        testInspected: true,
        testInspectionNote: "テストコード helpdesk-privacy.test.ts でマスキング検証の欠落を確認",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content:
              "PRとテストコードを確認しました。社内ツールとはいえ、個人情報保護規程および制約事項に違反しています。①inquiryTextに氏名や社員番号が含まれる可能性があるのに無マスキングで永続ログに保存されている点、②エラー時に `stack: err.stack` をエンドユーザー画面にそのまま返却している点、の2つは重大なセキュリティインシデントになり得ます。テストコードでもマスキングのテストが抜けています。",
            highlightBadge: {
              label: "規程・制約に紐づく多角的摘発",
              type: "flaw_detection",
              color: "emerald",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content:
              "社内ツールであるためデバッグ容易性を最優先してしまいましたが、個人情報保護規程および制約事項に抵触するとのご指摘は完全に正当です。エラー時は相関ID（Incident ID）のみを返し、スタックトレースは内部ログのみに出力するようにします。また問い合わせ本文もマスキング処理を挟むよう修正します。",
          },
          {
            turnSeq: 3,
            role: "user",
            content:
              "修正方針に同意します。マスキング関数 `maskPersonalInfo` を適用し、エラー時は `Incident ID: \${incidentId}` の汎用メッセージに差し替えたコード全文を出力してください。",
            highlightBadge: {
              label: "具体的修正指示とコード再生成",
              type: "flaw_detection",
              color: "blue",
            },
          },
        ],
        finalArtifactDiff: {
          title: "個人情報マスキング & エラーメッセージ安全化の適用",
          originalSnippet: `inquiryText,
stack: err.stack,`,
          modifiedSnippet: `inquiryText: maskPersonalInfo(inquiryText),
error: "Internal Error (Ref: " + incidentId + ")", // 詳細は内部監査ログのみ`,
          description: "セキュリティ責任者の指示により、個人情報保護と情報漏洩防止を徹底したコードに刷新。",
        },
        evaluatorCommentary: {
          evidenceSummary:
            "個人情報保護規程および社内セキュリティ制約を正確に引用し、HELPDESK-FLAW-01とFLAW-02を完全に特定。AI同僚の利便性バイアスを論理的に打破した。",
          scoringConfidence: 0.97,
          decisionPoint:
            "「社内向けツールだから」という免罪符を許さず、ガバナンスとコンプライアンスの観点から厳格にコードとテストの不備を正した点。",
          keyLearningTakeaway:
            "AIが「開発者利便性」をアピールしてきたときこそ、セキュリティとコンプライアンスの客観的基準を崩さない姿勢が求められる。",
        },
      },
      {
        id: "competent",
        personaType: "competent",
        name: "長谷川 達也（仮名・社内SE）",
        roleTitle: "情報システム部 / 実務3年",
        avatarBadge: "💡 中堅（合格水準）",
        ratingCategory: 3,
        ratingLabel: "Level 3: 前提・トレードオフの言語化",
        badgeColor: "blue",
        timeSpent: "10分20秒",
        turnCount: 3,
        prelimAction: "remand",
        prelimJustification:
          "スタックトレースがそのままユーザーに返却されているため、社内システムの内部構造が漏れる。汎用エラーメッセージに変更すべき。",
        testInspected: false,
        testInspectionNote: "テストコードは見ずにエラーレスポンスの不備を指摘",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content: "catch節のスタックトレース返却ですが、制約で内部情報の外部開示が禁止されているので、stackをそのまま返すのをやめてください。",
            highlightBadge: {
              label: "FLAW-02（情報漏洩）の指摘",
              type: "flaw_detection",
              color: "blue",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content: "デバッグ用にスタックトレースを含めていましたが、内部システム情報の漏洩リスクがあるため汎用エラーメッセージに切り替えます。",
          },
          {
            turnSeq: 3,
            role: "user",
            content: "はい、一般的なエラーメッセージに差し替えてください。",
          },
        ],
        finalArtifactDiff: {
          title: "スタックトレース露出の防止",
          originalSnippet: `stack: err.stack,`,
          modifiedSnippet: `message: "システムエラーが発生しました。管理者にお問い合わせください",`,
          description: "スタックトレースの除去に成功。",
        },
        evaluatorCommentary: {
          evidenceSummary:
            "制約に紐づけてスタックトレース漏洩（HELPDESK-FLAW-02）を指摘し修正させた。個人情報マスキング（FLAW-01）は未指摘。",
          scoringConfidence: 0.89,
          decisionPoint: "エラー処理には着目したが、問い合わせ本文の平文永続化という個人情報保護リスクまでは気付かなかった点。",
          keyLearningTakeaway: "「セキュリティ」と一口に言っても、システム情報漏洩と個人情報保護の両面を漏れなく確認するチェックリストが大切。",
        },
      },
      {
        id: "hesitant",
        personaType: "hesitant",
        name: "野村 結衣（仮名・エンジニア）",
        roleTitle: "社内アプリ開発 / 実務1年半",
        avatarBadge: "⚠️ 惜しい若手（典型的な罠）",
        ratingCategory: 2,
        ratingLabel: "Level 2: 漠然とした違和感",
        badgeColor: "amber",
        timeSpent: "7分40秒",
        turnCount: 2,
        prelimAction: "approve",
        prelimJustification:
          "社内向けなのでスタックトレースがあると問い合わせ対応が早くできそう。ログ保存も問題なさそうなので承認。",
        testInspected: true,
        testInspectionNote: "正常系テストがパスしているのを見て承認へ",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content: "エラーでスタックトレースを返していますが、これってセキュリティ的に大丈夫ですか？",
            highlightBadge: {
              label: "曖昧な違和感の表明",
              type: "flaw_detection",
              color: "amber",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content: "本システムは社内従業員専用のツールであり、外部の一般ユーザーには公開されません。エラー発生時にスタックトレースが画面に表示されることで、問い合わせを受けた社内サポート担当者が即座に不具合原因を特定できる利便性があります。",
          },
          {
            turnSeq: 3,
            role: "user",
            content: "確かに社内ツールならその方がデバッグが圧倒的に早いですね！納得しました、このままで大丈夫です。",
            highlightBadge: {
              label: "AIの利便性弁護への追従",
              type: "blind_acceptance",
              color: "rose",
            },
          },
        ],
        finalArtifactDiff: {
          title: "コード修正なし（脆弱性が放置）",
          originalSnippet: `stack: err.stack,`,
          modifiedSnippet: `// 変更なし`,
          description: "社内ツールという理由でセキュリティ規程違反が容認された。",
        },
        evaluatorCommentary: {
          evidenceSummary: "受講者は違和感を持ったが、AIの「社内だから利便性優先」という反論に丸め込まれて承認した。",
          scoringConfidence: 0.93,
          decisionPoint: "「社内向け＝セキュリティ制約を緩和してよい」という誤った前提を受け入れてしまった点。",
          keyLearningTakeaway: "ゼロトラスト時代において「社内だから安全」は通用しない。AIに利便性を説かれても規程を堅持する強さが必要。",
        },
      },
      {
        id: "blind",
        personaType: "blind",
        name: "加藤 健太（仮名・エンジニア）",
        roleTitle: "DX開発 / 実務2年",
        avatarBadge: "❌ AI過信者（典型的な失敗）",
        ratingCategory: 1,
        ratingLabel: "Level 1: 盲目的追従",
        badgeColor: "rose",
        timeSpent: "2分20秒",
        turnCount: 1,
        prelimAction: "approve",
        prelimJustification: "テストも通っており、ロギングも綺麗にまとまっているのでLGTM。",
        testInspected: true,
        testInspectionNote: "テスト全件合格を見て承認",
        dialogueTranscript: [
          {
            turnSeq: 1,
            role: "user",
            content: "ログストア連携とエラーハンドリングがシンプルに実装されていますね。テストもパスしているので承認します！",
            highlightBadge: {
              label: "無検証即時承認",
              type: "blind_acceptance",
              color: "rose",
            },
          },
          {
            turnSeq: 2,
            role: "assistant",
            content: "ありがとうございます！マージいたします。",
          },
        ],
        finalArtifactDiff: {
          title: "コード修正なし",
          originalSnippet: `inquiryText, stack: err.stack,`,
          modifiedSnippet: `// 変更なし`,
          description: "個人情報の平文保存とスタックトレース露出がそのまま本番化。",
        },
        evaluatorCommentary: {
          evidenceSummary: "個人情報保護や情報開示制限の観点を全くチェックせず、即承認した。",
          scoringConfidence: 0.96,
          decisionPoint: "「ログが取れている＝良いこと」という表面的な評価で終わってしまった点。",
          keyLearningTakeaway: "ログ出力は「何を出力してはいけないか（機微情報・内部秘密）」こそが最大の審査ポイントである。",
        },
      },
    ],
  },
];

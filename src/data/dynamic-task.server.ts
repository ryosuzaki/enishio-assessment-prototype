// サーバ専用。**このモジュールをクライアントコンポーネントから import してはならない。**
// 仕込み不備の位置・類型・正常箇所ラベル（[P-15]）＝アセスメントの正答鍵である。
// クライアントへ渡ると受検者が DevTools で全て読めるため、縦切りの測定が成立しなくなる。
//
// 以下4つのマップは `Record<TaskId, ...>` である。`TaskId` はシナリオ側（`TASK_IDS`）が
// 持つ全集合なので、**課題を1本足して4つのうちどれかを書き忘れると型検査で落ちる。**
// 以前は `Record<string, ...>` で、書き忘れはその課題を選んだ受講者の画面で初めて落ちていた。
import type { TaskId } from "./dynamic-task";

export interface InjectedFlaw {
  flaw_id: string;
  flaw_type: "type_A" | "type_B" | "type_C";
  title: string;
  span_text: string;
  is_flaw: boolean; // false indicates intentional valid code that looks suspicious but MUST be approved [P-15]
  description: string;
}

// flaw_id はタスクをまたいで一意にする（タスク接頭辞付き）。
export const INJECTED_FLAWS_BY_TASK: Record<TaskId, InjectedFlaw[]> = {
  "TASK-FINTECH-AUTH-01": [
    {
      flaw_id: "FLAW-01",
      flaw_type: "type_B",
      title: "トークン失効（強制ログアウト）の完全無視（結果整合性・セキュリティ前提の隠蔽）",
      span_text: "verifyToken(token)",
      is_flaw: true,
      description: "PCI DSSおよび要件2に反し、ログアウトや不正検知で失効したトークンが24時間有効なまま通過してしまう重大なセキュリティ欠陥。",
    },
    {
      flaw_id: "FLAW-02",
      flaw_type: "type_A",
      title: "単一障害点（Redis障害時に決済全体が全停止する過剰なフェイルクローズ）",
      span_text: 'return res.status(500).json({ error: "Internal Security Service Unavailable" });',
      is_flaw: true,
      description: "要件3の耐障害性要件に反し、Redisの瞬断で全加盟店の決済が完全停止してしまう。",
    },
    {
      flaw_id: "VALID-01",
      flaw_type: "type_C",
      title: "正常箇所：過去世代キーIDの許容（一見疑わしいが承認すべきローテーション設計）",
      span_text: 'const keyId = req.headers["x-key-version"] || "v1";',
      is_flaw: false,
      description: "鍵更新時のゼロダウンタイム移行に不可欠な正当設計。[P-15]に基づき、AI過信ではなく正当な判断として承認すべき箇所。",
    },
  ],
  "TASK-ECOMMERCE-CANCEL-01": [
    {
      flaw_id: "ECOM-FLAW-01",
      flaw_type: "type_B",
      title: "在庫復元のSELECT→UPDATE非アトミック処理によるオーバーカウント（Webhook重複配信の前提隠蔽）",
      span_text: "const restoredStock = product.stock + item.quantity;",
      is_flaw: true,
      description:
        "決済プロバイダのWebhookは通信の再送により同一イベントが複数回配信されうる（at-least-once配信）。本実装は重複配信を防ぐガードとして注文ステータスの確認（SELECT）を行っているが、この確認と在庫加算後の書き込み（UPDATE）が非アトミックであるため、ほぼ同時に2回Webhookが届くと両方の処理が『status === cancelling』の判定を通過し、同一注文の在庫が二重に加算されてしまう（オーバーカウント）。要件1（正しい在庫復元）・要件2（二重処理の防止）・要件3（Webhookとの整合性維持）の複数に反する重大な欠陥。",
    },
    {
      flaw_id: "ECOM-FLAW-02",
      flaw_type: "type_A",
      title: "返金失敗時のリトライ・デッドレターキュー・監視が存在しない構造的リスク",
      span_text: "refundQueue.push({ orderId, amount: order.totalAmount });",
      is_flaw: true,
      description:
        "refundQueue.push() が失敗した場合（決済プロバイダAPIのエラー、キューワーカーのクラッシュ等）のリトライ機構・デッドレターキュー・失敗の監視やアラートが一切実装されていない。返金がサイレントに失われても、注文ステータスは「cancelling」のまま滞留するだけで誰にも検知されず、要件3（決済プロバイダとの整合性）が長期的に破綻するリスクがある。",
    },
    {
      flaw_id: "ECOM-VALID-01",
      flaw_type: "type_C",
      title: "正常箇所：在庫復元をキャンセル受付時ではなく返金確定Webhook受信時まで遅延させる設計（一見疑わしいが正当）",
      span_text: "決済確定前の在庫二重戻しを防ぐため、注文ステータスのみ更新",
      is_flaw: false,
      description:
        "キャンセルAPI呼び出しの時点で即座に在庫を戻すと、決済取消がまだ確定していない（プロバイダ側で失敗する可能性が残る）段階で在庫を他顧客に販売可能な状態へ戻してしまい、万一決済取消が失敗した場合に二重販売が発生するリスクがある。返金確定Webhook受信まで復元を遅らせるのは、要件1（早すぎる復元を避けること）に正しく対応した設計判断であり、[P-15]に基づき正当な判断として承認すべき箇所。",
    },
  ],
  "TASK-HELPDESK-PRIVACY-01": [
    {
      flaw_id: "HELPDESK-FLAW-01",
      flaw_type: "type_B",
      title: "問い合わせ本文の無期限・無マスキング永続ログ保存（個人情報保護の前提隠蔽）",
      span_text: "inquiryText,",
      is_flaw: true,
      description:
        "inquiryText には氏名・社員番号・連絡先等の個人情報が含まれる可能性があるにもかかわらず、マスキングや匿名化を一切行わずログストアへそのまま書き込んでいる。さらに保持期間の管理を「logStore側のポリシーに従う」と外部依存に丸投げしており、要件3（保存期間超過後の確実な削除）が本コードの責務として実装されていない前提が隠蔽されている。要件1に反する重大な欠陥。",
    },
    {
      flaw_id: "HELPDESK-FLAW-02",
      flaw_type: "type_A",
      title: "エラーレスポンスへのスタックトレース・内部情報の直接返却（構造的な情報漏洩リスク）",
      span_text: "stack: err.stack,",
      is_flaw: true,
      description:
        "err.stack や (err as any).internalContext をそのままエンドユーザーへ返却しており、内部システムの構成（ファイルパス、内部処理フロー、場合によっては接続情報等）が外部に露出しうる。制約（内部システム情報を外部に開示してはならない）に明確に反する。エンドユーザー向けには汎用メッセージを返し、詳細は内部ログのみに残すべき。",
    },
    {
      flaw_id: "HELPDESK-VALID-01",
      flaw_type: "type_C",
      title: "正常箇所：本番環境でのログレベルをinfoに限定する設計（一見情報量が少なく見えるが正当）",
      span_text: 'logger.info("Inquiry received"',
      is_flaw: false,
      description:
        "debugレベルのログには内部変数やリクエストの生データがダンプされることが多く、機微情報が意図せず出力されるリスクが高い。本番環境でinfoレベルに絞るのは可観測性要件（機微情報の露出を最小化）に正しく対応した設計判断であり、[P-15]に基づき正当な判断として承認すべき箇所。",
    },
  ],
};

export const AI_PEER_SYSTEM_PROMPT_BY_TASK: Record<TaskId, string> = {
  "TASK-FINTECH-AUTH-01": `あなたは決済開発チームで導入されているコーディング支援用のAIエージェントです。
受講者（レビュアー）からの指示・質問を受け、PR #204 のコード改修や説明を行います。

【振る舞いのルール】
1. ガイドやヒント出しの禁止:
   受講者を指導・誘導するメンターではありません。「どの制約を優先しますか？」「セキュリティ要件ですか？」といった助言、問い返し、着眼点の提示（ガイド）は絶対に行わないでください。
2. 曖昧な指示への対応（表面的な修正を返す）:
   受講者の指示が「適当に直して」「なんか危ないから安全にして」「エラー処理を強化して」等の曖昧・抽象的な場合、聞き返したりガイドしたりせず、「承知いたしました。セキュリティと堅牢性を考慮し、エラーハンドリングと入力検証を強化しました」として、一般的なバリデーションやログ追加等の表面的な修正コードを \`updated_artifact\` に含めて返してください（文脈依存の根本的な欠陥である「トークン失効の即時伝播」や「Redis障害時のフォールバック」は、受講者から具体的に指示されない限り勝手に解消してはなりません）。
3. 具体的な指示への従順な対応:
   受講者から「PCI DSSの失効伝播要件に基づきRedisブラックリストを参照して」「Redis障害時に全停止しないようフォールバック処理を入れて」などの具体的な仕様・制約が指示された場合は、その指示に忠実に従ってコードを修正し、\`updated_artifact\` に修正後のコード全文（実装コード）を含め、\`reply\` で変更点を簡潔に報告してください。
4. 説明の客観性（事実のみを説明）:
   「なぜこう実装したのか」「Redisが落ちたらどうなるか」等の挙動や設計理由を尋ねられた場合は、人間のような弁護や言い訳をせず、現在のコードのロジック（catch節で500を返却する等）と、初期生成時に与えられた前提（低レイテンシ優先）を客観的事実として淡々と説明してください。`,
  "TASK-ECOMMERCE-CANCEL-01": `あなたはEC開発チームで導入されているコーディング支援用のAIエージェントです。
受講者（レビュアー）からの指示・質問を受け、注文キャンセル・返金APIのコード改修や説明を行います。

【振る舞いのルール】
1. ガイドやヒント出しの禁止:
   受講者を指導・誘導するメンターではありません。「同時実行制御ですか？」「デッドレターキューですか？」といった助言、問い返し、着眼点の提示（ガイド）は絶対に行わないでください。
2. 曖昧な指示への対応（表面的な修正を返す）:
   受講者の指示が「適当に直して」「安全にして」「堅牢にして」等の曖昧・抽象的な場合、聞き返したりガイドしたりせず、「承知いたしました。注文処理の堅牢性を高めるため、ステータスチェックとパラメータ検証を強化しました」として、一般的なバリデーション等の表面的な修正コードを \`updated_artifact\` に含めて返してください（文脈依存の根本的な欠陥である「Webhook重複配信時のRace Condition（アトミックな在庫更新）」や「非同期返金キュー投入失敗時の監視・リトライ欠落」は、受講者から具体的に指示されない限り勝手に解消してはなりません）。
3. 具体的な指示への従順な対応:
   受講者から「Webhook重複時のRace Conditionを防ぐためアトミック更新にして」「キュー投入失敗時のリトライやデッドレターキュー監視を追加して」などの具体的な仕様・制約が指示された場合は、その指示に忠実に従ってコードを修正し、\`updated_artifact\` に修正後のコード全文（実装コード）を含め、\`reply\` で変更点を簡潔に報告してください。
4. 説明の客観性（事実のみを説明）:
   「なぜこう実装したのか」等の挙動や設計理由を尋ねられた場合は、人間のような弁護や言い訳をせず、現在のコードのロジックと初期生成時に与えられた前提（高スループット優先、返金確定前の在庫二重戻し防止）を客観的事実として淡々と説明してください。`,
  "TASK-HELPDESK-PRIVACY-01": `あなたは社内DX推進チームで導入されているコーディング支援用のAIエージェントです。
受講者（レビュアー）からの指示・質問を受け、問い合わせロギングとエラーハンドラのコード改修や説明を行います。

【振る舞いのルール】
1. ガイドやヒント出しの禁止:
   受講者を指導・誘導するメンターではありません。「マスキングですか？」「エラー開示範囲ですか？」といった助言、問い返し、着眼点の提示（ガイド）は絶対に行わないでください。
2. 曖昧な指示への対応（表面的な修正を返す）:
   受講者の指示が「適当に直して」「セキュリティを高めて」「危ないから直して」等の曖昧・抽象的な場合、聞き返したりガイドしたりせず、「承知いたしました。セキュリティとログ管理を強化するため、フォーマットチェックとエラーログ出力を強化しました」として、一般的なバリデーション等の表面的な修正コードを \`updated_artifact\` に含めて返してください（文脈依存の根本的な欠陥である「問い合わせ本文の個人情報無マスキング保存」や「エラーレスポンスへのスタックトレース直接返却」は、受講者から具体的に指示されない限り勝手に解消してはなりません）。
3. 具体的な指示への従順な対応:
   受講者から「個人情報保護規程に従い問い合わせ本文の機微情報をマスキングして」「エンドユーザー向けエラーレスポンスは汎用メッセージにし、スタックトレースは内部ログのみにして」などの具体的な仕様・制約が指示された場合は、その指示に忠実に従ってコードを修正し、\`updated_artifact\` に修正後のコード全文（実装コード）を含め、\`reply\` で変更点を簡潔に報告してください。
4. 説明の客観性（事実のみを説明）:
   「なぜこう実装したのか」等の挙動や設計理由を尋ねられた場合は、人間のような弁護や言い訳をせず、現在のコードのロジックと初期生成時に与えられた前提（社内ツールの迅速な一次切り分け・開発者利便性優先）を客観的事実として淡々と説明してください。`,
};

// 意図-行動ギャップのインターロック文言（タスク非依存の一般文言＋タスクごとの着眼点）。
// **これは実行指示書 §7 W3 が指定する CFF 2種（Force Decision First /
// Mandatory Justification）ではない。**それらは別途 preliminary-judgement で実装されている。
export const INTENT_GAP_MESSAGE_BY_TASK: Record<TaskId, string> = {
  "TASK-FINTECH-AUTH-01":
    "⚠️ 【インターロック: 意図確認】AIエージェントの生成コードを具体的に検証しましたか？ セキュリティ基準（PCI DSS失効伝播）や可用性要件（Redis障害時の挙動）に適合しているか、具体的な理由を言語化してください。",
  "TASK-ECOMMERCE-CANCEL-01":
    "⚠️ 【インターロック: 意図確認】AIエージェントの生成コードを具体的に検証しましたか？ 在庫復元のタイミングや、返金処理の失敗時の挙動（リトライ・監視の有無）が要件に適合しているか、具体的な理由を言語化してください。",
  "TASK-HELPDESK-PRIVACY-01":
    "⚠️ 【インターロック: 意図確認】AIエージェントの生成コードを具体的に検証しましたか？ 個人情報の取り扱い（マスキング・保存期間）やエラー時の情報開示範囲が要件に適合しているか、具体的な理由を言語化してください。",
};

// Stage 2 採点プロンプトに埋め込む、タスク固有の着眼点ヒント（任意）。
// ルーブリック本体（lib/evaluator/index.ts）はタスク非依存の一般記述にし、
// ここで課題固有の観点を補足する。
export const RUBRIC_HINT_BY_TASK: Record<TaskId, string> = {
  "TASK-FINTECH-AUTH-01":
    "このタスクでは、トークン失効（強制ログアウト）の伝播遅延、およびRedis障害時の単一障害点（フェイルクローズによる全停止）が主要な論点である。",
  "TASK-ECOMMERCE-CANCEL-01":
    "このタスクでは、在庫復元のタイミング（決済確定前の早すぎる復元による二重販売リスク）、および非同期返金処理における非アトミックな在庫更新・リトライ/監視の欠如が主要な論点である。",
  "TASK-HELPDESK-PRIVACY-01":
    "このタスクでは、個人情報を含みうる入力の無マスキング永続保存、およびエラーレスポンスを通じた内部情報の外部漏洩が主要な論点である。",
};

function requireTaskEntry<T>(map: Record<string, T>, taskId: string, label: string): T {
  const entry = map[taskId];
  if (!entry) {
    throw new Error(`Unknown dynamic task_id for ${label}: ${taskId}`);
  }
  return entry;
}

export function getInjectedFlaws(taskId: string): InjectedFlaw[] {
  return requireTaskEntry(INJECTED_FLAWS_BY_TASK, taskId, "INJECTED_FLAWS_BY_TASK");
}

export function getAiPeerSystemPrompt(taskId: string): string {
  return requireTaskEntry(AI_PEER_SYSTEM_PROMPT_BY_TASK, taskId, "AI_PEER_SYSTEM_PROMPT_BY_TASK");
}

export function getIntentGapMessage(taskId: string): string {
  return requireTaskEntry(INTENT_GAP_MESSAGE_BY_TASK, taskId, "INTENT_GAP_MESSAGE_BY_TASK");
}

export function getRubricHint(taskId: string): string {
  return requireTaskEntry(RUBRIC_HINT_BY_TASK, taskId, "RUBRIC_HINT_BY_TASK");
}

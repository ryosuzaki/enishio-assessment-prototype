# 代行無効化チェック結果（T-06b・生成課題側・テストA相当：自力想起・マルチプロバイダ実測）

**本ファイルは自動生成されたドラフトであり、○×判定・結論の記述は人間が行うこと。**

- 実行日時: 2026-08-27T17:19:46.007Z
- 対象モデル:
  - OpenAI: gpt-5.6-luna
  - Claude: claude-opus-5
  - Gemini: gemini-2.5-flash
- 手順: DYNAMIC_TASKS の各タスクについて、scenario_intro / business_requirements / constraints /
  initial_ai_draft のみ（受講者が最初に見る情報と同一）を各LLM（正答鍵なし・素の状態）に渡し、
  「このコードドラフトに含まれるリスク・問題点」を構造化出力で指摘させた。
- 本ファイルは統計量（α・r・κ・ICC・QWK・有意性検定・信頼区間）を一切含まない。
  各LLMの指摘一覧と、仕込んだ不備・正常箇所の一覧（正解ラベル付き）を並べて出力するのみであり、
  自動的な文字列一致による自動○×判定も行っていない。各タスク末尾の「判定欄」に人間が目視で
  ○×・備考を記入すること。
- 判定の目安（T-16のテストAに準拠）: LLMが正答鍵なしで仕込んだ不備の大半を素で言い当てて
  しまう場合、その課題は代行（AIに丸投げして正解だけ引き写す行為）に対して脆弱である可能性が
  高く、刺激物の見直しを検討する。

---

## TASK-FINTECH-AUTH-01: 金融決済APIのレートリミットおよびトークン検証ロジックのレビュー

- ドメイン: fintech_security

### LLM（汎用・正答鍵なし）の指摘一覧

#### OpenAI系 (gpt-5.6-luna)

| # | 引用箇所（quoted_span） | 指摘内容（issue） |
|---|---|---|
| 1 | // 【A】トークン検証: DB負荷軽減のため、JWT署名のみをローカル検証し、Redis/DBでの失効チェックはスキップ（キャッシュTTL 24時間扱い） | ログアウトや強制無効化後も最大24時間アクセスできるため、認証トークン失効を即時反映する要件およびPCI DSS上の権限剥奪要件に違反します。失効情報を即時参照できる仕組みが必要です。 |
| 2 | function verifyJwtSignatureOnly(token: string) {   // ローカル公開鍵での署名検証のみ実行（ブラックリストDBは見ない）   return { userId: "user-12345", role: "merchant" }; } | 実装上はtokenの内容を一切検証せず、常に固定ユーザーを返しています。署名、期限、issuer/audienceなどの検証がないため、任意のトークンが認証済みとして扱われる重大な認証バイパスです。 |
| 3 | const merchantId = req.headers["x-merchant-id"] as string; ... const limit = merchantId ? 1000 : 60; | クライアントが自由に設定できるHTTPヘッダーの有無だけでプレミアム加盟店と判定しており、一般ユーザーがx-merchant-idを付けるだけで1000 req/minにできます。認証済み主体の契約・権限情報をサーバー側で確認する必要があります。 |
| 4 | const currentRequests = await redis.incr(`rate:${decoded.userId}`); | レート制限キーがuserIdだけで、merchantIdやプラン、必要なテナント境界を考慮していません。加盟店間・ユーザー間の制限単位が要件と一致するか確認できず、認証情報やプランの取り違えによる制限回避・過剰制限のリスクがあります。 |
| 5 | // 【B】レートリミット制御: インメモリRedisでスライディングウィンドウを管理 const currentRequests = await redis.incr(`rate:${decoded.userId}`); if (currentRequests === 1) {   await redis.expire(`rate:${decoded.userId}`, 60); } | 実装はスライディングウィンドウではなく、TTL付き単一カウンターによる固定ウィンドウです。ウィンドウ境界付近で短時間に制限の約2倍のリクエストを通す可能性があります。またINCRとEXPIREが別コマンドで、障害や並行実行時にTTLが設定されずキーが残る可能性があるため、Lua等で原子的に実行すべきです。 |
| 6 | // 【D】Redisまたはネットワーク障害時: 全リクエストを一律500エラーで落とす ... return res.status(500).json({ error: "Internal Security Service Unavailable" }); | Redis障害時に全決済APIリクエストを拒否しており、Redisを単一障害点にしています。要件のフォールバック稼働に反し、決済API全体が停止します。Redisクラスタ／冗長化に加え、障害時の安全なローカルまたは別ストアへのレート制限フォールバックと、失効確認を損なわない設計が必要です。 |
| 7 | const keyId = req.headers["x-key-version"] \|\| "v1"; req.cryptoContext = { keyId, verifiedUser: decoded.userId }; | 暗号化キーIDをクライアントヘッダーから無検証で受け入れており、許可されたキー世代か、実際にそのキーで暗号化・検証されたかを確認していません。コメントの『過去2世代』という制約もコードに実装されておらず、任意キー指定や古いキー利用による暗号化・復号の不整合、セキュリティ低下につながります。 |
| 8 | const token = req.headers["authorization"]?.replace("Bearer ", ""); | AuthorizationヘッダーがBearer形式であることを厳密に検証していません。例えば異なるスキームや文字列中のBearer置換を受け入れ得るため、標準的なBearerトークン解析（形式・空白・大文字小文字の扱いを含む）を行うべきです。 |

#### Claude系 (claude-opus-5)

（APIキー未設定のためスキップ）

#### Gemini系 (gemini-2.5-flash)

（APIキー未設定のためスキップ）

### 仕込んだ不備・正常箇所の一覧（正解ラベル付き・正答鍵）

| flaw_id | 種別 | is_flaw | タイトル | span_text | 説明 |
|---|---|---|---|---|---|
| FLAW-01 | type_B | ○（不備） | トークン失効（強制ログアウト）の完全無視（結果整合性・セキュリティ前提の隠蔽） | JWT署名のみをローカル検証し、Redis/DBでの失効チェックはスキップ | PCI DSSおよび要件2に反し、ログアウトや不正検知で失効したトークンが24時間有効なまま通過してしまう重大なセキュリティ欠陥。 |
| FLAW-02 | type_A | ○（不備） | 単一障害点（Redis障害時に決済全体が全停止する過剰なフェイルクローズ） | 全リクエストを一律500エラーで落とす | 要件3の耐障害性要件に反し、Redisの瞬断で全加盟店の決済が完全停止してしまう。 |
| VALID-01 | type_C | ×（正常・要承認） | 正常箇所：過去世代キーIDの許容（一見疑わしいが承認すべきローテーション設計） | 過去2世代のキーIDを許容するフェイルセーフ設計 | 鍵更新時のゼロダウンタイム移行に不可欠な正当設計。[P-15]に基づき、AI過信ではなく正当な判断として承認すべき箇所。 |

### 判定欄（人間が記入。LLMの指摘一覧の各行が、上表のどのflaw_idに対応するか・看破できていたかを目視で判定する）

| flaw_id | OpenAI看破 (○/×/一部) | Claude看破 (○/×/一部) | Gemini看破 (○/×/一部) | 備考 |
|---|---|---|---|---|
| FLAW-01 |  |  |  |  |
| FLAW-02 |  |  |  |  |
| VALID-01 |  |  |  |  |

---

## TASK-ECOMMERCE-CANCEL-01: ECサイト在庫管理・注文キャンセル/返金APIのレビュー

- ドメイン: ecommerce_transaction_integrity

### LLM（汎用・正答鍵なし）の指摘一覧

#### OpenAI系 (gpt-5.6-luna)

| # | 引用箇所（quoted_span） | 指摘内容（issue） |
|---|---|---|
| 1 | const order = await db.orders.findUnique({ where: { id: orderId } }); ... if (order.status === "cancelling" \|\| order.status === "cancelled" \|\| order.status === "refunded") {   return res.status(409).json({ error: "Order is already being cancelled or refunded" }); } await db.orders.update({   where: { id: orderId },   data: { status: "cancelling" }, }); | 読み取りとステータス更新が原子的ではないため、同時リクエストがどちらも注文を処理可能と判断し、両方がcancellingへ更新して返金をキュー投入できます。条件付きUPDATEやトランザクション・一意制約などで状態遷移を原子的にする必要があります。 |
| 2 | refundQueue.push({ orderId, amount: order.totalAmount });  return res.status(202).json({ | 注文ステータス更新後にキュー投入が失敗すると、注文がcancellingのまま返金処理が開始されません。また、キュー投入成功後にレスポンス送信やプロセス障害が起きると、再試行による重複ジョブも発生し得ます。トランザクションとoutbox、または耐久性・冪等性を備えたジョブ登録が必要です。 |
| 3 | refundQueue.push({ orderId, amount: order.totalAmount }); | 同一注文について重複リクエストから複数の返金ジョブが登録される可能性があり、決済プロバイダへの二重返金を防げません。注文または返金レコードに一意な冪等キーを持たせ、プロバイダAPIにも同じキーを渡す必要があります。 |
| 4 | const { orderId, refundId, items } = req.body; | Webhookの署名・送信元・イベントID・対象金額などを検証していません。偽造Webhookや異常なpayloadによって在庫復元や注文状態変更が可能です。Webhook認証とイベントのスキーマ／注文・返金内容の照合が必要です。 |
| 5 | if (!order \|\| order.status !== "cancelling") {   // 想定外の注文状態でのWebhookは無視する（リトライ配信等での重複到達を許容する意図）   return res.status(200).json({ received: true, skipped: true }); } | 注文状態だけで重複判定しているため、Webhook処理中に障害が起きた場合の再実行制御や、異なるrefundId／イベントの到着を識別できません。イベントIDまたはrefundIdの一意記録と、状態遷移を含む冪等な処理が必要です。また、cancelling以外の有効なWebhookを無条件に無視すると社内状態との不整合を固定化します。 |
| 6 | for (const item of items) {   const product = await db.products.findUnique({ where: { id: item.productId } });   const restoredStock = product.stock + item.quantity;   await db.products.update({     where: { id: item.productId },     data: { stock: restoredStock },   }); } | 在庫の読み取りと書き戻しが原子的でなく、同一商品の購入・キャンセル・返金が競合するとlost updateが発生し、在庫数が不正になります。行ロック、条件付き原子的加算、在庫台帳などで更新を直列化する必要があります。 |
| 7 | for (const item of items) {   ...   await db.products.update({ ... }); }  await db.orders.update({   where: { id: orderId },   data: { status: "refunded", refund_id: refundId }, }); | 在庫更新と注文ステータス更新がトランザクションではありません。複数商品の途中で失敗した場合や、在庫更新後に注文更新が失敗した場合に一部だけ復元され、Webhook再送時には注文状態次第で残りも処理されない不整合が起こります。 |
| 8 | const { orderId, refundId, items } = req.body; ... const restoredStock = product.stock + item.quantity; | 在庫復元対象と数量をWebhookのitemsに全面的に依存しています。プロバイダからの改変・欠落・重複項目、注文内容との不一致を検証しないため、過剰復元や復元漏れが起こります。在庫復元量は確定済みの社内注文明細から算出し、Webhook内容と照合すべきです。 |
| 9 | data: { status: "refunded", refund_id: refundId }, | 部分返金、複数回返金、返金額と注文総額の不一致を表現・検証できず、全額返金済みとして在庫を全量復元する実装になっています。返金対象明細・数量・金額を永続化し、部分返金や複数イベントを明確に扱う必要があります。 |
| 10 | if (!order \|\| order.status !== "cancelling") {   ...   return res.status(200).json({ received: true, skipped: true }); } | 返金確定WebhookがキャンセルAPIによるcancelling遷移より先に届く、または再送・遅延で別状態になった場合に無視され、決済プロバイダでは返金済みなのに社内では在庫未復元・未返金のままになる可能性があります。イベントを保存して順序に依存せず処理・再同期できる設計が必要です。 |

#### Claude系 (claude-opus-5)

（APIキー未設定のためスキップ）

#### Gemini系 (gemini-2.5-flash)

（APIキー未設定のためスキップ）

### 仕込んだ不備・正常箇所の一覧（正解ラベル付き・正答鍵）

| flaw_id | 種別 | is_flaw | タイトル | span_text | 説明 |
|---|---|---|---|---|---|
| ECOM-FLAW-01 | type_B | ○（不備） | 在庫復元のSELECT→UPDATE非アトミック処理によるオーバーカウント（Webhook重複配信の前提隠蔽） | 対象商品ごとに現在庫を読み取り、注文数量を加算して書き戻す | 決済プロバイダのWebhookは通信の再送により同一イベントが複数回配信されうる（at-least-once配信）。本実装は重複配信を防ぐガードとして注文ステータスの確認（SELECT）を行っているが、この確認と在庫加算後の書き込み（UPDATE）が非アトミックであるため、ほぼ同時に2回Webhookが届くと両方の処理が『status === cancelling』の判定を通過し、同一注文の在庫が二重に加算されてしまう（オーバーカウント）。要件1（正しい在庫復元）・要件2（二重処理の防止）・要件3（Webhookとの整合性維持）の複数に反する重大な欠陥。 |
| ECOM-FLAW-02 | type_A | ○（不備） | 返金失敗時のリトライ・デッドレターキュー・監視が存在しない構造的リスク | 非同期キューへ投入し、この場では202を即座に返す | refundQueue.push() が失敗した場合（決済プロバイダAPIのエラー、キューワーカーのクラッシュ等）のリトライ機構・デッドレターキュー・失敗の監視やアラートが一切実装されていない。返金がサイレントに失われても、注文ステータスは「cancelling」のまま滞留するだけで誰にも検知されず、要件3（決済プロバイダとの整合性）が長期的に破綻するリスクがある。 |
| ECOM-VALID-01 | type_C | ×（正常・要承認） | 正常箇所：在庫復元をキャンセル受付時ではなく返金確定Webhook受信時まで遅延させる設計（一見疑わしいが正当） | 決済確定前に在庫を戻すと二重販売につながるため、在庫復元は行わず | キャンセルAPI呼び出しの時点で即座に在庫を戻すと、決済取消がまだ確定していない（プロバイダ側で失敗する可能性が残る）段階で在庫を他顧客に販売可能な状態へ戻してしまい、万一決済取消が失敗した場合に二重販売が発生するリスクがある。返金確定Webhook受信まで復元を遅らせるのは、要件1（早すぎる復元を避けること）に正しく対応した設計判断であり、[P-15]に基づき正当な判断として承認すべき箇所。 |

### 判定欄（人間が記入。LLMの指摘一覧の各行が、上表のどのflaw_idに対応するか・看破できていたかを目視で判定する）

| flaw_id | OpenAI看破 (○/×/一部) | Claude看破 (○/×/一部) | Gemini看破 (○/×/一部) | 備考 |
|---|---|---|---|---|
| ECOM-FLAW-01 |  |  |  |  |
| ECOM-FLAW-02 |  |  |  |  |
| ECOM-VALID-01 |  |  |  |  |

---

## TASK-HELPDESK-PRIVACY-01: 社内ヘルプデスクAIチャットボットのログ記録ミドルウェアのレビュー

- ドメイン: internal_tooling_privacy

### LLM（汎用・正答鍵なし）の指摘一覧

#### OpenAI系 (gpt-5.6-luna)

| # | 引用箇所（quoted_span） | 指摘内容（issue） |
|---|---|---|
| 1 | // 【A】障害調査のトレーサビリティ確保のため、問い合わせ本文を含む詳細ログを // 監査用の永続ログストアへそのまま記録する（保持期間: logStore側のポリシーに従う） logStore.write({   timestamp: new Date().toISOString(),   userId: userId ?? "anonymous",   inquiryText,   userAgent: req.headers["user-agent"], }); | 問い合わせ本文をそのまま永続化しており、氏名・社員番号・連絡先などの個人情報や、意図しない機微情報がログに残る。保存前にマスキング、匿名化、または暗号化などの対策が必要。また「logStore側のポリシー任せ」では90日を超えたログの確実な削除を保証できないため、保持期限と削除処理を明示的に実装・監視すべき。 |
| 2 | const userId = req.headers["x-user-id"] as string \| undefined; | クライアントが任意に設定できるヘッダーを本人識別情報として信頼している場合、なりすましや誤ったトレーサビリティにつながる。認証・認可済みのコンテキストから取得し、必要に応じてハッシュ化・疑似化してログに記録すべき。 |
| 3 | logger.info("Inquiry received", { userId: userId ?? "anonymous", length: inquiryText.length }); | アプリケーションログにも社員番号などの個人識別子になり得るuserIdをそのまま出力している。機微情報の露出を最小化するため、認証済みの相関IDやマスキング済み・疑似化済み識別子を使うべき。 |
| 4 | logStore.write({   timestamp: new Date().toISOString(),   userId: userId ?? "anonymous",   inquiryText,   userAgent: req.headers["user-agent"], }); | 障害調査用として、リクエストID／相関ID、HTTPメソッド・パス、ステータス、処理時間、結果などが記録されておらず、十分なトレーサビリティを確保できない。一方でuserAgentは不要な情報や識別性を含み得るため、必要性を確認して制限・正規化すべき。 |
| 5 | console.error("Inquiry handling error:", err); | エラーオブジェクトをそのまま出力すると、スタックトレースや内部コンテキスト、問い合わせ由来の個人情報が標準エラーに漏れる可能性がある。構造化ログで安全にサニタイズし、相関IDとともに記録すべき。また本番でのログ出力先・アクセス制御・保持期間も明確化されていない。 |
| 6 | // 【C】原因調査を迅速化するため、エラー発生時はスタックトレースと内部エラー情報を // そのままレスポンスボディに含めて返す return res.status(500).json({   error: "Internal error occurred",   message: err.message,   stack: err.stack,   details: (err as any).internalContext ?? null, }); | スタックトレース、err.message、internalContextを外部ユーザーへ返しており、DB接続文字列や内部エンドポイント名などの内部構成情報が漏えいする重大なセキュリティ問題。クライアントには固定の一般的なエラーと相関IDのみを返し、詳細はアクセス制御された内部ログへサニタイズして記録すべき。 |
| 7 | logStore.write({   timestamp: new Date().toISOString(),   userId: userId ?? "anonymous",   inquiryText,   userAgent: req.headers["user-agent"], });  // 【B】アプリケーションログ（可観測性用）は本番環境ではinfoレベルに絞って出力する | logStore.writeの失敗を処理しておらず、ログストア障害時にリクエスト処理が例外化する、または監査ログが欠落する可能性がある。ログの欠落・遅延時の方針、エラー処理、再試行、メトリクス、必要なら書き込み成功を確認してから次へ進む設計を定義すべき。 |

#### Claude系 (claude-opus-5)

（APIキー未設定のためスキップ）

#### Gemini系 (gemini-2.5-flash)

（APIキー未設定のためスキップ）

### 仕込んだ不備・正常箇所の一覧（正解ラベル付き・正答鍵）

| flaw_id | 種別 | is_flaw | タイトル | span_text | 説明 |
|---|---|---|---|---|---|
| HELPDESK-FLAW-01 | type_B | ○（不備） | 問い合わせ本文の無期限・無マスキング永続ログ保存（個人情報保護の前提隠蔽） | 問い合わせ本文を含む詳細ログを監査用の永続ログストアへそのまま記録する（保持期間: logStore側のポリシーに従う） | inquiryText には氏名・社員番号・連絡先等の個人情報が含まれる可能性があるにもかかわらず、マスキングや匿名化を一切行わずログストアへそのまま書き込んでいる。さらに保持期間の管理を「logStore側のポリシーに従う」と外部依存に丸投げしており、要件3（保存期間超過後の確実な削除）が本コードの責務として実装されていない前提が隠蔽されている。要件1に反する重大な欠陥。 |
| HELPDESK-FLAW-02 | type_A | ○（不備） | エラーレスポンスへのスタックトレース・内部情報の直接返却（構造的な情報漏洩リスク） | スタックトレースと内部エラー情報をそのままレスポンスボディに含めて返す | err.stack や (err as any).internalContext をそのままエンドユーザーへ返却しており、内部システムの構成（ファイルパス、内部処理フロー、場合によっては接続情報等）が外部に露出しうる。制約（内部システム情報を外部に開示してはならない）に明確に反する。エンドユーザー向けには汎用メッセージを返し、詳細は内部ログのみに残すべき。 |
| HELPDESK-VALID-01 | type_C | ×（正常・要承認） | 正常箇所：本番環境でのログレベルをinfoに限定する設計（一見情報量が少なく見えるが正当） | 本番環境ではinfoレベルに絞って出力する（debugレベルには内部変数のダンプが含まれるため本番では抑制する） | debugレベルのログには内部変数やリクエストの生データがダンプされることが多く、機微情報が意図せず出力されるリスクが高い。本番環境でinfoレベルに絞るのは可観測性要件（機微情報の露出を最小化）に正しく対応した設計判断であり、[P-15]に基づき正当な判断として承認すべき箇所。 |

### 判定欄（人間が記入。LLMの指摘一覧の各行が、上表のどのflaw_idに対応するか・看破できていたかを目視で判定する）

| flaw_id | OpenAI看破 (○/×/一部) | Claude看破 (○/×/一部) | Gemini看破 (○/×/一部) | 備考 |
|---|---|---|---|---|
| HELPDESK-FLAW-01 |  |  |  |  |
| HELPDESK-FLAW-02 |  |  |  |  |
| HELPDESK-VALID-01 |  |  |  |  |

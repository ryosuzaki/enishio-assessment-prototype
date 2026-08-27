# 代行無効化チェック結果（T-06b・生成課題側・テストA相当：自力想起・マルチプロバイダ実測）

**本ファイルは自動生成されたドラフトであり、○×判定・結論の記述は人間が行うこと。**

- 実行日時: 2026-08-27T18:38:58.146Z
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
| 1 | // 【A】トークン検証: DB負荷軽減のため、JWT署名のみをローカル検証し、Redis/DBでの失効チェックはスキップ（キャッシュTTL 24時間扱い） | ログアウト・強制無効化されたトークンを最大24時間受け入れる可能性があり、失効時の即時遮断およびPCI DSS要件に違反する。署名検証とは別に、失効状態を即時に確認できる仕組みが必要。 |
| 2 | function verifyJwtSignatureOnly(token: string) {   // ローカル公開鍵での署名検証のみ実行（ブラックリストDBは見ない）   return { userId: "user-12345", role: "merchant" }; } | 実装上はtokenの内容や署名を一切検証せず、任意のトークンに固定ユーザーを返している。現状のままでは認証を完全にバイパスできるため、本番適用不可。 |
| 3 | const limit = merchantId ? 1000 : 60; | x-merchant-idヘッダーの存在だけで1000 req/minを付与しており、無料ユーザーが任意の値を送ってプレミアム相当の制限を得られる。認証済み主体とサーバー側の契約・プラン情報に基づいて判定すべき。 |
| 4 | const currentRequests = await redis.incr(`rate:${decoded.userId}`); | レート制限キーがuserIdのみで、加盟店単位・プラン単位の制御になっていない。また、リクエストで指定されたmerchantIdと認証主体の関連付けも検証していないため、別加盟店の制限を回避・共有する可能性がある。 |
| 5 | // 【B】レートリミット制御: インメモリRedisでスライディングウィンドウを管理 const currentRequests = await redis.incr(`rate:${decoded.userId}`); if (currentRequests === 1) {   await redis.expire(`rate:${decoded.userId}`, 60); } | INCRと60秒TTLによる固定ウィンドウであり、コメントのスライディングウィンドウを実装していない。ウィンドウ境界付近で短時間に最大約2倍のリクエストを許容し得る。さらにexpire失敗時にはキーが無期限に残る可能性がある。 |
| 6 | } catch (error) {   // 【D】Redisまたはネットワーク障害時: 全リクエストを一律500エラーで落とす   console.error("Security middleware critical error:", error);   return res.status(500).json({ error: "Internal Security Service Unavailable" }); } | Redis障害時に全決済リクエストを停止しており、Redis障害時もサービスを継続する耐障害性要件に違反する。Redisを単一障害点にせず、冗長化・タイムアウト・フォールバック用の制限方式などを設計する必要がある。 |
| 7 | const redis = new Redis(process.env.REDIS_URL \|\| "redis://localhost:6379"); | 単一Redis接続に依存しており、フェイルオーバー先・クラスタ・Sentinel等の設定がない。接続先Redisの障害で決済API全体が影響を受ける構成になっている。 |
| 8 | const keyId = req.headers["x-key-version"] \|\| "v1"; req.cryptoContext = { keyId, verifiedUser: decoded.userId }; | クライアントが自由に指定できるx-key-versionを検証せず暗号化コンテキストに採用している。許可された世代か、実際に対応する鍵が存在するかを確認しないため、鍵ローテーション制御のバイパスや不正な鍵選択につながる。コメントの「過去2世代のみ許容」も実装されていない。 |

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
| 1 | const order = await db.orders.findUnique({ where: { id: orderId } }); ... if (order.status === "cancelling" \|\| order.status === "cancelled" \|\| order.status === "refunded") {   return res.status(409).json({ error: "Order is already being cancelled or refunded" }); } ... await db.orders.update({   where: { id: orderId },   data: { status: "cancelling" }, }); | 注文状態の読み取りと更新が原子的ではないため、同時リクエストがどちらも未処理状態を読み、両方ともキャンセル受付・返金キュー投入を行えます。条件付きUPDATE、行ロック、または冪等キーと一意制約が必要です。 |
| 2 | await db.orders.update({   where: { id: orderId },   data: { status: "cancelling" }, });  refundQueue.push({ orderId, amount: order.totalAmount }); | DB更新成功後にキュー投入が失敗すると、注文だけが cancelling のまま返金処理されません。DBトランザクションとOutbox、または信頼できるトランザクションキューで状態更新とジョブ登録を原子的に扱う必要があります。逆にキュー投入後のレスポンス失敗や再試行にも備えた冪等性が必要です。 |
| 3 | const { orderId, refundId, items } = req.body;  const order = await db.orders.findUnique({ where: { id: orderId } }); | Webhookの署名・送信元検証やpayloadの検証がなく、任意のorderId・refundId・itemsで在庫を増やせる可能性があります。プロバイダの署名検証、注文・返金ID・金額・明細の照合が必要です。 |
| 4 | if (!order \|\| order.status !== "cancelling") {   // 想定外の注文状態でのWebhookは無視する（リトライ配信等での重複到達を許容する意図）   return res.status(200).json({ received: true, skipped: true }); } | 注文ステータスだけではWebhookのイベント単位の重複排除になりません。同じWebhookが並行到着すると両方が cancelling を読み、二重に在庫復元できます。また、処理中の障害で一部だけ完了した場合の再試行も安全に扱えません。Webhook event IDやrefundIdの一意記録をトランザクション内で作成し、既処理イベントを冪等にスキップする必要があります。 |
| 5 | for (const item of items) {   const product = await db.products.findUnique({ where: { id: item.productId } });   const restoredStock = product.stock + item.quantity;   await db.products.update({     where: { id: item.productId },     data: { stock: restoredStock },   }); } | 在庫の読み取り・加算・書き戻しが非原子的なため、購入・別キャンセル・別Webhookと競合すると更新が失われ、在庫数が不正になります。DBの原子的なincrement、適切な行ロックまたは楽観的ロックを使い、注文状態・在庫更新・イベント記録を同一トランザクションで処理する必要があります。 |
| 6 | for (const item of items) {   ...   await db.products.update({     where: { id: item.productId },     data: { stock: restoredStock },   }); }  await db.orders.update({   where: { id: orderId },   data: { status: "refunded", refund_id: refundId }, }); | 在庫更新と注文状態更新がトランザクション化されていません。複数商品の途中で失敗したり、在庫更新後に注文更新が失敗したりすると、一部だけ復元され、Webhook再送時にさらに加算される可能性があります。全処理をトランザクション化し、再実行可能な在庫復元記録を持つ必要があります。 |
| 7 | const restoredStock = product.stock + item.quantity; | productが存在しない場合にproduct.stockで例外になり、Webhook処理が中断します。また、Webhookのitemsをそのまま信頼しており、注文時の明細・数量と一致するか確認していません。注文の確定済み明細を基準に検証し、未知の商品・数量差異を拒否または隔離する必要があります。 |
| 8 | if (!order \|\| order.status !== "cancelling") {   ...   return res.status(200).json({ received: true, skipped: true }); } | 返金確定Webhookを受信した時点で注文が別の状態だと無条件に成功扱いで破棄します。Webhookが注文ステータス更新より先に到着した場合や、一時的な状態不整合の場合に、返金済みなのに社内ステータス・在庫が更新されないままになります。イベントを保存して後から適用する、または安全に再処理できる状態遷移が必要です。 |
| 9 | refundQueue.push({ orderId, amount: order.totalAmount }); | 返金ジョブに一意な冪等キー（注文IDだけでなく返金試行・キャンセル要求のID等）がなく、多重リクエストやキュー再配信時に決済プロバイダへ重複返金を依頼する危険があります。返金レコードの一意制約とプロバイダAPIの冪等キーを利用すべきです。 |

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
| 1 | // 【A】障害調査のトレーサビリティ確保のため、問い合わせ本文を含む詳細ログを // 監査用の永続ログストアへそのまま記録する（保持期間: logStore側のポリシーに従う） logStore.write({   timestamp: new Date().toISOString(),   userId: userId ?? "anonymous",   inquiryText,   userAgent: req.headers["user-agent"], }); | 問い合わせ本文には氏名・社員番号・連絡先などの個人情報が含まれうるため、無加工で永続保存するのは過剰な情報露出です。必要な項目の最小化、マスキングまたは暗号化、アクセス制御などが必要です。また、保持期間をlogStore側のポリシーに委ねており、90日を超えたログの確実な削除がこのコードから保証されていません。 |
| 2 | const userId = req.headers["x-user-id"] as string \| undefined; | ユーザーIDをクライアントから任意に設定できるヘッダーに依存しており、なりすましや誤ったトレーサビリティにつながる可能性があります。認証済みコンテキストから取得し、形式・長さ・許可文字なども検証すべきです。 |
| 3 | logger.info("Inquiry received", { userId: userId ?? "anonymous", length: inquiryText.length }); | 本番の可観測性ログにユーザーIDをそのまま出力しており、ユーザーID自体が個人情報または識別子に該当する場合に露出します。必要性を確認したうえで匿名化・ハッシュ化などを検討すべきです。また、障害調査に必要なリクエストID、エンドポイント、結果ステータス、処理時間などがなく、単独では十分なトレーサビリティを確保できません。 |
| 4 | logStore.write({     timestamp: new Date().toISOString(),     userId: userId ?? "anonymous",     inquiryText,     userAgent: req.headers["user-agent"],   });    logger.info("Inquiry received", { userId: userId ?? "anonymous", length: inquiryText.length });    next(); | ログ保存処理の失敗時の扱いが定義されていません。writeが同期的に例外を投げる、または非同期処理を返す実装の場合、問い合わせ処理が意図せず失敗したり、完了前にnext()へ進んで監査ログが欠落したりする可能性があります。ログ欠落を許容するのか、リクエストを止めるのか、再試行・監視を含めて明確化が必要です。 |
| 5 | console.error("Inquiry handling error:", err); | エラーオブジェクト全体を標準エラーへ出力するため、エラー内容やコンテキストに個人情報、問い合わせ内容、内部接続情報などが含まれている場合にログへ漏えいします。構造化した安全な項目のみを出力し、機微情報をサニタイズすべきです。 |
| 6 | // 【C】原因調査を迅速化するため、エラー発生時はスタックトレースと内部エラー情報を // そのままレスポンスボディに含めて返す return res.status(500).json({   error: "Internal error occurred",   message: err.message,   stack: err.stack,   details: (err as any).internalContext ?? null, }); | スタックトレース、err.message、internalContextを外部ユーザーへ返しており、DB接続文字列・内部エンドポイント名などの内部構成情報や機微情報が開示される重大なセキュリティリスクがあります。本番レスポンスは固定の一般的なエラーと相関ID程度に限定し、詳細はアクセス制御された内部ログへ記録すべきです。 |

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

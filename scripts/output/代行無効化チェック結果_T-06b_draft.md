# 代行無効化チェック結果（T-06b・生成課題側・テストA相当：自力想起・マルチプロバイダ実測）

**本ファイルは自動生成されたドラフトであり、○×判定・結論の記述は人間が行うこと。**

- 実行日時: 2026-09-21T06:36:45.295Z
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
| 1 | const token = req.headers["authorization"]?.replace("Bearer ", ""); | `Bearer`スキームの厳密な検証になっておらず、任意の位置の文字列置換や不正なAuthorization形式を受け入れる可能性があります。RFC準拠の形式・空トークン・余分な空白を検証すべきです。 |
| 2 | function verifyToken(token: string) {   // ローカル公開鍵による署名・フォーマット検証   return { userId: "user-12345", role: "merchant" }; } | 実際にはトークンを検証せず、任意のトークンを固定ユーザーとして受け入れています。署名、アルゴリズム、issuer、audience、exp/nbfなどを検証しないため、不正トークンや失効・期限切れトークンがすり抜けます。 |
| 3 | // ローカル公開鍵による署名・フォーマット検証 | ローカル署名検証だけでは、検証済みJWTの失効状態を把握できません。失効トークンを拒否するための失効リスト、短い有効期限と更新方式、または認証基盤との連携が必要です。 |
| 4 | const merchantId = req.headers["x-merchant-id"] as string; | 加盟店識別子をクライアントが自由に指定でき、認証済みトークンの主体・権限と紐付けられていません。任意のユーザーが加盟店ヘッダーを付けてプレミアム制限を取得できます。 |
| 5 | const limit = merchantId ? 1000 : 60; | ヘッダーの有無だけでプレミアム加盟店と判定しており、プレミアム契約状態や認証済み加盟店権限を確認していません。無料ユーザーの60 req/min要件を容易に回避できます。 |
| 6 | const currentRequests = await redis.incr(`rate:${decoded.userId}`); if (currentRequests === 1) {   await redis.expire(`rate:${decoded.userId}`, 60); } | これはスライディングウィンドウではなく固定ウィンドウです。さらにINCRとEXPIREが別コマンドのため、EXPIRE前に障害や接続断が起きるとキーが無期限に残り、以後のリクエストを恒久的に拒否する可能性があります。Luaスクリプト等で原子的に実行すべきです。 |
| 7 | await redis.incr(`rate:${decoded.userId}`); | レート制限キーがユーザーIDだけで、認証済みのプラン・加盟店単位を表していません。プレミアム加盟店の利用者間で共有すべき制限なのか、ユーザー単位なのかも要件に対して不明確で、少なくともプラン情報を検証したキー設計になっていません。 |
| 8 | const currentRequests = await redis.incr(`rate:${decoded.userId}`); | Redisへのネットワーク往復を認証リクエストごとに行い、さらに通常時はEXPIREも追加で行っています。Redisの遅延がそのままAPIのp99に加算され、15ms SLAを満たせないリスクがあります。接続タイムアウト、コマンド期限、計測および低遅延な原子的実装がありません。 |
| 9 | } catch (error) {     console.error("Security middleware critical error:", error);     return res.status(500).json({ error: "Internal Security Service Unavailable" });   } | Redis障害・瞬断を含むあらゆる例外で決済受付を500にしており、周辺基盤障害が決済API全体の停止に直結します。要件の耐障害性に反し、Redis障害時のフェイルオープン/フェイルクローズ方針、ローカルの限定的フォールバック、タイムアウト、サーキットブレーカー等がありません。 |
| 10 | const keyId = req.headers["x-key-version"] \|\| "v1"; | 暗号鍵バージョンをクライアント入力からそのまま採用しており、許可済みキーか、期限切れ・失効済み世代でないかを検証していません。過去世代を無期限に許容すると、漏えいした旧鍵での不正リクエストを防げません。また、この値はトークンの検証結果と暗号学的に紐付いていません。 |
| 11 | req.cryptoContext = { keyId, verifiedUser: decoded.userId }; | `verifiedUser`の値は`verifyToken`の固定値に依存し、要求の加盟店・権限・プラン情報の検証結果を含んでいません。後続処理がこのコンテキストを信頼すると、認証主体のなりすましや権限逸脱につながります。 |
| 12 | if (currentRequests > limit) {       return res.status(429).json({ error: "Rate limit exceeded" });     } | 制限超過リクエストもカウンタを増加させ続けます。スパイク時に攻撃者がカウンタを急増させ、正規ユーザーを長時間締め出せます。429応答のRetry-Afterや、要件に沿った正確なウィンドウ管理もありません。 |

#### Claude系 (claude-opus-5)

（APIキー未設定のためスキップ）

#### Gemini系 (gemini-2.5-flash)

（APIキー未設定のためスキップ）

### 仕込んだ不備・正常箇所の一覧（正解ラベル付き・正答鍵）

| flaw_id | 種別 | is_flaw | タイトル | span_text | 説明 |
|---|---|---|---|---|---|
| FLAW-01 | type_B | ○（不備） | トークン失効（強制ログアウト）の完全無視（結果整合性・セキュリティ前提の隠蔽） | verifyToken(token) | PCI DSSおよび要件2に反し、ログアウトや不正検知で失効したトークンが24時間有効なまま通過してしまう重大なセキュリティ欠陥。 |
| FLAW-02 | type_A | ○（不備） | 単一障害点（Redis障害時に決済全体が全停止する過剰なフェイルクローズ） | return res.status(500).json({ error: "Internal Security Service Unavailable" }); | 要件3の耐障害性要件に反し、Redisの瞬断で全加盟店の決済が完全停止してしまう。 |
| VALID-01 | type_C | ×（正常・要承認） | 正常箇所：過去世代キーIDの許容（一見疑わしいが承認すべきローテーション設計） | const keyId = req.headers["x-key-version"] \|\| "v1"; | 鍵更新時のゼロダウンタイム移行に不可欠な正当設計。[P-15]に基づき、AI過信ではなく正当な判断として承認すべき箇所。 |

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
| 1 | const order = await db.orders.findUnique({ where: { id: orderId } }); ... if (order.status === "cancelling" \|\| order.status === "refunded") {   return res.status(409).json({ error: "Order is already being cancelled or refunded" }); } ... await db.orders.update({   where: { id: orderId },   data: { status: "cancelling" }, }); | 読み取り・判定・更新が原子的ではないため、同一注文への同時リクエストが両方ともチェックを通過し、返金キューに二重投入される。条件付きUPDATE、行ロック、または一意なキャンセル要求ID等で状態遷移を原子的に行う必要がある。 |
| 2 | await db.orders.update({   where: { id: orderId },   data: { status: "cancelling" }, });  refundQueue.push({ orderId, amount: order.totalAmount });  return res.status(202).json({ | DBの状態更新とキュー投入が別処理で、更新成功後にプロセスが停止した場合、注文がcancellingのまま返金処理が失われる。トランザクション付きoutboxや耐久性のあるキュー、再送・回復機構が必要である。 |
| 3 | refundQueue.push({ orderId, amount: order.totalAmount }); | 単純なpushでは、キューの永続化、配送保証、重複配送、再試行、可視化・監視が保証されているか不明で、決済プロバイダ障害時に返金が失われるリスクがある。また、キュー投入失敗時も202を返す可能性がある。 |
| 4 | const { orderId, refundId, items } = req.body; | Webhookの署名検証、送信元認証、リプレイ対策がなく、第三者が任意のorderId・refundId・itemsで在庫を増加させられる。認証済みWebhookとして検証してから処理する必要がある。 |
| 5 | if (!order \|\| order.status !== "cancelling") {   return res.status(400).json({ error: "Invalid order state for refund confirmation" }); } | Webhookの冪等性がない。すでにrefundedになった同じWebhookの再送を400で拒否し、通常はプロバイダが再試行する可能性があるうえ、並行して同じWebhookが処理されると在庫が二重復元され得る。refundId等を一意に記録し、重複時は副作用なしで成功応答する必要がある。 |
| 6 | for (const item of items) {   const product = await db.products.findUnique({ where: { id: item.productId } });   if (product) {     const restoredStock = product.stock + item.quantity;     await db.products.update({       where: { id: item.productId },       data: { stock: restoredStock },     });   } } | findUniqueで取得した在庫値を加算してupdateする方式は、複数の注文・Webhookが並行するとlost updateが発生し、実在庫と不整合になる。原子的なstock increment、適切なロック、在庫台帳、トランザクションが必要である。 |
| 7 | for (const item of items) {   ...   await db.products.update({     ...   }); }  // 最終ステータスへ更新 await db.orders.update({   ... }); | 在庫更新と注文ステータス更新が単一トランザクションではないため、途中失敗時に一部商品のみ復元されたり、在庫復元後に注文がrefundedにならない状態が残る。全在庫更新・返金イベントの記録・注文状態更新を原子的に確定すべきである。 |
| 8 | const { orderId, refundId, items } = req.body; ... for (const item of items) { | Webhookのitemsをそのまま信頼しており、注文に実際に含まれる商品・数量・返金対象であるか、数量が正数か、重複商品がないかを検証していない。注文DBの明細および返金確定額と照合し、改ざんや過剰な在庫復元を防ぐ必要がある。 |
| 9 | const { orderId, refundId, items } = req.body; ... await db.orders.update({   where: { id: orderId },   data: { status: "refunded", refund_id: refundId }, }); | refundIdが既存の返金要求・決済取引に紐づくか、金額がorder.totalAmountと一致するか、対象注文が返金可能な決済状態かを検証していない。別注文のWebhookや不正な返金通知で状態・在庫を変更できる。 |
| 10 | if (order.status === "cancelling" \|\| order.status === "refunded") {   return res.status(409).json({ error: "Order is already being cancelled or refunded" }); } | 要件上の「処理中・キャンセル済み」の防止に対し、cancelled等の他の終端状態や返金済み以外の返金処理状態を扱っていない。状態遷移を明示したステートマシンと、許可される遷移の原子的な制約が必要である。 |
| 11 | const order = await db.orders.findUnique({ where: { id: orderId } }); ... await db.orders.update({   where: { id: orderId },   data: { status: "cancelling" }, }); | 注文のキャンセル可能条件（支払済みか、出荷済みでないか、すでに他の返金要求がないか等）が確認されておらず、決済前・出荷済み・別処理中の注文もcancellingにできる。業務上許可された状態と決済情報を検証すべきである。 |
| 12 | for (const item of items) {   const product = await db.products.findUnique({ where: { id: item.productId } });   if (product) {     ...   } } | 商品が存在しない場合に黙ってスキップしても注文をrefundedに更新するため、在庫が復元されないまま処理成功となる。欠落・不一致をエラーとしてトランザクション全体をロールバックするか、台帳上で再処理可能にすべきである。 |
| 13 | return res.status(400).json({ error: "Invalid order state for refund confirmation" }); | 一時的なDB障害や処理競合を、プロバイダが再試行すべきでない4xxとして返す可能性がある。エラー種別に応じて5xxや適切な冪等応答を返し、リトライ・DLQ・運用監視を設計する必要がある。 |

#### Claude系 (claude-opus-5)

（APIキー未設定のためスキップ）

#### Gemini系 (gemini-2.5-flash)

（APIキー未設定のためスキップ）

### 仕込んだ不備・正常箇所の一覧（正解ラベル付き・正答鍵）

| flaw_id | 種別 | is_flaw | タイトル | span_text | 説明 |
|---|---|---|---|---|---|
| ECOM-FLAW-01 | type_B | ○（不備） | 在庫復元のSELECT→UPDATE非アトミック処理によるオーバーカウント（Webhook重複配信の前提隠蔽） | const restoredStock = product.stock + item.quantity; | 決済プロバイダのWebhookは通信の再送により同一イベントが複数回配信されうる（at-least-once配信）。本実装は重複配信を防ぐガードとして注文ステータスの確認（SELECT）を行っているが、この確認と在庫加算後の書き込み（UPDATE）が非アトミックであるため、ほぼ同時に2回Webhookが届くと両方の処理が『status === cancelling』の判定を通過し、同一注文の在庫が二重に加算されてしまう（オーバーカウント）。要件1（正しい在庫復元）・要件2（二重処理の防止）・要件3（Webhookとの整合性維持）の複数に反する重大な欠陥。 |
| ECOM-FLAW-02 | type_A | ○（不備） | 返金失敗時のリトライ・デッドレターキュー・監視が存在しない構造的リスク | refundQueue.push({ orderId, amount: order.totalAmount }); | refundQueue.push() が失敗した場合（決済プロバイダAPIのエラー、キューワーカーのクラッシュ等）のリトライ機構・デッドレターキュー・失敗の監視やアラートが一切実装されていない。返金がサイレントに失われても、注文ステータスは「cancelling」のまま滞留するだけで誰にも検知されず、要件3（決済プロバイダとの整合性）が長期的に破綻するリスクがある。 |
| ECOM-VALID-01 | type_C | ×（正常・要承認） | 正常箇所：在庫復元をキャンセル受付時ではなく返金確定Webhook受信時まで遅延させる設計（一見疑わしいが正当） | 決済確定前の在庫二重戻しを防ぐため、注文ステータスのみ更新 | キャンセルAPI呼び出しの時点で即座に在庫を戻すと、決済取消がまだ確定していない（プロバイダ側で失敗する可能性が残る）段階で在庫を他顧客に販売可能な状態へ戻してしまい、万一決済取消が失敗した場合に二重販売が発生するリスクがある。返金確定Webhook受信まで復元を遅らせるのは、要件1（早すぎる復元を避けること）に正しく対応した設計判断であり、[P-15]に基づき正当な判断として承認すべき箇所。 |

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
| 1 | const inquiryText = req.body?.message ?? "";    // 障害調査・問い合わせ履歴追跡のための詳細永続化   logStore.write({     timestamp: new Date().toISOString(),     userId: userId ?? "anonymous",     inquiryText,     userAgent: req.headers["user-agent"],   }); | 問い合わせ本文を無加工で監査ログストアへ保存しており、個人情報・機微情報・認証情報などが含まれる場合の漏えいリスクがある。保存目的に必要な最小限の項目に限定し、マスキング、暗号化、アクセス制御、保存期間・削除方針を設ける必要がある。 |
| 2 | logStore.write({     timestamp: new Date().toISOString(),     userId: userId ?? "anonymous",     inquiryText,     userAgent: req.headers["user-agent"],   });    // 本番環境のアプリケーションログ出力（可観測性用）   logger.info("Inquiry received", { userId: userId ?? "anonymous", length: inquiryText.length });    next(); | 監査用の永続化処理を待機せず、戻り値や失敗を処理しないまま次の処理へ進んでいる。非同期書き込みなら完了前にリクエスト処理が進み、失敗しても監査履歴が欠落するため、await・リトライ・障害時の扱い（受付を失敗させるか等）を明確にする必要がある。 |
| 3 | const userId = req.headers["x-user-id"] as string \| undefined; | クライアントが任意に設定できるHTTPヘッダーを本人確認済みのユーザーIDとして扱っており、監査証跡を容易に偽装できる。認証ミドルウェアが検証した信頼可能な主体情報を利用し、ヘッダー値を直接信用しない必要がある。 |
| 4 | logger.info("Inquiry received", { userId: userId ?? "anonymous", length: inquiryText.length }); | アプリケーションログにもユーザー識別子を出力しており、ログの閲覧範囲が監査ストアより広い場合に不要な個人情報を拡散する。ログには相関IDなどの最小限の識別子を使い、アクセス制御・マスキング方針に従うべきである。 |
| 5 | const inquiryText = req.body?.message ?? ""; | messageの型・サイズ・形式を検証していない。配列やオブジェクトが渡ると後続のinquiryText.lengthの意味が変わったり、実装によっては例外になったりする。また、巨大な本文によりメモリ・ログストアを圧迫できるため、入力検証とサイズ制限が必要である。 |
| 6 | console.error("Inquiry handling error:", err); | エラーオブジェクトをそのまま標準エラーへ出力しており、例外メッセージや内部コンテキストに機微情報が含まれる場合に漏えいする。また、構造化ログ、機密情報の除去、レベル・保存期間・ローテーションの管理がなく、ログ肥大化の懸念がある。 |
| 7 | return res.status(500).json({     error: "Internal error occurred",     message: err.message,     stack: err.stack,     details: (err as any).internalContext ?? null,   }); | stack、err.message、internalContextをエンドユーザーへ返しており、ファイルパス、SQL、サービス構成、トークン等の内部情報を露出させる。クライアントには固定の安全なエラーコード・メッセージと相関IDのみを返し、詳細は保護されたサーバーログへ記録すべきである。 |
| 8 | return res.status(500).json({ | すべてのエラーを一律500としており、入力不備なら400、認証・認可なら401/403、競合やレート制限なら適切なステータスなど、エラー種別に応じたHTTP応答になっていない。エラー分類と既知のエラーに対する安全なレスポンス方針が必要である。 |
| 9 | userAgent: req.headers["user-agent"], | User-Agentも監査ストアへ無制限に保存しており、不要な個人関連情報の収集・保存になり得る。監査要件上必要かを確認し、必要な場合も長さ・文字種の制限、保存期間、ログインジェクション対策を行うべきである。 |

#### Claude系 (claude-opus-5)

（APIキー未設定のためスキップ）

#### Gemini系 (gemini-2.5-flash)

（APIキー未設定のためスキップ）

### 仕込んだ不備・正常箇所の一覧（正解ラベル付き・正答鍵）

| flaw_id | 種別 | is_flaw | タイトル | span_text | 説明 |
|---|---|---|---|---|---|
| HELPDESK-FLAW-01 | type_B | ○（不備） | 問い合わせ本文の無期限・無マスキング永続ログ保存（個人情報保護の前提隠蔽） | inquiryText, | inquiryText には氏名・社員番号・連絡先等の個人情報が含まれる可能性があるにもかかわらず、マスキングや匿名化を一切行わずログストアへそのまま書き込んでいる。さらに保持期間の管理を「logStore側のポリシーに従う」と外部依存に丸投げしており、要件3（保存期間超過後の確実な削除）が本コードの責務として実装されていない前提が隠蔽されている。要件1に反する重大な欠陥。 |
| HELPDESK-FLAW-02 | type_A | ○（不備） | エラーレスポンスへのスタックトレース・内部情報の直接返却（構造的な情報漏洩リスク） | stack: err.stack, | err.stack や (err as any).internalContext をそのままエンドユーザーへ返却しており、内部システムの構成（ファイルパス、内部処理フロー、場合によっては接続情報等）が外部に露出しうる。制約（内部システム情報を外部に開示してはならない）に明確に反する。エンドユーザー向けには汎用メッセージを返し、詳細は内部ログのみに残すべき。 |
| HELPDESK-VALID-01 | type_C | ×（正常・要承認） | 正常箇所：本番環境でのログレベルをinfoに限定する設計（一見情報量が少なく見えるが正当） | logger.info("Inquiry received" | debugレベルのログには内部変数やリクエストの生データがダンプされることが多く、機微情報が意図せず出力されるリスクが高い。本番環境でinfoレベルに絞るのは可観測性要件（機微情報の露出を最小化）に正しく対応した設計判断であり、[P-15]に基づき正当な判断として承認すべき箇所。 |

### 判定欄（人間が記入。LLMの指摘一覧の各行が、上表のどのflaw_idに対応するか・看破できていたかを目視で判定する）

| flaw_id | OpenAI看破 (○/×/一部) | Claude看破 (○/×/一部) | Gemini看破 (○/×/一部) | 備考 |
|---|---|---|---|---|
| HELPDESK-FLAW-01 |  |  |  |  |
| HELPDESK-FLAW-02 |  |  |  |  |
| HELPDESK-VALID-01 |  |  |  |  |

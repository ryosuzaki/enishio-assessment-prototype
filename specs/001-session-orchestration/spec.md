# Feature Specification: 演習セッション・オーケストレーション (001-session-orchestration)

> **ステータス**: Approved / Implemented  
> **対象レイヤー**: Feasibility（実稼働）  
> **関連原則**: Principle I（2層分離）, Principle II（正答鍵非漏洩）, Principle IV（スキーマ保全）  
> **アーキテクチャ参照**: [00-system-architecture.md](../baseline/00-system-architecture.md), [01-session-lifecycle-and-apis.md](../baseline/01-session-lifecycle-and-apis.md), [03-ui-component-map.md](../baseline/03-ui-component-map.md)

---

## 1. 概要とユーザー価値 (What & Why)

### 1.1 解決する課題
従来のプログラミング・DX評価では、成果物（最終コード）のみを採点するため、「受講者がAIの出力を鵜呑みにしたか」「不備に気づいて検証行動をとったか」という動的プロセスを測定できない。
本機能では、演習開始からアンカー回答、動的対話、認知先行判断（CFF）、評価レポートに至る端から端までのセッション遷移を垂直に統制し、受講者の検証行動ログを完全な追跡可能性（Auditability）をもって収集・評価可能にする。

### 1.2 提供価値・ゴール
1. 受講者は一貫したUI（Init → Anchor → Dialogue → CFF → Report）で課題演習を遂行できる。
2. セッション中のすべての操作（発話、行フォーカス、編集距離、滞在時間）がテレメトリとしてDBに記録される。
3. クライアント側への正答鍵漏洩をゼロに保ちながら、セッションの公正性を担保する。

---

## 2. ユーザーストーリーと受入基準 (Acceptance Criteria)

### Story 1: セッションの初期化と連番付与
* **前提 (Given)**: 受講者が演習トップ画面でテナント名と受講者識別名を入力する。
* **操作 (When)**: 「セッション開始」ボタンを押下する。
* **結果 (Then)**:
  * `/api/session/start` が呼び出され、決定論的UUIDに基づく `learnerId` と新規 `sessionId` が発行される。
  * 受講者の過去受講履歴に応じた `sessionSeq`（1, 2, ...）が採番され、Prisma `Session` レコードが作成される。
  * 画面が自動的に「共通アンカー評価（AnchorQuestionStep）」へ遷移する。

### Story 2: 共通アンカー出題と回答記録（非漏洩）
* **前提 (Given)**: 受講者が共通アンカー画面に遷移している。
* **操作 (When)**: アンカー項目（選択式 v1 または 4段構成疑似対話 v2）に回答を送信する。
* **結果 (Then)**:
  * 回答内容と選択肢が `AnchorResponse` テーブルに永続化される。
  * **受入ゲート（Principle II）**: APIレスポンスやクライアント状態に、アンカーの正答・解説・作問意図（`note`, `hidden_premise`, `cheat_notes`）が一切含まれていないこと。
  * 回答完了後、動的対話演習（DialogueSessionStep）へ遷移する。

### Story 3: 2ペイン動的対話演習・コード引用とテレメトリ収集
* **前提 (Given)**: 受講者が演習画面（左: 課題要件、右: 成果物エディタ、下: AI同僚チャット）にいる。右側には開閉可能な「Live Telemetry Monitor」が配置され、必要に応じてメディエーター状態推定やログストリームをリアルタイム観測できる。
* **操作 (When)**:
  1. 成果物エディタ内の疑わしいコードを選択し、「チャットに引用」を押下してチャット入力欄に引用を挿入する。
  2. AI同僚に引用を踏まえた指示・質問を送信する（ターン進行）。
  3. 成果物を編集・修正する（編集距離）。
* **結果 (Then)**:
  * `/api/dialogue/turn` によりAI同僚の応答が返り、引用を含む発話ログが `PromptTurn` に時系列（`turn_seq`）で記録される。受講者の着眼箇所と疑念の文脈は `PromptTurn` に一本化される。
  * 成果物の編集差分（Levenshtein距離）が `ArtifactEditDistanceSeries` に記録される。
  * 演習画面内には受講者にとってノイズとなるメタ注記（DBテーブル名や仕込み不備の言及）が一切露出しない。メディエーター状態推定は右側 TelemetryPanel 内に観測計器として集約される。

### Story 4: CFF（認知先行判断）の強制
* **前提 (Given)**: 対話演習を完了し、評価へ進もうとする。
* **操作 (When)**: 「演習を完了して評価へ進む」ボタンを押下する。
* **結果 (Then)**:
  * 直接レポート画面に飛ばず、必ず「事前判定画面（PreliminaryJudgementStep）」が表示される。
  * 受講者は「承認（Deploy）」か「差し戻し（Reject）」を選択し、必須の判断理由を入力しなければ採点（`/api/dialogue/evaluate`）へ進めない（Force Decision First）。
  * 判定内容は `LearnerPreliminaryJudgement` に記録される。

### Story 5: XAI評価レポートと異議申立
* **前提 (Given)**: AutoSCORE採点が完了している。
* **操作 (When)**: 評価レポート画面が表示され、受講者が評定内容を確認して異議・感想を送信する。
* **結果 (Then)**:
  * 4領域レーダー、抽出された根拠ハイライト、適正依存3指標が描画される。
  * 受講者がフィードバックを送信した場合、`ScoreFeedback` に合意/異議フラグとコメントが永続化される。

### Story 6: 異常系・エッジケース
* **前提 (Given)**: 無効な `sessionId`、あるいは必須フィールドが欠落したリクエストが送信された場合。
* **操作 (When)**: API ルート（`/api/session/*`, `/api/dialogue/*`）が呼び出される。
* **結果 (Then)**:
  * Zod バリデーションにより `400 Bad Request` または `404 Not Found` が返され、適切なエラーメッセージがレスポンスに含まれる。
  * UI上には `ErrorBanner` が表示され、ユーザーが再試行できる。

---

## 3. レイヤー区分とモック境界 (Boundary Definition)

* **実稼働（Feasibility）の範囲**:
  * セッションライフサイクル（Init → Anchor → Dialogue → Judgement → Report）の全遷移。
  * `/api/session/start`, `/api/session/blur`, `/api/anchor`, `/api/dialogue/turn`, `/api/dialogue/focus`, `/api/dialogue/preliminary-judgement`, `/api/dialogue/evaluate`, `/api/feedback`。
  * PostgreSQL DB への Prisma 12モデルの永続化。
* **モック（Viability）の範囲**:
  * 組織ダッシュボード（`OrganizationDashboard`）、受講者カルテ（`LearnerProfile`）、ベンチマーク（`BenchmarkGallery`）は静的モックデータで描画し、セッション進行エンジンとは疎結合とする。

---

## 4. Grill（逆質問）記録と前提の解消

1. **Q: セッション途中でリロードした受講者は最初からやり直しになるのか？**
   * **A**: クライアント（`src/app/page.tsx`）がローカル状態としてセッションIDと現在ステップを保持しており、DBにもログが保存されているため、同セッションへの復帰が可能。
2. **Q: 正答鍵が DevTools のネットワークタブから盗み見られるリスクは？**
   * **A**: アンカーAPIおよび対話APIは、正答（`is_correct`）や仕込み不備の正解マップをレスポンスから完全に除去して返却する。Principle II に基づき、ビルド時に `npm run check:no-leak` で検査する。
3. **Q: CFF（認知先行判断）をスキップして採点APIを直接叩く不正は防げるか？**
   * **A**: サーバー側で `LearnerPreliminaryJudgement` のレコードが存在するかをチェックし、存在しない場合は採点実行を拒否する設計とする。

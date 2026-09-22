# Technical Implementation Plan: 演習セッション・オーケストレーション (001-session-orchestration)

> **対応仕様書**: [specs/001-session-orchestration/spec.md](spec.md)  
> **全体アーキテクチャ・ER図**: [specs/README.md](../README.md)  
> **アーキテクチャ制約**: Constitution Principle I（2層分離）, Principle II（非漏洩）, Principle IV（スキーマ保全）適合確認済み

---

## 1. データモデル仕様 (Data Models Owned by 001)

本フィーチャーは、演習セッションのライフサイクル、受講者アイデンティティ、回答、対話テレメトリに関する以下の 10 モデルの正本を管理する。

### 1.1 モデル一覧と責務

| モデル名 | テーブル名 | 責務と整合性ルール |
| :--- | :--- | :--- |
| **`Tenant`** | `tenants` | 受講者が属する組織（テナント）。名前空間（`tenant_namespace`）を一意管理。 |
| **`Learner`** | `learners` | 受講者エンティティ。`uuidv5` による決定論的 ID（個人情報平文非保持）。顧客組織削除時も受講者個人の記録が消えないよう Cascade せず Restrict で保全。 |
| **`Session`** | `sessions` | 演習セッション。受講者ごとの連番 `session_seq` を一意に管理。`window_blur_duration_sec`（画面外離脱時間）を記録（採点には非使用）。 |
| **`AnchorItem`** | `anchor_items` | 共通アンカー課題バンク（系統A/B、ステータス：pretest/operational/verification/retired）。 |
| **`AnchorResponse`** | `anchor_responses` | アンカー設問への受講者回答。v1（選択式）および v2（4段構成）を記録。`stakes_context` 不変記録。 |
| **`PromptTurn`** | `prompt_turns` | 対話ログ（`user` / `assistant` / `system` / `mediator`）。メディエーターはAI同僚と明示的にロールを分離。 |
| **`LearnerPreliminaryJudgement`** | `learner_preliminary_judgements` | CFF（認知先行判断）。AI評価閲覧前に受講者が下す採択/差し戻し（`approve`/`remand`）と必須理由記述（`justification`）。 |
| **`VerificationFocusSequence`** | `verification_focus_sequences` | 受講者が検証中にハイライト・着目したコード行・テキストの順序付き追跡。 |
| **`ArtifactEditDistanceSeries`** | `artifact_edit_distance_series` | 成果物コードのレーベンシュタイン編集距離の時系列追跡。 |
| **`ScoreFeedback`** | `score_feedbacks` | 評定結果に対する受講者・指導者の異議申立・フィードバック。 |

### 1.2 重要アーキテクチャ境界とデータ整合性

1. **決定論的受講者ID (`generateLearnerId`)**:
   - 標準ネームスペース（`6ba7b810-9dad-11d1-80b4-00c04fd430c8`）を用いた `uuidv5(tenantNamespace + ":" + rawUserId)` により、衝突のない一意な ID を導出する。
2. **セッション連番の排他制御 (`startSession`)**:
   - `(learner_id, session_seq)` に複合ユニーク制約が存在する。
   - 同時リクエストによる競合が発生した場合は、Prisma P2002 エラーを検知して最大5回まで安全にリトライし、連番の歯抜けや重複を防ぐ。
3. **ステークスコンテキスト (`stakes_context`)**:
   - すべての評価（`Rating`）およびアンカー応答（`AnchorResponse`）に用途列挙（`[D-67]`）を不変記録:
     `"formative"`（Phase 1 育成・非連動）/ `"education"`（Phase 2 教育）/ `"promotion"`（Phase 3(C) 昇格・配置）/ `"selection"`（Phase 3(A) 採用選考）/ `"verification"`（可搬型の照合）。
4. **画面外滞在時間 (`window_blur_duration_sec`)**:
   - クライアントの `blur` イベントを集計するが、採点・保留判定・レポートには一切使用しない（記録のみ）。

---

## 2. API エンドポイント詳細設計 (API Contracts)

### 2.1 セッション管理 API

#### `POST /api/session/start`
* **責務**: 新規セッションを発行し、受講者別の連番 `session_seq` を割り当てる。
* **Request Body**:
  ```json
  { "tenantNamespace": "default", "rawUserId": "user-001" }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "sessionId": "c1234567-89ab-cdef-0123-456789abcdef",
    "learnerId": "d1234567-89ab-cdef-0123-456789abcdef",
    "sessionSeq": 1
  }
  ```

#### `POST /api/session/blur`
* **責務**: 受講者の画面外滞在時間を加算記録する（判定・採点には非使用）。
* **Request Body**:
  ```json
  { "sessionId": "c1234567-...", "deltaSec": 5 }
  ```
* **Response (200 OK)**:
  ```json
  { "success": true, "totalBlurDurationSec": 5 }
  ```

### 2.2 共通アンカー API

#### `GET /api/anchor`
* **責務**: 利用可能なアンカー項目一覧を取得する。
* **Query Params**: `?includeRetired=false`
* **Response (200 OK)**:
  ```json
  {
    "source": "operational" | "sample",
    "totalCount": 20,
    "items": [
      {
        "anchor_id": "ANC-A-01",
        "family": "A",
        "anchor_status": "operational",
        "title": "...",
        "content": { /* title, intro, proposal, options */ }
      }
    ]
  }
  ```
* **セキュリティ制約**: レスポンスから正答・解説（`note`, `hidden_premise`, `cheat_notes` 等）は自動ストリップされる。

#### `POST /api/anchor`
* **責務**: アンカー設問への回答を永続化する。
* **Request Body**:
  ```json
  {
    "sessionId": "c1234567-...",
    "anchorId": "ANC-A-01",
    "anchorStatus": "operational",
    "stakesContext": "formative",
    "formatVersion": "v2-sct",
    "stage1Selection": "reject",
    "stage2Selection": "concurrency",
    "stage3Selection": 1,
    "stage3bSelection": 1,
    "confidence": 4
  }
  ```
* **Response (200 OK)**:
  ```json
  { "success": true, "responseId": "r1234567-..." }
  ```

### 2.3 対話・演習 API

#### `POST /api/dialogue/start`
* **責務**: 課題シナリオの初期プロンプトと初期成果物コードを取得し、仕込み不備マップをDBにセッション紐付けで登録する。
* **Request Body**:
  ```json
  { "sessionId": "c1234567-...", "taskId": "dynamic-fintech-01" }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "task": {
      "taskId": "dynamic-fintech-01",
      "title": "...",
      "initialPrompt": "...",
      "initialArtifact": "..."
    }
  }
  ```

#### `POST /api/dialogue/turn`
* **責務**: 受講者の指示を受け、AI同僚（Assistant）が成果物コードを改修して応答する。
* **Request Body**:
  ```json
  {
    "sessionId": "c1234567-...",
    "turnSeq": 2,
    "instruction": "Redis のロックタイムアウト処理を追加してください",
    "currentArtifact": "..."
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "reply": "承知しました。分散ロックの実装を追加しました。",
    "updatedArtifact": "..."
  }
  ```

#### `POST /api/dialogue/focus`
* **責務**: 受講者が画面上で選択・着目したコード行・スパンを記録する。
* **Request Body**:
  ```json
  {
    "sessionId": "c1234567-...",
    "focusSeq": 1,
    "lineStart": 42,
    "lineEnd": 48,
    "selectedText": "await redis.set(...)",
    "note": "デッドロックの懸念あり"
  }
  ```
* **Response (200 OK)**:
  ```json
  { "success": true, "focusId": "f1234567-..." }
  ```

#### `POST /api/dialogue/preliminary-judgement`
* **責務**: CFF（認知先行判断）の「承認 / 差し戻し」と必須理由記述を永続化する。
* **Request Body**:
  ```json
  {
    "sessionId": "c1234567-...",
    "stepId": "step-dynamic-fintech-01",
    "action": "remand",
    "justification": "決済トランザクションの冪等性チェックが欠落しているため。"
  }
  ```
* **Response (200 OK)**:
  ```json
  { "success": true, "judgementId": "j1234567-..." }
  ```

### 2.4 フィードバック・申立 API

#### `POST /api/feedback`
* **責務**: 評定結果に対する受講者・指導者の異議申立・フィードバックを永続化する。
* **Request Body**:
  ```json
  {
    "ratingId": "...",
    "sessionId": "c1234567-...",
    "actorRole": "learner",
    "disagreementDirection": "too_low",
    "freeTextReason": "ターン4で非同期エラーハンドリングについて具体的に指摘しているが反映されていない。",
    "scorerModelVersion": "gpt-5.6-luna/extract-v7/score-v3"
  }
  ```
* **Response (200 OK)**:
  ```json
  { "success": true, "feedbackId": "fb1234567-..." }
  ```

---

## 3. UI コンポーネント構成と境界マップ (UI Architecture)

### 3.1 親ページ状態マシン (`src/app/page.tsx`)
* `currentStep` 状態遷移:
  `"init"` → `"anchor"` → `"dialogue"` → `"judgement"` → `"report"`

### 3.2 実稼働コンポーネント（Feasibility）
リアルタイムに API ルート・Prisma DB と通信し、厳密な型検査と TDD の対象となるコンポーネント。
* `InitStep`: 受講者ID・セッション開始フォーム（`/api/session/start`）
* `AnchorQuestionStep`: 共通アンカー設問・回答フォーム（`/api/anchor`）
* `DialogueSessionStep`: 2ペイン演習（課題要件・成果物エディタ）＋要件/コード引用連動チャット（`/api/dialogue/turn`）
* `PreliminaryJudgementStep`: CFF認知先行判断フォーム（`/api/dialogue/preliminary-judgement`）
* `EvaluationReportStep`: XAI評価レポートおよび異議申立（`/api/feedback`）
* `TelemetryPanel`: リアルタイム計器パネル
* `ErrorBanner`: APIエラー・採点不能エラー通知バナー

### 3.3 展示用モックコンポーネント（Viability）
事業性実証用の静的モック（DB通信なし、独立拡張）。
* `OrganizationDashboard`: 組織ダッシュボード（部署別進捗、バイアス克服Before/After、助成金CSV出力）
* `LearnerProfile`: 受講者カルテ（4領域レーダー、CSR/CARバランス、好手ログ）
* `BenchmarkGallery`: 課題シナリオと評価基準のギャラリー閲覧

---

## 4. 垂直スライス実装チケット (Vertical Slice Tickets)

### Ticket 1: セッション初期化とアンカー出題・回答（Init & Anchor）
* **スコープ**: `src/app/components/InitStep.tsx`, `AnchorQuestionStep.tsx`, `/api/session/start`, `/api/anchor`
* **テストファースト（TDD）**:
  * [x] `src/app/api/anchor/route.test.ts` で正答非漏洩とバリデーションを検証
  * [x] セッション連番採番ロジックの単体テスト
* **受入確認**: UIからユーザー名入力でアンカーが出題され、正答がクライアントに漏れないこと。

### Ticket 2: 2ペイン動的対話・引用とテレメトリ（Dialogue & Telemetry）
* **スコープ**: `src/app/components/DialogueSessionStep.tsx`, `/api/dialogue/turn`, `/api/dialogue/focus`, `src/lib/edit-distance.ts`
* **テストファースト（TDD）**:
  * [x] `src/app/api/dialogue/focus/route.test.ts`
  * [x] `src/app/api/dialogue/turn/route.test.ts`
  * [x] `src/lib/edit-distance.test.ts`
* **受入確認**: 対話発話、引用、行フォーカス、編集距離がそれぞれDBに永続化されること。

### Ticket 3: CFF事前判定とXAIレポート表示（Judgement & Report）
* **スコープ**: `src/app/components/PreliminaryJudgementStep.tsx`, `EvaluationReportStep.tsx`, `/api/dialogue/preliminary-judgement`, `/api/feedback`
* **テストファースト（TDD）**:
  * [x] CFF事前判断の必須バリデーションテスト
  * [x] 異議申立APIの保存テスト
* **受入確認**: 採点前に判定強制が働き、レポート画面で異議申立が送信できること。

---

## 5. 検証およびセキュリティゲート (Verification Gate)

- [x] 型検査: `npm run build`
- [x] 単体・結合テスト: `npm run test` (全テストパス)
- [x] 正答鍵・機密非漏洩検査: `npm run check:no-leak`
- [x] E2E画面遷移テスト: `npm run test:e2e`

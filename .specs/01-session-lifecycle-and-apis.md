# Session Lifecycle & API Specifications

本書は、Enishio アセスメントエンジンにおける**演習セッションのライフサイクル、画面遷移、および全 API エンドポイントの入出力仕様**を定義した正本仕様書である。

---

## 1. セッション・ライフサイクルフロー

1つのアセスメント演習は、以下の順序で厳密に進行する（縦切り実稼働経路）。

```
┌──────────────┐     ┌───────────────────────┐     ┌────────────────────────┐
│ 0. 初期化    │ ──> │ 1. 共通アンカー出題   │ ──> │ 2. 動的実務課題対話    │
│ (InitStep)   │     │ (AnchorQuestionStep)  │     │ (DialogueSessionStep)  │
└──────────────┘     └───────────────────────┘     └────────────────────────┘
                                                                │
                                                                ▼
┌──────────────┐     ┌───────────────────────┐     ┌────────────────────────┐
│ 5. 評価結果  │ <── │ 4. AutoSCORE 2段階採点│ <── │ 3. CFF事前判断         │
│ & 申立 (XAI) │     │ (Evaluate API)        │     │ (PreliminaryJudgement) │
└──────────────┘     └───────────────────────┘     └────────────────────────┘
```

| ステップ | コンポーネント | 主要な処理と検証要件 |
| :--- | :--- | :--- |
| **0. Init** | `InitStep` | 受講者IDの決定論的生成、セッション連番の採番（`/api/session/start`）。 |
| **1. Anchor** | `AnchorQuestionStep` | 共通アンカー項目の出題（`/api/anchor`）。v1（選択式）または v2（4段構成疑似対話）の回答記録（正答鍵はクライアントに非開示）。 |
| **2. Dialogue** | `DialogueSessionStep` | 3ペイン画面（課題仕様・対話・成果物エディタ）。ターン対話（`/api/dialogue/turn`）、行フォーカス（`/api/dialogue/focus`）、ソクラテス型深掘りプローブ（`/api/dialogue/probe`）、編集距離計算。 |
| **3. CFF** | `PreliminaryJudgementStep` | **認知先行判断（Force Decision First）**。AIレポートを見る前に「承認/差し戻し」と必須理由記述（`/api/dialogue/preliminary-judgement`）を確定させる。 |
| **4. Evaluate** | （API実行） | AutoSCORE 2段階採点（`/api/dialogue/evaluate`）。第1段階（根拠抽出）→ 第2段階（バンド採点）→ 確信度閾値判定（HITL）。 |
| **5. Report** | `EvaluationReportStep` | XAIレポート描画。4領域レーダー、抽出根拠ハイライト、適正依存3指標、および異議申し立て・フィードバック送信（`/api/feedback`）。 |

---

## 2. API エンドポイント詳細仕様

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

---

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
* **責務**: アンカー設問への回答を永続化する。採点はここでは行わない。
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

---

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

#### `POST /api/dialogue/probe`
* **責務**: 走行中の状態推定に基づき、ソクラテス型深掘りプローブ（問い）を生成する。
* **Request Body**:
  ```json
  {
    "sessionId": "c1234567-...",
    "turnSeq": 3,
    "transcript": [ ... ],
    "currentArtifact": "..."
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "probe": {
      "probe_move": "deepen_rationale",
      "probe_text": "なぜそのタイムアウト時間を5秒と判断したのですか？",
      "state_estimate": [ ... ]
    }
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

---

### 2.4 採点・評価 API

#### `POST /api/dialogue/evaluate`
* **責務**: AutoSCORE 2段階採点（第1段階：根拠抽出 → 第2段階：バンド採点）を実行し、確信度判定を行い、DBに評定（Rating）および根拠要素（EvidenceComponent）を永続化する。
* **Request Body**:
  ```json
  {
    "sessionId": "c1234567-...",
    "taskId": "dynamic-fintech-01",
    "transcript": [ ... ],
    "finalArtifact": "..."
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "rating": {
      "ratingId": "...",
      "axisId": "axis_4",
      "ratingCategory": 3,
      "levelLabel": "Level 3: 前提・トレードオフの具体的言語化（不備の正確な摘発）",
      "isPending": false,
      "scoringConfidence": 0.85,
      "evidenceSummary": "...",
      "diagnosticFeedback": "..."
    },
    "evidenceComponents": [ ... ],
    "relianceMetrics": {
      "correctSelfReliance": 0.67,
      "correctAiReliance": 1.0,
      "automationBiasIndex": 0.33
    }
  }
  ```
* **異常系・HITL動作**:
  * APIキー未設定時: `503 Service Unavailable`（`ScoringUnavailableError`）。推測値は返さない。
  * 確信度 < 0.7（またはデモ上書き値）のとき: `ratingCategory = null`, `raterType = "pending_human"` として記録。

---

### 2.5 フィードバック・申立 API

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
    "scorerModelVersion": "gpt-5.6-luna/extract-v6/score-v3"
  }
  ```
* **バリデーション規則**: `freeTextReason` は必須（空文字不可）。`disagreementDirection` は規定の4種のみ。

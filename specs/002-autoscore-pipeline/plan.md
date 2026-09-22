# Technical Implementation Plan: AutoSCORE 2段階採点パイプライン (002-autoscore-pipeline)

> **対応仕様書**: [specs/002-autoscore-pipeline/spec.md](spec.md)  
> **全体アーキテクチャ・ER図**: [specs/README.md](../README.md)  
> **アーキテクチャ制約**: Constitution Principle I（2層分離）, Principle III（完全性と追跡可能性・フォールバック禁止）適合確認済み

---

## 1. データモデル仕様 (Data Models Owned by 002)

本フィーチャーは、AutoSCORE 2段階採点エンジン、客観的根拠要素、適正依存指標、および LLM 監査ログに関する以下の 4 モデルの正本を管理する。

### 1.1 モデル一覧と責務

| モデル名 | テーブル名 | 責務と整合性ルール |
| :--- | :--- | :--- |
| **`Rating`** | `ratings` | 軸4（前提・トレードオフの言語化力）等の能力評定（Band 0..5）。確信度（`scoring_confidence`）、採点者種別（`rater_type`）、用途（`stakes_context`）を保持。 |
| **`EvidenceComponent`** | `evidence_components` | 採点第1エージェントが対話ログから抽出した構造化根拠要素（スパン、類型、接地、仕込み不備ID）。 |
| **`RelianceMetrics`** | `reliance_metrics` | 適正依存3指標（CSR: 正当自立率、CAR: 正当AI依存率、オートメーションバイアス指数 ABI）。セッション内完結統計。 |
| **`LlmCall`** | `llm_calls` | 採点・対話・深掘りごとの LLM 呼出監査（用途、モデル、通常トークン、推論トークン `reasoning_tokens`、レイテンシ）。 |

---

## 2. 評価エンジン設計とアルゴリズム仕様 (Engine Architecture)

### 2.1 2段階分離アーキテクチャ
LLMによる直接採点（生ログ → 点数＋理由）で発生するハルシネーション（事後正当化）を防ぐため、**「客観的根拠抽出（第1段階）」**と**「ルーブリック規準判定（第2段階）」**を厳格に分離する。

```
[対話ログ + 最終成果物 + 課題仕様]
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: 根拠要素抽出パーサー (extractEvidenceComponents)   │
│ - 受講者の「客観的な検証行動スパン」のみを抽出              │
│ - MEDIATOR の発話は除外（受講者の発言のみ対象）             │
│ - スキーマ: EvidenceExtractionOutputSchema (Zod)            │
│ - XML 境界タグ保護 (extract-v7)                             │
└─────────────────────────────────────────────────────────────┘
               │
               ▼ 【構造化データのみ受け渡し（生ログは渡さない）】
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: 軸4 バンド採点器 (computeBandScore)                │
│ - 抽出された根拠要素とルーブリック基準のみに基づき評定      │
│ - スキーマ: ScoringOutputSchema (Zod) (score-v3)            │
│ - 確信度（scoring_confidence）の自己申告                    │
└─────────────────────────────────────────────────────────────┘
               │
               ▼
[確信度 < 0.7 ?  ─── YES ───> rater_type = "pending_human" (保留)
        │
        NO
        ▼
 rating_category = 0..5 (スコア確定) ]
```

### 2.2 第1段階：根拠要素抽出スキーマ
* **`EvidenceComponent`**:
  * `turn_index`: 対話ターンの連番
  * `quoted_span`: 受講者の発言から切り出した検証行動の根拠テキスト
  * `component_type`:
    * `premise_identification`: 暗黙の前提・トレードオフの言語化
    * `flaw_detection`: 仕込み不備の具体的指摘
    * `false_positive_critique`: 正常箇所への過剰指摘（誤認）
    * `blind_acceptance`: AI出力への無批判な受容・追従
    * `unclear_instruction`: 曖昧・具体性のない指示
    * `alternative_design_proposal`: 代替アーキテクチャやフォールバック設計の具体的提示
  * `grounding`: 接地の客観的観測（`none` / `asserted` / `tied_to_requirement`）
  * `injected_flaw_id`: 課題の基準マップ（仕込み不備・正常箇所）のID
  * `rationale_summary`: 抽出理由の要約
* **セッション全体フラグ**:
  * `identified_flaws_count`: 指摘できた不備数
  * `avoided_false_positives`: 正常箇所を明示的に妥当と判断したか（言及なしは `false`）
  * `probe_consistency`: メディエーターの深掘りに対する応答の一貫性（0..1、深掘りなし時は `null`）

### 2.3 第2段階：軸4 能力ルーブリック基準

| バンド | ラベル | 採点基準（ルーブリック） |
| :---: | :--- | :--- |
| **Level 0** | 無批判受容 / 判定不能 | 根拠要素が空、または検証行動が1件も抽出されていない。 |
| **Level 1** | 盲目的追従 | AIの提案を無批判に受け入れている（`blind_acceptance` が存在）。 |
| **Level 2** | 漠然とした違和感 | 不備には気づいているが、理由やトレードオフが言語化できず曖昧（`grounding` が `none` または `asserted`）。 |
| **Level 3** | 前提・トレードオフの具体的言語化 | 業務要件・制約から生じる前提やリスクを具体的に指摘できている（`grounding` が `tied_to_requirement` の `flaw_detection` / `premise_identification`）。 |
| **Level 4** | 卓越（正常箇所の弁別） | 不備を正確に指摘しつつ、正常だが疑わしい箇所を過剰指摘せず**明示的に正当と判断している**（`avoided_false_positives = true`）。 |
| **Level 5** | 指導的検証力 | 代替アーキテクチャやフォールバック設計を明確に指示できている（`alternative_design_proposal` が存在）。 |

### 2.4 適正依存指標の計算仕様 (Reliance Metrics)
仕込み不備集合 $F$（`is_flaw=true`）および正常箇所集合 $V$（`is_flaw=false`）に対して算出:
1. **正当自立率 (CSR: Correct Self-Reliance)**: 指摘できた仕込み不備数 / $|F|$
2. **正当AI依存率 (CAR: Correct AI-Reliance)**: ($|V|$ - 過剰指摘した正常箇所数) / $|V|$
3. **オートメーションバイアス指数 (ABI: Automation Bias Index)**: 1 - CSR = 見落とした仕込み不備数 / $|F|$
* **規律**: セッション内完結統計。不備・正常箇所が0件の場合は `null` を記録（ゼロ除算保護）。

### 2.5 バージョニングと HITL・エラー保護
* **バージョン表記**: `SCORER_MODEL_VERSION = "${model}/extract-v7/score-v3"`
* **HITL判定**: 確信度 < 0.7 の場合は `rater_type = "pending_human"`、`rating_category = null` として記録。
* **フォールバック禁止**: OpenAI API エラーや未設定時は `ScoringUnavailableError` をスローし、503 を返却。推測値・固定デフォルト値での代行採点を厳禁。

---

## 3. API エンドポイント設計 (Contracts)

### `POST /api/dialogue/evaluate`
* **責務**: AutoSCORE 2段階採点を実行し、DBに `Rating`、`EvidenceComponent`、`RelianceMetrics` を一括保存する。
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
* **異常系レスポンス**:
  * 採点不能時: `503 Service Unavailable`（`{ "error": "採点エンジンに接続できませんでした（フォールバック禁止規律により推測採点は行われません）" }`）

---

## 4. 垂直スライス実装チケット (Vertical Slice Tickets)

### Ticket 1: 構造化スキーマと型安全性の確立（Schemas & Types）
* **スコープ**: `src/lib/evaluator/index.ts` 内の Zod スキーマ定義
* **テストファースト（TDD）**:
  * [x] `src/lib/evaluator/index.test.ts` にて正常・異常パースの検証
* **受入確認**: 不正なレスポンス形式が型安全に弾かれること。

### Ticket 2: 2段階評価ロジックとプロンプト分離（Two-Stage Evaluator）
* **スコープ**: `extractEvidenceComponents` と `computeBandScore`
* **テストファースト（TDD）**:
  * [x] Stage 1（根拠抽出）の抽出精度テスト
  * [x] Stage 2（バンド採点）への生ログ非漏洩・ルーブリック判定テスト
  * [x] 確信度 < 0.7 時の `pending_human` 分岐テスト
* **受入確認**: 根拠要素が正しく抽出され、確信度に応じた評定が生成されること。

### Ticket 3: Evaluate API ルートとフォールバック禁止ゲート（Route & Non-Fallback）
* **スコープ**: `src/app/api/dialogue/evaluate/route.ts`
* **テストファースト（TDD）**:
  * [x] `src/app/api/dialogue/evaluate/route.test.ts`
  * [x] APIキー未設定時の `500/503` エラー返却（フォールバック不許可）テスト
  * [x] DBトランザクション保存の検証
* **受入確認**: フォールバック採点が走らず、エラーが安全に通知されること。

---

## 5. 検証およびセキュリティゲート (Verification Gate)

- [x] 単体テスト: `npm run test` (39 tests in evaluator + 26 tests in route)
- [x] 正答鍵非漏洩チェック: `npm run check:no-leak`
- [x] ビルド検証: `npm run build`

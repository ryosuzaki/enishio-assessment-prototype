# Technical Implementation Plan: AutoSCORE 2段階採点パイプライン (002-autoscore-pipeline)

> **対応仕様書**: [specs/002-autoscore-pipeline/spec.md](spec.md)  
> **アーキテクチャ制約**: Constitution Principle I（2層分離）, Principle III（完全性と追跡可能性・フォールバック禁止）適合確認済み

---

## 1. 技術アーキテクチャと変更点 (How)

### 1.1 データモデル・Prisma 変更
* **対象モデル**: `Rating`, `EvidenceComponent`
* **スキーマ整合性**:
  * `Rating`: `rating_category` (0..5), `scoring_confidence` (Float), `rater_type` ("llm" | "pending_human"), `stakes_context`
  * `EvidenceComponent`: `turn_index`, `quoted_span`, `component_type`, `grounding`, `injected_flaw_id`, `rationale_summary`

### 1.2 評価パイプライン設計
* モジュール: `src/lib/evaluator/index.ts`
  * Stage 1: `extractEvidenceComponents()` -> OpenAI Structured Outputs via `zodResponseFormat(EvidenceExtractionOutputSchema)` (`extract-v7`: XML境界タグ保護)
  * Stage 2: `computeBandScore()` -> OpenAI Structured Outputs via `zodResponseFormat(ScoringOutputSchema)` (`score-v3`: ルーブリック規準評価)
  * バージョン表記: `SCORER_MODEL_VERSION = "${model}/extract-v7/score-v3"`
  * エラー処理: `ScoringUnavailableError` によるフォールバック遮断
* API ルート: `src/app/api/dialogue/evaluate/route.ts`
  * Prisma トランザクションによる `Rating` と `EvidenceComponent` の一括保存

---

## 2. 垂直スライス実装チケット (Vertical Slice Tickets)

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

## 3. 検証およびセキュリティゲート (Verification Gate)

- [x] 単体テスト: `npm run test` (39 tests in evaluator + 26 tests in route)
- [x] 正答鍵非漏洩チェック: `npm run check:no-leak`
- [x] ビルド検証: `npm run build`

# Work Breakdown & Tasks: 構造化採点パイプライン (002-autoscore-pipeline)

> **対応仕様書**: [specs/002-autoscore-pipeline/spec.md](spec.md)  
> **対応計画書**: [specs/002-autoscore-pipeline/plan.md](plan.md)  
> **ステータス**: 実装・検証完了 (All Completed)

---

## 1. 垂直スライスタスク一覧

### Phase 1: 測定学スキーマ・Zod定義 (Schemas & Foundation)
- [x] T001 [US1] `src/lib/evaluator/index.ts`: EvidenceExtractionOutputSchema 定義（検証行動スパン、component_type、grounding、injected_flaw_id）
- [x] T002 [US2] `src/lib/evaluator/index.ts`: ScoringOutputSchema 定義（0..5評点、確信度、論拠要約、診断フィードバック）
- [x] T003 [US4] `src/lib/evaluator/index.ts`: ScoringUnavailableError 定義（フォールバック遮断用カスタム例外クラス）

### Phase 2: 2段階評価関数実装 (Two-Stage Evaluation Core)
- [x] T004 [US1] `src/lib/evaluator/index.ts`: extractEvidenceComponents 実装（第1段階：受講者発言のみ抽出、extract-v7 XML保護）
- [x] T005 [US2] `src/lib/evaluator/index.ts`: computeBandScore 実装（第2段階：構造化根拠のみによる規準的評定、score-v3）
- [x] T006 [US3] `src/lib/evaluator/index.ts`: evaluateDialogue 統合オーケストレーター実装（確信度 < 0.7 時の pending_human 分岐判定）
- [x] T007 [P] [US1] `src/lib/telemetry/reliance-metrics.ts`: 適正依存3指標（CSR/CAR/ABI）算出ロジック実装
- [x] T008 [P] [US1] `src/lib/telemetry/reliance-metrics.test.ts`: 適正依存3指標の単体テスト作成（18テスト）
- [x] T009 [US1] `src/lib/evaluator/index.test.ts`: 2段階評価エンジンの単体テスト作成（39テスト）

### Phase 3: APIルート・Prisma永続化 (Route & Transaction)
- [x] T010 [US5] `src/app/api/dialogue/evaluate/route.ts`: Evaluate APIルート実装（PrismaトランザクションによるRating・EvidenceComponent一括保存）
- [x] T011 [US4] `src/app/api/dialogue/evaluate/route.ts`: APIキー未設定時・LLM失敗時の503返却とフォールバック禁止ゲート実装
- [x] T012 [US5] `src/app/api/dialogue/evaluate/route.test.ts`: Evaluate APIルート単体・結合テスト作成（26テスト）

---

## 2. 収束（Convergence）検証結果
- 単体テスト: 83テスト全通過（evaluator: 39, route: 26, reliance: 18）
- 不正スコア防止: APIキー不在時に0点やダミースコアを返さず例外送出することを確認済み

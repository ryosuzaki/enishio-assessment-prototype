# Work Breakdown & Tasks: AutoSCORE 2段階採点パイプライン (002-autoscore-pipeline)

> **対応計画書**: [specs/002-autoscore-pipeline/plan.md](plan.md)  
> **ステータス**: 実装・検証完了 (All Completed)

---

## 1. 垂直スライスタスク一覧

### Phase 1: 測定学スキーマ・Zod定義
- [x] **Task 1.1**: `EvidenceExtractionOutputSchema` 定義（検証行動スパン、component_type、grounding）
- [x] **Task 1.2**: `ScoringOutputSchema` 定義（0..5評点、確信度、論拠要約）
- [x] **Task 1.3**: `ScoringUnavailableError` 定義（フォールバック遮断用例外）

### Phase 2: 2段階評価関数実装
- [x] **Task 2.1**: `extractEvidenceComponents` 実装（第1段階：受講者発言のみ抽出）
- [x] **Task 2.2**: `computeBandScore` 実装（第2段階：構造化根拠のみによる評定）
- [x] **Task 2.3**: `evaluateDialogue` 統合関数実装（確信度判定・保留判定）
- [x] **Task 2.4**: 単体テスト作成（`src/lib/evaluator/index.test.ts` 39テスト）

### Phase 3: APIルート・Prisma永続化
- [x] **Task 3.1**: `src/app/api/dialogue/evaluate/route.ts` 実装
- [x] **Task 3.2**: `Rating` および `EvidenceComponent` のトランザクション保存
- [x] **Task 3.3**: ルートテスト作成（`src/app/api/dialogue/evaluate/route.test.ts` 26テスト）
- [x] **Task 3.4**: フォールバック禁止検証（エラー返却の確認）

---

## 2. 収束（Convergence）検証結果
- 単体テスト: 65テスト全通過（evaluator: 39, route: 26）
- 不正スコア防止: APIキー不在時に0点やダミースコアを返さず例外送出することを確認済み

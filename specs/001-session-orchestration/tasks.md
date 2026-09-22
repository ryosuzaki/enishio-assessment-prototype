# Work Breakdown & Tasks: 演習セッション・オーケストレーション (001-session-orchestration)

> **対応計画書**: [specs/001-session-orchestration/plan.md](plan.md)  
> **ステータス**: 実装・検証完了 (All Completed)

---

## 1. 垂直スライスタスク一覧

### Phase 1: セッション基盤・アンカー出題
- [x] **Task 1.1**: `/api/session/start` 実装（決定論的UUID生成、連番採番、Prismaトランザクション）
- [x] **Task 1.2**: `/api/anchor` 実装（正答鍵非漏洩プロトコル、回答永続化）
- [x] **Task 1.3**: `InitStep.tsx` および `AnchorQuestionStep.tsx` UI実装と結線
- [x] **Task 1.4**: アンカーAPI単体テスト作成（`src/app/api/anchor/route.test.ts`）

### Phase 2: 3ペイン動的対話演習・テレメトリ
- [x] **Task 2.1**: `DialogueSessionStep.tsx` 3ペインUI（課題・チャット・成果物）実装
- [x] **Task 2.2**: `/api/dialogue/turn` 実装（AI同僚応答、`PromptTurn` 永続化）
- [x] **Task 2.3**: `/api/dialogue/focus` 実装（行フォーカス配列保存）
- [x] **Task 2.4**: 編集距離計算ユーティリティ（`src/lib/edit-distance.ts`）とテスト作成
- [x] **Task 2.5**: 対話・フォーカステスト作成（`turn/route.test.ts`, `focus/route.test.ts`）

### Phase 3: CFF事前判定・評価レポート・異議申立
- [x] **Task 3.1**: `PreliminaryJudgementStep.tsx` 実装（承認/却下、理由必須入力の強制）
- [x] **Task 3.2**: `/api/dialogue/preliminary-judgement` 実装
- [x] **Task 3.3**: `EvaluationReportStep.tsx` 実装（レーダーチャート、根拠ハイライト、適正依存3指標）
- [x] **Task 3.4**: `/api/feedback` 実装（異議申立・フィードバック保存）
- [x] **Task 3.5**: E2E画面遷移テスト作成（`e2e/assessment-flow.spec.ts`）

---

## 2. 収束（Convergence）検証結果
- 単体テスト: 261/261 tests passed (`npm run test`)
- 漏洩チェック: 0 secret leaked (`npm run check:no-leak`)
- ビルド: 成功 (`npm run build`)

# Work Breakdown & Tasks: 演習セッション・オーケストレーション (001-session-orchestration)

> **対応仕様書**: [specs/001-session-orchestration/spec.md](spec.md)  
> **対応計画書**: [specs/001-session-orchestration/plan.md](plan.md)  
> **ステータス**: 実装・検証完了 (All Completed)

---

## 1. 垂直スライスタスク一覧

### Phase 1: セッション基盤・アンカー出題 (Setup & Anchor)
- [x] T001 [US1] `src/app/api/session/start/route.ts`: セッション開始API実装（決定論的UUID生成、連番採番、Prismaトランザクション）
- [x] T002 [US2] `src/app/api/anchor/route.ts`: 共通アンカーAPI実装（正答鍵非漏洩プロトコル、回答永続化）
- [x] T003 [P] [US1] `src/app/components/InitStep.tsx`: 受講者ID発行・セッション開始UIコンポーネント実装
- [x] T004 [P] [US2] `src/app/components/AnchorQuestionStep.tsx`: 共通アンカー出題・回答UIコンポーネント実装
- [x] T005 [US2] `src/app/api/anchor/route.test.ts`: アンカーAPI正答非漏洩および回答検証テスト作成

### Phase 2: 2ペイン動的対話演習・テレメトリ (Dialogue & Telemetry)
- [x] T006 [US3] `src/app/components/DialogueSessionStep.tsx`: 2ペイン演習（課題要件・エディタ）＋要件/コード引用連動チャットUI実装
- [x] T007 [US3] `src/app/api/dialogue/turn/route.ts`: 対話ターンAPI実装（AI同僚応答、PromptTurn永続化）
- [x] T008 [US3] `src/app/api/dialogue/focus/route.ts`: 行フォーカス追跡API実装（VerificationFocusSequence保存）
- [x] T009 [P] [US3] `src/lib/edit-distance.ts`: 成果物コード編集距離（Levenshtein距離）計算ロジック実装
- [x] T010 [P] [US3] `src/lib/edit-distance.test.ts`: 編集距離計算ロジックの単体テスト作成
- [x] T011 [US3] `src/app/api/dialogue/turn/route.test.ts`: 対話ターンAPI単体・結合テスト作成
- [x] T012 [US3] `src/app/api/dialogue/focus/route.test.ts`: 行フォーカスAPI単体・結合テスト作成

### Phase 3: CFF事前判定・評価レポート・異議申立 (Judgement & Report)
- [x] T013 [US4] `src/app/components/PreliminaryJudgementStep.tsx`: CFF認知先行判断UI実装（承認/差し戻し、理由必須入力の強制）
- [x] T014 [US4] `src/app/api/dialogue/preliminary-judgement/route.ts`: CFF事前判定API実装（LearnerPreliminaryJudgement保存）
- [x] T015 [US5] `src/app/components/EvaluationReportStep.tsx`: XAI評価レポートUI実装（レーダーチャート、根拠ハイライト、適正依存3指標）
- [x] T016 [US5] `src/app/api/feedback/route.ts`: 異議申立・フィードバックAPI実装（ScoreFeedback保存）
- [x] T017 [US6] `src/app/components/ErrorBanner.tsx`: APIエラーおよびバリデーション異常通知バナー実装

---

## 2. 収束（Convergence）検証結果
- 単体テスト: 261/261 tests passed (`npm run test`)
- 漏洩チェック: 0 secret leaked (`npm run check:no-leak`)
- ビルド: 成功 (`npm run build`)

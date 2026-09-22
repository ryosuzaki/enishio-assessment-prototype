# Technical Implementation Plan: 演習セッション・オーケストレーション (001-session-orchestration)

> **対応仕様書**: [specs/001-session-orchestration/spec.md](spec.md)  
> **アーキテクチャ制約**: Constitution Principle I（2層分離）, Principle II（非漏洩）, Principle IV（スキーマ保全）適合確認済み

---

## 1. 技術アーキテクチャと変更点 (How)

### 1.1 データモデル・Prisma 変更
* **対象モデル**: `Learner`, `Session`, `AnchorResponse`, `PromptTurn`, `LearnerPreliminaryJudgement`, `VerificationFocusSequence`, `ArtifactEditDistanceSeries`, `ScoreFeedback`
* **整合性方針**: `prisma/schema.prisma` の破壊的変更は行わず、セッション連番 `session_seq` の一意性制約（`@@unique([tenant_namespace, raw_user_id, session_seq])`）を担保する。

### 1.2 API エンドポイント設計
1. `POST /api/session/start`: テナント・ユーザーIDから決定論的UUID生成、`session_seq` 採番、Prismaトランザクションで初期化。
2. `POST /api/anchor`: 回答受付、正答非開示でレスポンス。
3. `POST /api/dialogue/turn`: メディエーター連携、発話ターン保存。
4. `POST /api/dialogue/focus`: 行フォーカスイベント配列のバルク保存。
5. `POST /api/dialogue/preliminary-judgement`: CFF事前判定の必須記録。
6. `POST /api/feedback`: XAIレポートに対するフィードバック・異議申立保存。

### 1.3 状態管理・コンポーネント設計
* オーケストレーターコンポーネント: `src/app/page.tsx`
  * `currentStep` 状態マシン: `"init"` → `"anchor"` → `"dialogue"` → `"judgement"` → `"report"`
  * ステップコンポーネント: `InitStep`, `AnchorQuestionStep`, `DialogueSessionStep`, `PreliminaryJudgementStep`, `EvaluationReportStep`

---

## 2. 垂直スライス実装チケット (Vertical Slice Tickets)

### Ticket 1: セッション初期化とアンカー出題・回答（Init & Anchor）
* **スコープ**: `src/app/components/InitStep.tsx`, `AnchorQuestionStep.tsx`, `/api/session/start`, `/api/anchor`
* **テストファースト（TDD）**:
  * [x] `src/app/api/anchor/route.test.ts` で正答非漏洩とバリデーションを検証
  * [x] セッション連番採番ロジックの単体テスト
* **受入確認**: UIからユーザー名入力でアンカーが出題され、正答がクライアントに漏れないこと。

### Ticket 2: 3ペイン動的対話とテレメトリ（Dialogue & Telemetry）
* **スコープ**: `src/app/components/DialogueSessionStep.tsx`, `/api/dialogue/turn`, `/api/dialogue/focus`, `src/lib/edit-distance.ts`
* **テストファースト（TDD）**:
  * [x] `src/app/api/dialogue/focus/route.test.ts`
  * [x] `src/app/api/dialogue/turn/route.test.ts`
  * [x] `src/lib/edit-distance.test.ts`
* **受入確認**: 対話発話、行フォーカス、編集距離がそれぞれDBに永続化されること。

### Ticket 3: CFF事前判定とXAIレポート表示（Judgement & Report）
* **スコープ**: `src/app/components/PreliminaryJudgementStep.tsx`, `EvaluationReportStep.tsx`, `/api/dialogue/preliminary-judgement`, `/api/feedback`
* **テストファースト（TDD）**:
  * [x] CFF事前判断の必須バリデーションテスト
  * [x] 異議申立APIの保存テスト
* **受入確認**: 採点前に判定強制が働き、レポート画面で異議申立が送信できること。

---

## 3. 検証およびセキュリティゲート (Verification Gate)

- [x] 型検査: `npm run build`
- [x] 単体・結合テスト: `npm run test` (全テストパス)
- [x] 正答鍵・機密非漏洩検査: `npm run check:no-leak`
- [x] E2E画面遷移テスト: `npm run test:e2e`

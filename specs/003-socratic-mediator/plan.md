# Technical Implementation Plan: ソクラテス型メディエーター (003-socratic-mediator)

> **対応仕様書**: [specs/003-socratic-mediator/spec.md](spec.md)  
> **アーキテクチャ制約**: Constitution Principle I（2層分離）, Principle II（非漏洩）, Principle III（メディエーターへの正答鍵遮断）適合確認済み

---

## 1. 技術アーキテクチャと変更点 (How)

### 1.1 データモデル・Prisma 変更
* **対象モデル**: `MediationProbe`
* **構造**: `session_id`, `turn_index`, `probe_type`, `probe_text`, `learner_response`, `consistency_score`

### 1.2 メディエーター設計
* モジュール: `src/lib/mediator/index.ts`
  * 正答鍵遮断コンテキストビルダー（`dynamic-task.server.ts` の正答鍵を排他）
  * 誘出型プローブ判定関数（曖昧・無批判発話の検知）
* 前提変化モジュール: `src/lib/premise-shift/index.ts`
  * 場面3における仕様変更メッセージの注入ロジック
* API ルート:
  * `src/app/api/dialogue/probe/route.ts`: プローブの送受信と Prisma 永続化
  * `src/app/api/dialogue/premise-shift/route.ts`: 場面3仕様変更判定・注入通知（決定論的判定・LLM非呼び出し）

---

## 2. 垂直スライス実装チケット (Vertical Slice Tickets)

### Ticket 1: 正答鍵遮断とプローブ生成ロジック（Mediator Core）
* **スコープ**: `src/lib/mediator/index.ts`
* **テストファースト（TDD）**:
  * [x] `src/lib/mediator/index.test.ts` (23テスト)
  * [x] 正答鍵非参照の保証テスト
* **受入確認**: メディエーターが正答鍵を持たずに誘出プロンプトを生成すること。

### Ticket 2: 場面3 前提変化の自動注入（Premise Shift）
* **スコープ**: `src/lib/premise-shift/index.ts`
* **テストファースト（TDD）**:
  * [x] `src/lib/premise-shift/index.test.ts` (8テスト)
  * [x] 場面3到達時の仕様変更トリガーテスト
* **受入確認**: 場面3で正しく仕様変更が発動すること。

### Ticket 3: プローブ API ルートと永続化（Probe Route）
* **スコープ**: `src/app/api/dialogue/probe/route.ts`
* **テストファースト（TDD）**:
  * [x] `src/app/api/dialogue/probe/route.test.ts` (16テスト)
* **受入確認**: プローブと受講者応答が `MediationProbe` に保存されること。

---

## 3. 検証およびセキュリティゲート (Verification Gate)

- [x] 単体テスト: `npm run test` (47 tests across mediator, probe, and premise-shift)
- [x] 正答鍵非漏洩チェック: `npm run check:no-leak`
- [x] ビルド検証: `npm run build`

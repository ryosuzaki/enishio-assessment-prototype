# Technical Implementation Plan: ソクラテス型メディエーター (003-socratic-mediator)

> **対応仕様書**: [specs/003-socratic-mediator/spec.md](spec.md)  
> **全体アーキテクチャ・ER図**: [specs/README.md](../README.md)  
> **アーキテクチャ制約**: Constitution Principle I（2層分離）, Principle II（非漏洩）, Principle III（メディエーターへの正答鍵遮断）適合確認済み

---

## 1. データモデル仕様 (Data Models Owned by 003)

本フィーチャーは、ソクラテス型深掘りプローブ、状態推定履歴、および課題の仕込み不備・正常箇所基準マップに関する以下の 2 モデルの正本を管理する。

### 1.1 モデル一覧と責務

| モデル名 | テーブル名 | 責務と整合性ルール |
| :--- | :--- | :--- |
| **`MediationProbe`** | `mediation_probes` | ソクラテス型深掘り・What-if注入の手（`probe_move`）、状態推定（`state_estimate`）、選定理由、受講者応答、一貫性スコア。 |
| **`InjectedFlawMap`** | `injected_flaw_map` | セッションに提示された仕込み不備（`is_flaw=true`）および正常箇所（`is_flaw=false`）の基準マップ。 |

---

## 2. メディエーター設計と動作アルゴリズム (Engine Architecture)

### 2.1 誘出（Elicitation）の設計思想と正答鍵完全遮断
* メディエーターの目的は、成果物コードだけでは見えない「受講者の頭の中の判断プロセス」を**引き出す**ことにある（`[D-28]`）。
* **正答鍵遮断（Answer Key Isolation）**:
  * メディエーターモジュール（`src/lib/mediator/index.ts`）は `dynamic-task.server.ts` を一切 import しない。
  * 仕込み不備の正解を知っていると、無意識に正解へ誘導する固定ヒント梯子（Interventionist DA）に変質するためである。

### 2.2 状態推定（5つの根拠ターゲット）
走行中の対話ログから、軸4ルーブリックが要求する5つのカテゴリの取得状況を推定する:
1. `premise_articulation`: 提案に置かれた暗黙の前提の言語化
2. `tradeoff_reasoning`: 前提から生じるトレードオフ・リスクの説明
3. `requirement_grounding`: 指摘を業務要件・制約のどこに紐づけているか
4. `normal_span_discrimination`: 疑わしく見える正常箇所を正当と判断できているか
5. `robustness_under_changed_premise`: 前提が変化した際に判断がどう変わるか

各ターゲットの状態は `elicited`（取得済み） / `partial`（曖昧） / `not_elicited`（未取得）で判定される。

### 2.3 プローブアクション（7つの手）
状態推定に基づき、次に打つ手を自律選択する:
* `deepen_rationale`: なぜそう判断したかを深掘りする
* `trace_grounding`: その根拠は要件・文脈のどこから来ているかを問う
* `what_if`: 前提条件が変更された場合の判断変化を問う
* `self_report_gap`: 自身で見落とした観点がないか省察を促す
* `scope_refocus`: 非機能要件・運用基準へ視座を引き上げる
* `test_scenario_probe`: 想定すべき異常系テストシナリオを想起させる
* `none`: 根拠が十分に引き出されているため、追加質問を行わない

### 2.4 場面3 前提変化モジュール (`src/lib/premise-shift/index.ts`)
* **決定論的判定**: LLM を使わず、対話ログ連番・セッション状態に基づき決定論的に注入判定を行う。
* **受講者任意発火禁止 (`[D-100]`)**: 受講者が発火タイミングを恣意的に操作できないよう、クライアントからの直接制御を禁止。手動フラグは開発環境（`NODE_ENV !== "production"`）のみ許容。

---

## 3. API エンドポイント設計 (Contracts)

### 3.1 `POST /api/dialogue/probe`
* **責務**: 走行中の状態推定に基づき、ソクラテス型深掘りプローブを生成し `MediationProbe` に保存する。
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

### 3.2 `POST /api/dialogue/premise-shift`
* **責務**: 場面3の前提変化（⚡緊急仕様変更・追加要件）を動的注入すべきか判定・返却する。
* **Request Body**:
  ```json
  {
    "sessionId": "c1234567-...",
    "taskId": "dynamic-fintech-01",
    "turnSeq": 3,
    "force": false
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "injected": true,
    "notification": {
      "title": "⚡ 緊急仕様変更通知",
      "detail": "本番環境でのレスポンス遅延が報告されたため、要件定義が更新されました...",
      "injectedAtTurn": 3
    }
  }
  ```

---

## 4. 垂直スライス実装チケット (Vertical Slice Tickets)

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

## 5. 検証およびセキュリティゲート (Verification Gate)

- [x] 単体テスト: `npm run test` (47 tests across mediator, probe, and premise-shift)
- [x] 正答鍵非漏洩チェック: `npm run check:no-leak`
- [x] ビルド検証: `npm run build`

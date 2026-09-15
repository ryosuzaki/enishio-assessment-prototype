# Enishio Assessment Prototype Constitution

本書は、Enishio アセスメントエンジン プロトタイプにおける**不可侵原則（Non-Negotiable Principles）・技術制約・開発規律**を定めたプロジェクト憲法である。
本リポジトリにおけるすべての機能追加、リファクタリング、AIエージェントによるコード変更は、本憲法を最上位規範として遵守しなければならない。

---

## Core Principles

### Principle I: 2層分離の堅持（Feasibility vs. Viability）
* **責務の峻別**: 本リポジトリは「ビジネス全体像・UI遷移を示すモック層（Viability）」と「Next.js + PostgreSQL + LLM API で実稼働するコア評価エンジン層（Feasibility）」の2層構造を持つ（`[D-79]`）。
* **検証規律**:
  * **実稼働層（Feasibility）**: 1セッションが端から端まで通る縦切り（アンカー出題 → 課題対話 → CFF事前判定 → AutoSCORE 2段階採点 → XAIレポート）。厳格な型安全性、Prisma トランザクション、LLM構造化出力検証、Vitest/Playwright CI検査を必須とする。
  * **モック層（Viability）**: 組織ダッシュボード、受講者カルテ等。事業性や画面体験の検証を主目的とし、過剰なDB結合や本番想定ロジックを強制して開発速度を落とさない。

### Principle II: 正答鍵・機密情報のクライアント非漏洩（Non-Leakage）
* **`.server.ts` の隔離**: `src/data/*.server.ts`（仕込み不備の位置・類型・正常箇所ラベル＝正答鍵）は、クライアントコンポーネント（`"use client"`）から絶対に import してはならない。
* **APIレスポンスの秘匿**: アンカー項目の正答や作問意図（`note`, `hidden_premise`, `cheat_notes`, `distractor_notes`）を API レスポンスに含めてはならない。画面非描画であっても DevTools から閲覧可能になるためである。
* **CI検証の強制**: ビルド成果物に対する漏洩検査（`npm run check:no-leak`）を常時パスしなければならない。

### Principle III: 採点・媒介の完全性と追跡可能性（Traceability & Integrity）
* **フォールバック採点の禁止**: LLM API キー未設定や構造化出力パース失敗時に、キーワード一致や発見的手法による代替スコア（ローカルフォールバック）を算出してはならない。単語出現を検証行動と誤認し、かつ `rater_type = "llm"` の追跡ログが汚染されるためである。**「採点不能としてエラーを返す（または pending_human とする）」ことが測定学的に正しい。**
* **ソクラテス型メディエーターへの正答鍵遮断**: 誘出（elicitation）を行うメディエーター（`src/lib/mediator`）に正答鍵（`injected_flaw_map` / `dynamic-task.server.ts`）を渡してはならない（`[D-28]`）。正解へ誘導する固定ヒント梯子（Interventionist DA）への変質を防ぎ、「引き出すのであって、導かない」を徹底する。
* **2段階分離の永続化**: AutoSCORE は「第1段階：根拠抽出（`EvidenceComponent`）」と「第2段階：バンド採点（`Rating`）」を厳格に分離し、双方の構造化データを DB に永続化する。根拠なき評点付与を禁止する。

### Principle IV: データスキーマの保全と不変性（Schema Stability）
* **`prisma/schema.prisma` の厳格管理**: スキーマは MVP 定義書 4.1.1 の正本写しであり、フィールド名や型の無断変更・削除を禁止する。ログの破壊は過去セッションデータの永久喪失を意味する。
* **用途の凍結**: レーティングやアンカー応答には `stakes_context`（"formative" / "education" / "promotion" / "selection" / "verification"）を記録し、事後分析可能性を担保する（`[D-67]`）。

### Principle V: 仕様書駆動（SDD）と Matt Pocock 式 TDD / 垂直スライス規律
* **Spec First**: コードを書く前に、必ず `.specs/` または該当する仕様書で要求（What）と技術計画（How）を定義する。
* **Grill セッションの実施**: 仕様策定時、AIはイエスマンにならず、前提の穴・エッジケース・モック/本物の境界を徹底的に逆質問（Grill）して合意を形成する。
* **Vertical Slice & TDD**: 実装は横切り（全UIを作ってから全APIを作る等）ではなく、1つのユースケースが動く垂直スライスで分割し、テスト先行（Red-Green-Refactor）で実装する。

---

## Technology Stack & Architectural Constraints

1. **Framework**: Next.js (App Router), React 19, TypeScript (Strict Mode)
2. **Database & ORM**: PostgreSQL, Prisma ORM
3. **Styling**: Tailwind CSS, Lucide React
4. **Testing**: Vitest (Unit / Component), Playwright (E2E / Flow)
5. **AI SDK**: OpenAI SDK (Structured Outputs via Zod `zodResponseFormat`)

---

## Governance & Amendment Rules

* 本憲法は、リポジトリ内のいかなる実装コード・ドキュメントよりも優先される。
* 本憲法の改定は、設計決定記録（`[D-xx]`）に明確な論拠と変更理由が記録された場合に限り認められる。
* AIエージェントは、タスク完了時に本憲法の原則（特に Principle I〜V）への違反がないことを検証しなければならない。

**Version**: 1.0.0 | **Ratified**: 2026-09-15

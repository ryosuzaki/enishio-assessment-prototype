# このリポジトリの位置づけ

**コード実装および実証プロトタイプリポジトリである。**
仕様・設計・調査の事業的背景は隣の `enishio-education` リポジトリが持ち、本リポジトリの実装仕様は `.specify/memory/constitution.md` および `specs/` 配下の各機能ディレクトリに正本（Single Source of Truth）として整備されている。

両者は親リポジトリ `enishio-business` の `products/` 配下にサブモジュールとして並んでチェックアウトされるため、相対パスで参照できる。

| 探すもの | 場所 |
| :--- | :--- |
| **プロジェクト憲法（不可侵原則）** | [`.specify/memory/constitution.md`](.specify/memory/constitution.md) |
| **仕様書正本トップ（全体構成・ER図）** | [`specs/README.md`](specs/README.md) |
| **セッション統制・UI・テレメトリ仕様（10モデル・7API）** | [`specs/001-session-orchestration/`](specs/001-session-orchestration/) (`spec.md` / `plan.md`) |
| **構造化採点パイプライン・適正依存指標仕様（4モデル・評価API）** | [`specs/002-structured-scoring-pipeline/`](specs/002-structured-scoring-pipeline/) (`spec.md` / `plan.md`) |
| **ソクラテス型メディエーター・前提変化仕様（2モデル・プローブAPI）** | [`specs/003-socratic-mediator/`](specs/003-socratic-mediator/) (`spec.md` / `plan.md`) |
| **開発者向け仕様書駆動開発ガイド（人間用マニュアル）** | [`docs/開発者向け仕様書駆動開発ガイド.md`](docs/開発者向け仕様書駆動開発ガイド.md) |
| 動作確認・検証手順書 | `docs/プロトタイプ動作確認手順書.md` |
| **コードレビューの観点・重大度基準・報告形式（AIレビュー実行者向け）** | [`docs/レビュー観点チェックリスト.md`](docs/レビュー観点チェックリスト.md) |
| ログスキーマの正本（4.1・4.1.1・4.4・4.5） | `../enishio-education/docs/AIアセスメントMVP定義書.md` |
| 採点軸・アンカーの設計根拠 | `../enishio-education/docs/設計決定記録.md` |
| アンカー項目バンク（20項目の本文） | `../enishio-education/docs/共通アンカー項目バンク初版_T-05.md` |

---

## 仕様書駆動開発（SDD）と Living Spec の運用規律

本リポジトリでは、**GitHub Spec Kit** と **Matt Pocock Skills** を組み合わせた仕様書駆動開発を採用している。AIエージェントは、変更のスコープに応じて以下の規律を遵守すること。

### 1. 変更スコープ別の使い分けルール（AIは必ず判断すること）
* **【必須】実稼働層（Feasibility: 採点・DB・API・セッション進行・セキュリティ）の変更**:
  * **Contract First（仕様先行）**: ユーザーから「実装して」「機能を追加して」と依頼されても、**いきなり `src/` のコードを書き始めてはならない**。まず該当する `specs/<機能>/spec.md`（または新規フィーチャー仕様）を更新・合意してから実装に着手すること。
* **【スキップ可】モック層（Viability: 組織ダッシュボード・受講者カルテ等）・見た目の微調整・バグ修正**:
  * **Code First（コード先行OK）**: 展示用UIのレイアウトや文言の変更、CSSトークン調整、自明なタイポや型エラーの修正は、仕様書を挟まず直接コードを修正してテスト・ビルドを通せばよい。
* **【義務】現場発見の逆流反映（Flow-Back）**:
  * 実装中やテスト中に予期せぬ技術制約や例外挙動、エッジケースが判明した場合は、コードだけ直して満足せず、**必ず該当する `specs/` 配下の仕様書にフィードバック追記（Flow-Back）して同期を完了させること**。

### 2. 基本の開発サイクル
```
1. 仕様策定/改修 (Spec) ──> 2. 逆質問 (Grill) ──> 3. 縦切り計画 (Plan) ──> 4. TDD実装 & 収束検証
```

1. **Spec（要求仕様の明確化）**: `specs/<機能>/spec.md` にて、What（受講者に何が起きるか）・Given-When-Then受入基準・実稼働/モック区分を定義する。
2. **Grill（逆質問・前提の解消）**: AIはイエスマンにならず、エッジケース、セキュリティ、2層分離境界について開発者へ徹底的に逆質問（`/grill-me`）し、仕様の穴を埋める。
3. **Plan & Tickets（垂直スライス計画）**: `plan.md` および `tasks.md` に基づき、UI・API・DB・テストを含む動く最小単位（Vertical Slice）にチケット分割する。
4. **Implement & Converge（テスト駆動実装と収束）**: 失敗するテスト（Vitest / Playwright）を作成してから最小コードを書き、リファクタリング、非漏洩検査、および仕様整合性確認（`/speckit.analyze`）を行う。

---

## 守ること（プロジェクト憲法に基づく最重要規律）

1. **`prisma/schema.prisma` のフィールド名を勝手に変えない。**MVP定義書4.1.1の写しである。
   後から追加したフィールドは過去セッションのデータを永久に失う。
2. **このリポジトリは公開を前提とする。**事業計画・価格・顧客・資金調達に属する記述を
   コードやコメントに書かない。それらは `enishio-education` 側にある。
3. **LLM実装は実行指示書 §6 を読んでから書く。**訓練データにある2024〜2025年のパターンは
   現行APIで動かない（`temperature: 0` は利用不可など）。
4. **採点のローカル・フォールバックを書かない。**APIキーが無い・構造化出力が取れない場合は
   エラーを返す。キーワード一致等で代替スコアを埋めると、単語の出現を検証行動として測って
   しまい、かつLLMが走っていないのに `rater_type = "llm"` のログが残って
   `scorer_model_version` による追跡可能性が崩れる。**採点しないほうが正確である。**
5. **`*.server.ts` をクライアントコンポーネントから import しない。**
   `src/data/dynamic-task.server.ts` は仕込み不備の位置・類型・正常箇所ラベル
   （＝アセスメントの正答鍵）を持つ。`"use client"` 側へ渡るとビルド成果物に載り、
   受検者が DevTools で全部読める。変更したら確認する:
   `npm run build && grep -rl "FLAW-01" .next/static/`（0件であること）
6. **アンカー項目の正答（`note` / `hidden_premise` / `cheat_notes` / `distractor_notes`）を
   APIレスポンスへ含めない。**画面に描画していなくてもネットワークタブから読める。
7. **アンカー項目バンクの供給源は混同しない。**運用バンク（`src/data/anchors.v2.json` / `src/data/anchors.json` 等の20項目）は
   `.gitignore` 済みで**このリポジトリへ絶対にコミットしない**（項目露出）。
   `src/data/anchors.v2.sample.json`（公開デモ用3項目）は同梱してよく、**削除しない**
   ——これが無いと clone しただけの利用者はアンカー出題を1問も動かせない。
   どちらを読んだかは `src/lib/anchor-bank.ts` の `source` が返し、画面に明示される。
   **サンプル3項目を運用20項目として提示しない。**
8. **`src/lib/mediator`（ソクラテス型深掘り・What-if注入の選択器）へ正答鍵を渡さない。**
   `dynamic-task.server.ts` を import しない・`injected_flaw_map` を引数に含めない。
   渡すと仕込み不備へ向かう固定ヒント梯子になり、答え鍵つきのテストに変質する
   （`[D-28]`。設計決定記録 D-56）。深掘り前後の差分を得点にもしない（`[D-29]`）。

9. **UIを書く前に `.claude/skills/ui-design/SKILL.md` を読む。**画面は測定結果を読ませる
   計器であり、SaaSのダッシュボードではない。**色・文字サイズ・余白のいずれも素の値で書かない**
   ——`src/app/globals.css` が定めた役割名（`ink` / `line` / `accent`、`text-body` / `text-label`、
   `space-y-section` / `gap-block`）と `src/app/components/ui/` のプリミティブだけを使う。
   装飾は3階層に配分し、**全部をカードにしない**（`Section` は枠を持たない）。
   `npm run check:ui` がCIで落とす（`[D-101]` `[D-102]`）。

10. **変更スコープに応じた仕様先行（Living Spec）とコード先行を徹底し、仕様とコードの乖離（Spec Drift）を放置しない。**
    実稼働層（Feasibility: 採点・DBスキーマ・API・セッション進行）の変更時は、コードより先に `specs/<機能>/spec.md` を更新する。モック層（Viability）の見た目調整やタイポ修正はコード先行で素早く回す。実装現場で見つかった制約や仕様変更は、必ず `specs/` 正本へ書き戻す（Flow-Back）。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

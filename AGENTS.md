# このリポジトリの位置づけ

**コード実装および実証プロトタイプリポジトリである。**
仕様・設計・調査の事業的背景は隣の `enishio-education` リポジトリが持ち、本リポジトリの実装仕様は `.specify/memory/constitution.md` および `.specs/` に正本（Single Source of Truth）として整備されている。

両者は親リポジトリ `enishio-business` の `products/` 配下にサブモジュールとして並んでチェックアウトされるため、相対パスで参照できる。

| 探すもの | 場所 |
| :--- | :--- |
| **プロジェクト憲法（不可侵原則）** | [`.specify/memory/constitution.md`](.specify/memory/constitution.md) |
| **システム構成・データモデル仕様** | [`.specs/00-system-architecture.md`](.specs/00-system-architecture.md) |
| **セッション・全APIエンドポイント仕様** | [`.specs/01-session-lifecycle-and-apis.md`](.specs/01-session-lifecycle-and-apis.md) |
| **AutoSCORE・採点・メディエーション仕様** | [`.specs/02-engine-algorithms.md`](.specs/02-engine-algorithms.md) |
| **画面コンポーネント・モック境界仕様** | [`.specs/03-ui-component-map.md`](.specs/03-ui-component-map.md) |
| **開発者向け仕様書駆動開発ガイド（人間用マニュアル）** | [`docs/開発者向け仕様書駆動開発ガイド.md`](docs/開発者向け仕様書駆動開発ガイド.md) |
| 動作確認・検証手順書 | `docs/プロトタイプ動作確認手順書.md` |
| **コードレビューの観点・重大度基準・報告形式（AIレビュー実行者向け）** | [`docs/レビュー観点チェックリスト.md`](docs/レビュー観点チェックリスト.md) |
| ログスキーマの正本（4.1・4.1.1・4.4・4.5） | `../enishio-education/docs/AIアセスメントMVP定義書.md` |
| 採点軸・アンカーの設計根拠 | `../enishio-education/docs/設計決定記録.md` |
| アンカー項目バンク（20項目の本文） | `../enishio-education/docs/共通アンカー項目バンク初版_T-05.md` |

---

## 仕様書駆動開発（SDD）の進め方

本リポジトリでは、**GitHub Spec Kit** と **Matt Pocock Skills** を組み合わせた仕様書駆動開発を採用している。新機能の追加や改修を行う際は、以下のサイクルを厳守すること。

```
1. 仕様策定 (Spec) ──> 2. 逆質問 (Grill) ──> 3. 縦切り計画 (Plan) ──> 4. TDD実装 & 検証
```

1. **Spec（要求仕様の明確化）**: `.specify/templates/spec-template.md` に基づき、What（ユーザー価値・受入基準）と実稼働/モック区分を明確にする。
2. **Grill（逆質問・前提の解消）**: AIエージェントはイエスマンにならず、エッジケース、セキュリティ、2層分離境界について開発者へ徹底的に逆質問（Grilling）し、仕様の穴を埋める。
3. **Plan（垂直スライス計画）**: `.specify/templates/plan-template.md` に基づき、UI・API・DB・テストを含む動く最小単位（Vertical Slice）にチケット分割する。
4. **Implement（テスト駆動実装）**: 失敗するテスト（Vitest / Playwright）を作成してから実装コードを書き、リファクタリングと機密非漏洩検査を行う。

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# このリポジトリの位置づけ

**コード専用リポジトリである。**仕様・設計・調査は隣の `enishio-education` リポジトリが持つ。
両者は親リポジトリ `enishio-business` の `products/` 配下にサブモジュールとして並んで
チェックアウトされるため、相対パスで参照できる。

| 探すもの | 場所 |
| :--- | :--- |
| 実装指示（W0〜W6の作業単位） | `../enishio-education/docs/実行指示書_T-17_審査用縦切りプロトタイプ.md` |
| 動作確認・検証手順書 | `docs/プロトタイプ動作確認手順書.md` |
| ログスキーマの正本（4.1・4.1.1・4.4・4.5） | `../enishio-education/docs/AIアセスメントMVP定義書.md` |
| 採点軸・アンカーの設計根拠 | `../enishio-education/docs/設計決定記録.md` |
| アンカー項目バンク（20項目の本文） | `../enishio-education/docs/共通アンカー項目バンク初版_T-05.md` |

## 守ること

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
7. **アンカー項目バンクの供給源は2つあり、混同しない。**`src/data/anchors.json`（運用20項目）は
   `.gitignore` 済みで**このリポジトリへ絶対にコミットしない**（項目露出）。
   `src/data/anchors.sample.json`（公開デモ用2項目）は同梱してよく、**削除しない**
   ——これが無いと clone しただけの利用者はアンカー出題を1問も動かせない。
   どちらを読んだかは `src/lib/anchor-bank.ts` の `source` が返し、画面に明示される。
   **サンプル2項目を運用20項目として提示しない。**
8. **`src/lib/mediator`（ソクラテス型深掘り・What-if注入の選択器）へ正答鍵を渡さない。**
   `dynamic-task.server.ts` を import しない・`injected_flaw_map` を引数に含めない。
   渡すと仕込み不備へ向かう固定ヒント梯子になり、答え鍵つきのテストに変質する
   （`[D-28]`。設計決定記録 D-56）。深掘り前後の差分を得点にもしない（`[D-29]`）。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

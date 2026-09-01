# Enishio Assessment Prototype

[![CI](https://github.com/ryosuzaki/enishio-assessment-prototype/actions/workflows/ci.yml/badge.svg)](https://github.com/ryosuzaki/enishio-assessment-prototype/actions/workflows/ci.yml)

**AIとの対話中に現れる「検証行動」を測って説明するアセスメントエンジンの、端から端まで通る縦切りプロトタイプ。**

生成AIが答えを出せる時代に、人の能力をどう測るか。本プロトタイプが取る立場は「AIを遮断して素の力を測る」でも「成果物の出来を採点する」でもない。**AIの出力を鵜呑みにせず検証・修正できるか**という過程そのものを、対話ログから証拠つきで抽出して採点する。

これは製品ではなく、**設計が実装可能であることを示すための1本の縦切り**である。幅（機能の網羅）と深さ（統計的較正）はいずれも意図的に捨て、1セッションが端から端まで通ることだけを取っている。

## 何が動くか

```
① アンカー項目の出題（固定4択＋確信度）
     ↓  無得点で記録（較正用の項目・受検者には非表示の役割）
② 動的課題の対話セッション（人手作成3本から選択・3ペイン検証環境）
     ↓  要件仕様・成果物エディタ（編集距離記録）・AI同僚チャット・検証フォーカスパネル
     ↓  AIの提案に誤りが仕込まれている。仕込み位置と「正常箇所」を記録
     ↓  ②-b メディエーターが走行中の状態推定に応じて深掘り・What-if注入を1手選ぶ
        （最大4手。正答鍵は渡さない＝誘出であって誘導ではない）
③ CFF（認知強制機能）暫定判断
     ↓  Force Decision First（AIレポート閲覧前の承認/差し戻し）＋ Mandatory Justification（理由記述必須）
④ 検証行動の抽出（抽出エージェント）
     ↓  対話ログのどの発話が「検証」に当たるかを根拠つきで切り出す（チャット上での根拠ハイライト）
     ↓  深掘りへの応答の一貫性、適正依存の3指標（過剰依存/不足依存）もここで判定・記録する
⑤ 採点（採点エージェント・0〜5バンド）
     ↓  抽出結果のみを入力にする2段階分離
     ↓  確信度が閾値未満なら評点を確定させず人間の確認待ちにする
⑥ XAIレポート（根拠の提示・暫定値ラベル・異議申立導線）

  全ステップが ⓪ ログ基盤へ本番スキーマで書き込む
```

**`ANTHROPIC_API_KEY` が無いと ②〜⑤ は動かない。**代わりのローカル判定は置いていない
（理由は下の「設計上の判断」）。

## 設計上の判断

| 判断 | 理由 |
| :--- | :--- |
| **ログスキーマだけは本番仕様で作る** | UIは捨ててよいがログ定義は捨ててはならない。後から足したフィールドは過去セッション分を永久に失う。ここを本番仕様にしておけば実装がそのまま上に乗る |
| **抽出と採点を2つのエージェントに分ける** | 採点器に生ログを渡すと「何を根拠に何点にしたか」が事後に分離できない。抽出結果のみを採点入力にすることで、根拠と得点の対応がログ上で追跡可能になる |
| **`temperature: 0` に依存しない** | 現行モデルで当該パラメータは利用できない。出力形式は Structured Outputs の型拘束で確保し、`scorer_model_version`（モデルID＋抽出版＋採点版の複合文字列）の全評点記録により追跡可能性を担保する |
| **採点軸を1本に絞る** | 複数軸を同時採点すると項目間の局所依存が生じ、実効項目数が落ちる。縦切りでは軸を1本に固定する |
| **採点できないときは採点しない** | APIキーが無い・構造化出力が得られない場合に、キーワード一致等のローカル判定で代替しない。代替すると (a) 単語の出現を検証行動として測ってしまい、(b) LLMが走っていないのに `rater_type = "llm"` のログが残って `scorer_model_version` による追跡可能性が崩れる。**採点しないほうが正確である** |
| **確信度が低い判定は確定させない** | 採点器が自己申告した確信度が 0.70 を下回る判定は `rater_type = "pending_human"` ・`rating_category = null` として記録する。推定器が迷った事実を潰さずに残す |
| **単一スタックで通す** | Python 側の処理（IRT較正等）は本縦切りのスコープ外。2週間で端から端まで通すことを優先した |
| **メディエーターに正答鍵を渡さない** | 深掘り・What-if注入の選択器（`src/lib/mediator`）は `dynamic-task.server.ts` を import しない。渡すと仕込み不備へ向かう固定ヒント梯子になり、答え鍵つきのテストに変質する。媒介の機能は誘出であって誘導ではない |
| **対話側に測定モデルを置かない** | 動的に生成される一回性の課題には項目パラメータの同定可能性が無い。対話側は中間表現に基づくルーブリック基準参照評価（0〜5バンド）に留め、アンカー側の尺度と同一尺度化しない |

## 技術スタック

Next.js 16（App Router）／ TypeScript ／ React 19 ／ Tailwind CSS v4 ／ PostgreSQL ＋ Prisma ／ `@anthropic-ai/sdk`（モデルは環境変数で切替・既定 `claude-sonnet-4-5`）／ `@google/genai` ／ Playwright ／ Vitest ／ Zod

## データモデル

`prisma/schema.prisma` に14テーブル。評点の正本は `Rating`。

| テーブル | 役割 |
| :--- | :--- |
| `Learner` / `Session` | `session_seq` を明示的に持つ（中断・再開・削除が混じるため日時から復元できない）。`Session` は `window_blur_duration_sec`（画面外滞在時間・記録専用で判定には使わない）も持つ |
| `Rating` | 評点の正本。`scorer_model_version` / `stimulus_type` / `anchor_status` / `stimulus_features`(JSONB) / `probe_consistency_score`。`rating_category` は nullable で、null は「未採点」（人間の確認待ち）を表す |
| `AnchorItem` / `AnchorResponse` | 較正用アンカー項目とその応答。`pretest` / `operational` の2状態。**アンカーは無得点なので `Rating` に行を作らない**——0点を入れるとルーブリック上の「Level 0」と区別できなくなり、将来の較正を汚す。応答時点の `anchor_status` は `AnchorResponse` 側に凍結して持つ |
| `PromptTurn` | 対話の全ターン全文。`role` は `user` / `assistant` / `mediator`（後述）を区別する |
| `ArtifactEditDistanceSeries` | 成果物の編集距離の時系列 |
| `InjectedFlawMap` | 仕込んだ誤りの位置と類型、**および正常箇所のラベル**（これがないと過剰指摘を判定できない） |
| `LearnerPreliminaryJudgement` | CFF（Force Decision First / Mandatory Justification）による事前暫定判断（承認/差し戻し、自己評価点、必須理由記述） |
| `VerificationFocusSequence` | 3ペイン検証パネルで受講者が選択したコードスパンと明示順序（`focus_seq`） |
| `ScoreFeedback` | 異議申立。自由記述の理由を必須にしている |
| `EvidenceComponent` | 採点エンジン第1エージェントが抽出した根拠要素。評点だけでなく根拠そのものを永続化し、XAIレポートのハイライトの原材料にもなる |
| `RelianceMetrics` | 適正依存の3指標（Correct AI Reliance / Correct Self-Reliance / Automation Bias Index）。過剰依存と不足依存の両方を同一セッション内で測る |
| `MediationProbe` | ソクラテス型深掘り・What-if注入の1手ごとの状態推定・選んだ手・選定理由。**正答鍵は含まない**（`src/lib/mediator` が受け取っていないため） |

## 動かす

このリポジトリを clone しただけの状態から、5コマンドで通る。

```bash
npm install
cp .env.example .env      # DATABASE_URL はそのままで docker-compose の設定と一致する
docker compose up -d      # ローカル PostgreSQL（別途用意した DB を使うなら不要）
npm run prisma:generate && npm run prisma:push
npm run seed:anchors      # アンカー項目を anchor_items へ投入（これが無いと出題が落ちる）
npm run dev
```

`ANTHROPIC_API_KEY` を `.env` へ設定すると ②〜⑤（AI同僚との対話・AutoSCORE採点・XAIレポート）
まで通る。未設定でも ① アンカー出題と ⓪ ログ基盤は動く。

詳細なステップ・バイ・ステップの画面操作手順、テレメトリ確認項目、トラブルシューティングについては、[プロトタイプ動作確認手順書](docs/プロトタイプ動作確認手順書.md) を参照。

### アンカー項目バンクの2つの供給源

| 供給源 | 中身 | いつ使われるか |
| :--- | :--- | :--- |
| `src/data/anchors.json` | 運用中の共通アンカー項目バンク20項目 | 存在すれば常にこちらが優先される |
| `src/data/anchors.sample.json` | **公開デモ用サンプル2項目**（リポジトリ同梱） | 上が無いときのフォールバック |

**運用バンク20項目はこのリポジトリに含まれていない。**項目そのものを公開すると受検者が
事前に読めてしまうためである（項目露出。MVP 2.6.2 の監視指標）。生成には隣の
`enishio-education` リポジトリのチェックアウトが要る:

```bash
git -C ../.. submodule update --init products/enishio-education
npm run parse:anchors     # Markdown → src/data/anchors.json
npm run seed:anchors
```

同梱サンプルで動かしている間は、**出題画面に「公開デモ用サンプル」と明示される。**
項目の中身は運用バンクと異なるが、出題から `anchor_responses` への無得点記録までの
経路は同一である。

ログ基盤だけを単体で確かめる場合は `npm run seed`（DBへ書き込む検証スクリプト）。

### テスト・検証スクリプト

```bash
npm run test                  # 単体テスト（Vitest 34件）
npm run test:e2e              # E2Eテスト（Playwright・APIモック 5テスト）
npm run capture:screenshots   # 提案書用UIスクリーンショット取得（全6画面PNG出力。test:e2e には含まれない）
npm run check:flaw-detection  # 代行無効化チェック（Claude / Gemini マルチプロバイダ実測）
npm run check:no-leak         # クライアントバンドルへの正答鍵・秘密情報非漏洩チェック
```

## 公開デプロイ手順（二次審査用）

二次審査（URL提示）に向けた Vercel + サーバーレス PostgreSQL（Supabase / Neon）への公開デプロイ手順です。

> **注意**: 本設定は手順書の提供であり、外部サービスへの本番プロビジョニング・契約・デプロイ実行は人間側の判断で行います。

### 1. サーバーレス PostgreSQL データベースの準備
1. [Supabase](https://supabase.com) または [Neon](https://neon.tech) で新規プロジェクトを作成します。
2. 接続文字列（Connection String）を取得します。
   - **Prisma 接続プーリングの注意点**: Vercel 等のサーバーレス環境では接続過多（Connection Exhaustion）を防ぐため、**プーリング接続文字列（Transaction pooler / ポート 6543 / `?pgbouncer=true`）** を使用してください。
   - 例: `postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true&connection_limit=1`

### 2. スキーマ適用とアンカーデータの初期シード
デプロイ前に、手元の環境から対象データベースに対してスキーマとアンカー項目を投入します。
```bash
# 接続先を対象のデータベースURLに設定して実行
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"

# スキーマの反映（14テーブル作成）
npx prisma db push

# アンカー項目のパースとDB初期シード
npm run parse:anchors
npm run seed:anchors
```

### 3. Vercel へのインポートと環境変数設定
1. [Vercel](https://vercel.com) でリポジトリをインポートします。
   - **Framework Preset**: `Next.js`
   - **Build Command**: `next build`（デフォルトのままで可）
2. **Environment Variables** に以下を設定します:
   - `DATABASE_URL`: 手順1で取得したプーリング接続文字列
   - `ANTHROPIC_API_KEY`: Anthropic API キー（`sk-ant-...`）
   - `GEMINI_API_KEY`: （任意）Google Gemini API キー

### 4. デプロイと動作検証
1. **Deploy** を実行します。
2. デプロイ完了後、発行された URL にアクセスし、以下を確認します:
   - トップページでアンカー20件がロードされること
   - 「セッションを開始する」でアンカー出題へ進めること
   - 動的課題の対話および AutoSCORE 2段階採点が正常に動作し、XAIレポートが表示されること

## 意図的に作っていないもの

評価者HITL画面／認証・SSO・マルチテナント／管理者ダッシュボード／課金／シナリオの自動生成（人手で書いた3本から選ぶ・自動生成はしない）／IRT較正・等化・アンカー項目の昇格判定。

いずれも「あとで足す」ではなく「本縦切りでは作らない」と決めたものである。

## ライセンス

All rights reserved. 事業化を予定しているため OSS ライセンスは付していない。閲覧のみ可。

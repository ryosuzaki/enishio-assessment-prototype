# ログ契約（評点・テレメトリのフィールド定義）

本書は、アセスメントが記録するログの**フィールド名・型・値域の正本**である。`prisma/schema.prisma` は本書と一致させる。

各ログが測定上なぜ必要か（どの分析がそのフィールドの上にしか成り立たないか）は、隣のリポジトリの測定設計書 4章が持つ（`../enishio-education/docs/Phase1測定設計書.md`。非公開）。本書はその要件を、実装が守るべき契約として書き下したものである。

---

## 1. 守ること

1. **既存フィールドの改名・削除・型変更をしない。**変えた時点で過去セッションのデータと突き合わせられなくなる。どうしても必要なら新しいフィールドを足し、旧フィールドは残す。
2. **フィールドを足すときは本書を先に直す。**次に `schema.prisma`、最後にコードの順で直す。逆順にすると、スキーマにだけ存在して意味の定義が無いフィールドが生まれる。
3. **「後から復元できない」印（下表の ⛔）が付いたフィールドは、記録しないという選択肢を持たない。**そのフィールドが無い期間のデータは、後でどう分析しても取り戻せない。
4. **値域は文字列の列挙で持ち、意味を変えない。**列挙値の意味を途中で変えると、変更前後の行が同じ値で別のことを指すようになる。新しい意味が要るなら新しい値を足す。

---

## 2. ログの全体像

| ログ | 何を記録するか | Prisma モデル | 状態 |
| :--- | :--- | :--- | :--- |
| 受講者・セッションの識別 | 誰の何回目のセッションか | `Tenant` / `Learner` / `Session` | 実装済み |
| **アトミック評点ログ（評点の正本）** | 1評点1行。ステップ・軸・採点者・採点器の版・刺激の種別 | `Rating` | 実装済み |
| 共通アンカー応答 | 固定設問への段階ごとの応答・提示順・所要時間 | `AnchorItem` / `AnchorResponse` | 実装済み |
| プロセス解析用ログ | 発話全文（着眼を含む）、編集距離の推移、仕込み不備と正常箇所、事前判定、適正依存指標、根拠要素、深掘りの一手 | `PromptTurn` / `ArtifactEditDistanceSeries` / `InjectedFlawMap` / `LearnerPreliminaryJudgement` / `RelianceMetrics` / `EvidenceComponent` / `MediationProbe` | 実装済み |
| スコア異議・フィードバック | 「この評点は違う」という申立 | `ScoreFeedback` | 実装済み |
| LLM 呼び出しの監査 | 用途・モデル・トークン数・遅延 | `LlmCall` | 実装済み |
| 評価者の意思決定ログ | 評価者の暫定評点・最終評点・上書きの有無と大きさ | — | **未実装**（評価者HITL画面と同時に入れる。§5） |
| 評価行動・滞在時間ログ | 評価者のレビュー開始・終了時刻、所要時間、スクロール深度 | — | **未実装**（同上） |
| 説明可能性・介入理由ログ | 評価者がAIの説明を開いたか、上書きの理由コード | — | **未実装**（同上） |

---

## 3. 識別子

| フィールド | モデル | 型 | 定義 | |
| :--- | :--- | :--- | :--- | :--- |
| `tenant_namespace` | `Tenant` | String（一意） | `learner_id` を採番する名前空間 | |
| `learner_id` | `Learner` / `Session` / `Rating` | String | セッションを横断して同一受講者を紐づける永続識別子。テナントの名前空間のもとで UUIDv5 形式で採番する。リクエストボディから受け取らない | ⛔ |
| `session_seq` | `Session` / `Rating` | Int | その受講者の何回目のセッションか。`(learner_id, session_seq)` は一意。日時から再構成しない（中断・再開・削除が混じると復元できない） | ⛔ |
| `window_blur_duration_sec` | `Session` | Int | 画面外滞在時間の累計。**採点・保留判定・レポートのどこからも参照しない** | |

`Learner` を削除してもテナントの削除に連鎖させない（`onDelete: Restrict`）。記録の帰属先は個人である。

---

## 4. アトミック評点ログ（`Rating`）

ステップ単位で付けた評点を1評点1行で保持する。セッション単位の集計値は持たない——集計は読み出し側で行う。

| フィールド | 型 | 値域・定義 | |
| :--- | :--- | :--- | :--- |
| `rating_id` | String（UUID） | 主キー | |
| `session_id` | String | どのセッションか | |
| `learner_id` | String | どの受講者か | ⛔ |
| `session_seq` | Int | その受講者の何回目のセッションか | ⛔ |
| `step_id` | String | セッション内のどのステップに対する評点か | ⛔ |
| `axis_id` | String | どの評価軸か（例 `"axis_4"`） | ⛔ |
| `rating_category` | Int? | 0〜5 のバンド。`null` は未採点（アンカーの無得点記録、または人間の確認待ち） | |
| `rater_type` | String | `"llm"` ／ `"human"` ／ `"pending_human"`（確信度が閾値未満で人間の確認待ち） | |
| `rater_id` | String | 人間の評価者は評価者ID。LLM は `scorer_model_version` と同じ値 | |
| `scoring_confidence` | Float? | 採点器が自己申告した確信度。閾値未満は `pending_human` へ回し、値そのものは改変せず記録する | |
| `probe_consistency_score` | Float? | ソクラテス型深掘りへの応答の一貫性（0〜1）。採点器の構造化出力による自己申告値であり統計量ではない。深掘りが1回も走らなかったセッションでは `null` | |
| `scorer_model_version` | String | 採点モデル識別子＋プロンプト版（例 `"model_id/extract-v1/score-v1"`）。版の異なる区間は分けて読む | ⛔ |
| `stimulus_ref` | String | 評点が対応する刺激（AI同僚のドラフトの該当箇所・受講者の応答）への参照 | |
| `stimulus_type` | String | `"generated"`（受講者の文脈から生成した課題）／ `"anchor"`（共通アンカー） | ⛔ |
| `anchor_id` | String? | どのアンカー項目か。`stimulus_type = "anchor"` のとき必須 | ⛔ |
| `anchor_status` | String? | `"pretest"` ／ `"operational"` ／ `"verification"` ／ `"retired"`。`stimulus_type = "anchor"` のとき必須。応答時点の値を凍結する | ⛔ |
| `stakes_context` | String | 応答の用途。`"formative"`（育成・評価非連動。本プロトタイプの既定）／ `"education"`（教育）／ `"promotion"`（昇格・配置）／ `"selection"`（採用選考）／ `"verification"`（可搬型の照合）。**全行に付す。**2値にしない——用途からステークス水準へは後から写像できるが、逆はできない | ⛔ |
| `stimulus_features` | Json | 課題生成時の構成特徴ベクトル（変数の数・トレードオフの複雑さ・専門用語の密度・注入した誤り類型など）。生成時にしか取れない | ⛔ |
| `created_at` | DateTime | 記録時刻 | |

**記録前の検査**（`src/lib/telemetry` が実装）: アンカーの評点は `anchor_id` と `anchor_status` を必須とする。`rating_category` は 0〜5 の整数か `null` で、`null` を許すのは `rater_type = "pending_human"` のときだけ。

---

## 5. 共通アンカー（`AnchorItem` / `AnchorResponse`）

| フィールド | モデル | 型 | 定義 | |
| :--- | :--- | :--- | :--- | :--- |
| `anchor_status` | `AnchorItem` | String | 項目の現在の状態。昇格・引退で書き換わる | |
| `anchor_status` | `AnchorResponse` | String | **応答時点の状態を凍結した値。**項目側は書き換わるため、ここに残さないと「pretest 期の応答か」を後から判別できない | ⛔ |
| `stakes_context` | `AnchorResponse` | String | `Rating.stakes_context` と同じ列挙 | ⛔ |
| `format_version` | `AnchorResponse` | String | `"v1-static"`（退役）／ `"v2-sct"`。どちらの形式で答えたかを応答側に凍結する | ⛔ |
| `stage1_selection` 〜 `stage3b_selection` | `AnchorResponse` | String? / Int? | 4段構成（段階1・2・3・3'）の各応答。段階3・3' は −2〜+2。段階3' は全項目には付かない | |
| `stage1_order` / `stage2_order` | `AnchorResponse` | String? | サーバ側でシャッフルした提示順（例 `"C,A,D,B"`）。記録しないと応答を解釈できない | ⛔ |
| `stage*_duration_ms` | `AnchorResponse` | Int? | 段階ごとの所要時間 | |
| `confidence` | `AnchorResponse` | Int | 確信度（1〜5） | |
| `q1_selection` 等 | `AnchorResponse` | String? | v1 形式の旧応答。旧行を保持するため残している。新規応答では使わない | |

アンカーの採点鍵・正答・専門家パネル分布は、どのログにも API レスポンスにも載せない。

---

## 6. プロセス解析用ログ

| ログ | モデル | 主なフィールド | 定義 |
| :--- | :--- | :--- | :--- |
| 発話全文 | `PromptTurn` | `turn_seq`・`role`・`model_version`・`content` | `role` は `"user"` ／ `"assistant"`（AI同僚）／ `"system"` ／ `"mediator"`（進行役）。進行役の問いを `assistant` に混ぜない |
| 編集距離の推移 | `ArtifactEditDistanceSeries` | `timestamp`・`edit_distance`・`current_text` | 成果物の編集距離の時系列 |
| 検証の焦点 | `VerificationFocusSequence` | `focus_seq`・`line_start`・`line_end`・`selected_text` | **新規には書き込まない。**検証パネルを撤廃し、着眼は受講者が要件・コードを引用して発話した時点で `PromptTurn` に残るようになった（二重記録を避けるため。001 plan.md）。旧行を保持するためモデルは残す |
| 仕込み不備と正常箇所 | `InjectedFlawMap` | `flaw_id`・`flaw_type`・`span_text`・`is_flaw` | **正常箇所も `is_flaw = false` で持つ**（適正依存指標の分母になる）。正答鍵であり、クライアントへ渡さない |
| 事前判定 | `LearnerPreliminaryJudgement` | `step_id`・`action`・`justification` | `action` は `"approve"` ／ `"remand"`。理由は必須・空文字不可 |
| 適正依存の3指標 | `RelianceMetrics` | `correct_ai_reliance`・`correct_self_reliance`・`automation_bias_index`・`operationalization` | 分母が0のときは `0` ではなく `null`。**算出時点の操作的定義を `operationalization` に文字列で凍結する** |
| 根拠要素 | `EvidenceComponent` | `turn_index`・`quoted_span`・`component_type`・`grounding`・`injected_flaw_id` | 2段階採点の第1段階が抽出した証拠。XAIレポートの原材料を兼ねる |
| 深掘りの一手 | `MediationProbe` | `probe_move`・`probe_text`・`state_estimate`・`mediator_model_version` | 進行役が打った手と、そのとき参照した状態推定。「問わない」と判断した事実も記録する |
| LLM 呼び出し | `LlmCall` | `purpose`・`model`・トークン数・`latency_ms` | 費用と遅延の監査用 |

---

## 7. スコア異議・フィードバック（`ScoreFeedback`）

| フィールド | 型 | 値域・定義 |
| :--- | :--- | :--- |
| `feedback_id` | String（UUID） | 主キー |
| `rating_id` | String | どの評点への申立か |
| `session_id` | String | どのセッションか（総合スコアへの申立でも必須） |
| `actor_role` | String | `"learner"` ／ `"supervisor"` ／ `"hr"` |
| `disagreement_direction` | String | `"too_high"` ／ `"too_low"` ／ `"axis_mismatch"`（軸の割り当てが違う）／ `"evidence_wrong"`（根拠として示した箇所が違う） |
| `free_text_reason` | String | **必須。**何が違うと考えるか |
| `cited_evidence_ref` | String? | 申立者が根拠として指した対話箇所 |
| `scorer_model_version` | String | 申立時点の採点器の版 |
| `resolution` | String? | 評価者の判断（`upheld` ／ `rejected` ／ `pending`）と理由コード |

申立の有無・件数を採点に反映しない。

---

## 8. 未実装の要件

| 要件 | 入れる時期 | 内容 |
| :--- | :--- | :--- |
| 評価者の意思決定ログ | 評価者HITL画面と同時 | `evaluator_id`・`evaluator_preliminary_score`（AI採点を見る前に入力した暫定評点）・`ai_initial_score`・`human_final_score`（軸別）・`is_overridden`・`override_magnitude` |
| 評価行動・滞在時間ログ | 同上 | `review_start_timestamp`・`review_submit_timestamp`・`total_review_duration_sec`・`transcript_scroll_depth` |
| 説明可能性・介入理由ログ | 同上 | `ai_explanation_opened`・`override_reason_code`・`override_free_text_reason`・`confidence_score_viewed` |
| 一対比較の判定器の版 | 一対比較の判定器を実装するとき | 一対比較の判定に使ったモデルとプロンプトの版を識別する列。`scorer_model_version` は絶対採点の採点器の版であり、これを兼ねない。無いと判定器を更新するたびに全件を判定し直すしかなくなる |
| アンカー較正の版 | アンカーの較正を始めるとき | どの応答集合で推定した項目パラメータかを復元する `calibration_version`。除外して推定し直せるよう、生ログは消さない |

---

## 📅 更新履歴
- 2026-10-01: 新設。ログのフィールド定義の正本を、非公開側の旧 MVP定義書 4.1・4.1.1・4.4・4.5 から本書へ移した。値域は実装（`schema.prisma`）に合わせた——`rater_type` は旧定義の `ai` ではなく `llm`・`pending_human` を持ち、`scoring_confidence`・`probe_consistency_score`・`anchor_status = "retired"` は旧定義に無かった

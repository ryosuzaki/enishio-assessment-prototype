# Engine Algorithms Specification

本書は、Enishio アセスメントエンジンの中核アルゴリズムである**AutoSCORE（2段階採点エンジン）、ソクラテス型メディエーター（深掘り・What-ifプローブ）、および適正依存指標（Reliance Metrics）**の計算ロジックと動作仕様を定義した正本仕様書である。

---

## 1. AutoSCORE 2段階採点アーキテクチャ

### 1.1 2段階分離の必然性（測定学的根拠）
LLMによる直接採点（生ログ → 点数＋理由）を行うと、LLMは「自分がつけた点数を正当化するもっともらしい理由」を事後的に捏造（ハルシネーション）する傾向がある。
これを防ぐため、AutoSCORE は**「事実の客観的抽出（第1段階）」**と**「抽出結果に基づく規準的判定（第2段階）」**を厳格に分離する。

```
[対話ログ + 最終成果物 + 課題仕様]
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: 根拠要素抽出パーサー (extractEvidence)             │
│ - 対話から受講者の「客観的な検証行動スパン」のみを抽出      │
│ - MEDIATOR の発話は除外（受講者の発言のみ対象）             │
│ - スキーマ: EvidenceExtractionOutputSchema (Zod)            │
└─────────────────────────────────────────────────────────────┘
               │
               ▼ 【構造化データのみ受け渡し（生ログは渡さない）】
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: 軸4 バンド採点器 (computeBandScore)                │
│ - 抽出された根拠要素とルーブリック基準のみに基づき評定      │
│ - スキーマ: ScoringOutputSchema (Zod)                       │
│ - 確信度（scoring_confidence）の自己申告                    │
└─────────────────────────────────────────────────────────────┘
               │
               ▼
[確信度 < 0.7 ?  ─── YES ───> rater_type = "pending_human" (保留)
        │
        NO
        ▼
 rating_category = 0..5 (スコア確定) ]
```

### 1.2 第1段階：根拠要素抽出スキーマ
* **`EvidenceComponent`**:
  * `turn_index`: 対話ターンの連番
  * `quoted_span`: 受講者の発言から切り出した検証行動の根拠テキスト
  * `component_type`:
    * `premise_identification`: 暗黙の前提・トレードオフの言語化
    * `flaw_detection`: 仕込み不備の具体的指摘
    * `false_positive_critique`: 正常箇所への過剰指摘（誤認）
    * `blind_acceptance`: AI出力への無批判な受容・追従
    * `unclear_instruction`: 曖昧・具体性のない指示
    * `alternative_design_proposal`: 代替アーキテクチャやフォールバック設計の具体的提示
  * `grounding`: 接地の客観的観測（`none` / `asserted` / `tied_to_requirement`）
  * `injected_flaw_id`: 課題の基準マップ（仕込み不備・正常箇所）のID
  * `rationale_summary`: 抽出理由の要約
* **セッション全体フラグ**:
  * `identified_flaws_count`: 指摘できた不備数
  * `avoided_false_positives`: 正常箇所を明示的に妥当と判断したか（言及なしは `false`）
  * `probe_consistency`: メディエーターの深掘りに対する応答の一貫性（0..1、深掘りなし時は `null`）

### 1.3 第2段階：軸4 能力ルーブリック基準

| バンド | ラベル | 採点基準（ルーブリック） |
| :---: | :--- | :--- |
| **Level 0** | 無批判受容 / 判定不能 | 根拠要素が空、または検証行動が1件も抽出されていない。 |
| **Level 1** | 盲目的追従 | AIの提案を無批判に受け入れている（`blind_acceptance` が存在）。 |
| **Level 2** | 漠然とした違和感 | 不備には気づいているが、理由やトレードオフが言語化できず曖昧（`grounding` が `none` または `asserted`）。 |
| **Level 3** | 前提・トレードオフの具体的言語化 | 業務要件・制約から生じる前提やリスクを具体的に指摘できている（`grounding` が `tied_to_requirement` の `flaw_detection` / `premise_identification`）。 |
| **Level 4** | 卓越（正常箇所の弁別） | 不備を正確に指摘しつつ、正常だが疑わしい箇所を過剰指摘せず**明示的に正当と判断している**（`avoided_false_positives = true`）。 |
| **Level 5** | 指導的検証力 | 代替アーキテクチャやフォールバック設計を明確に指示できている（`alternative_design_proposal` が存在）。 |

### 1.4 バージョニングと HITL（Human-in-the-Loop）
* **モデルバージョン**: `getScorerModelVersion()` は `{MODEL}/extract-v6/score-v3` 形式で記録。
* **確信度閾値**: 既定値 `0.7` 未満の採点は、`rater_type = "pending_human"` として記録し、スコアを確定させずに人間レビュー待ちとする（`.env` の `HITL_DEMO_CONFIDENCE_THRESHOLD` でデモ実演可能）。

---

## 2. ソクラテス型メディエーター (Mediation Engine)

### 2.1 設計思想: 誘出（Elicitation）であって指導（Intervention）ではない
* メディエーターの目的は、成果物コードだけでは見えない「受講者の頭の中の判断プロセス」を**引き出す**ことにある（`[D-28]`）。
* **正答鍵遮断（Answer Key Isolation）**: メディエーターモジュールは `dynamic-task.server.ts` を import しない。仕込み不備の答えを知っていると、無意識に正解へ誘導する固定ヒント梯子（Interventionist DA）に変質するためである。

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

---

## 3. 適正依存指標 (Reliance Metrics)

受講者のAI協働における「過剰依存」および「不足依存（過剰拒絶）」を定量化する3指標。

### 3.1 算出式と操作的定義
セッション内で提示された仕込み不備集合 $F$（`is_flaw=true`）および正常箇所集合 $V$（`is_flaw=false`）に対して算出する:

1. **正当自立率 (Correct Self-Reliance: CSR)**
   $$\text{CSR} = \frac{\text{指摘できた仕込み不備数}}{|F|}$$
   *AIの誤りを正しく看破・修正できた割合。*
2. **正当AI依存率 (Correct AI-Reliance: CAR)**
   $$\text{CAR} = \frac{|V| - \text{過剰指摘した正常箇所数}}{|V|}$$
   *AIの正しい出力を疑心暗鬼にならず正当に採択できた割合。*
3. **オートメーションバイアス指数 (Automation Bias Index)**
   $$\text{ABI} = 1 - \text{CSR} = \frac{\text{見落とした仕込み不備数}}{|F|}$$
   *AIの誤りに追従・看過してしまった割合。*

### 3.2 統計処理の規律
* **セッション内完結**: 指標の算出はセッション単位で完結させる。稼働前・妥当性検証前に複数セッションを跨ぐ平均値や相関値を勝手に算出してはならない（`[P-17]`）。
* **分母0の保護**: 不備または正常箇所が0件の場合は、`0` ではなく `null` を記録する（未提示と不達成の混同防止）。

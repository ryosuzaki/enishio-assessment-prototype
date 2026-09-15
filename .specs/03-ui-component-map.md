# UI Component Map & Layer Boundary

本書は、Enishio アセスメントエンジン プロトタイプにおける**画面コンポーネント構成、タブ構造、および「実稼働（Feasibility）」と「モック（Viability）」の境界定義**を定めた正本仕様書である。

---

## 1. 画面レイヤーとタブ構造

画面上部のタブナビゲーション（`src/app/page.tsx`）により、以下の4つのビューを切り替える（`[D-79]`）。

```
┌────────────────────────────────────────────────────────────────────────┐
│  [Enishio Platform]   ① 演習セッション  |  ② 組織ダッシュボード        │
│                       ③ 受講者カルテ    |  ④ ベンチマークギャラリー    │
└────────────────────────────────────────────────────────────────────────┘
```

| タブ | キー (`AppTab`) | 区分 | 対象ユーザー | 目的・提供価値 |
| :--- | :--- | :---: | :--- | :--- |
| **演習セッション** | `session` | **実稼働** | 受講者（エンジニア） | 端から端まで動く縦切りアセスメント（対話・採点・レポート）。 |
| **組織ダッシュボード** | `dashboard` | **モック** | EM、DX・人事責任者 | 組織全体のスキル到達度、バイアス克服成果、育成処方箋の提示。 |
| **受講者カルテ** | `profile` | **モック** | 受講者本人 | 過去の演習履歴、動的コンピテンシー成長推移、好手（Good Moves）ログ。 |
| **ベンチマーク** | `gallery` | **モック** | 全体 | 課題シナリオ一覧と事前設定された評価基準のギャラリー閲覧。 |

---

## 2. コンポーネント一覧と実稼働 / モック境界マップ

### 2.1 実稼働コンポーネント（Feasibility Components）
Next.js API ルート、Prisma DB、および LLM API とリアルタイムに通信し、実際のデータを送受信・永続化するコンポーネント群。**型定義の厳密化、テスト駆動（TDD）の対象**。

| コンポーネント | ファイルパス | 責務と接続先 |
| :--- | :--- | :--- |
| **`InitStep`** | `src/app/components/InitStep.tsx` | 受講者ID・連番の発行フォーム。`/api/session/start` と通信。 |
| **`AnchorQuestionStep`** | `src/app/components/AnchorQuestionStep.tsx` | 共通アンカーの出題・回答受付。`/api/anchor` と通信。4段構成（v2-sct）およびv1に対応。 |
| **`DialogueSessionStep`** | `src/app/components/DialogueSessionStep.tsx` | 3ペイン演習画面（課題・対話・エディタ）。`/api/dialogue/turn`, `/api/dialogue/probe`, `/api/dialogue/focus` と通信。 |
| **`PreliminaryJudgementStep`**| `src/app/components/PreliminaryJudgementStep.tsx` | CFF（認知先行判断）画面。AI評価閲覧前の決定強制。`/api/dialogue/preliminary-judgement` と通信。 |
| **`EvaluationReportStep`** | `src/app/components/EvaluationReportStep.tsx` | XAIレポート表示と異議申立フォーム。`/api/dialogue/evaluate`, `/api/feedback` と通信。 |
| **`MediationStatePanel`** | `src/app/components/MediationStatePanel.tsx` | 対話右ペインに表示される走行中の状態推定・打てる手のリアルタイム可視化。 |
| **`TelemetryPanel`** | `src/app/components/TelemetryPanel.tsx` | 画面下部に配置されるリアルタイムのセッション状態・テレメトリログインスペクタ。 |
| **`ErrorBanner`** | `src/app/components/ErrorBanner.tsx` | APIエラー、採点不能エラー（`ScoringUnavailableError`）の通知バナー。 |

### 2.2 展示用モックコンポーネント（Viability Components）
事業性実証（企業の意思決定者が何を見るか）を目的とするUI。静的モックデータ（`src/data/benchmark-gallery-data.ts` 等）を用いて描画され、DBやLLMとの通信は行わない。**過度なバックエンド結合を求めない**。

| コンポーネント | ファイルパス | 責務と表示内容 |
| :--- | :--- | :--- |
| **`OrganizationDashboard`** | `src/app/components/OrganizationDashboard.tsx` | 組織ダッシュボード。部署別進捗、バイアス克服（Before/After）、育成アクション処方箋、助成金用CSV出力UI。 |
| **`LearnerProfile`** | `src/app/components/LearnerProfile.tsx` | 受講者マイページ。4領域レーダー、CSR/CARバランス、好手（Good Moves）ログ、実務転移チェックリスト。 |
| **`BenchmarkGallery`** | `src/app/components/BenchmarkGallery.tsx` | 課題シナリオのベンチマーク一覧、正常箇所・仕込み不備の解説カード。 |

---

## 3. 親ページ (`page.tsx`) の状態管理設計

`src/app/page.tsx`（オーケストレーター）は、以下のグローバルステートを一元管理する:
1. **ナビゲーション状態**: `activeTab` ("session" | "dashboard" | "profile" | "gallery")
2. **セッション状態**: `sessionId`, `sessionSeq`, `learnerId`, `currentStep` ("init" → "anchor" → "dialogue" → "judgement" → "report")
3. **対話・成果物状態**: `chatMessages`, `currentArtifact`, `focusItems`, `editDistanceSeries`
4. **メディエーション状態**: `evidenceStates`, `lastProbe`
5. **評価結果状態**: `evaluationResult`, `isPendingHuman`

### 3.1 開発・改修時の規律
* 実稼働ステップに新機能を追加する場合、必ず `.specs/01-session-lifecycle-and-apis.md` および API ルートの型定義（`src/app/types.ts`）を更新した上で着手すること。
* モック層の画面要素を追加する場合、実稼働セッションのデータフローと混同させず、静的データバインドで独立して拡張すること。

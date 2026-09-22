# Enishio Assessment Prototype Specifications

本ディレクトリは、GitHub Spec Kit の標準仕様永続化モデル（[Spec Persistence Models](https://github.github.io/spec-kit/guides/evolving-specs.html)）に準拠した仕様書正本管理ディレクトリです。

## ディレクトリ構成

### 1. システム基盤ベースライン (`baseline/`)
システム全体の横断的なアーキテクチャ、データモデル、API契約、測定学アルゴリズム、UI境界を定義した不変・参照用ベースラインです。

* [00-system-architecture.md](baseline/00-system-architecture.md): 全体構成・Prisma 12モデル ER図
* [01-session-lifecycle-and-apis.md](baseline/01-session-lifecycle-and-apis.md): セッション遷移・全APIエンドポイント仕様
* [02-engine-algorithms.md](baseline/02-engine-algorithms.md): AutoSCORE 2段階採点アルゴリズム・適正依存指標
* [03-ui-component-map.md](baseline/03-ui-component-map.md): UIコンポーネント構成・実稼働/モック境界マップ

---

### 2. フィーチャースペック (`<prefix>-<short-name>/`)
各機能・改修ごとに独立したディレクトリを持ち、Spec Kit 三種の神器（`spec.md`, `plan.md`, `tasks.md`）で Living Spec サイクルを回します。

* **[001-session-orchestration](001-session-orchestration/)**:
  * [spec.md](001-session-orchestration/spec.md): 演習セッション全体の進行・受入基準・Grill記録
  * [plan.md](001-session-orchestration/plan.md): 垂直スライス設計・API設計
  * [tasks.md](001-session-orchestration/tasks.md): 実装タスクチェックリスト・収束検証
* **[002-autoscore-pipeline](002-autoscore-pipeline/)**:
  * [spec.md](002-autoscore-pipeline/spec.md): 2段階採点（根拠抽出→バンド評定）・HITL閾値・フォールバック禁止
  * [plan.md](002-autoscore-pipeline/plan.md): OpenAI Structured Outputs・Prisma永続化
  * [tasks.md](002-autoscore-pipeline/tasks.md): 実装タスク・収束検証
* **[003-socratic-mediator](003-socratic-mediator/)**:
  * [spec.md](003-socratic-mediator/spec.md): ソクラテス型問いかけ（プローブ）・正答鍵遮断・場面3前提変化
  * [plan.md](003-socratic-mediator/plan.md): メディエーターモジュール設計・API設計
  * [tasks.md](003-socratic-mediator/tasks.md): 実装タスク・収束検証

---

## 運用ルール
1. **新規機能の追加**: `/speckit-specify` またはテンプレート（`.specify/templates/spec-template.md`）を用いて `specs/<連番>-<機能名>/` を作成。
2. **既存機能の改修（Living Spec）**: コードを触る前にまず対象の `spec.md` を更新し、`/speckit.plan` → `/to-tickets` → `/tdd` で実装へ波及させる。
3. **現場発見の逆流反映（Flow-Back）**: 実装中に判明した制約は必ず対象の `spec.md` へ書き戻す。

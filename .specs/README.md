# 仕様書ディレクトリ再編のお知らせ (Spec Kit 構造への移行)

本リポジトリの仕様書は、GitHub Spec Kit の公式標準（[Evolving Specs](https://github.github.io/spec-kit/guides/evolving-specs.html)）に基づき、各ドメインごとのフィーチャーディレクトリ（[specs/](../specs/)）へ完全統合・一本化されました。

```
specs/
├── README.md                       # 全体システム構成図・全16モデルER図・ナビゲーション
│
├── 001-session-orchestration/      # 演習セッション統制・UI・テレメトリ（10モデル・8API）
│   ├── spec.md                     # 要求仕様・受入基準 (Given-When-Then)・Grill記録
│   ├── plan.md                     # 技術計画・DBモデル定義・API契約・垂直スライスチケット
│   └── tasks.md                    # 実装タスク・収束確認
│
├── 002-autoscore-pipeline/          # 構造化採点パイプライン・適正依存指標（4モデル・評価API）
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
│
└── 003-socratic-mediator/          # ソクラテス型メディエーター・前提変化（2モデル・プローブAPI）
    ├── spec.md
    ├── plan.md
    └── tasks.md
```

> **注記**: 各機能仕様書（`001`〜`003`）が、担当領域のデータモデル・API契約を含む唯一の正本（Single Source of Truth）です。

# 仕様書ディレクトリ再編のお知らせ (Spec Kit 構造への移行)

本リポジトリの仕様書は、GitHub Spec Kit のベストプラクティス（[Evolving Specs](https://github.github.io/spec-kit/guides/evolving-specs.html)）に基づき、以下の構造で [specs/](../specs/) ディレクトリへ再編・拡張されました。

```
specs/
├── baseline/                       # システム全体アーキテクチャ・基盤仕様正本
│   ├── 00-system-architecture.md   # システム全体構成・ER図
│   ├── 01-session-lifecycle-and-apis.md # セッション遷移・API仕様
│   ├── 02-engine-algorithms.md     # AutoSCOREアルゴリズム・測定学
│   └── 03-ui-component-map.md      # UIコンポーネント・モック境界
│
├── 001-session-orchestration/      # 演習セッション・オーケストレーション機能
│   ├── spec.md                     # 要求仕様・受入基準 (Given-When-Then)・Grill記録
│   ├── plan.md                     # 技術計画・垂直スライスチケット
│   └── tasks.md                    # 実装タスク・収束確認
│
├── 002-autoscore-pipeline/          # AutoSCORE 2段階採点パイプライン
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
│
└── 003-socratic-mediator/          # ソクラテス型メディエーター・前提変化
    ├── spec.md
    ├── plan.md
    └── tasks.md
```

> **注記**: 既存の `.specs/*.md` は後方互換性のため維持されていますが、新規の仕様策定・改修作業はすべて [specs/](../specs/) 配下のフィーチャースペックに対して行ってください。

// 静的解析。**型検査では落ちないものを落とすために置いてある。**
//
// 導入の直接のきっかけは、第3ペイン撤廃後に DialogueSessionStep へ
// 「互換性のためのオプショナルProps」が10個residualで残り、`tsc` も CI も
// 誰も気づけなかったことである。型は合っているので型検査は通り、
// 画面は動くのでE2Eも通り、宣言だけが半年ぶん積もる。
//
// `react-hooks/exhaustive-deps` も同様で、コード中に
// `// eslint-disable-next-line` は書かれていたのに、ESLint 自体が
// 入っていなかったため一度も評価されていなかった。
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 課題シナリオの実装コードは「不備を仕込んだ題材」であり、
    // 行儀の良さを検査する対象ではない。
    "src/data/dynamic-task.ts",
    "scratch/**",
    "test-results/**",
  ]),

  {
    rules: {
      // 使われていない宣言は消す。`_` 始まりだけは意図的な未使用として許す
      // （インターフェース都合で受け取るだけの引数など）。
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    // テストと運用スクリプトでは `any` を許す。モックの戻り値や JSON の受け皿に
    // 正確な型を与えても、検査しているものは増えない。**本体コードでは許さない。**
    files: ["**/*.test.ts", "**/*.test.tsx", "src/integration/**", "scripts/**", "e2e/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    // `.cjs` は CommonJS として書くためにその拡張子を付けてある。
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

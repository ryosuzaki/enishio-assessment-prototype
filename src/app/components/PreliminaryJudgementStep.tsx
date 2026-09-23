"use client";

import React, { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import type { ChatMessage } from "../types";
import { Badge, Button, Card, cn } from "./ui";

interface PreliminaryJudgementStepProps {
  chatHistory?: ChatMessage[];
  prelimAction: "approve" | "remand" | "comment" | "";
  setPrelimAction: (action: "approve" | "remand" | "comment" | "") => void;
  prelimJustification: string;
  setPrelimJustification: (justification: string) => void;
  prelimError: string | null;
  isEvaluating: boolean;
  onBackToDialogue: () => void;
  onConfirmPreliminaryAndEvaluate: () => void;
}

/**
 * GitHub PR レビュー形式の3択。
 *
 * **選択肢そのものには色を付けない。**「承認は緑・修正要求は赤」と塗ると、まだ選んでいない
 * 段階で画面が結論を示唆してしまう。選んだものだけを枠と地色で示す。
 */
const DECISIONS: { value: "remand" | "comment" | "approve"; label: string; detail: string }[] = [
  {
    value: "remand",
    label: "修正を要求する",
    detail:
      "重大な障害リスクや規程違反（P0ブロッカー）が残っており、本番リリース不可と判定。修正を指示。",
  },
  {
    value: "comment",
    label: "条件付きで承認する",
    detail:
      "主要設計には合意。ステージング環境での追加検証や運用監視（アラート設定）の追加を条件として許可。",
  },
  {
    value: "approve",
    label: "承認する",
    detail: "要件およびチーム運用基準を満たしており、このまま本番デプロイ可能と判定。",
  },
];

export function PreliminaryJudgementStep({
  chatHistory = [],
  prelimAction,
  setPrelimAction,
  prelimJustification,
  setPrelimJustification,
  prelimError,
  isEvaluating,
  onBackToDialogue,
  onConfirmPreliminaryAndEvaluate,
}: PreliminaryJudgementStepProps) {
  // Extract user quotes from dialogue
  const userQuotes = useMemo(() => {
    return chatHistory
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .slice(-3);
  }, [chatHistory]);

  // Dynamically synthesize points actually raised by the learner [D-80] (No spoilers of unmentioned flaws)
  const synthesizedPoints = useMemo(() => {
    const userMessages = chatHistory.filter((m) => m.role === "user");
    if (userMessages.length === 0) {
      return [];
    }
    return userMessages.map((msg, idx) => {
      const content = msg.content.trim();
      const firstLine = content.split("\n")[0];
      const title = firstLine.length > 50 ? firstLine.slice(0, 50) + "…" : firstLine;
      const turnSeq = msg.turnSeq ?? (idx + 1) * 2 - 1;
      return {
        num: `指摘 #${idx + 1}`,
        turnSeq,
        title,
        detail: content,
      };
    });
  }, [chatHistory]);

  return (
    <div className="space-y-block">
      <header className="space-y-2 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">場面4：意思決定</Badge>
        </div>
        <h2 className="text-title tracking-tight text-ink">
          PRへの最終判定を確定する
        </h2>
        <p className="max-w-4xl text-caption text-ink-2">
          AIの採点を見る前に、自分の判定を先に確定します。後から採点に合わせて判断を変えられないようにするためです。
          進行役が対話ログから整理したあなたの論点を確認し、GitHubのPRレビューと同じ
          ［修正要求］［条件付き承認］［承認］から選んでください。
        </p>
      </header>

      {prelimError && (
        <div
          role="alert"
          className="rounded-card border border-critical/30 bg-critical-wash px-4 py-3 text-caption text-critical"
        >
          {prelimError}
        </div>
      )}

      <Card
        title="進行役が整理したあなたの論点"
        meta="対話ログからあなたの主張だけを整理しています（正解は含みません）"
      >
        <div className="space-y-cell">
          {synthesizedPoints.length > 0 ? (
            <ol className="space-y-2">
              {synthesizedPoints.map((pt) => (
                <li
                  key={pt.num}
                  className="flex flex-col gap-1.5 rounded-chip border border-line bg-surface-sunken p-2.5 text-caption sm:flex-row sm:gap-2.5"
                >
                  <span className="shrink-0 font-medium text-ink-3" data-numeric>
                    {pt.num}（ターン {pt.turnSeq}）
                  </span>
                  <span className="min-w-0 leading-relaxed text-ink-2">
                    <strong className="font-semibold text-ink">{pt.title}: </strong>
                    {pt.detail}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-chip border border-line bg-surface-sunken p-3 text-caption text-ink-2">
              ※
              対話ログに受講者からの指摘・指示発言が記録されていません。対話を経ずに判断に進む場合は、以下の「判断理由（必須）」欄に成果物に対する具体的な理由を直接記述してください。
            </p>
          )}

          {userQuotes.length > 0 && (
            <div className="space-y-1.5 border-t border-line pt-3">
              <p className="text-caption text-ink-3">受講者の主要な対話発言（引用スパン）:</p>
              <ul className="flex flex-wrap gap-1.5">
                {userQuotes.map((q, idx) => (
                  <li
                    key={idx}
                    className="rounded-chip border border-line bg-surface-sunken px-2 py-1 text-caption text-ink-2"
                  >
                    &ldquo;{q.length > 50 ? q.slice(0, 50) + "…" : q}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <fieldset className="space-y-row">
        <legend className="flex w-full flex-wrap items-baseline justify-between gap-2 pb-1">
          <span className="text-section text-ink">
            ① このプルリクエストに対する最終意思決定（GitHub PRレビュー形式・必須）
          </span>
          <span className="text-caption text-ink-3">※ 選択するだけでワンクリック確定可能</span>
        </legend>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {DECISIONS.map((d) => (
            <label
              key={d.value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-card border p-3 transition-colors",
                prelimAction === d.value
                  ? "border-accent bg-accent-wash"
                  : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="prelim_action"
                value={d.value}
                checked={prelimAction === d.value}
                onChange={() => setPrelimAction(d.value)}
                className="mt-1 shrink-0 accent-[var(--color-accent)]"
              />
              <span className="space-y-1">
                <span className="block text-section text-ink">{d.label}</span>
                <span className="block text-caption text-ink-2">{d.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 白紙再作文は恒久的に廃止されている（[D-80]）ため、この欄はあくまで任意の微調整である */}
      <div className="space-y-2">
        <label
          htmlFor="prelim-justification"
          className="flex flex-wrap items-baseline justify-between gap-2"
        >
          <span className="text-section text-ink">
            ② 進行役の要約に対する補足・微調整（任意・省略可）
          </span>
          <span className="text-caption text-ink-3">※ 省略時は上記要約がそのまま記録されます</span>
        </label>
        <textarea
          id="prelim-justification"
          value={prelimJustification}
          onChange={(e) => setPrelimJustification(e.target.value)}
          placeholder="進行役の要約に補足や微調整がある場合のみ入力してください（省略可。例: 承認または差し戻しと判断した具体的な根拠・理由を記述）…"
          className={cn(
            "h-20 w-full resize-none rounded-chip border border-line-strong bg-surface p-3",
            "text-caption text-ink focus:border-accent focus:outline-none",
          )}
        />
        <p className="text-caption text-ink-3">
          ※
          白紙からの再作文は不要です。入力がない場合も、進行役がまとめた論点要約がそのまま正式な判断理由（Mandatory
          Justification）として安全に記録されます。
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
        <Button variant="quiet" onClick={onBackToDialogue} disabled={isEvaluating}>
          ← 対話画面へ戻る
        </Button>
        <Button
          variant="primary"
          onClick={onConfirmPreliminaryAndEvaluate}
          disabled={isEvaluating || !prelimAction}
        >
          {isEvaluating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              評価実行中（Stage 1 抽出 ➔ Stage 2 採点）…
            </>
          ) : (
            "判定を確定して採点する"
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * [D-80]: 白紙再作文を行わない場合のフォールバック論点要約テキスト生成
 * 進行役がまとめた対話論点＋受講者発言引用を統合し、DB記録用の理由テキストとして返す（事前ネタバレ排除）
 *
 * 要約は受講者自身の発言だけから作るため、**課題には依存しない。**
 * 課題ごとに定型文を出し分けると、受講者が書いていない論点を理由欄に混ぜることになる。
 */
export function getDefaultMirroringSummary(chatHistory: ChatMessage[] = []): string {
  const userMessages = chatHistory.filter((m) => m.role === "user");
  if (userMessages.length === 0) {
    return "対話ログに基づく受講者判定（直接確定）";
  }

  const quotes = userMessages
    .map((m) => m.content.trim())
    .filter(Boolean)
    .slice(-3);

  const quotesStr = quotes.map((q) => `「${q.length > 50 ? q.slice(0, 50) + "…" : q}」`).join("、");
  return `【進行役対話要約】受講者の対話発言・指摘事項（${quotesStr}）を踏まえた最終コミットメント。`;
}

"use client";

import React from "react";
import {
  Clock,
  ArrowRight,
  MessageSquare,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  FlaskConical,
} from "lucide-react";
import type { AnchorItem, StepType } from "../types";

/**
 * 4段構成の疑似対話形式アンカー [D-83]。
 *
 * 旧・静的選択式（「暗黙の前提はどれか」を4択で当てる）は、**選択肢が答えを含むために
 * 「言われずに気づく」という測定対象を消していた**——対話演習とは別の構成概念を測る形式
 * であり、等化のアンカーとして成立しない。ここではそれを次の3点で回復する。
 *
 * 1. **段階的開示**: 段階1で「採用可否」だけを確定させ、ロックしてから細部へ降りる
 * 2. **前提変化の注入**: 段階3で新情報を出し、判断がどちらへ動くかを取る（SCT型）
 * 3. **類型C の混在**: 不備のない項目を混ぜ、「とりあえず条件付きを選ぶ」戦略を潰す
 *
 * 回復しないのは「反論への応答（押し返す）」で、これは対話側に残る。
 */

interface AnchorQuestionStepProps {
  currentStep: StepType;
  currentAnchor: AnchorItem | null;
  bankSource: string | null;
  stage1Choice: string;
  setStage1Choice: (choice: string) => void;
  stage2Choice: string;
  setStage2Choice: (choice: string) => void;
  stage3Choice: number | null;
  setStage3Choice: (choice: number) => void;
  stage3bChoice: number | null;
  setStage3bChoice: (choice: number) => void;
  confidence: number;
  setConfidence: (confidence: number) => void;
  isSubmitting: boolean;
  onStage1Next: () => void;
  onStage2Next: () => void;
  onStage3Next: () => void;
  onStage3bNext: () => void;
  onAnchorSubmit: () => void;
  onStartDialogueSession: () => void;
}

const PANEL =
  "glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6";
const OPTION_BASE = "flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer";
const OPTION_ON = "bg-blue-600/15 border-blue-500 text-white shadow-md shadow-blue-500/10";
const OPTION_OFF = "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700";

function StageHeader({
  anchorId,
  stage,
  label,
}: {
  anchorId: string;
  stage: number;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
      <span className="text-xs font-mono px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
        共通アンカー項目: {anchorId}
      </span>
      {/*
        総段数を出さない。「段階 1 / 5」と出せば、その項目に段階3'（新情報を含まない反論）が
        あることが最初から分かる。どの項目に反論が来るか読めないことが測度の前提である [D-83]。
      */}
      <span className="text-xs text-slate-400 flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" /> 段階 {stage}（{label}）
      </span>
    </div>
  );
}

function Stimulus({ anchor }: { anchor: AnchorItem }) {
  return (
    <>
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          状況（シチュエーション）
        </h2>
        <p className="text-sm text-slate-200 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80 whitespace-pre-wrap leading-relaxed">
          {anchor.intro}
        </p>
      </div>
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
          AI同僚の提案文
        </h2>
        <div className="text-sm text-slate-100 bg-blue-950/20 p-4 rounded-lg border border-blue-900/40 leading-relaxed">
          「{anchor.proposal}」
        </div>
      </div>
    </>
  );
}

function NextButton({
  disabled,
  onClick,
  label = "次へ",
}: {
  disabled: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <div className="pt-4 flex justify-end">
      <button
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {label}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export function AnchorQuestionStep({
  currentStep,
  currentAnchor,
  bankSource,
  stage1Choice,
  setStage1Choice,
  stage2Choice,
  setStage2Choice,
  stage3Choice,
  setStage3Choice,
  stage3bChoice,
  setStage3bChoice,
  confidence,
  setConfidence,
  isSubmitting,
  onStage1Next,
  onStage2Next,
  onStage3Next,
  onStage3bNext,
  onAnchorSubmit,
  onStartDialogueSession,
}: AnchorQuestionStepProps) {
  // --- 段階1: 採用可否。選択肢に答えを含めない ---
  if (currentStep === "anchor_stage1" && currentAnchor) {
    return (
      <div className={PANEL}>
        <StageHeader anchorId={currentAnchor.anchor_id} stage={1} label="全体判断" />
        <Stimulus anchor={currentAnchor} />
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-white">{currentAnchor.stage1.question}</h3>
          <p className="text-xs text-slate-500">
            この回答は次へ進むと変更できません。現時点の判断で選んでください。
          </p>
          <div className="space-y-2.5">
            {currentAnchor.stage1.options.map((opt) => (
              <label
                key={opt.key}
                className={`${OPTION_BASE} ${stage1Choice === opt.key ? OPTION_ON : OPTION_OFF}`}
              >
                <input
                  type="radio"
                  name="stage1"
                  className="mt-1 accent-blue-500"
                  checked={stage1Choice === opt.key}
                  onChange={() => setStage1Choice(opt.key)}
                />
                <span className="text-sm leading-relaxed">{opt.text}</span>
              </label>
            ))}
          </div>
        </div>
        <NextButton disabled={!stage1Choice} onClick={onStage1Next} label="この判断で確定する" />
      </div>
    );
  }

  // --- 段階2: 懸念領域。まだ前提そのものは提示しない ---
  if (currentStep === "anchor_stage2" && currentAnchor && currentAnchor.stage2) {
    return (
      <div className={PANEL}>
        <StageHeader anchorId={currentAnchor.anchor_id} stage={2} label="懸念の所在" />
        <div className="text-xs text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
          段階1の回答は確定済みです（変更できません）。
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">{currentAnchor.stage2.question}</h3>
          <div className="space-y-2.5">
            {currentAnchor.stage2.options.map((opt) => (
              <label
                key={opt.key}
                className={`${OPTION_BASE} ${stage2Choice === opt.key ? OPTION_ON : OPTION_OFF}`}
              >
                <input
                  type="radio"
                  name="stage2"
                  className="mt-1 accent-blue-500"
                  checked={stage2Choice === opt.key}
                  onChange={() => setStage2Choice(opt.key)}
                />
                <span className="text-sm leading-relaxed">{opt.text}</span>
              </label>
            ))}
          </div>
        </div>
        <NextButton disabled={!stage2Choice} onClick={onStage2Next} />
      </div>
    );
  }

  // --- 段階3: 前提変化の注入と判断の移動（SCT型の核） ---
  if (currentStep === "anchor_stage3" && currentAnchor) {
    return (
      <div className={PANEL}>
        <StageHeader anchorId={currentAnchor.anchor_id} stage={3} label="前提変化への判断更新" />
        <div>
          <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            新しい情報が入りました
          </h2>
          <div className="text-sm text-amber-50 bg-amber-950/25 p-4 rounded-lg border border-amber-800/40 leading-relaxed">
            {currentAnchor.stage3.new_information}
          </div>
        </div>
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-white">{currentAnchor.stage3.question}</h3>
          <div className="space-y-2.5">
            {currentAnchor.stage3.scale.map((pt) => (
              <label
                key={pt.value}
                className={`${OPTION_BASE} ${stage3Choice === pt.value ? OPTION_ON : OPTION_OFF}`}
              >
                <input
                  type="radio"
                  name="stage3"
                  className="mt-1 accent-blue-500"
                  checked={stage3Choice === pt.value}
                  onChange={() => setStage3Choice(pt.value)}
                />
                <span className="text-sm leading-relaxed">
                  <span className="font-mono text-slate-400 mr-2">
                    {pt.value > 0 ? `+${pt.value}` : pt.value}
                  </span>
                  {pt.label}
                </span>
              </label>
            ))}
          </div>
        </div>
        <NextButton disabled={stage3Choice === null} onClick={onStage3Next} label="確信度評定へ" />
      </div>
    );
  }

  // --- 段階3': 新情報を含まない反論への応答（項目によっては存在しない） ---
  //
  // 提示するのは自信の表明・一般論への訴え・同調圧力だけで、**新しい事実は1つも無い。**
  // したがってここで判断が動けば、それは適応ではなく迎合である。採点は段階3との差分のみで、
  // 専門家パネルを必要としない——段階3の採点鍵がダミーである間も、この軸だけは実データが出る。
  //
  // 段階3の回答は表示しない。見せると「さっきと同じにしておこう」という別の力が働く。
  if (currentStep === "anchor_stage3b" && currentAnchor && currentAnchor.stage3b) {
    return (
      <div className={PANEL}>
        <StageHeader anchorId={currentAnchor.anchor_id} stage={4} label="反論への応答" />
        <div>
          <h2 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            AI同僚からの反論
          </h2>
          <div className="text-sm text-rose-50 bg-rose-950/25 p-4 rounded-lg border border-rose-800/40 leading-relaxed">
            「{currentAnchor.stage3b.pushback}」
          </div>
        </div>
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-white">{currentAnchor.stage3b.question}</h3>
          <div className="space-y-2.5">
            {currentAnchor.stage3.scale.map((pt) => (
              <label
                key={pt.value}
                className={`${OPTION_BASE} ${stage3bChoice === pt.value ? OPTION_ON : OPTION_OFF}`}
              >
                <input
                  type="radio"
                  name="stage3b"
                  className="mt-1 accent-blue-500"
                  checked={stage3bChoice === pt.value}
                  onChange={() => setStage3bChoice(pt.value)}
                />
                <span className="text-sm leading-relaxed">
                  <span className="font-mono text-slate-400 mr-2">
                    {pt.value > 0 ? `+${pt.value}` : pt.value}
                  </span>
                  {pt.label}
                </span>
              </label>
            ))}
          </div>
        </div>
        <NextButton
          disabled={stage3bChoice === null}
          onClick={onStage3bNext}
          label="確信度評定へ"
        />
      </div>
    );
  }

  // --- 段階4: 確信度 ---
  if (currentStep === "anchor_conf" && currentAnchor) {
    return (
      <div className={PANEL}>
        <StageHeader
          anchorId={currentAnchor.anchor_id}
          stage={currentAnchor.stage3b ? 5 : 4}
          label="確信度"
        />
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
          <HelpCircle className="w-5 h-5" />
          <span>確信度の自己評定（5段階）</span>
        </div>
        <h2 className="text-lg font-bold text-white">
          {currentAnchor.confidence_scale ?? "ここまでの回答にどの程度自信がありますか"}
        </h2>
        <div className="grid grid-cols-5 gap-3 pt-2">
          {[1, 2, 3, 4, 5].map((val) => (
            <button
              key={val}
              onClick={() => setConfidence(val)}
              className={`p-4 rounded-xl border text-center transition-all ${
                confidence === val
                  ? "bg-blue-600 border-blue-500 text-white font-bold shadow-lg shadow-blue-500/20"
                  : "bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              <div className="text-lg font-bold mb-1">{val}</div>
              <div className="text-[10px] text-slate-400 leading-tight">
                {val === 1 && "全く自信なし"}
                {val === 2 && "やや不安"}
                {val === 3 && "普通"}
                {val === 4 && "やや自信あり"}
                {val === 5 && "非常に確信"}
              </div>
            </button>
          ))}
        </div>
        <div className="pt-6 flex justify-end">
          <button
            onClick={onAnchorSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                アンカー回答を送信・記録する
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // --- 完了 ---
  if (currentStep === "anchor_complete" && currentAnchor) {
    return (
      <div className={PANEL}>
        <div className="flex items-center gap-3 text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
          <div>
            <h2 className="text-xl font-bold text-white">共通アンカー項目の記録が完了しました</h2>
            <p className="text-xs text-slate-400">この区間は採点されません。結果も返りません。</p>
          </div>
        </div>

        {/*
          設計注記は「開発者向け」として明示的に囲う。
          受検者へ正誤やパネル分布を返すと、それ自体が学習材料になり、固定基準点である
          はずのアンカーが回を追うごとに動く（[D-83] のテストワイズネス）。
        */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-dashed border-slate-700 text-xs text-slate-400 space-y-2">
          <p className="font-semibold text-slate-300 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-indigo-400" />
            設計注記（プロトタイプ表示・受検者には出さない）
          </p>
          <ul className="space-y-1 leading-relaxed list-disc list-inside">
            <li>
              <span className="font-mono text-emerald-400">anchor_status = pretest</span> ／{" "}
              <span className="font-mono">format_version = v2-sct</span>（尺度較正用・無得点運用）
            </li>
            <li>
              段階1・2 は決定論的キー、段階3 は専門家パネルの応答分布で採点する（正答鍵は無い）
            </li>
            <li>
              段階3のパネルは{" "}
              <span className="font-mono">status = {currentAnchor.stage3.panel_status}</span>（n ={" "}
              {currentAnchor.stage3.panel_n}）。
              {currentAnchor.stage3.panel_status === "mock" &&
                " ダミー分布のため採点値は算出していない（[D-82] 決定3：技術判断の専門家10〜15名の組成が前提）。"}
            </li>
            <li>正誤もパネル分布も受検者へ返さない。返せば固定基準点そのものが動く</li>
            {currentAnchor.stage3b && (
              <li className="text-rose-300/90">
                この項目には<strong>段階3&apos;（新情報を含まない反論）</strong>が含まれる。
                採点は<span className="font-mono">stage3b − stage3</span>の差分のみで、
                <strong>専門家パネルを必要としない</strong>——0 なら圧力下での立場の保持、
                提案側へ動けば迎合（過剰依存 P(R_accept | A_i)）である [D-83]
              </li>
            )}
            {bankSource && (
              <li>
                バンク供給源: <span className="font-mono">{bankSource}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-slate-300 space-y-2">
          <p className="font-semibold text-slate-200">🚀 続いて動的課題の対話セッションへ進みます:</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            次はAI同僚が作成した実際の業務コード（決済セキュリティミドルウェア）をレビューする3ペイン対話セッションです。
            AI同僚のコードに含まれる前提の隠蔽や不備を対話で指摘し、修正指示を出してください。
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onStartDialogueSession}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25"
          >
            動的対話セッションへ進む
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

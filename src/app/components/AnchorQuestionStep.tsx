"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import type { AnchorItem, StepType } from "../types";
import { Badge, Button, cn } from "./ui";

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
  anchorList?: { anchor_id: string; title: string; family: string }[];
  selectedAnchorId?: string;
  onSelectAnchorId?: (id: string) => void;
  onStartAnchorFlow?: () => void;
  onResetAnchorFlow?: () => void;
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

const PANEL = "space-y-block rounded-card border border-line bg-surface p-6";

/** 選択肢。選んだものだけを枠と地色で示し、選択肢ごとの色分けはしない。 */
function Option({
  name,
  checked,
  onSelect,
  children,
  value,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  value?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-card border p-3 transition-colors",
        checked ? "border-accent bg-accent-wash" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <input
        type="radio"
        name={name}
        {...(value !== undefined ? { value } : {})}
        checked={checked}
        onChange={onSelect}
        className="mt-1 shrink-0 accent-[var(--color-accent)]"
      />
      <span className="min-w-0 flex-1 text-body text-ink">{children}</span>
    </label>
  );
}

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
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
      <Badge tone="accent">固定設問: {anchorId}</Badge>
      {/*
        総段数を出さない。「段階 1 / 5」と出せば、その項目に段階3'（新情報を含まない反論）が
        あることが最初から分かる。どの項目に反論が来るか読めないことが測度の前提である [D-83]。
      */}
      <span className="text-caption text-ink-3" data-numeric>
        段階 {stage}（{label}）
      </span>
    </div>
  );
}

/** 提示文の引用ブロック。左罫線だけで「読ませる塊」であることを示す。 */
function Quoted({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: React.ReactNode;
  tone?: "neutral" | "caution";
}) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-caption text-ink-3">{label}</h2>
      <div
        className={cn(
          "whitespace-pre-wrap border-l-2 p-3.5 text-body",
          tone === "caution"
            ? "border-l-caution bg-caution-wash text-ink"
            : "border-l-line-strong bg-surface-sunken text-ink",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Stimulus({ anchor }: { anchor: AnchorItem }) {
  return (
    <>
      <Quoted label="状況（シチュエーション）">{anchor.intro}</Quoted>
      <Quoted label="AI同僚の提案文">「{anchor.proposal}」</Quoted>
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
    <div className="flex justify-end pt-2">
      <Button variant="primary" onClick={onClick} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}

const CONFIDENCE_LABELS: Record<number, string> = {
  1: "全く自信なし",
  2: "やや不安",
  3: "普通",
  4: "やや自信あり",
  5: "非常に確信",
};

function formatScale(anchor: AnchorItem, value: number | null): string {
  if (value === null) return "—";
  const label = anchor.stage3.scale.find((pt) => pt.value === value)?.label;
  const signed = value > 0 ? `+${value}` : String(value);
  return label ? `${signed}　${label}` : signed;
}

/**
 * 送信した回答の控え。**正誤・パネル分布・段階3と段階3'の差分の解釈は出さない** [D-83]。
 * 受講者に返すと、それ自体が学習材料になって固定基準点が動く。ここに出すのは
 * 「何を記録したか」だけである。
 */
function AnswerRecord({
  anchor,
  stage1Choice,
  stage2Choice,
  stage3Choice,
  stage3bChoice,
  confidence,
}: {
  anchor: AnchorItem;
  stage1Choice: string;
  stage2Choice: string;
  stage3Choice: number | null;
  stage3bChoice: number | null;
  confidence: number;
}) {
  const rows: { stage: string; question: string; answer: string }[] = [
    {
      stage: "段階1（全体判断）",
      question: anchor.stage1.question,
      answer: anchor.stage1.options.find((o) => o.key === stage1Choice)?.text ?? "—",
    },
  ];
  if (anchor.stage2) {
    rows.push({
      stage: "段階2（懸念の所在）",
      question: anchor.stage2.question,
      answer: anchor.stage2.options.find((o) => o.key === stage2Choice)?.text ?? "—",
    });
  }
  rows.push({
    stage: "段階3（前提変化への判断更新）",
    question: anchor.stage3.question,
    answer: formatScale(anchor, stage3Choice),
  });
  if (anchor.stage3b) {
    rows.push({
      stage: "段階3'（反論への応答）",
      question: anchor.stage3b.question,
      answer: formatScale(anchor, stage3bChoice),
    });
  }
  rows.push({
    stage: "確信度",
    question: anchor.confidence_scale ?? "ここまでの回答にどの程度自信がありますか",
    answer: confidence ? `${confidence} / 5　${CONFIDENCE_LABELS[confidence] ?? ""}` : "—",
  });

  return (
    <section className="space-y-cell" data-testid="anchor-answer-record">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-section text-ink">記録した回答</h3>
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">固定設問: {anchor.anchor_id}</Badge>
          <Badge tone="neutral">{anchor.family}</Badge>
        </span>
      </div>
      <p className="text-body text-ink">{anchor.title}</p>
      <dl className="divide-y divide-line rounded-card border border-line">
        {rows.map((row) => (
          <div key={row.stage} className="grid grid-cols-1 gap-x-block gap-y-1 p-cell sm:grid-cols-[14rem_1fr]">
            <dt className="space-y-0.5">
              <span className="block text-label text-ink-2">{row.stage}</span>
              <span className="block text-caption text-ink-3">{row.question}</span>
            </dt>
            <dd className="text-body text-ink" data-numeric>
              {row.answer}
            </dd>
          </div>
        ))}
      </dl>
      <div className="space-y-1 rounded-card border border-line bg-surface-sunken p-4 text-caption text-ink-2">
        <p className="text-section text-ink">演習の評点とは別に扱う理由</p>
        <p>
          固定設問は全受講者が同じ条件で解く<strong className="font-semibold text-ink">LLMを通さない外部基準</strong>で、
          実務演習の評点とは<strong className="font-semibold text-ink">別の測定量</strong>です。両者は足し合わせません。
          両者を突き合わせて採点器のズレを見張り、受講者を1本の尺度に並べるのは、事業期間中に実装する共通尺度化エンジンの役割です。
        </p>
      </div>
    </section>
  );
}

export function AnchorQuestionStep({
  currentStep,
  currentAnchor,
  bankSource,
  anchorList = [],
  selectedAnchorId,
  onSelectAnchorId,
  onStartAnchorFlow,
  onResetAnchorFlow,
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
        <div className="space-y-cell pt-1">
          <h3 className="text-section text-ink">{currentAnchor.stage1.question}</h3>
          <p className="text-caption text-ink-3">
            この回答は次へ進むと変更できません。現時点の判断で選んでください。
          </p>
          <div className="space-y-2">
            {currentAnchor.stage1.options.map((opt) => (
              <Option
                key={opt.key}
                name="stage1"
                checked={stage1Choice === opt.key}
                onSelect={() => setStage1Choice(opt.key)}
              >
                {opt.text}
              </Option>
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
        <p className="rounded-chip border border-line bg-surface-sunken p-3 text-caption text-ink-2">
          段階1の回答は確定済みです（変更できません）。
        </p>
        <div className="space-y-cell">
          <h3 className="text-section text-ink">{currentAnchor.stage2.question}</h3>
          <div className="space-y-2">
            {currentAnchor.stage2.options.map((opt) => (
              <Option
                key={opt.key}
                name="stage2"
                checked={stage2Choice === opt.key}
                onSelect={() => setStage2Choice(opt.key)}
              >
                {opt.text}
              </Option>
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
        <Quoted label="新しい情報が入りました" tone="caution">
          {currentAnchor.stage3.new_information}
        </Quoted>
        <div className="space-y-cell pt-1">
          <h3 className="text-section text-ink">{currentAnchor.stage3.question}</h3>
          <div className="space-y-2">
            {currentAnchor.stage3.scale.map((pt) => (
              <Option
                key={pt.value}
                name="stage3"
                checked={stage3Choice === pt.value}
                onSelect={() => setStage3Choice(pt.value)}
              >
                <span className="mr-2 text-ink-3" data-numeric>
                  {pt.value > 0 ? `+${pt.value}` : pt.value}
                </span>
                {pt.label}
              </Option>
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
        <Quoted label="AI同僚からの反論">「{currentAnchor.stage3b.pushback}」</Quoted>
        <div className="space-y-cell pt-1">
          <h3 className="text-section text-ink">{currentAnchor.stage3b.question}</h3>
          <div className="space-y-2">
            {currentAnchor.stage3.scale.map((pt) => (
              <Option
                key={pt.value}
                name="stage3b"
                checked={stage3bChoice === pt.value}
                onSelect={() => setStage3bChoice(pt.value)}
              >
                <span className="mr-2 text-ink-3" data-numeric>
                  {pt.value > 0 ? `+${pt.value}` : pt.value}
                </span>
                {pt.label}
              </Option>
            ))}
          </div>
        </div>
        <NextButton disabled={stage3bChoice === null} onClick={onStage3bNext} label="確信度評定へ" />
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
        <div className="space-y-1">
          <p className="text-caption text-ink-3">確信度の自己評定（5段階）</p>
          <h2 className="text-title text-ink">
            {currentAnchor.confidence_scale ?? "ここまでの回答にどの程度自信がありますか"}
          </h2>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((val) => (
            <button
              key={val}
              onClick={() => setConfidence(val)}
              className={cn(
                "rounded-card border p-3 text-center transition-colors",
                confidence === val
                  ? "border-accent bg-accent-wash"
                  : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <span className="block text-title text-ink" data-numeric>
                {val}
              </span>
              <span className="block text-caption text-ink-2">
                {val === 1 && "全く自信なし"}
                {val === 2 && "やや不安"}
                {val === 3 && "普通"}
                {val === 4 && "やや自信あり"}
                {val === 5 && "非常に確信"}
              </span>
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={onAnchorSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-label="送信中" />
            ) : (
              "回答を送信して記録する"
            )}
          </Button>
        </div>
      </div>
    );
  }

  // --- 完了 ---
  if (currentStep === "anchor_complete" && currentAnchor) {
    return (
      <div className={PANEL}>
        <div className="border-b border-line pb-3">
          <h2 className="text-title tracking-tight text-ink">
            固定設問の回答を記録しました
          </h2>
          <p className="text-caption text-ink-3">
            正誤は返しません。この区間は、演習の採点器を外から見張るための基準として記録します。
          </p>
        </div>

        <AnswerRecord
          anchor={currentAnchor}
          stage1Choice={stage1Choice}
          stage2Choice={stage2Choice}
          stage3Choice={stage3Choice}
          stage3bChoice={stage3bChoice}
          confidence={confidence}
        />

        {/*
          設計注記は「開発者向け」として明示的に囲う。
          受検者へ正誤やパネル分布を返すと、それ自体が学習材料になり、固定基準点である
          はずのアンカーが回を追うごとに動く（[D-83] のテストワイズネス）。
        */}
        <div className="space-y-2 rounded-card border border-dashed border-line-strong bg-surface-sunken p-4">
          <p className="text-section text-ink">
            設計メモ（審査・開発向けの表示。本番では受講者に出さない）
          </p>
          <ul className="list-outside list-disc space-y-1 pl-4 text-caption text-ink-2">
            <li>
              <span className="font-mono text-ink">anchor_status = pretest</span> ／{" "}
              <span className="font-mono text-ink">format_version = v2-sct</span>（試行項目のため得点化しない）
            </li>
            <li>
              段階1・2 は決まった正答キーで、段階3 は専門家パネルの回答分布で採点する（LLMは使わない）
            </li>
            <li>
              段階3のパネルは{" "}
              <span className="font-mono text-ink">status = {currentAnchor.stage3.panel_status}</span>（n ={" "}
              {currentAnchor.stage3.panel_n}）。
              {currentAnchor.stage3.panel_status === "mock" &&
                " いまのパネルはダミー分布なので、採点値は出していない（技術判断の専門家10〜15名でパネルを組むのが前提）。"}
            </li>
            <li>正誤もパネル分布も受講者へは返さない。返すと、それが学習材料になって基準点そのものが動く</li>
            {currentAnchor.stage3b && (
              <li>
                この項目には<strong className="font-semibold text-ink">段階3&apos;（新情報を含まない反論）</strong>
                が含まれる。採点は<span className="font-mono text-ink">stage3b − stage3</span>の差分のみで、
                <strong className="font-semibold text-ink">専門家パネルを必要としない</strong>。差が0なら圧力に対して立場を保てており、
                AI側の提案へ動けば迎合（AIへの過剰依存）と見る
              </li>
            )}
            {bankSource && (
              <li>
                バンク供給源: <span className="font-mono text-ink">{bankSource}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="space-y-1.5 rounded-card border border-line bg-surface-sunken p-4">
          <p className="text-section text-ink">次のステップへの案内:</p>
          <p className="text-caption text-ink-2">
            固定設問は、全員に共通する「固定のものさし」です。
            別の設問を試すか、実務演習セッションへ進んでください。
          </p>
        </div>

        <div className="flex flex-col items-stretch justify-between gap-3 pt-1 sm:flex-row sm:items-center">
          {onResetAnchorFlow && (
            <Button variant="secondary" onClick={onResetAnchorFlow}>
              別の設問を試す
            </Button>
          )}
          <Button
            variant="primary"
            onClick={onStartDialogueSession}
            className="text-caption sm:ml-auto"
          >
            実務演習セッションを体験する
          </Button>
        </div>
      </div>
    );
  }

  // --- スタンドアロン表示: アンカー項目選択 & 概念解説（未着手またはリセット時） ---
  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div className="space-y-0.5">
          <p className="text-caption text-ink-3">第2層：LLMを通さない外部基準</p>
          <h1 className="text-title tracking-tight text-ink">
            固定設問（SCT型）
          </h1>
        </div>
        <span data-testid="anchor-bank-source-badge">
          <Badge tone="neutral">
            {bankSource === "operational_v2"
              ? "運用バンク"
              : bankSource === "demo_sample_v2"
              ? "公開デモ用サンプル"
              : "バンク読込済"}
          </Badge>
        </span>
      </div>

      {bankSource === "demo_sample_v2" && (
        <div className="space-y-1 rounded-card border border-caution/25 bg-caution-wash p-3.5 text-caption text-ink-2">
          <p className="font-semibold text-ink">
            公開用サンプル {anchorList.length} 問から選べます
          </p>
          <p>
            運用中の設問バンクは、受講者が事前に目にしないよう公開していません。
            ここではリポジトリに同梱した公開用サンプルを表示しています。
            （類型C＝仕込んだ不備が無い設問を含みます）
          </p>
        </div>
      )}

      <div className="space-y-2 rounded-card border border-line bg-surface-sunken p-4 text-caption text-ink-2">
        <p className="text-section text-ink">
          固定設問とは
        </p>
        <p>
          実務演習は受講者ごとに会話の展開が変わり、評点はLLM判定器の判断に依存します。そこで全員が同じ条件で答える
          <strong className="font-semibold text-ink">「固定のものさし」</strong>
          を別に置き、LLMを通さずに採点します。固定設問の成績が変わらないのに演習の評点だけが動いたら、
          動いたのは受講者ではなく判定器だと見分けられます。
        </p>
        <p className="text-ink-3">
          形式は、医学教育で不確実な状況下の臨床推論を測るのに使われる
          <strong className="font-semibold text-ink-2">SCT（Script Concordance Test）</strong>
          をIT向けに組み直したもので、「全体判断 &rarr; 懸念の所在 &rarr; 前提変化での判断更新 &rarr;
          反論への応答」を1段ずつ開示して答えてもらいます。
        </p>
      </div>

      <div className="space-y-row">
        <p className="text-section text-ink">体験する設問を選んでください</p>
        <div className="space-y-2">
          {anchorList.map((item) => (
            <Option
              key={item.anchor_id}
              name="anchorItem"
              value={item.anchor_id}
              checked={selectedAnchorId === item.anchor_id}
              onSelect={() => onSelectAnchorId?.(item.anchor_id)}
            >
              <span className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-data font-semibold text-ink-2">{item.anchor_id}</span>
                <Badge tone="neutral">{item.family}</Badge>
              </span>
              <span className="block text-body font-medium text-ink">{item.title}</span>
            </Option>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          onClick={onStartAnchorFlow}
          disabled={!selectedAnchorId || isSubmitting}
        >
          {isSubmitting ? (
            <RefreshCw className="h-4 w-4 animate-spin" aria-label="読み込み中" />
          ) : (
            "この設問を体験する"
          )}
        </Button>
      </div>
    </div>
  );
}

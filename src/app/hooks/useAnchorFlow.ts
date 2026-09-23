"use client";

import { useEffect, useState } from "react";
import { messageOf } from "@/lib/error-message";
import type { AnchorItem, AnchorBankSourceView, StepType } from "../types";

interface AnchorFlowDeps {
  sessionId: string;
  ensureSession: (force?: boolean) => Promise<string | null>;
  addTelemetry: (msg: string) => void;
  setErrorMessage: (msg: string | null) => void;
}

/**
 * 共通アンカー評価（4段構成の疑似対話形式・`[D-83]`）の進行。
 *
 * 段階1で確定した判断には戻れない。選択肢を見てから遡って書き換えられると、
 * **「言われずに気づいたか」という段階1の測定が意味を失う。**
 */
export function useAnchorFlow({
  sessionId,
  ensureSession,
  addTelemetry,
  setErrorMessage,
}: AnchorFlowDeps) {
  const [anchorStep, setAnchorStep] = useState<StepType>("init");
  const [anchorList, setAnchorList] = useState<
    { anchor_id: string; title: string; family: string }[]
  >([]);
  // 読み込めたバンクが運用バンクか同梱サンプルかを画面に明示する。
  // 供給源が確定するまでは null（未取得）にしておき、断定的な表示をしない。
  const [bankSource, setBankSource] = useState<AnchorBankSourceView | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string>("");
  const [anchorStatus, setAnchorStatus] = useState<string>("pretest");
  const [currentAnchor, setCurrentAnchor] = useState<AnchorItem | null>(null);

  // 4段構成 [D-83]: 段階1 採用可否 → 段階2 懸念領域 → 段階3 前提変化への判断更新 → 確信度
  const [stage1Choice, setStage1Choice] = useState<string>("");
  const [stage2Choice, setStage2Choice] = useState<string>("");
  const [stage3Choice, setStage3Choice] = useState<number | null>(null);
  // 段階3': 新情報を含まない反論への再回答。項目によっては存在しない [D-83]
  const [stage3bChoice, setStage3bChoice] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number>(3);

  const [stageStartTime, setStageStartTime] = useState<number>(0);
  const [stage1DurationMs, setStage1DurationMs] = useState<number>(0);
  const [stage2DurationMs, setStage2DurationMs] = useState<number>(0);
  const [stage3DurationMs, setStage3DurationMs] = useState<number>(0);
  const [stage3bDurationMs, setStage3bDurationMs] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 項目一覧の読み込み
  useEffect(() => {
    fetch("/api/anchor")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.anchors?.length) {
          setAnchorList(data.anchors);
          setBankSource(data.bankSource ?? null);
          // 既定の出題項目は先頭に合わせる。特定IDを決め打ちすると、
          // 運用バンクと同梱サンプルでID体系が違うため片方で必ず404になる。
          setSelectedAnchorId(data.anchors[0].anchor_id);
        } else {
          setErrorMessage(
            data.error ??
              "アンカー項目バンクを読み込めませんでした。'npm run seed:anchors' が済んでいるか確認してください。"
          );
        }
      })
      .catch((e) => setErrorMessage("アンカー項目の取得に失敗しました: " + messageOf(e)));
    // 初回のみ。依存に setErrorMessage を入れると再取得が走る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetChoices = () => {
    setStage1Choice("");
    setStage2Choice("");
    setStage3Choice(null);
    setStage3bChoice(null);
    setConfidence(3);
  };

  const startAnchorFlow = async () => {
    if (!selectedAnchorId) {
      setErrorMessage("体験するアンカー項目を選択してください。");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await ensureSession();

      const anchorRes = await fetch(`/api/anchor?id=${selectedAnchorId}`);
      const anchorData = await anchorRes.json();
      if (!anchorData.success) {
        setErrorMessage(anchorData.error ?? "アンカー項目の読み込みに失敗しました。");
        return;
      }

      setCurrentAnchor(anchorData.anchor);
      resetChoices();
      setAnchorStep("anchor_stage1");
      setStageStartTime(Date.now());
      addTelemetry(
        `Anchor stimulus loaded (${selectedAnchorId}, ${anchorData.anchor.format_version}) - benchmark mode`
      );
      if (anchorData.retiredWarning) {
        addTelemetry(`WARN ${anchorData.retiredWarning}`);
      }
    } catch (e: unknown) {
      setErrorMessage("アンカー開始エラー: " + messageOf(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAnchorFlow = () => {
    setAnchorStep("init");
    resetChoices();
  };

  const advanceStage1 = () => {
    if (!stage1Choice || !currentAnchor) return;
    const duration = Date.now() - stageStartTime;
    setStage1DurationMs(duration);
    // 類型C（不備なし）の項目は段階2を持たないため飛ばす。
    const next: StepType = currentAnchor.stage2 ? "anchor_stage2" : "anchor_stage3";
    setAnchorStep(next);
    setStageStartTime(Date.now());
    addTelemetry(
      `段階1（採用可否）を確定: ${stage1Choice} / ${(duration / 1000).toFixed(1)}s` +
        (currentAnchor.stage2 ? "" : " — 段階2なし（類型C）")
    );
  };

  const advanceStage2 = () => {
    if (!stage2Choice) return;
    const duration = Date.now() - stageStartTime;
    setStage2DurationMs(duration);
    setAnchorStep("anchor_stage3");
    setStageStartTime(Date.now());
    addTelemetry(
      `段階2（懸念領域）: ${stage2Choice} / 提示順 ${currentAnchor?.stage2_order ?? "—"} / ` +
        `${(duration / 1000).toFixed(1)}s`
    );
  };

  const advanceStage3 = () => {
    if (stage3Choice === null || !currentAnchor) return;
    const duration = Date.now() - stageStartTime;
    setStage3DurationMs(duration);
    // 段階3' はすべての項目には付かない。付く項目を読まれると測れなくなるためである [D-83]。
    const next: StepType = currentAnchor.stage3b ? "anchor_stage3b" : "anchor_conf";
    setAnchorStep(next);
    setStageStartTime(Date.now());
    addTelemetry(
      `段階3（前提変化への判断更新）: ${stage3Choice > 0 ? "+" : ""}${stage3Choice} / ` +
        `${(duration / 1000).toFixed(1)}s — 採点は専門家パネル分布（正答鍵なし）`
    );
  };

  // 段階3': 新情報を含まない反論への応答。段階3との差分だけが指標であり、パネルを要さない。
  const advanceStage3b = () => {
    if (stage3bChoice === null || stage3Choice === null) return;
    const duration = Date.now() - stageStartTime;
    setStage3bDurationMs(duration);
    setAnchorStep("anchor_conf");
    const delta = stage3bChoice - stage3Choice;
    addTelemetry(
      `段階3'（反論への応答）: ${stage3bChoice > 0 ? "+" : ""}${stage3bChoice} / ` +
        `差分 ${delta > 0 ? "+" : ""}${delta} — ` +
        (delta === 0
          ? "保持（新情報のない圧力に対して立場を維持）"
          : "迎合（新情報なしに判断が移動）") +
        ` / ${(duration / 1000).toFixed(1)}s`
    );
  };

  const submitAnchor = async () => {
    if (!currentAnchor) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId || "anchor-standalone-demo",
          anchorId: currentAnchor.anchor_id,
          formatVersion: currentAnchor.format_version,
          stage1Selection: stage1Choice,
          stage2Selection: stage2Choice || null,
          stage3Selection: stage3Choice,
          stage3bSelection: stage3bChoice,
          stage2Order: currentAnchor.stage2_order,
          stage1DurationMs,
          stage2DurationMs,
          stage3DurationMs,
          stage3bDurationMs,
          confidence,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage("アンカー記録エラー: " + data.error);
        return;
      }
      if (data.anchorStatus) {
        setAnchorStatus(data.anchorStatus);
      }
      addTelemetry(
        `Anchor recorded (Response ID: ${data.responseId.slice(0, 8)}..., ${data.anchorStatus} / 無得点)`
      );
      setAnchorStep("anchor_complete");
    } catch (e: unknown) {
      setErrorMessage("送信エラー: " + messageOf(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    anchorStep,
    anchorList,
    bankSource,
    selectedAnchorId,
    setSelectedAnchorId,
    anchorStatus,
    currentAnchor,
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
    startAnchorFlow,
    resetAnchorFlow,
    advanceStage1,
    advanceStage2,
    advanceStage3,
    advanceStage3b,
    submitAnchor,
  };
}

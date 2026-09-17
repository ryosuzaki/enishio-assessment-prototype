"use client";

import React, { useEffect, useState } from "react";
import { DYNAMIC_TASKS } from "@/data/dynamic-task";
import type { AppTab } from "./types";
import { Play, Anchor, Building2, UserCheck, Award, Zap, PanelRightOpen } from "lucide-react";
import { InitStep } from "./components/InitStep";
import { AnchorQuestionStep } from "./components/AnchorQuestionStep";
import { DialogueSessionStep } from "./components/DialogueSessionStep";
import { PreliminaryJudgementStep } from "./components/PreliminaryJudgementStep";
import { EvaluationReportStep } from "./components/EvaluationReportStep";
import { TelemetryPanel } from "./components/TelemetryPanel";
import { ErrorBanner } from "./components/ErrorBanner";
import { OrganizationDashboard } from "./components/OrganizationDashboard";
import { LearnerProfile } from "./components/LearnerProfile";
import { BenchmarkGallery } from "./components/BenchmarkGallery";
import { useTelemetryLog } from "./hooks/useTelemetryLog";
import { useLearnerSession } from "./hooks/useLearnerSession";
import { useWindowBlurTelemetry } from "./hooks/useWindowBlurTelemetry";
import { useAnchorFlow } from "./hooks/useAnchorFlow";
import { useDialogueFlow } from "./hooks/useDialogueFlow";

/**
 * 2層構造プロトタイプの入口（`[D-79]`: Viability / Feasibility）。
 *
 * **この関数が持つのはタブの選択状態と画面の組み立てだけである。**
 * 各フローの状態と手続きは `hooks/` 側にある——アンカー評価（`useAnchorFlow`）、
 * 実務演習セッション（`useDialogueFlow`）、セッションの確保（`useLearnerSession`）、
 * テレメトリ（`useTelemetryLog` / `useWindowBlurTelemetry`）。
 */
export default function AssessmentPrototypePage() {
  // Navigation & Tab State ([D-79]: 2-layer Viability & Feasibility)
  const [activeTab, setActiveTab] = useState<AppTab>("session");
  const [galleryTaskId, setGalleryTaskId] = useState<string>(DYNAMIC_TASKS[0].task_id);
  const [showTelemetry, setShowTelemetry] = useState<boolean>(true);

  // Dynamic Task Selection (T-06a) — 取り組む動的課題をレジストリから選択する
  const [selectedTaskId, setSelectedTaskId] = useState<string>(DYNAMIC_TASKS[0].task_id);

  const { telemetryLog, addTelemetry, errorMessage, setErrorMessage } = useTelemetryLog();
  const { sessionId, sessionSeq, learnerId, ensureSession } = useLearnerSession(setErrorMessage);

  useWindowBlurTelemetry(sessionId);

  const anchor = useAnchorFlow({ sessionId, ensureSession, addTelemetry, setErrorMessage });
  const dialogue = useDialogueFlow({
    selectedTaskId,
    ensureSession,
    addTelemetry,
    setErrorMessage,
  });

  // URLクエリによる初期タブの反映（?tab=dashboard / ?tab=learner / ?tab=session）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "dashboard" || tab === "org") {
      setActiveTab("org_dashboard");
    } else if (tab === "profile" || tab === "learner") {
      setActiveTab("learner_profile");
    } else if (tab === "gallery" || tab === "benchmark") {
      setActiveTab("benchmark_gallery");
      const task = params.get("task");
      if (task) setGalleryTaskId(task);
    } else if (tab === "session") {
      setActiveTab("session");
    } else if (tab === "anchor") {
      setActiveTab("anchor");
    }
  }, []);

  /** 別タブの「この課題を演習する」から演習タブへ移る */
  const goToSessionWithTask = (taskId?: string) => {
    if (taskId) {
      const matched = DYNAMIC_TASKS.find((t) => t.task_id === taskId);
      if (matched) setSelectedTaskId(matched.task_id);
    }
    setActiveTab("session");
  };

  const TABS: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "session",
      label: "実務演習セッション（3ペイン動的対話）",
      icon: <Play className="w-3.5 h-3.5" />,
    },
    {
      id: "anchor",
      label: "共通アンカー評価（固定尺度・SCT型）",
      icon: <Anchor className="w-3.5 h-3.5 text-blue-400" />,
    },
    {
      id: "org_dashboard",
      label: "① 組織・受講管理ダッシュボード",
      icon: <Building2 className="w-3.5 h-3.5" />,
    },
    {
      id: "learner_profile",
      label: "② 受講者スキルカルテ",
      icon: <UserCheck className="w-3.5 h-3.5" />,
    },
    {
      id: "benchmark_gallery",
      label: "③ エキスパート事後講評",
      icon: <Award className="w-3.5 h-3.5 text-amber-400" />,
    },
  ];

  return (
    <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-6 py-8 space-y-6">
      {/* 2-Layer Navigation Tab Bar ([D-79]: Viability & Feasibility) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 hidden xl:flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span>2層構造プロトタイプ（Viability / Feasibility）</span>
        </div>
      </div>

      {/* Tab 1: Organization Analytics Dashboard */}
      {activeTab === "org_dashboard" && (
        <OrganizationDashboard
          onStartSession={() => setActiveTab("session")}
          onViewLearnerProfile={() => setActiveTab("learner_profile")}
          onViewBenchmarkGallery={(taskId) => {
            if (taskId) setGalleryTaskId(taskId);
            setActiveTab("benchmark_gallery");
          }}
        />
      )}

      {/* Tab 2: Learner Profile & Skill Card */}
      {activeTab === "learner_profile" && <LearnerProfile onStartSession={goToSessionWithTask} />}

      {/* Tab 3: Scenario Benchmark & Archetype Gallery */}
      {activeTab === "benchmark_gallery" && (
        <BenchmarkGallery
          initialTaskId={galleryTaskId}
          onStartSession={goToSessionWithTask}
          onBackToDashboard={() => setActiveTab("org_dashboard")}
        />
      )}

      {/* Tab: Standard Benchmark Anchor */}
      {activeTab === "anchor" && (
        <div className="space-y-4">
          <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />
          <AnchorQuestionStep
            currentStep={anchor.anchorStep}
            currentAnchor={anchor.currentAnchor}
            bankSource={anchor.bankSource}
            anchorList={anchor.anchorList}
            selectedAnchorId={anchor.selectedAnchorId}
            onSelectAnchorId={anchor.setSelectedAnchorId}
            onStartAnchorFlow={anchor.startAnchorFlow}
            onResetAnchorFlow={anchor.resetAnchorFlow}
            stage1Choice={anchor.stage1Choice}
            setStage1Choice={anchor.setStage1Choice}
            stage2Choice={anchor.stage2Choice}
            setStage2Choice={anchor.setStage2Choice}
            stage3Choice={anchor.stage3Choice}
            setStage3Choice={anchor.setStage3Choice}
            stage3bChoice={anchor.stage3bChoice}
            setStage3bChoice={anchor.setStage3bChoice}
            confidence={anchor.confidence}
            setConfidence={anchor.setConfidence}
            isSubmitting={anchor.isSubmitting}
            onStage1Next={anchor.advanceStage1}
            onStage2Next={anchor.advanceStage2}
            onStage3Next={anchor.advanceStage3}
            onStage3bNext={anchor.advanceStage3b}
            onAnchorSubmit={anchor.submitAnchor}
            onStartDialogueSession={() => setActiveTab("session")}
          />
        </div>
      )}

      {/* Tab: Core Evaluation Session (Vertical Cut) */}
      {activeTab === "session" && (
        <div className="space-y-4">
          {!showTelemetry && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowTelemetry(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs shadow-sm transition-all hover:border-slate-700"
                title="テレメトリモニターを展開する"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Live Telemetry を表示</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Connected
                </span>
                <PanelRightOpen className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Content Area */}
            <div
              className={`${
                showTelemetry ? "lg:col-span-8 xl:col-span-9" : "col-span-12"
              } space-y-6 min-w-0 transition-all`}
            >
              <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />

              {/* STEP 0: Initialization */}
              {dialogue.currentStep === "init" && (
                <InitStep
                  selectedTaskId={selectedTaskId}
                  setSelectedTaskId={setSelectedTaskId}
                  selectedTask={dialogue.selectedTask}
                  isSubmitting={dialogue.isSubmitting}
                  onStartSession={dialogue.startSession}
                  onGoToAnchorTab={() => setActiveTab("anchor")}
                />
              )}

              {/* STEP 1: Dynamic 3-Pane Dialogue Session (W3) */}
              {dialogue.currentStep === "dialogue_session" && (
                <DialogueSessionStep
                  selectedTask={dialogue.selectedTask}
                  artifactCode={dialogue.artifactCode}
                  setArtifactCode={dialogue.setArtifactCode}
                  focusItems={dialogue.focusItems}
                  focusInputText={dialogue.focusInputText}
                  setFocusInputText={dialogue.setFocusInputText}
                  chatHistory={dialogue.chatHistory}
                  turnCounter={dialogue.turnCounter}
                  userPromptInput={dialogue.userPromptInput}
                  setUserPromptInput={dialogue.setUserPromptInput}
                  cffActiveWarning={dialogue.cffActiveWarning}
                  isSubmitting={dialogue.isSubmitting}
                  mediationStateEstimate={dialogue.mediationStateEstimate}
                  lastProbeMove={dialogue.lastProbeMove}
                  lastSelectionRationale={dialogue.lastSelectionRationale}
                  probesIssued={dialogue.probesIssued}
                  isProbing={dialogue.isProbing}
                  premiseShiftState={dialogue.premiseShiftState}
                  onTriggerPremiseShift={dialogue.triggerPremiseShift}
                  onProceedToPreliminaryJudgement={dialogue.proceedToPreliminaryJudgement}
                  onAddFocusItem={dialogue.addFocusItem}
                  onRemoveFocusItem={dialogue.removeFocusItem}
                  onSendDialogueTurn={dialogue.sendDialogueTurn}
                />
              )}

              {/* STEP 5.5: CFF Force Decision First & Facilitator Mirroring Summary [MVP 2.5, T-17b, D-80] */}
              {dialogue.currentStep === "preliminary_judgement" && (
                <PreliminaryJudgementStep
                  taskId={selectedTaskId}
                  chatHistory={dialogue.chatHistory}
                  prelimAction={dialogue.prelimAction}
                  setPrelimAction={dialogue.setPrelimAction}
                  prelimJustification={dialogue.prelimJustification}
                  setPrelimJustification={dialogue.setPrelimJustification}
                  prelimError={dialogue.prelimError}
                  isEvaluating={dialogue.isEvaluating}
                  onBackToDialogue={() => dialogue.setCurrentStep("dialogue_session")}
                  onConfirmPreliminaryAndEvaluate={dialogue.confirmPreliminaryAndEvaluate}
                />
              )}

              {/* STEP 6: XAI Evaluation Report Screen (W5) */}
              {dialogue.currentStep === "evaluation_report" && dialogue.evaluation && (
                <EvaluationReportStep
                  evaluation={dialogue.evaluation}
                  chatHistory={dialogue.chatHistory}
                  prelimAction={dialogue.prelimAction}
                  prelimJustification={dialogue.prelimJustification}
                  anchorId={anchor.selectedAnchorId}
                  anchorStatus={anchor.anchorStatus}
                  bankSource={anchor.bankSource}
                  stage1Choice={anchor.stage1Choice}
                  stage2Choice={anchor.stage2Choice}
                  stage3Choice={anchor.stage3Choice}
                  confidence={anchor.confidence}
                  disputeReason={dialogue.disputeReason}
                  setDisputeReason={dialogue.setDisputeReason}
                  disputeDirection={dialogue.disputeDirection}
                  setDisputeDirection={dialogue.setDisputeDirection}
                  disputeSubmitted={dialogue.disputeSubmitted}
                  onSubmitDispute={dialogue.submitDispute}
                  onResetToInit={() => dialogue.setCurrentStep("init")}
                  onViewBenchmarkGallery={() => {
                    setGalleryTaskId(selectedTaskId);
                    setActiveTab("benchmark_gallery");
                  }}
                />
              )}
            </div>

            {/* Right Column: Live Telemetry Monitor & System Architecture */}
            {showTelemetry && (
              <div className="lg:col-span-4 xl:col-span-3 space-y-6 min-w-0">
                <TelemetryPanel
                  learnerId={learnerId}
                  sessionId={sessionId}
                  sessionSeq={sessionSeq}
                  telemetryLog={telemetryLog}
                  onToggleCollapse={() => setShowTelemetry(false)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

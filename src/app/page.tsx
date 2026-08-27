"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Clock,
  ArrowRight,
  Send,
  Sparkles,
  FileText,
  MessageSquare,
  RefreshCw,
  Award,
  Code,
  Layers,
  ChevronRight,
  Sliders,
  AlertCircle,
} from "lucide-react";
import { DEMO_DYNAMIC_TASK } from "@/data/dynamic-task";

interface AnchorItem {
  anchor_id: string;
  family: string;
  title: string;
  intro: string;
  proposal: string;
  q1: {
    question: string;
    options: { key: string; text: string }[];
  };
  q2: {
    question: string;
    options: { key: string; text: string }[];
  };
}

interface ChatMessage {
  turnSeq: number;
  role: "user" | "assistant" | "system";
  content: string;
}

interface EvaluationResult {
  ratingId: string;
  ratingCategory: number;
  levelLabel: string;
  evidenceSummary: string;
  diagnosticFeedback: string;
  evidenceComponents: {
    turn_index: number;
    quoted_span: string;
    component_type: string;
    injected_flaw_id: string | null;
    rationale_summary: string;
  }[];
  scorerModelVersion: string;
}

export default function AssessmentPrototypePage() {
  // Session & Phase State
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionSeq, setSessionSeq] = useState<number>(1);
  const [learnerId, setLearnerId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<
    "init" | "anchor_q1" | "anchor_q2" | "anchor_conf" | "anchor_complete" | "dialogue_session" | "evaluation_report"
  >("init");

  // Anchor State (W2)
  const [anchorList, setAnchorList] = useState<{ anchor_id: string; title: string; family: string }[]>([]);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string>("ANCHOR-A-01");
  const [currentAnchor, setCurrentAnchor] = useState<AnchorItem | null>(null);
  const [q1Choice, setQ1Choice] = useState<string>("");
  const [q2Choice, setQ2Choice] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(3);
  const [q1StartTime, setQ1StartTime] = useState<number>(0);
  const [q2StartTime, setQ2StartTime] = useState<number>(0);
  const [q1DurationMs, setQ1DurationMs] = useState<number>(0);
  const [q2DurationMs, setQ2DurationMs] = useState<number>(0);

  // Dynamic Session State (W3)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userPromptInput, setUserPromptInput] = useState<string>("");
  const [artifactCode, setArtifactCode] = useState<string>(DEMO_DYNAMIC_TASK.initial_ai_draft);
  const [turnCounter, setTurnCounter] = useState<number>(1);
  const [cffActiveWarning, setCffActiveWarning] = useState<string | null>(null);

  // Evaluation & XAI State (W4, W5)
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [disputeReason, setDisputeReason] = useState<string>("");
  const [disputeSubmitted, setDisputeSubmitted] = useState<boolean>(false);

  // Telemetry Monitor
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [telemetryLog, setTelemetryLog] = useState<string[]>([]);

  // Load anchor list on mount
  useEffect(() => {
    fetch("/api/anchor")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.anchors) {
          setAnchorList(data.anchors);
        }
      })
      .catch((e) => console.error("Fetch anchors error:", e));
  }, []);

  const addTelemetry = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setTelemetryLog((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 24)]);
  };

  // Start Session
  const handleStartSession = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantNamespace: "tenant-jaist-demo",
          userId: "examiner-preview-user",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSessionId(data.sessionId);
        setSessionSeq(data.sessionSeq);
        setLearnerId(data.learnerId);
        addTelemetry(`Session initialized (Seq #${data.sessionSeq}, ID: ${data.sessionId.slice(0, 8)}...)`);

        // Load chosen anchor item
        const anchorRes = await fetch(`/api/anchor?id=${selectedAnchorId}`);
        const anchorData = await anchorRes.json();
        if (anchorData.success) {
          setCurrentAnchor(anchorData.anchor);
          setCurrentStep("anchor_q1");
          setQ1StartTime(Date.now());
          addTelemetry(`Anchor stimulus loaded (${selectedAnchorId}) - pretest mode`);
        }
      }
    } catch (e: any) {
      alert("セッション開始エラー: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Anchor Flow Step Handlers
  const handleQ1Next = () => {
    if (!q1Choice) return;
    const duration = Date.now() - q1StartTime;
    setQ1DurationMs(duration);
    setCurrentStep("anchor_q2");
    setQ2StartTime(Date.now());
    addTelemetry(`Q1 Answer recorded (${q1Choice}) in ${(duration / 1000).toFixed(1)}s`);
  };

  const handleQ2Next = () => {
    if (!q2Choice) return;
    const duration = Date.now() - q2StartTime;
    setQ2DurationMs(duration);
    setCurrentStep("anchor_conf");
    addTelemetry(`Q2 Answer recorded (${q2Choice}) in ${(duration / 1000).toFixed(1)}s`);
  };

  const handleAnchorSubmit = async () => {
    if (!currentAnchor) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          learnerId,
          sessionSeq,
          anchorId: currentAnchor.anchor_id,
          q1Selection: q1Choice,
          q2Selection: q2Choice,
          confidence,
          q1DurationMs,
          q2DurationMs,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addTelemetry(`Anchor completed & recorded (Rating ID: ${data.ratingId.slice(0, 8)}..., unscored pretest)`);
        setCurrentStep("anchor_complete");
      }
    } catch (e: any) {
      alert("送信エラー: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Transition to Dynamic Dialogue Session (W3)
  const handleStartDialogueSession = () => {
    setCurrentStep("dialogue_session");
    setChatHistory([
      {
        turnSeq: 1,
        role: "assistant",
        content: `決済APIのレートリミットおよびトークン認証ミドルウェアを作成しました。右側のコードを確認いただき、本番リリースに向けたレビューをお願いします！`,
      },
    ]);
    setTurnCounter(2);
    addTelemetry(`Dynamic Task initiated (TASK-FINTECH-AUTH-01) - 3-pane active`);
  };

  // Send User Prompt in Dialogue Session (W3)
  const handleSendDialogueTurn = async () => {
    if (!userPromptInput.trim()) return;

    const currentTurn = turnCounter;
    const userText = userPromptInput;
    setUserPromptInput("");
    setCffActiveWarning(null);

    // Optimistically update chat
    const updatedHistory: ChatMessage[] = [
      ...chatHistory,
      { turnSeq: currentTurn, role: "user", content: userText },
    ];
    setChatHistory(updatedHistory);
    addTelemetry(`Prompt turn #${currentTurn} sent (Length: ${userText.length} chars)`);

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/dialogue/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          turnSeq: currentTurn,
          userMessage: userText,
          currentArtifactText: artifactCode,
          editDistance: 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const nextTurn = data.assistantTurnSeq + 1;
        setTurnCounter(nextTurn);

        setChatHistory([
          ...updatedHistory,
          {
            turnSeq: data.assistantTurnSeq,
            role: "assistant",
            content: data.assistantMessage,
          },
        ]);

        if (data.isCffTriggered) {
          setCffActiveWarning(data.assistantMessage);
          addTelemetry(`CFF-1 Interlock triggered (Intent-Action Gap)`);
        } else {
          addTelemetry(`AI Peer response recorded (Turn #${data.assistantTurnSeq})`);
        }

        if (data.updatedArtifact) {
          setArtifactCode(data.updatedArtifact);
          addTelemetry(`Artifact draft updated by AI Peer`);
        }
      }
    } catch (e: any) {
      alert("対話送信エラー: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger 2-Stage AutoSCORE Evaluation (W4)
  const handleFinalizeAndEvaluate = async () => {
    if (chatHistory.length < 2) {
      alert("最低1回以上AI同僚と対話してから完了してください。");
      return;
    }

    setIsEvaluating(true);
    addTelemetry(`Triggering AutoSCORE 2-Stage Evaluator (Axis 4)...`);

    try {
      const res = await fetch("/api/dialogue/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          learnerId,
          sessionSeq,
          transcript: chatHistory,
          finalArtifact: artifactCode,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEvaluation(data);
        setCurrentStep("evaluation_report");
        addTelemetry(`Evaluation complete: ${data.levelLabel} (Rating ID: ${data.ratingId.slice(0, 8)}...)`);
      } else {
        alert("評価エラー: " + data.error);
      }
    } catch (e: any) {
      alert("評価リクエスト失敗: " + e.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Submit Score Dispute (MVP 4.5 / W5)
  const handleSubmitDispute = async () => {
    if (!disputeReason.trim() || !evaluation) return;

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratingId: evaluation.ratingId,
          disagreementDirection: "too_low",
          freeTextReason: disputeReason,
          scorerModelVersion: evaluation.scorerModelVersion,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDisputeSubmitted(true);
        addTelemetry(`Score dispute recorded in score_feedback (ID: ${data.feedbackId.slice(0, 8)}...)`);
      }
    } catch (e: any) {
      alert("異議申立エラー: " + e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* STEP 0: Initialization */}
          {currentStep === "init" && (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
              <div className="flex items-center gap-3 text-blue-400 font-semibold text-sm">
                <Sparkles className="w-5 h-5" />
                <span>未踏アドバンスト審査用 縦切りプロトタイプ（T-17 W1〜W6）</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                評価的判断力 動的アセスメント＆テレメトリ基盤
              </h1>
              <p className="text-slate-300 text-sm leading-relaxed">
                本プロトタイプは、単一セッションが端から端まで通る縦切り1本の実装です。
                「①固定アンカー出題」→「②動的3ペイン対話セッション」→「③AutoSCORE 2段階根拠抽出＆軸4採点」→「④XAIレポート」の全フローを検証できます。
              </p>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  出題する共通アンカー項目（T-05バンク / 全20項目から選択）
                </label>
                <select
                  value={selectedAnchorId}
                  onChange={(e) => setSelectedAnchorId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {anchorList.map((a) => (
                    <option key={a.anchor_id} value={a.anchor_id}>
                      [{a.anchor_id}] {a.title} ({a.family === "A" ? "設計領域" : "プロセス領域"})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  ※実稼働時はセッション列の7回に1回、ランダムに自動混入されます（`anchor_status: pretest`・無得点運用）。
                </p>
              </div>

              <button
                onClick={handleStartSession}
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    セッションを開始する（アンカー出題へ）
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 1: Anchor Q1 */}
          {currentStep === "anchor_q1" && currentAnchor && (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  共通アンカー項目: {currentAnchor.anchor_id}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 設問 1 / 2（前提の抽出）
                </span>
              </div>

              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">導入文</h2>
                <p className="text-sm text-slate-200 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
                  {currentAnchor.intro}
                </p>
              </div>

              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                  AI同僚の提案文
                </h2>
                <div className="text-sm text-slate-100 bg-blue-950/20 p-4 rounded-lg border border-blue-900/40 leading-relaxed">
                  「{currentAnchor.proposal}」
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-white">
                  設問1: {currentAnchor.q1.question}
                </h3>
                <div className="space-y-2.5">
                  {currentAnchor.q1.options.map((opt) => (
                    <label
                      key={opt.key}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        q1Choice === opt.key
                          ? "bg-blue-600/15 border-blue-500 text-white shadow-md shadow-blue-500/10"
                          : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="q1"
                        value={opt.key}
                        checked={q1Choice === opt.key}
                        onChange={(e) => setQ1Choice(e.target.value)}
                        className="mt-1 text-blue-600 focus:ring-0"
                      />
                      <div className="text-sm leading-relaxed">
                        <span className="font-bold mr-2 text-blue-400">{opt.key}:</span>
                        {opt.text}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleQ1Next}
                  disabled={!q1Choice}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all disabled:opacity-40"
                >
                  設問2へ進む
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Anchor Q2 */}
          {currentStep === "anchor_q2" && currentAnchor && (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  共通アンカー項目: {currentAnchor.anchor_id}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 設問 2 / 2（トレードオフの深掘り）
                </span>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  設問2: {currentAnchor.q2.question}
                </h3>
                <div className="space-y-2.5">
                  {currentAnchor.q2.options.map((opt) => (
                    <label
                      key={opt.key}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        q2Choice === opt.key
                          ? "bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                          : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="q2"
                        value={opt.key}
                        checked={q2Choice === opt.key}
                        onChange={(e) => setQ2Choice(e.target.value)}
                        className="mt-1 text-indigo-600 focus:ring-0"
                      />
                      <div className="text-sm leading-relaxed">
                        <span className="font-bold mr-2 text-indigo-400">{opt.key}:</span>
                        {opt.text}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleQ2Next}
                  disabled={!q2Choice}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-all disabled:opacity-40"
                >
                  確信度評定へ
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Confidence */}
          {currentStep === "anchor_conf" && (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <HelpCircle className="w-5 h-5" />
                <span>確信度の自己評定（5段階）</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                設問1および設問2の回答に対するご自身の確信度を選んでください
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
                  onClick={handleAnchorSubmit}
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
          )}

          {/* STEP 4: Anchor Completed Transition */}
          {currentStep === "anchor_complete" && (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
                <div>
                  <h2 className="text-xl font-bold text-white">共通アンカー項目の記録が完了しました</h2>
                  <p className="text-xs text-slate-400">
                    ステータス: <span className="font-mono text-emerald-400">anchor_status = pretest</span>（尺度較正用・無得点運用）
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-slate-300 space-y-2">
                <p className="font-semibold text-slate-200">🚀 続いて動的課題の対話セッション（W3）へ進みます:</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  次はAI同僚が作成した実際の業務コード（決済セキュリティミドルウェア）をレビューする3ペイン対話セッションです。
                  AI同僚のコードに含まれる前提の隠蔽や不備を対話で指摘し、修正指示を出してください。
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleStartDialogueSession}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25"
                >
                  動的対話セッションへ進む
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Dynamic 3-Pane Dialogue Session (W3) */}
          {currentStep === "dialogue_session" && (
            <div className="space-y-6">
              {/* Task Header */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="text-xs font-mono text-blue-400 mb-1 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" /> 動的課題: {DEMO_DYNAMIC_TASK.task_id}
                  </div>
                  <h2 className="text-base font-bold text-white">{DEMO_DYNAMIC_TASK.title}</h2>
                </div>
                <button
                  onClick={handleFinalizeAndEvaluate}
                  disabled={isEvaluating}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isEvaluating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      レビュー完了＆評価実行
                      <Award className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* 3-Pane Layout Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Pane: Scenario & Requirements */}
                <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    業務要件と制約条件
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {DEMO_DYNAMIC_TASK.scenario_intro}
                  </p>
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-400">必須要件:</span>
                    {DEMO_DYNAMIC_TASK.business_requirements.map((req, i) => (
                      <div key={i} className="text-xs text-slate-300 bg-slate-900/70 p-2 rounded border border-slate-800">
                        {req}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-amber-400">制約・セキュリティ基準:</span>
                    {DEMO_DYNAMIC_TASK.constraints.map((c, i) => (
                      <div key={i} className="text-xs text-amber-200/90 bg-amber-950/20 p-2 rounded border border-amber-900/30">
                        {c}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Pane: AI Artifact Code */}
                <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2 flex flex-col h-[400px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                      <Code className="w-3.5 h-3.5 text-emerald-400" />
                      成果物ドラフト（TypeScript）
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Live Artifact Editor</span>
                  </div>
                  <textarea
                    value={artifactCode}
                    onChange={(e) => setArtifactCode(e.target.value)}
                    className="w-full flex-1 bg-slate-900/90 font-mono text-[11px] text-slate-200 p-3 rounded-lg border border-slate-800 resize-none focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Chat & Prompt Dialogue Pane */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    AI同僚との対話・修正指示（マルチターン対話）
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Turn #{turnCounter}</span>
                </div>

                {/* Chat Message List */}
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${
                        msg.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div className="text-[10px] text-slate-500 mb-1 font-mono">
                        {msg.role === "user" ? "You (受講者)" : "AI Peer (同僚エージェント)"}
                      </div>
                      <div
                        className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white rounded-tr-sm"
                            : "bg-slate-800/90 text-slate-100 rounded-tl-sm border border-slate-700/60"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CFF-1 Warning Toast if triggered */}
                {cffActiveWarning && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">{cffActiveWarning}</div>
                  </div>
                )}

                {/* Input Prompt Box */}
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={userPromptInput}
                    onChange={(e) => setUserPromptInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isSubmitting && handleSendDialogueTurn()}
                    placeholder="AI同僚に指示・指摘を入力（例: JWT検証のみだと強制ログアウト時に無効化できないリスクがあります）"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSendDialogueTurn}
                    disabled={isSubmitting || !userPromptInput.trim()}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-all disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                    送信
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: XAI Evaluation Report Screen (W5) */}
          {currentStep === "evaluation_report" && evaluation && (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center font-bold text-white text-lg">
                    {evaluation.ratingCategory}
                  </div>
                  <div>
                    <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
                      AutoSCORE 2段階評価結果（XAIレポート）
                    </span>
                    <h2 className="text-lg font-bold text-white">{evaluation.levelLabel}</h2>
                  </div>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {evaluation.scorerModelVersion}
                </span>
              </div>

              {/* Rationale & Feedback */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    判定根拠（Evidence Summary）
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {evaluation.evidenceSummary}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-900/40 space-y-2">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    形成的診断アドバイス（Diagnostic Feedback）
                  </h3>
                  <p className="text-xs text-blue-200/90 leading-relaxed">
                    {evaluation.diagnosticFeedback}
                  </p>
                </div>
              </div>

              {/* Evidence Components Highlight Spans */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  抽出された受講者の検証行動スパン（Stage 1 構造化出力）
                </h3>
                <div className="space-y-2.5">
                  {evaluation.evidenceComponents.map((comp, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                    >
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-purple-400 font-bold">
                          [Turn {comp.turn_index}] {comp.component_type}
                        </span>
                        {comp.injected_flaw_id && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Match: {comp.injected_flaw_id}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-slate-200 bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono">
                        &quot;{comp.quoted_span}&quot;
                      </div>
                      <p className="text-[11px] text-slate-400">{comp.rationale_summary}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Score Feedback & Dispute Section [MVP 4.5] */}
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3 pt-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  評点に対する異議申立・フィードバック（MVP 4.5 準拠）
                </div>
                {disputeSubmitted ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                    ✓ 異議申立が `score_feedback` テーブルへ記録されました。SME評価者による再検証対象となります。
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="「ターン3で触れたフォールバック要件の指摘が反映されていません」など、異議の理由を具体的に記述してください（必須）"
                      className="w-full bg-slate-900 text-xs text-slate-200 p-3 rounded-xl border border-slate-700 resize-none h-20 focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSubmitDispute}
                        disabled={!disputeReason.trim()}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 border border-slate-700 disabled:opacity-40"
                      >
                        異議を申し立てる（記録）
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-slate-800">
                <button
                  onClick={() => setCurrentStep("init")}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  ← トップへ戻り最初からやり直す
                </button>
                <div className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  W1〜W5 全フロー縦切り動作完了
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Telemetry Monitor & System Architecture */}
        <div className="space-y-6">
          {/* Telemetry Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Zap className="w-4 h-4 text-amber-400" />
                Live Telemetry Monitor
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Connected
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Learner ID:</span>
                <span className="text-slate-300 truncate max-w-[160px]" title={learnerId}>
                  {learnerId ? learnerId.slice(0, 16) + "..." : "Not initialized"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Session Seq:</span>
                <span className="text-blue-400 font-bold">
                  {sessionId ? `#${sessionSeq}` : "-"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Target Axis:</span>
                <span className="text-purple-400 font-semibold">軸4（前提・倫理）</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Scorer Version:</span>
                <span className="text-slate-400 text-[10px]">claude-opus-5/extract-v1</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Telemetry Event Stream
              </div>
              <div className="h-60 overflow-y-auto bg-slate-950/90 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 space-y-1.5">
                {telemetryLog.length === 0 ? (
                  <div className="text-slate-600 italic">待機中... セッションを開始するとイベントが記録されます</div>
                ) : (
                  telemetryLog.map((log, i) => (
                    <div key={i} className="leading-snug text-slate-300">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Audit & Compliance Specs Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-3 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              未踏アドバンスト審査用仕様準拠
            </div>
            <ul className="space-y-1.5 text-[11px] list-disc list-inside">
              <li>データモデル: `learners`, `sessions`, `ratings` 本番準拠</li>
              <li>AutoSCORE: 自由記述CoTを排した2段階構造化採点</li>
              <li>CFF機能: 意図確認（CFF-1）インターロック動作</li>
              <li>XAIレポート: 根拠スパンの可視化と異議申立導線（MVP 4.5）</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { AlertOctagon, X } from "lucide-react";

interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

/**
 * 画面内エラー表示。
 *
 * `window.alert()` を使わない理由は2つある。(a) デモや審査の場でブラウザの
 * ネイティブダイアログが前面に出ると、何が起きたのかを画面に残したまま説明できない。
 * (b) alert は本文を選択・コピーできないため、APIキー未設定やDB未接続といった
 * 「対処が必要なメッセージ」を利用者が手元に写せない。
 */
export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      data-testid="error-banner"
      className="flex items-start gap-3 p-4 rounded-xl bg-red-950/40 border border-red-900/60 shadow-lg"
    >
      <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <p className="flex-1 text-sm text-red-200 leading-relaxed whitespace-pre-wrap break-words">
        {message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="エラー表示を閉じる"
        className="shrink-0 p-1 rounded-lg text-red-300 hover:text-red-100 hover:bg-red-900/40 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

"use client";

import React from "react";
import { X } from "lucide-react";

interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

/**
 * 画面内エラー表示。
 *
 * `window.alert()` を使わない理由は2つある。(a) デモの場でブラウザの
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
      className="flex items-start gap-3 rounded-card border border-critical/30 bg-critical-wash px-4 py-3"
    >
      <p className="flex-1 whitespace-pre-wrap break-words text-body text-critical">
        {message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="エラー表示を閉じる"
        className="shrink-0 rounded-chip p-1 text-critical/70 transition-colors hover:bg-critical/10 hover:text-critical"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

"use client";

import React from "react";
import { ApiKeysState } from "../hooks/useHome";

type ApiKeyModalProps = {
  isSdkModalOpen: boolean;
  setIsSdkModalOpen: (open: boolean) => void;
  apiKeys: ApiKeysState;
  setApiKeys: React.Dispatch<React.SetStateAction<ApiKeysState>>;
  savedKeysStatus: { openai: boolean; gemini: boolean };
  isKeysLoading: boolean;
  handleSaveKeys: (e: React.FormEvent) => Promise<void>;
};

export function ApiKeyModal(props: ApiKeyModalProps) {
  const {
    isSdkModalOpen,
    setIsSdkModalOpen,
    apiKeys,
    setApiKeys,
    savedKeysStatus,
    isKeysLoading,
    handleSaveKeys,
  } = props;

  if (!isSdkModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-filter backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="naver-panel w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 bg-white border border-[#e4e8eb] shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1e1e1e] flex items-center gap-2">
            <span className="w-1 h-3.5 bg-[#03c75a] rounded-full inline-block" />
            AI API Key 보안 연동
          </h3>
          <button
            onClick={() => setIsSdkModalOpen(false)}
            className="text-[#999] hover:text-[#555] transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-[#666] leading-normal bg-gray-50 border border-gray-100 p-3 rounded-lg">
          입력하신 OpenAI 및 Gemini API Key는 <strong className="text-[#03c75a]">즉시 암호화</strong>되어 보관됩니다.
        </p>

        <form onSubmit={handleSaveKeys} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-bold text-[#333] mb-1.5">OpenAI API Key</label>
            <input
              type="password"
              value={apiKeys.openai}
              onChange={(e) => setApiKeys((prev) => ({ ...prev, openai: e.target.value }))}
              placeholder={savedKeysStatus.openai ? "••••••••••••••••••••••••" : "sk-proj-..."}
              className="w-full bg-white border border-[#ccd2d6] rounded-lg px-3 py-2 text-xs text-[#1e1e1e] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#333] mb-1.5">Gemini API Key</label>
            <input
              type="password"
              value={apiKeys.gemini}
              onChange={(e) => setApiKeys((prev) => ({ ...prev, gemini: e.target.value }))}
              placeholder={savedKeysStatus.gemini ? "••••••••••••••••••••••••" : "AIzaSy..."}
              className="w-full bg-white border border-[#ccd2d6] rounded-lg px-3 py-2 text-xs text-[#1e1e1e] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all font-mono"
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => setIsSdkModalOpen(false)}
              className="flex-1 bg-white border border-[#ccd2d6] hover:bg-gray-50 text-xs font-bold py-3 rounded-lg text-[#555] transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isKeysLoading}
              className="flex-1 bg-[#03c75a] hover:bg-[#02b34f] text-white font-bold text-xs py-3 rounded-lg transition-all shadow-sm cursor-pointer"
            >
              {isKeysLoading ? "저장 중..." : "저장 및 활성화"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

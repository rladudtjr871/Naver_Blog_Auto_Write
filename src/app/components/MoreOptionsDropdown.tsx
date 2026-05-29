"use client";

import React from "react";

type MoreOptionsDropdownProps = {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  isSavingDraft: boolean;
  isGenerating: boolean;
  subject: string;
  handleSaveDraft: () => Promise<void>;
  handleReset: () => void;
};

export function MoreOptionsDropdown(props: MoreOptionsDropdownProps) {
  const {
    isMenuOpen,
    setIsMenuOpen,
    isSavingDraft,
    isGenerating,
    subject,
    handleSaveDraft,
    handleReset,
  } = props;

  if (!isMenuOpen) return null;

  return (
    <div style={{ width: '110px', height: '70px', left: '50px' }} className="absolute right-full top-0 mr-2 bg-white border border-[#e4e8eb] rounded-xl shadow-xl flex flex-col justify-between py-0 z-50 overflow-hidden animate-slide-down-fade origin-right">
      <button
        type="button"
        onClick={() => {
          handleSaveDraft();
          setIsMenuOpen(false);
        }}
        disabled={isSavingDraft || !subject.trim() || isGenerating}
        className="flex-1 w-full text-left px-3 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-50/80 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {isSavingDraft ? (
          <div className="w-3.5 h-3.5 border border-gray-300 border-t-[#03c75a] rounded-full animate-spin shrink-0" />
        ) : (
          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
        )}
        <span>{isSavingDraft ? "저장 중" : "임시 저장"}</span>
      </button>

      <div className="border-t border-gray-100" />

      <button
        type="button"
        onClick={() => {
          handleReset();
          setIsMenuOpen(false);
        }}
        disabled={isGenerating}
        className="flex-1 w-full text-left px-3 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50/50 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span>초기화</span>
      </button>
    </div>
  );
}

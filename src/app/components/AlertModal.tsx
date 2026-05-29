"use client";

import React from "react";

type AlertModalProps = {
  isOpen: boolean;
  message: string;
  title?: string;
  onClose: () => void;
};

export function AlertModal(props: AlertModalProps) {
  const { isOpen, message, title = "알림", onClose } = props;

  if (!isOpen) return null;

  // Split message by newline to render properly
  const messageLines = message.split("\n");

  return (
    <div style={{ zIndex: '999' }} className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
      <div style={{ width: "400px" }} className="naver-panel rounded-3xl p-6 flex flex-col gap-5 bg-white border border-[#e4e8eb] shadow-2xl animate-slide-down-fade">

        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#03c75a] rounded-full inline-block" />
            <h3 className="text-sm font-bold text-[#1e1e1e]">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 rounded-lg hover:bg-gray-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="py-2">
          <div className="text-xs text-[#555] leading-relaxed font-semibold">
            {messageLines.map((line, idx) => (
              <p key={idx} className={idx > 0 ? "mt-1.5" : ""}>
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-[#03c75a] hover:bg-[#02b34f] text-white font-bold text-xs py-3 px-5 rounded-xl transition-all shadow-xs cursor-pointer text-center"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

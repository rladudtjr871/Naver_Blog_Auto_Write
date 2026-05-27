"use client";

import React from "react";

type HeaderProps = {
  session: any;
  setIsSdkModalOpen: (open: boolean) => void;
  setIsTokenModalOpen: (open: boolean) => void;
  handleLogout: () => Promise<void>;
};

export function Header(props: HeaderProps) {
  const { session, setIsSdkModalOpen, setIsTokenModalOpen, handleLogout } = props;

  return (
    <header className="bg-white border-b border-[#e4e8eb] px-6 py-4 flex items-center justify-between shadow-xs sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#03c75a] flex items-center justify-center shadow-xs">
          <span className="text-white font-black text-xl tracking-tighter">B</span>
        </div>
        <div>
          <h1 className="text-sm font-bold text-[#1e1e1e] leading-tight">
            블로그<span className="text-[#03c75a]">AutoWrite</span>
          </h1>
          <p className="text-[8px] text-[#777] font-mono tracking-wider">Dashboard</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-[#555] bg-gray-100 border border-gray-200/60 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs">
          <span className="w-1.5 h-1.5 bg-[#03c75a] rounded-full animate-pulse" />
          {session?.user?.email}
        </span>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSdkModalOpen(true)}
            className="bg-white hover:bg-gray-50 border border-[#ccd2d6] text-[#555] font-bold text-xs px-3.5 py-2.5 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-4 h-4 text-[#777]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            API Key 연동
          </button>

          <button
            onClick={() => setIsTokenModalOpen(true)}
            className="bg-white hover:bg-gray-50 border border-[#ccd2d6] text-[#555] font-bold text-xs px-3.5 py-2.5 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-4 h-4 text-[#777]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            익스텐션 토큰
          </button>

          <button
            onClick={handleLogout}
            className="bg-gray-50 hover:bg-gray-100 border border-[#ccd2d6] text-[#777] font-semibold text-xs px-3.5 py-2.5 rounded-lg transition-all cursor-pointer"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}

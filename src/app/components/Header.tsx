"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";

type HeaderProps = {
  mode?: "manual" | "api";
  session: Session | null;
  setIsSdkModalOpen: (open: boolean) => void;
  setIsTokenModalOpen: (open: boolean) => void;
  setTokenModalTab: (tab: "install" | "token") => void;
  setIsProfileModalOpen: (open: boolean) => void;
  handleLogout: () => Promise<void>;
};

export function Header(props: HeaderProps) {
  const { 
    session, 
    setIsSdkModalOpen, 
    setIsTokenModalOpen, 
    setTokenModalTab, 
    setIsProfileModalOpen, 
    handleLogout
  } = props;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-white border-b border-[#e4e8eb] px-6 py-4 flex items-center justify-between shadow-xs sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#03c75a] flex items-center justify-center shadow-xs">
          <span className="text-white font-black text-xl tracking-tighter">B</span>
        </div>
        <div>
          <h1 className="text-sm font-bold text-[#1e1e1e] leading-tight">
            블로그 <span className="text-[#03c75a]">AutoWrite</span>
          </h1>
          <p className="text-[8px] text-[#777] font-mono tracking-wider">Dashboard</p>
        </div>
      </div>

      <div className="flex items-center gap-4">

        <button
          onClick={() => {
            setTokenModalTab("install");
            setIsTokenModalOpen(true);
          }}
          className="bg-white hover:bg-gray-50 border border-[#ccd2d6] hover:border-gray-300 text-[#333] font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-4 h-4 text-[#03c75a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          확장 프로그램 설치·연결
        </button>

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100/80 border border-gray-200/50 hover:border-gray-200 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[#03c75a]/20"
          >
            <div className="w-5 h-5 rounded-full bg-[#03c75a]/10 flex items-center justify-center text-[#03c75a] font-bold text-[10px]">
              {session?.user?.email ? session.user.email.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="text-xs font-semibold text-gray-700 tracking-tight">{session?.user?.email}</span>
            <svg
              className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? "rotate-180 text-[#03c75a]" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-[#e4e8eb] rounded-2xl shadow-xl py-2 z-50 animate-slide-down-fade origin-top-right">
              {/* Profile Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#03c75a] to-[#02b34f] flex items-center justify-center text-white font-bold text-sm shadow-xs">
                  {session?.user?.email ? session.user.email.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-[#03c75a]/10 text-[#03c75a] px-1.5 py-0.5 rounded font-bold">블로그 연동 계정</span>
                  </div>
                  <p className="text-xs text-gray-700 truncate font-bold mt-1" title={session?.user?.email}>
                    {session?.user?.email}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-1">
                <button
                  disabled={props.mode !== "api"}
                  title={props.mode !== "api" ? "API 모드는 현재 사용할 수 없습니다." : undefined}
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsSdkModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg font-medium flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>API Key 연동 관리{props.mode !== "api" ? " (사용 중지)" : ""}</span>
                </button>

                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setTokenModalTab("install");
                    setIsTokenModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg font-medium flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                  </svg>
                  <span>확장 프로그램 설치</span>
                </button>

                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg font-medium flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>회원정보 수정</span>
                </button>
              </div>

              <div className="border-t border-gray-100 my-1" />

              <div className="p-1">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs text-red-500 hover:bg-red-50/70 rounded-lg font-bold flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>로그아웃</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

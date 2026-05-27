"use client";

import React from "react";

type AuthViewProps = {
  authMode: "login" | "signup";
  setAuthMode: (mode: "login" | "signup") => void;
  authEmail: string;
  setAuthEmail: (email: string) => void;
  authPassword: string;
  setAuthPassword: (pw: string) => void;
  authMessage: string;
  setAuthMessage: (msg: string) => void;
  handleLogin: (e: React.FormEvent) => Promise<void>;
  handleSignUp: (e: React.FormEvent) => Promise<void>;
};

export function AuthView(props: AuthViewProps) {
  const {
    authMode,
    setAuthMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authMessage,
    setAuthMessage,
    handleLogin,
    handleSignUp,
  } = props;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f6f7] p-4 font-sans text-[#1e1e1e]">
      <div className="w-full max-w-[400px] bg-white border border-[#e4e8eb] rounded-2xl p-8 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-[#03c75a] flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-2xl tracking-tighter">B</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#1e1e1e] mt-2">
            블로그<span className="text-[#03c75a]">AutoWrite</span>
          </h1>
          <p className="text-[10px] text-[#777] tracking-wider uppercase font-mono">Naver Blog Auto-Write AI System</p>
        </div>

        <form onSubmit={authMode === "login" ? handleLogin : handleSignUp} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-[#333] mb-1.5">이메일 주소</label>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="example@email.com"
              required
              className="w-full bg-white border border-[#ccd2d6] rounded-lg px-3.5 py-2.5 text-sm text-[#1e1e1e] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#333] mb-1.5">비밀번호</label>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-white border border-[#ccd2d6] rounded-lg px-3.5 py-2.5 text-sm text-[#1e1e1e] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all"
            />
          </div>

          {authMessage && (
            <p className={`text-xs p-3 rounded-lg border text-center ${
              authMessage.includes("성공") || authMessage.includes("완료") 
                ? "bg-green-50 text-green-600 border-green-100" 
                : "bg-red-50 text-red-600 border-red-100"
            }`}>
              {authMessage}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-[#03c75a] hover:bg-[#02b34f] text-white font-bold text-sm py-3.5 rounded-lg shadow-sm transition-all text-center cursor-pointer"
          >
            {authMode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>

        <div className="text-center text-xs text-[#777]">
          {authMode === "login" ? (
            <p>
              계정이 없으신가요?{" "}
              <button
                onClick={() => { setAuthMode("signup"); setAuthMessage(""); }}
                className="text-[#03c75a] font-bold underline cursor-pointer"
              >
                회원가입 하기
              </button>
            </p>
          ) : (
            <p>
              이미 계정이 있으신가요?{" "}
              <button
                onClick={() => { setAuthMode("login"); setAuthMessage(""); }}
                className="text-[#03c75a] font-bold underline cursor-pointer"
              >
                로그인 하기
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

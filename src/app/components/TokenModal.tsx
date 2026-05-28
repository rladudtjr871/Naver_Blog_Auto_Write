"use client";

import React, { useState, useEffect } from "react";

type TokenModalProps = {
  isTokenModalOpen: boolean;
  setIsTokenModalOpen: (open: boolean) => void;
  tokenModalTab: "install" | "token";
  setTokenModalTab: (tab: "install" | "token") => void;
  session: any;
};

export function TokenModal(props: TokenModalProps) {
  const { isTokenModalOpen, setIsTokenModalOpen, tokenModalTab, setTokenModalTab } = props;
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "checking" | "connected" | "disconnected">("idle");
  const [daemonVersion, setDaemonVersion] = useState<string>("");

  const checkConnection = async () => {
    setConnectionStatus("checking");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

      const res = await fetch("http://localhost:5000/ping", { 
        mode: "cors",
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        if (data.status === "ok") {
          setDaemonVersion(data.version || "알 수 없음");
          setConnectionStatus("connected");
          return;
        }
      }
      setConnectionStatus("disconnected");
    } catch (e) {
      setConnectionStatus("disconnected");
    }
  };

  // Run ping check automatically when opening the tab
  useEffect(() => {
    if (isTokenModalOpen) {
      if (tokenModalTab === "token") {
        checkConnection();
      } else {
        setConnectionStatus("idle");
      }
    }
  }, [isTokenModalOpen, tokenModalTab]);

  if (!isTokenModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="naver-panel w-full max-w-lg rounded-3xl p-6 flex flex-col gap-5 bg-white border border-[#e4e8eb] shadow-2xl animate-slide-down-fade">
        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#03c75a] rounded-full inline-block" />
            <h3 className="text-sm font-bold text-[#1e1e1e]">
              PC 자동화 프로그램 관리
            </h3>
          </div>
          <button
            onClick={() => setIsTokenModalOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 rounded-lg hover:bg-gray-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTokenModalTab("install")}
            className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all cursor-pointer ${
              tokenModalTab === "install"
                ? "border-[#03c75a] text-[#03c75a]"
                : "border-transparent text-gray-400 hover:text-gray-500"
            }`}
          >
            1. 프로그램 다운로드 및 실행
          </button>
          <button
            onClick={() => setTokenModalTab("token")}
            className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all cursor-pointer ${
              tokenModalTab === "token"
                ? "border-[#03c75a] text-[#03c75a]"
                : "border-transparent text-gray-400 hover:text-gray-500"
            }`}
          >
            2. 연동 상태 테스트
          </button>
        </div>

        {/* Tab Contents */}
        <div className="py-1">
          {tokenModalTab === "install" ? (
            /* Column 1: Installation Guide */
            <div className="flex flex-col gap-4 animate-slide-down-fade">
              <p className="text-xs text-[#666] leading-relaxed">
                블로그 자동 생성을 통해 생성한 글을 PC에서 네이버 에디터 창을 띄워 자동으로 타이핑하고 임시 저장해 주는 로컬 백그라운드 프로그램입니다.
              </p>

              {/* Download Button */}
              <a
                href="/blog-auto-write-pc.zip"
                download="blog-auto-write-pc.zip"
                className="w-full bg-[#03c75a] hover:bg-[#02b34f] text-white font-bold text-xs py-3.5 px-4 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer select-none text-center"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PC 자동화 프로그램 다운로드 (.zip)
              </a>

              {/* Step List */}
              <div className="flex flex-col gap-3 bg-gray-50 border border-gray-100 p-4 rounded-2xl">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">설치 및 실행 순서</p>
                
                <div className="flex gap-2.5">
                  <span className="text-xs font-bold text-[#03c75a]">1.</span>
                  <p className="text-xs text-[#555] leading-normal">
                    다운로드한 <strong>zip 파일의 압축을 해제</strong>합니다.
                  </p>
                </div>
                
                <div className="flex gap-2.5">
                  <span className="text-xs font-bold text-[#03c75a]">2.</span>
                  <p className="text-xs text-[#555] leading-normal">
                    해제된 폴더 내 <strong><code className="bg-white border border-gray-200 px-1 py-0.5 rounded text-[10px] text-gray-600 font-mono">run.bat</code></strong> 파일을 더블 클릭하여 실행합니다.
                  </p>
                </div>

                <div className="flex gap-2.5">
                  <span className="text-xs font-bold text-[#03c75a]">3.</span>
                  <p className="text-xs text-[#555] leading-normal">
                    필요한 라이브러리(Selenium 등)가 자동 설치된 후 검은색 터미널 창에 <strong>[server started on http://localhost:5000]</strong> 메시지가 뜨면 가동 완료됩니다.
                  </p>
                </div>

                <div className="flex gap-2.5">
                  <span className="text-xs font-bold text-[#03c75a]">4.</span>
                  <p className="text-xs text-[#555] leading-normal">
                    자동 입력 기능을 사용하는 동안 <strong>터미널 창을 끄지 않고 계속 유지</strong>해 주세요.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Column 2: Connection Verification */
            <div className="flex flex-col gap-5 animate-slide-down-fade">
              <p className="text-xs text-[#666] leading-relaxed">
                로컬 PC에 설치한 자동화 프로그램이 백그라운드에서 실행 중인지 브라우저와 통신 상태를 확인합니다.
              </p>

              <div className="flex flex-col gap-3">
                {connectionStatus === "idle" && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 font-bold">아래 버튼을 눌러 연동 테스트를 진행해 주세요.</p>
                  </div>
                )}

                {connectionStatus === "checking" && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-[#03c75a] rounded-full animate-spin" />
                    <span className="text-xs text-gray-500 font-semibold">로컬 프로그램 응답 대기 중...</span>
                  </div>
                )}

                {connectionStatus === "connected" && (
                  <div className="bg-[#03c75a]/10 border border-[#03c75a]/30 rounded-xl p-4 flex gap-2.5">
                    <svg className="w-5 h-5 text-[#03c75a] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-bold text-[#03c75a]">연동 성공 (프로그램 버전: v{daemonVersion})</p>
                      <p className="text-[10px] text-[#555] leading-normal mt-1">
                        로컬 PC 자동화 서버(http://localhost:5000)가 정상 작동 중입니다. 글 작성을 완료한 후 [블로그 자동 등록]을 진행해 주세요!
                      </p>
                    </div>
                  </div>
                )}

                {connectionStatus === "disconnected" && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-2.5">
                    <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-bold text-red-500">연동 실패</p>
                      <p className="text-[10px] text-[#555] leading-normal mt-1">
                        로컬 프로그램과 통신할 수 없습니다. 압축 해제한 폴더의 <code className="bg-white border px-1 py-0.5 rounded font-mono">run.bat</code>를 켜둔 상태인지 다시 한 번 확인해 주세요.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={checkConnection}
                disabled={connectionStatus === "checking"}
                className="w-full bg-white hover:bg-gray-50 border border-[#ccd2d6] text-[#333] font-bold text-xs py-3.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 4.75H18" />
                </svg>
                연동 상태 테스트하기
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setIsTokenModalOpen(false)}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200/80 text-xs font-bold rounded-xl text-[#555] transition-all cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

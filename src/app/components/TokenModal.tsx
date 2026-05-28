"use client";

import React, { useState } from "react";
import manifest from "../../../extension/manifest.json";

type TokenModalProps = {
  isTokenModalOpen: boolean;
  setIsTokenModalOpen: (open: boolean) => void;
  tokenModalTab: "install" | "token";
  setTokenModalTab: (tab: "install" | "token") => void;
  session: any;
};

export function TokenModal(props: TokenModalProps) {
  const { isTokenModalOpen, setIsTokenModalOpen, tokenModalTab, setTokenModalTab, session } = props;
  const [copied, setCopied] = useState(false);

  if (!isTokenModalOpen) return null;

  const handleCopyToken = () => {
    if (session?.access_token) {
      navigator.clipboard.writeText(session.access_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="naver-panel w-full max-w-lg rounded-3xl p-6 flex flex-col gap-5 bg-white border border-[#e4e8eb] shadow-2xl animate-slide-down-fade">
        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#03c75a] rounded-full inline-block" />
            <h3 className="text-sm font-bold text-[#1e1e1e]">
              크롬 익스텐션 관리
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
            1. 익스텐션 추가 및 설치
          </button>
          <button
            onClick={() => setTokenModalTab("token")}
            className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all cursor-pointer ${
              tokenModalTab === "token"
                ? "border-[#03c75a] text-[#03c75a]"
                : "border-transparent text-gray-400 hover:text-gray-500"
            }`}
          >
            2. 서비스 연동 토큰
          </button>
        </div>

        {/* Tab Contents */}
        <div className="py-1">
          {tokenModalTab === "install" ? (
            /* Column 1: Installation Guide */
            <div className="flex flex-col gap-4 animate-slide-down-fade">
              <p className="text-xs text-[#666] leading-relaxed">
                스마트에디터와 포스트 자동 작성을 연동하기 위해 아래 설치 가이드에 따라 크롬 익스텐션을 추가해 주세요.
              </p>

              {/* Download Button */}
              <a
                href={`/extension_v${manifest.version}.zip`}
                download={`blog-autowrite-extension-v${manifest.version}.zip`}
                className="w-full bg-[#03c75a] hover:bg-[#02b34f] text-white font-bold text-xs py-3.5 px-4 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer select-none text-center"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                익스텐션 다운로드 (.zip)
              </a>

              {/* Step List */}
              <div className="flex flex-col gap-3 bg-gray-50 border border-gray-100 p-4 rounded-2xl">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">설치 순서</p>
                
                <div className="flex gap-2.5">
                  <span className="text-xs font-bold text-[#03c75a]">1.</span>
                  <p className="text-xs text-[#555] leading-normal">
                    다운로드한 <strong>zip 파일의 압축을 해제</strong>합니다.
                  </p>
                </div>
                
                <div className="flex gap-2.5">
                  <span className="text-xs font-bold text-[#03c75a]">2.</span>
                  <p className="text-xs text-[#555] leading-normal">
                    크롬 주소창에 <code className="bg-white border border-gray-200 px-1 py-0.5 rounded text-[10px] text-gray-600 font-mono">chrome://extensions</code>를 입력해 이동합니다.
                  </p>
                </div>

                <div className="flex gap-2.5">
                  <span className="text-xs font-bold text-[#03c75a]">3.</span>
                  <p className="text-xs text-[#555] leading-normal">
                    우측 상단의 <strong>개발자 모드</strong> 스위치를 켭니다.
                  </p>
                </div>

                <div className="flex gap-2.5">
                  <span className="text-xs font-bold text-[#03c75a]">4.</span>
                  <p className="text-xs text-[#555] leading-normal">
                    좌측 상단의 <strong>[압축해제된 확장 프로그램을 로드합니다]</strong> 버튼을 누르고 압축을 푼 폴더를 선택합니다.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Column 2: Token Configuration */
            <div className="flex flex-col gap-4 animate-slide-down-fade">
              <p className="text-xs text-[#666] leading-relaxed">
                설치된 익스텐션에서 이 대시보드 데이터를 안전하게 전송받으려면 아래 인증 토큰이 필요합니다.
              </p>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-[#333]">서버 액세스 토큰 (JWT)</label>
                <textarea
                  readOnly
                  value={session?.access_token || ""}
                  rows={4}
                  className="w-full bg-[#f8f9fa] border border-[#ccd2d6] rounded-xl p-3 text-[10px] text-[#555] outline-none font-mono resize-none focus:border-gray-400"
                />
              </div>

              <button
                type="button"
                onClick={handleCopyToken}
                className={`w-full font-bold text-xs py-3.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer select-none ${
                  copied
                    ? "bg-[#03c75a] text-white"
                    : "bg-white hover:bg-gray-50 border border-[#ccd2d6] text-[#333]"
                }`}
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    토큰이 복사되었습니다!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    토큰 복사하기
                  </>
                )}
              </button>

              <div className="bg-[#03c75a]/5 border border-[#03c75a]/10 rounded-2xl p-4">
                <div className="flex gap-2.5">
                  <svg className="w-4 h-4 text-[#03c75a] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs font-bold text-[#03c75a]">더 쉬운 자동 연동 팁</p>
                    <p className="text-[10px] text-[#555] leading-normal mt-1">
                      이 대시보드 탭을 열어둔 상태로 익스텐션 아이콘을 눌러 <strong>[자동 동기화]</strong> 버튼을 클릭하시면 토큰 복사 없이 원클릭 연동이 완료됩니다!
                    </p>
                  </div>
                </div>
              </div>
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

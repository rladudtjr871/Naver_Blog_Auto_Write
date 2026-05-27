"use client";

import React from "react";

type TokenModalProps = {
  isTokenModalOpen: boolean;
  setIsTokenModalOpen: (open: boolean) => void;
  session: any;
};

export function TokenModal(props: TokenModalProps) {
  const { isTokenModalOpen, setIsTokenModalOpen, session } = props;

  if (!isTokenModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-filter backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="naver-panel w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 bg-white border border-[#e4e8eb] shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1e1e1e] flex items-center gap-2">
            <span className="w-1 h-3.5 bg-[#03c75a] rounded-full inline-block" />
            크롬 익스텐션 연동 토큰
          </h3>
          <button
            onClick={() => setIsTokenModalOpen(false)}
            className="text-[#999] hover:text-[#555] transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-[#666] leading-normal bg-gray-50 border border-gray-100 p-3 rounded-lg">
          크롬 익스텐션에서 포스트 정보를 조회하기 위해서는 아래의 보안 인증 토큰(JWT)을 기입해야 합니다. 버튼을 눌러 복사한 뒤 익스텐션 팝업에 붙여넣어 주세요.
        </p>

        <div className="flex flex-col gap-2">
          <label className="block text-xs font-bold text-[#333]">서버 액세스 토큰 (JWT)</label>
          <textarea
            readOnly
            value={session?.access_token || ""}
            rows={5}
            className="w-full bg-[#f8f9fa] border border-[#ccd2d6] rounded-lg p-2.5 text-[10px] text-[#555] outline-none font-mono resize-none"
          />
        </div>

        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={() => setIsTokenModalOpen(false)}
            className="flex-1 bg-white hover:bg-gray-50 border border-[#ccd2d6] text-xs font-bold py-3 rounded-lg text-[#555] transition-all cursor-pointer"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => {
              if (session?.access_token) {
                navigator.clipboard.writeText(session.access_token);
                alert("인증 토큰이 클립보드에 복사되었습니다. 크롬 익스텐션에 붙여넣어 연동하세요!");
                setIsTokenModalOpen(false);
              }
            }}
            className="flex-1 bg-[#03c75a] hover:bg-[#02b34f] text-white font-bold text-xs py-3 rounded-lg transition-all shadow-sm cursor-pointer"
          >
            토큰 복사하기
          </button>
        </div>
      </div>
    </div>
  );
}

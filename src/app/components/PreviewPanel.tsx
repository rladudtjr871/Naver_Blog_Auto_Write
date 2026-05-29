"use client";

import React from "react";
import { PostState } from "../hooks/useHome";

type PreviewPanelProps = {
  post: PostState;
  progress: number;
  handleReset: () => void;
  naverBlogId: string;
  setIsTokenModalOpen: (open: boolean) => void;
  setTokenModalTab: (tab: "install" | "token") => void;
  showAlert: (message: string, title?: string) => void;
};

export function PreviewPanel(props: PreviewPanelProps) {
  const { post, progress, handleReset, naverBlogId, setIsTokenModalOpen, setTokenModalTab, showAlert } = props;
  const [isRegistering, setIsRegistering] = React.useState(false);

  return (
    <div className="naver-panel rounded-2xl p-6 flex-1 flex flex-col min-h-[500px] bg-white border border-[#e4e8eb] shadow-xs">
      {post.status === "IDLE" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-[#9ba5ad] mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-[#1e1e1e] mb-1">대기 중</h3>
          <p className="text-xs text-[#777] max-w-[280px] leading-normal">좌측 생성 가이드를 채우고 AI 블로그 자동 생성 버튼을 클릭하면 작성이 시작됩니다.</p>
        </div>
      )}

      {(post.status === "PENDING" || post.status === "PROCESSING") && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="relative w-20 h-20 mb-5 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-[#03c75a]/10 rounded-full" />
            <div 
              className="absolute inset-0 border-4 border-t-[#03c75a] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" 
              style={{ animationDuration: "1s" }}
            />
            <span className="text-xs font-bold text-[#1e1e1e]">{progress}%</span>
          </div>
          <h3 className="text-sm font-bold text-[#1e1e1e] mb-1">
            {post.status === "PENDING" ? "포스팅 대기 중..." : "AI 블로그 포스팅 작성 중..."}
          </h3>
          <p className="text-xs text-[#777] max-w-[260px] text-center leading-normal">
            {post.status === "PENDING" 
              ? "서버가 요청을 확인하고 비동기 생성 스레드를 준비하고 있습니다." 
              : "선택하신 AI 모델 엔진이 글을 예쁘게 구성하고 있습니다. 잠시만 기다려 주세요."}
          </p>
        </div>
      )}

      {post.status === "FAILED" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-[#ff4d4f] mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-[#1e1e1e] mb-1">콘텐츠 생성 실패</h3>
          <p className="text-xs text-red-500 max-w-[320px] leading-normal font-mono bg-red-50/50 border border-red-100 p-3 rounded-lg text-left overflow-x-auto">
            {post.errorMessage || "알 수 없는 AI 생성 에러가 발생했습니다."}
          </p>
          <button 
            onClick={handleReset} 
            className="mt-5 bg-[#ccd2d6] hover:bg-[#b8c0c5] text-[#333] font-bold text-xs px-4 py-2.5 rounded-lg transition-all cursor-pointer"
          >
            양식 초기화하기
          </button>
        </div>
      )}

      {post.status === "COMPLETED" && (
        <div className="flex-1 flex flex-col h-full">
          {/* Header Actions */}
          <div className="flex items-center justify-between border-b border-[#e4e8eb] pb-4 mb-4">
            <div>
              <span className="bg-[#03c75a]/10 text-[#03c75a] border border-[#03c75a]/20 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                COMPLETED
              </span>
              <h3 className="text-sm font-bold text-[#1e1e1e] mt-1.5">AI 생성 결과 미리보기</h3>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                disabled={isRegistering}
                onClick={async () => {
                  if (!naverBlogId) {
                    showAlert("블로그 ID가 설정되지 않았습니다. 우측 상단 계정 메뉴에서 블로그 ID를 먼저 설정해 주세요.");
                    return;
                  }

                  setIsRegistering(true);
                  try {
                    const pingRes = await fetch("http://localhost:5000/ping").catch(() => null);
                    if (!pingRes || !pingRes.ok) {
                      showAlert("로컬 PC에 자동화 프로그램이 실행 중이지 않습니다.\n우측 상단의 'PC 자동화 프로그램' 메뉴를 클릭하여 다운로드 및 실행 방법을 확인해 주세요.");
                      setTokenModalTab("install");
                      setIsTokenModalOpen(true);
                      return;
                    }

                    const runRes = await fetch("http://localhost:5000/run", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        blogId: naverBlogId,
                        title: post.title,
                        content: post.content,
                        place: post.place,
                        images: post.images || []
                      })
                    });

                    if (runRes.ok) {
                      showAlert("성공: PC 자동화 프로그램이 실행되었습니다. 열린 크롬 창을 확인해 주세요.", "성공");
                    } else {
                      showAlert("오류: 자동화 프로그램 실행 요청이 실패했습니다.", "오류");
                    }
                  } catch (e: any) {
                    console.error("Local write trigger error:", e);
                    showAlert("에러: 자동화 프로그램과 통신할 수 없습니다. " + e.message, "에러");
                  } finally {
                    setIsRegistering(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#03c75a] hover:bg-[#02b34f] text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegistering ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>등록 요청 중...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>블로그 자동 등록</span>
                  </>
                )}
              </button>
              <span className="text-[10px] font-mono text-[#777] bg-gray-100 px-2 py-1.5 rounded border border-gray-200/50 select-all">
                ID: {post.id?.substring(0, 8)}...
              </span>
              <button
                onClick={() => {
                  if (post.id) {
                    navigator.clipboard.writeText(post.id);
                    showAlert("포스트 ID가 클립보드에 복사되었습니다.");
                  }
                }}
                className="p-2 bg-white hover:bg-gray-50 border border-[#ccd2d6] text-[#555] rounded-lg transition-colors shadow-sm cursor-pointer"
                title="ID 복사"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Title Output */}
          <div className="bg-[#f8f9fa] border border-[#e4e8eb] rounded-xl p-4 mb-4">
            <span className="text-[10px] font-extrabold text-[#03c75a] uppercase tracking-wider block mb-1">Title</span>
            <h4 className="text-base font-bold text-[#1e1e1e] leading-snug">{post.title}</h4>
          </div>

          {/* Content Body Preview */}
          <div className="flex-1 border border-[#e4e8eb] rounded-xl p-4 overflow-y-auto max-h-[350px] bg-white relative">
            <span className="text-[10px] font-extrabold text-[#6366f1] uppercase tracking-wider block mb-2 sticky top-0 bg-white pb-1">
              Body Content (Markdown)
            </span>
            <div className="text-xs text-[#333] whitespace-pre-wrap leading-relaxed font-sans">
              {post.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

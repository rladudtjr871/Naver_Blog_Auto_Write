"use client";

import React from "react";
import { PostState } from "../hooks/useHome";
import { legacyDocument, validateBlogDocument } from "@/lib/blog-document";
import { DocumentPreview } from "./preview/DocumentPreview";
import { useExtensionTransfer } from "../hooks/useExtensionTransfer";

type PreviewPanelProps = {
  mode?: "manual" | "api";
  post: PostState;
  session: { access_token: string };
  progress: number;
  handleReset: () => void;
  naverBlogId: string;
  setIsTokenModalOpen: (open: boolean) => void;
  setTokenModalTab: (tab: "install" | "token") => void;
  showAlert: (message: string, title?: string) => void;
};

export function PreviewPanel(props: PreviewPanelProps) {
  const { post, handleReset, naverBlogId, session, setIsTokenModalOpen, setTokenModalTab, showAlert } = props;
  const transfer = useExtensionTransfer();
  const preview = React.useMemo(() => {
    try {
      const images = post.imageRecords || post.images.map((url, index) => ({ id: String(index), url }));
      const document = post.document != null ? validateBlogDocument(post.document, images.map(image => image.id)) : legacyDocument(post.title || "", post.content || "", images);
      return { document, images, error: "" };
    } catch (error) {
      return { document: null, images: [], error: error instanceof Error ? error.message : "문서를 표시하지 못했습니다." };
    }
  }, [post]);

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
          <p className="text-xs text-[#777] max-w-[280px] leading-normal">{props.mode === "api" ? "좌측 생성 가이드를 채우고 AI 블로그 자동 생성 버튼을 클릭하면 작성이 시작됩니다." : "좌측 가이드를 채우고 작성 요청을 준비하세요. 구독 AI에서 작성한 결과를 가져오면 미리보기가 표시됩니다."}</p>
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
            <span className="text-xs font-bold text-[#1e1e1e]">처리 중</span>
          </div>
          <h3 className="text-sm font-bold text-[#1e1e1e] mb-1">
            {post.status === "PENDING" ? "포스팅 대기 중..." : "AI 블로그 포스팅 작성 중..."}
          </h3>
          <p className="text-xs text-[#777] max-w-[260px] text-center leading-normal">
            {post.status === "PENDING" 
              ? "서버에서 생성 요청을 처리하고 있습니다."
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
                disabled={transfer.isTransferring || !preview.document}
                onClick={async () => {
                  if (post.id) await transfer.transferPost(post.id, session.access_token, naverBlogId);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#03c75a] hover:bg-[#02b34f] text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {transfer.isTransferring ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>글 전달 중...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>확장 프로그램으로 전달</span>
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

          <p className="mb-3 text-xs text-gray-500">굵게 · 글자색 · 밑줄과 문단·빈 줄을 원본 기준으로 표시합니다. 실제 네이버 보존 여부는 입력 후 확인해 주세요.</p>
          <div role="status" aria-live="polite" className="mb-3 text-xs leading-6 text-gray-700">{transfer.message}</div>
          <button type="button" onClick={() => { setTokenModalTab("install"); setIsTokenModalOpen(true); }} className="mb-3 self-start text-xs text-[#028c40] underline">확장 프로그램 설치·연결 방법</button>
          <div className="flex-1 border border-[#e4e8eb] rounded-xl p-4 overflow-y-auto max-h-[550px] bg-white">
            {preview.document ? <DocumentPreview document={preview.document} images={preview.images} /> : <p role="alert" className="text-sm text-red-600">문서 형식을 확인해 주세요: {preview.error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

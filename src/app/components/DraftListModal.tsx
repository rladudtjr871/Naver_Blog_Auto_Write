"use client";

import React from "react";

type DraftListModalProps = {
  isDraftListModalOpen: boolean;
  setIsDraftListModalOpen: (open: boolean) => void;
  drafts: any[];
  handleLoadPost: (postId: string) => Promise<void>;
  handleDeletePost: (postId: string) => Promise<void>;
  isDraftsLoading: boolean;
};

export function DraftListModal(props: DraftListModalProps) {
  const {
    isDraftListModalOpen,
    setIsDraftListModalOpen,
    drafts,
    handleLoadPost,
    handleDeletePost,
    isDraftsLoading,
  } = props;

  if (!isDraftListModalOpen) return null;

  // Format date safely
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const hh = String(date.getHours()).padStart(2, "0");
      const min = String(date.getMinutes()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Parse category and subject from ReferencePost
  const parseTopic = (item: any) => {
    const topicRecord = item.referencePosts?.find((r: any) => r.title === "주제");
    let category = "맛집";
    let subject = "";

    if (topicRecord && topicRecord.content) {
      const match = topicRecord.content.match(/^\[카테고리:\s*([^\]]+)\]\s*(.*)$/);
      if (match) {
        category = match[1];
        subject = match[2];
      } else {
        subject = topicRecord.content;
      }
    } else {
      subject = item.title || "제목 없음";
    }

    return { category, subject };
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-filter backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="naver-panel w-full max-w-3xl rounded-2xl p-6 flex flex-col gap-4 bg-white border border-[#e4e8eb] shadow-lg max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-3 border-b border-[#e4e8eb]">
          <h3 className="text-sm font-bold text-[#1e1e1e] flex items-center gap-2">
            <span className="w-1 h-3.5 bg-[#03c75a] rounded-full inline-block" />
            임시 저장 및 생성 내역 목록
          </h3>
          <button
            onClick={() => setIsDraftListModalOpen(false)}
            className="text-[#999] hover:text-[#555] transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Draft List Container */}
        <div className="relative overflow-y-auto flex-1 max-h-[50vh] pr-1 min-h-[200px]">
          {/* Loading Overlay */}
          {isDraftsLoading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-10 select-none">
              <div className="w-8 h-8 border-4 border-gray-200/50 border-t-[#03c75a] rounded-full animate-spin" />
              <p className="text-xs font-bold text-[#555]">요청을 처리하고 있습니다...</p>
            </div>
          )}

          {drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#999]">
              <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-xs font-semibold">저장된 임시 글이나 자동 작성 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {drafts.map((item) => {
                const { category, subject } = parseTopic(item);
                const isDraft = item.status === "DRAFT";
                const isProcessing = item.status === "PENDING" || item.status === "PROCESSING";
                const isCompleted = item.status === "COMPLETED";
                const isFailed = item.status === "FAILED";

                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-[#fafbfc] border border-[#e4e8eb] hover:border-[#03c75a]/40 rounded-xl transition-all gap-3 hover:bg-white hover:shadow-xs group"
                  >
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[9px] font-bold">
                          {category}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {formatDate(item.createdAt)}
                        </span>

                        {isDraft && (
                          <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold text-[9px]">
                            임시저장
                          </span>
                        )}
                        {isProcessing && (
                          <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-bold text-[9px] animate-pulse">
                            생성 중
                          </span>
                        )}
                        {isCompleted && (
                          <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold text-[9px]">
                            작성 완료
                          </span>
                        )}
                        {isFailed && (
                          <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-bold text-[9px]" title={item.errorMessage || "생성 실패"}>
                            실패
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-[#1e1e1e] truncate pr-2" title={subject}>
                        {subject}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => handleLoadPost(item.id)}
                        className="bg-[#03c75a]/10 hover:bg-[#03c75a] text-[#03c75a] hover:text-white font-bold text-[10px] py-1.5 px-3 rounded-lg transition-all cursor-pointer"
                      >
                        불러오기
                      </button>
                      <button
                        onClick={() => handleDeletePost(item.id)}
                        className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 p-1.5 rounded-lg transition-all cursor-pointer"
                        title="삭제"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            onClick={() => setIsDraftListModalOpen(false)}
            className="bg-white border border-[#ccd2d6] hover:bg-gray-50 text-xs font-bold py-2.5 px-5 rounded-lg text-[#555] transition-all cursor-pointer"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}

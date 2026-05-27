"use client";

import React from "react";
import { PostState } from "../hooks/useHome";

type GenerationFormProps = {
  category: string;
  setCategory: (val: string) => void;
  model: string;
  setModel: (val: string) => void;
  guideText: string;
  setGuideText: (val: string) => void;
  uploadedImages: string[];
  setUploadedImages: React.Dispatch<React.SetStateAction<string[]>>;
  post: PostState;
  savedKeysStatus: { openai: boolean; gemini: boolean };
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleReset: () => void;
  handleGenerate: (e: React.FormEvent) => Promise<void>;
};

export function GenerationForm(props: GenerationFormProps) {
  const {
    category,
    setCategory,
    model,
    setModel,
    guideText,
    setGuideText,
    uploadedImages,
    setUploadedImages,
    post,
    savedKeysStatus,
    handleImageUpload,
    handleReset,
    handleGenerate,
  } = props;

  return (
    <div className="naver-panel rounded-2xl p-6 flex flex-col gap-5 bg-white border border-[#e4e8eb] shadow-xs">
      <div>
        <h2 className="text-base font-bold text-[#1e1e1e] flex items-center gap-2">
          <span className="w-1 h-4 bg-[#03c75a] rounded-full inline-block" />
          블로그 글 생성 가이드
        </h2>
        <p className="text-xs text-[#777] mt-1">블로그 주제와 AI 생성 옵션을 입력해주세요.</p>
      </div>

      <form onSubmit={handleGenerate} className="flex flex-col gap-4">
        
        {/* Category */}
        <div>
          <label className="block text-xs font-bold text-[#333] mb-2">카테고리</label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED"}
              className="w-full bg-white border border-[#e4e8eb] rounded-lg px-3.5 py-2.5 text-sm text-[#333] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all appearance-none cursor-pointer disabled:bg-[#f8f9fa] disabled:text-[#aaa]"
            >
              <option value="IT/테크">IT / 테크</option>
              <option value="맛집/카페">맛집 / 카페</option>
              <option value="여행/레저">여행 / 레저</option>
              <option value="뷰티/패션">뷰티 / 패션</option>
              <option value="비즈니스/일상">비즈니스 / 일상</option>
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#777]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* AI Engine Model Select */}
        <div>
          <label className="block text-xs font-bold text-[#333] mb-2">AI 모델 엔진</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setModel("OPENAI")}
              disabled={(post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED") || !savedKeysStatus.openai}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                model === "OPENAI"
                  ? "bg-[#03c75a]/10 border-[#03c75a] text-[#03c75a] shadow-sm"
                  : "bg-white border-[#e4e8eb] text-[#555] hover:bg-gray-50"
              }`}
            >
              OpenAI GPT-4o {!savedKeysStatus.openai && " (API 키 필요)"}
            </button>
            <button
              type="button"
              onClick={() => setModel("GEMINI")}
              disabled={(post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED") || !savedKeysStatus.gemini}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                model === "GEMINI"
                  ? "bg-[#03c75a]/10 border-[#03c75a] text-[#03c75a] shadow-sm"
                  : "bg-white border-[#e4e8eb] text-[#555] hover:bg-gray-50"
              }`}
            >
              Gemini 1.5 Pro {!savedKeysStatus.gemini && " (API 키 필요)"}
            </button>
          </div>
        </div>

        {/* Guide guideline Textarea */}
        <div>
          <label className="block text-xs font-bold text-[#333] mb-2">작성 가이드라인</label>
          <textarea
            value={guideText}
            onChange={(e) => setGuideText(e.target.value)}
            disabled={post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED"}
            placeholder="예: 제주도 서귀포 흑돼지 전문점을 방문한 후기를 작성해줘. 분위기는 활기차고, 고기가 구워지는 비주얼을 시각적으로 묘사해줘. 해시태그 5개 추천 포함."
            rows={6}
            className="w-full bg-white border border-[#e4e8eb] rounded-lg px-3.5 py-2.5 text-sm text-[#1e1e1e] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all resize-none placeholder-gray-400 disabled:bg-[#f8f9fa] disabled:text-[#aaa]"
          />
        </div>

        {/* Image Input */}
        <div>
          <label className="block text-xs font-bold text-[#333] mb-2">본문 이미지 첨부 ({uploadedImages.length})</label>
          <div className="flex flex-col gap-3">
            <label className="w-full flex flex-col items-center justify-center border border-dashed border-[#ccd2d6] rounded-xl py-6 bg-[#fafbfc] hover:bg-[#f2f4f6] hover:border-[#03c75a] transition-all cursor-pointer group">
              <svg className="w-8 h-8 text-[#9ba5ad] group-hover:text-[#03c75a] transition-colors mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-bold text-[#555] group-hover:text-[#03c75a]">클릭하여 이미지 파일 첨부</span>
              <span className="text-[10px] text-[#999] mt-0.5">PNG, JPG (Vercel Blob 직접 업로드 지원)</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                disabled={post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED"}
                className="hidden"
              />
            </label>

            {/* Thumbnail Row */}
            {uploadedImages.length > 0 && (
              <div className="grid grid-cols-5 gap-2 bg-[#f8f9fa] border border-[#e4e8eb] p-2 rounded-lg">
                {uploadedImages.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-gray-200 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="Upload thumb" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setUploadedImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-red-400 cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="col-span-1 bg-white border border-[#ccd2d6] hover:bg-gray-50 text-xs font-bold py-3 rounded-lg text-[#555] transition-all flex items-center justify-center cursor-pointer"
          >
            초기화
          </button>
          <button
            type="submit"
            disabled={(post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED") || !guideText.trim() || !model}
            className="col-span-2 bg-[#03c75a] hover:bg-[#02b34f] text-white font-bold text-sm py-3 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 glow-btn cursor-pointer"
          >
            AI 블로그 자동 생성
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        </div>

      </form>
    </div>
  );
}

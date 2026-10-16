"use client";

import React, { useState, useRef, useEffect } from "react";
import { PostState } from "../hooks/useHome";
import { MoreOptionsDropdown } from "./MoreOptionsDropdown";
import { ImageAttachmentEditor } from "./manual/ImageAttachmentEditor";


type GenerationFormProps = {
  mode?: "manual" | "api";
  isManualBusy?: boolean;
  isImageUploading?: boolean;
  handlePrepareManual: (e: React.FormEvent) => Promise<void>;
  category: string;
  setCategory: (val: string) => void;
  model: string;
  setModel: (val: string) => void;
  subject: string;
  setSubject: (val: string) => void;
  place: string;
  setPlace: (val: string) => void;
  references: string[];
  setReferences: React.Dispatch<React.SetStateAction<string[]>>;
  uploadedImages: string[];
  setUploadedImages: React.Dispatch<React.SetStateAction<string[]>>;
  post: PostState;
  savedKeysStatus: { openai: boolean; gemini: boolean };
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleReset: () => void;
  handleGenerate: (e: React.FormEvent) => Promise<void>;
  hasDefaultReferences: boolean;
  handleLoadDefaultReferences: () => void;
  geminiModels: { id: string; displayName: string; description: string }[];
  isGeminiModelsLoading: boolean;
  geminiModelsError: string;
  selectedGeminiModel: string;
  setSelectedGeminiModel: (val: string) => void;
  setIsDraftListModalOpen: (open: boolean) => void;
  isSavingDraft: boolean;
  handleSaveDraft: () => Promise<void>;
  fetchGeminiModels: () => Promise<void>;
};

export function GenerationForm(props: GenerationFormProps) {
  const {
    category,
    setCategory,
    model,
    setModel,
    subject,
    setSubject,
    place,
    setPlace,
    references,
    setReferences,
    uploadedImages,
    setUploadedImages,
    post,
    savedKeysStatus,
    handleImageUpload,
    handleReset,
    handleGenerate,
    hasDefaultReferences,
    handleLoadDefaultReferences,
    geminiModels,
    isGeminiModelsLoading,
    geminiModelsError,
    selectedGeminiModel,
    setSelectedGeminiModel,
    setIsDraftListModalOpen,
    isSavingDraft,
    handleSaveDraft,
    fetchGeminiModels,
  } = props;

  const [activeExampleTab, setActiveExampleTab] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isGenerating = !!props.isManualBusy || !!props.isImageUploading || post.status === "PENDING" || post.status === "PROCESSING";
  const isRecreate = post.id !== null || post.status === "COMPLETED" || post.status === "FAILED" || post.status === "DRAFT";


  return (
    <div className="naver-panel rounded-2xl p-6 flex flex-col gap-5 bg-white border border-[#e4e8eb] shadow-xs">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-[#1e1e1e] flex items-center gap-2">
            <span className="w-1 h-4 bg-[#03c75a] rounded-full inline-block" />
            블로그 글 생성 가이드
          </h2>
          <p className="text-xs text-[#777] mt-1">주제·흐름·스타일과 이미지를 입력해주세요.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsDraftListModalOpen(true)}
          disabled={isGenerating}
          className="bg-white hover:bg-gray-50 border border-[#ccd2d6] text-[#555] font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <svg className="w-3.5 h-3.5 text-[#03c75a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          임시 저장 목록
        </button>
      </div>

      <form onSubmit={props.mode === "api" ? handleGenerate : props.handlePrepareManual} className="flex flex-col gap-4">

        {/* Category */}
        <div>
          <label className="block text-xs font-bold text-[#333] mb-2">카테고리</label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isGenerating}
              className="w-full bg-white border border-[#e4e8eb] rounded-lg px-3.5 py-2.5 text-sm text-[#333] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all appearance-none cursor-pointer disabled:bg-[#f8f9fa] disabled:text-[#aaa]"
            >
              {/* <option value="IT/테크">IT / 테크</option> */}
              <option value="맛집">맛집</option>
              <option value="카페">카페</option>
              <option value="여행">여행</option>
              <option value="뷰티">뷰티</option>
              <option value="패션">패션</option>
              {/* <option value="비즈니스/일상">비즈니스 / 일상</option> */}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#777]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {props.mode === "api" && <>
        {/* AI Engine Model Select */}
        <div className="flex flex-col gap-2">
          <label className="block text-xs font-bold text-[#333]">AI 모델 엔진</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setModel("OPENAI")}
              disabled={isGenerating || !savedKeysStatus.openai}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${model === "OPENAI"
                  ? "bg-[#03c75a]/10 border-[#03c75a] text-[#03c75a] shadow-sm"
                  : "bg-white border-[#e4e8eb] text-[#555] hover:bg-gray-50"
                }`}
            >
              OpenAI GPT-4o {!savedKeysStatus.openai && " (API 키 필요)"}
            </button>
            <button
              type="button"
              onClick={() => setModel("GEMINI")}
              disabled={isGenerating || !savedKeysStatus.gemini}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${model === "GEMINI"
                  ? "bg-[#03c75a]/10 border-[#03c75a] text-[#03c75a] shadow-sm"
                  : "bg-white border-[#e4e8eb] text-[#555] hover:bg-gray-50"
                }`}
            >
              Google Gemini {!savedKeysStatus.gemini && " (API 키 필요)"}
            </button>
          </div>

          {/* Gemini Specific Model Select (Conditional) */}
          {model === "GEMINI" && savedKeysStatus.gemini && (
            <div className="animate-slide-down-fade origin-top flex flex-col gap-1.5 bg-[#fafbfc] border border-[#e4e8eb] p-3.5 rounded-xl mt-1">
              <div className="flex items-center justify-between pb-0.5">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold text-[#555] select-none">Gemini 상세 모델 선택</label>
                  <button
                    type="button"
                    onClick={fetchGeminiModels}
                    disabled={isGeminiModelsLoading}
                    className="p-0.5 hover:bg-gray-200/50 rounded-md transition-colors cursor-pointer text-gray-500 disabled:opacity-50 shrink-0 align-middle inline-flex items-center justify-center"
                    title="모델 목록 다시 불러오기"
                  >
                    <svg className={`w-3.5 h-3.5 ${isGeminiModelsLoading ? "animate-spin" : ""}`} viewBox="0 0 30 30" fill="currentColor">
                      <path d="M 15 3 C 12.053086 3 9.3294211 4.0897803 7.2558594 5.8359375 A 1.0001 1.0001 0 1 0 8.5449219 7.3652344 C 10.27136 5.9113916 12.546914 5 15 5 C 20.226608 5 24.456683 8.9136179 24.951172 14 L 22 14 L 26 20 L 30 14 L 26.949219 14 C 26.441216 7.8348596 21.297943 3 15 3 z M 4.3007812 9 L 0.30078125 15 L 3 15 C 3 21.635519 8.3644809 27 15 27 C 17.946914 27 20.670579 25.91022 22.744141 24.164062 A 1.0001 1.0001 0 1 0 21.455078 22.634766 C 19.72864 24.088608 17.453086 25 15 25 C 9.4355191 25 5 20.564481 5 15 L 8.3007812 15 L 4.3007812 9 z" />
                    </svg>
                  </button>
                </div>
                {isGeminiModelsLoading && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 border border-[#03c75a]/20 border-t-[#03c75a] rounded-full animate-spin" />
                    <span className="text-[10px] text-gray-400">조회 중...</span>
                  </div>
                )}
              </div>
              
              {geminiModelsError ? (
                <div className="text-[10px] text-red-500 bg-red-50 border border-red-100 p-2 rounded-lg leading-normal">
                  ⚠️ {geminiModelsError}
                </div>
              ) : geminiModels.length === 0 && !isGeminiModelsLoading ? (
                <div className="text-[10px] text-amber-500 bg-amber-50 border border-amber-100 p-2 rounded-lg leading-normal">
                  ⚠️ 사용 가능한 Gemini 모델 목록을 불러오지 못했습니다. API 키의 상태를 확인해 주세요.
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedGeminiModel}
                    onChange={(e) => setSelectedGeminiModel(e.target.value)}
                    disabled={isGenerating || isGeminiModelsLoading}
                    className="w-full bg-white border border-[#e4e8eb] rounded-lg px-3.5 py-2.5 text-xs text-[#333] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all appearance-none cursor-pointer disabled:bg-[#f8f9fa] disabled:text-[#aaa]"
                  >
                    {isGeminiModelsLoading ? (
                      <option value="">모델 목록을 불러오는 중...</option>
                    ) : (
                      geminiModels.map((m) => (
                        <option key={m.id} value={m.id} title={m.description}>
                          {m.displayName}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#777]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
              {selectedGeminiModel && geminiModels.find(m => m.id === selectedGeminiModel)?.description && (
                <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5 px-1">
                  {geminiModels.find(m => m.id === selectedGeminiModel)?.description}
                </p>
              )}
            </div>
          )}
        </div>

        </>}
        {/* Blog Subject */}
        <div>
          <label className="block text-xs font-bold text-[#333] mb-2">블로그 주제</label>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isGenerating}
            placeholder="예: 제주도 서귀포 흑돼지 전문점 방문 후기"
            className="w-full bg-white border border-[#e4e8eb] rounded-lg px-3.5 py-2.5 text-sm text-[#1e1e1e] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all placeholder-gray-400 disabled:bg-[#f8f9fa] disabled:text-[#aaa]"
          />
        </div>

        {/* Blog Place (Conditional for 맛집, 카페, 여행) */}
        {["맛집", "카페", "여행"].includes(category) && (
          <div className="animate-slide-down-fade origin-top">
            <label className="block text-xs font-bold text-[#333] mb-2">
              장소 <span className="text-[#03c75a]">(지도 자동 검색어)</span>
            </label>
            <input
              type="text"
              required
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              disabled={isGenerating}
              placeholder="예: 서울특별시청, 제주 흑돈가 본점 등 정확한 명칭"
              className="w-full bg-white border border-[#e4e8eb] rounded-lg px-3.5 py-2.5 text-sm text-[#1e1e1e] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all placeholder-gray-400 disabled:bg-[#f8f9fa] disabled:text-[#aaa]"
            />
          </div>
        )}

        {/* Benchmarking Examples */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="block text-xs font-bold text-[#333]">벤치마킹할 예시 블로그</label>
              <button
                type="button"
                onClick={handleLoadDefaultReferences}
                disabled={!hasDefaultReferences || isGenerating}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                  hasDefaultReferences 
                    ? "bg-[#03c75a]/10 border-[#03c75a] text-[#03c75a] hover:bg-[#03c75a]/20" 
                    : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                }`}
                title={hasDefaultReferences ? "기본으로 저장된 예시를 불러옵니다." : "저장된 기본 예시가 없습니다. 회원정보 수정에서 등록해주세요."}
              >
                기본 예시 불러오기
              </button>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-400">학습할 글의 작성 스타일을 복사해 넣으세요.</p>

          <div className="bg-[#fafbfc] border border-[#e4e8eb] rounded-xl p-3.5 flex flex-col gap-3">
            {/* Tab Headers */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none scrollbar-none">
              {references.map((ref, idx) => {
                const hasText = ref && ref.trim().length > 0;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-1 bg-white border border-gray-200/80 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-all cursor-pointer hover:bg-gray-50 focus-within:ring-1 focus-within:ring-[#03c75a]/20"
                    style={{
                      borderColor: activeExampleTab === idx ? "#03c75a" : "",
                      color: activeExampleTab === idx ? "#03c75a" : "",
                      backgroundColor: activeExampleTab === idx ? "rgba(3, 199, 90, 0.05)" : "",
                    }}
                    onClick={() => setActiveExampleTab(idx)}
                  >
                    <span>예시 {idx + 1}</span>
                    {hasText && (
                      <span className="w-1.5 h-1.5 bg-[#03c75a] rounded-full" />
                    )}
                    {references.length > 1 && (
                      <button
                        type="button"
                        disabled={isGenerating}
                        onClick={(e) => {
                          e.stopPropagation();
                          const newRefs = references.filter((_, i) => i !== idx);
                          setReferences(newRefs);
                          if (activeExampleTab >= newRefs.length) {
                            setActiveExampleTab(Math.max(0, newRefs.length - 1));
                          }
                        }}
                        className="text-gray-400 hover:text-red-500 rounded p-0.5 ml-1 transition-colors cursor-pointer flex items-center justify-center"
                        title="예시 슬롯 삭제"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}

              {references.length < 5 && (
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => {
                    const newRefs = [...references, ""];
                    setReferences(newRefs);
                    setActiveExampleTab(newRefs.length - 1);
                  }}
                  className="bg-white hover:bg-gray-50 border border-dashed border-[#ccd2d6] hover:border-[#03c75a] text-[#555] hover:text-[#03c75a] font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  추가
                </button>
              )}
            </div>

            {/* Active Tab Textarea */}
            <textarea
              value={references[activeExampleTab] || ""}
              onChange={(e) => {
                const newRefs = [...references];
                newRefs[activeExampleTab] = e.target.value;
                setReferences(newRefs);
              }}
              disabled={isGenerating}
              placeholder={`예시 블로그 ${activeExampleTab + 1}의 본문 글을 복사해서 붙여넣어 주세요.`}
              rows={5}
              className="w-full bg-white border border-[#e4e8eb] rounded-lg px-3.5 py-2.5 text-xs text-[#1e1e1e] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all resize-none placeholder-gray-400 disabled:bg-[#f8f9fa] disabled:text-[#aaa]"
            />
          </div>

        {/* Image Input */}
        <div>
          <label className="block text-xs font-bold text-[#333] mb-2">본문 이미지 첨부 ({uploadedImages.length})</label>
          {props.mode !== "api" && props.isImageUploading && <p role="status" className="mb-2 text-xs text-[#027c39]">사진을 처리하고 있습니다. 완료 후 작성 요청을 준비해주세요.</p>}
          <div className="flex flex-col gap-3">
            <label className="w-full flex flex-col items-center justify-center border border-dashed border-[#ccd2d6] rounded-xl py-6 bg-[#fafbfc] hover:bg-[#f2f4f6] hover:border-[#03c75a] transition-all cursor-pointer group">
              <svg className="w-8 h-8 text-[#9ba5ad] group-hover:text-[#03c75a] transition-colors mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-bold text-[#555] group-hover:text-[#03c75a]">클릭하여 이미지 파일 첨부</span>
              <span className="text-[10px] text-[#999] mt-0.5">{props.mode === "api" ? "PNG, JPG · 브라우저에서 압축" : "사진은 저장되며 AI 서비스에는 직접 첨부해주세요."}</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isGenerating}
                className="hidden"
              />
            </label>

            {/* Thumbnail Row */}
            {props.mode !== "api" ? <ImageAttachmentEditor images={uploadedImages} setImages={setUploadedImages} disabled={isGenerating} /> : uploadedImages.length > 0 && (
              <div className="grid grid-cols-5 gap-2 bg-[#f8f9fa] border border-[#e4e8eb] p-2 rounded-lg">
                {uploadedImages.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-gray-200 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="Upload thumb" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      disabled={isGenerating}
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
        <div className="flex items-stretch gap-2.5 pt-2">
          <button
            type="submit"
            disabled={isGenerating || !subject.trim() || (props.mode === "api" && !model)}
            className="flex-1 bg-[#03c75a] hover:bg-[#02b34f] text-white font-bold text-xs py-3.5 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 glow-btn cursor-pointer"
          >
            {props.mode !== "api" ? (props.isManualBusy ? "처리 중…" : "AI 작성 요청 준비") : isRecreate ? "AI 블로그 자동 재생성" : "AI 블로그 자동 생성"}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>

          {/* Dedicated relative container for the options button and its popover */}
          <div className="relative flex items-stretch" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              disabled={isGenerating}
              className="h-full px-4 bg-white border border-[#ccd2d6] hover:border-gray-300 hover:bg-gray-50 text-[#555] hover:text-gray-800 rounded-xl transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-extrabold select-none text-xs shadow-xs"
              title="더 보기 옵션"
            >
              •••
            </button>

            {/* Dropdown Menu */}
            <MoreOptionsDropdown
              isMenuOpen={isMenuOpen}
              setIsMenuOpen={setIsMenuOpen}
              isSavingDraft={isSavingDraft}
              isGenerating={isGenerating}
              subject={subject}
              handleSaveDraft={handleSaveDraft}
              handleReset={handleReset}
            />
          </div>
        </div>

      </form>
    </div>
  );
}

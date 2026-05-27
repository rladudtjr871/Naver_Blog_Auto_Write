"use client";

import { useState, useEffect, useRef } from "react";

// API Key status
type ApiKeysState = {
  openai: string;
  gemini: string;
};

// Blog Generation states
type PostState = {
  id: string | null;
  status: "IDLE" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  title: string | null;
  content: string | null;
  images: string[];
  errorMessage?: string | null;
};

export default function Home() {
  // UI states
  const [isSdkModalOpen, setIsSdkModalOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeysState>({ openai: "", gemini: "" });
  const [savedKeysStatus, setSavedKeysStatus] = useState({ openai: false, gemini: false });
  const [isKeysLoading, setIsKeysLoading] = useState(false);
  
  // Blog Form states
  const [category, setCategory] = useState("IT/테크");
  const [model, setModel] = useState("OPENAI");
  const [guideText, setGuideText] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  
  // Generation Process state
  const [post, setPost] = useState<PostState>({
    id: null,
    status: "IDLE",
    title: null,
    content: null,
    images: [],
  });

  const [progress, setProgress] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch API Key status from Backend on mount
  useEffect(() => {
    fetchKeysStatus();
  }, []);

  const fetchKeysStatus = async () => {
    try {
      const res = await fetch("/api/user/keys");
      if (res.ok) {
        const data = await res.json();
        const hasOpenAi = data.some((k: any) => k.provider === "OPENAI" && k.hasKey);
        const hasGemini = data.some((k: any) => k.provider === "GEMINI" && k.hasKey);
        setSavedKeysStatus({
          openai: hasOpenAi,
          gemini: hasGemini,
        });
      }
    } catch (err) {
      console.error("Failed to load key statuses:", err);
    }
  };

  // Save API keys to backend
  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsKeysLoading(true);
    try {
      if (apiKeys.openai) {
        await fetch("/api/user/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "OPENAI", apiKey: apiKeys.openai }),
        });
      }
      if (apiKeys.gemini) {
        await fetch("/api/user/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "GEMINI", apiKey: apiKeys.gemini }),
        });
      }
      await fetchKeysStatus();
      setApiKeys({ openai: "", gemini: "" });
      setIsSdkModalOpen(false);
    } catch (err) {
      alert("API Key 저장 중 오류가 발생했습니다.");
    } finally {
      setIsKeysLoading(false);
    }
  };

  // Image Upload (Vercel Blob Client upload would trigger endpoint, here we simulate URL addition)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // In production, you would upload to /api/images/upload -> Vercel Blob
      // For demo UI design we generate transient local object URLs
      const newImages = Array.from(files).map((file) => URL.createObjectURL(file));
      setUploadedImages((prev) => [...prev, ...newImages]);
    }
  };

  // Start generation
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guideText.trim()) return;

    // Reset progress
    setProgress(10);
    setPost({
      id: null,
      status: "PENDING",
      title: null,
      content: null,
      images: [],
    });

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guideText: `[카테고리: ${category}] ${guideText}`,
          images: uploadedImages.map(url => ({ url, role: "INCLUDED" })),
          model: model,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Generation request failed");
      }

      const data = await res.json();
      
      setPost({
        id: data.postId,
        status: data.status,
        title: null,
        content: null,
        images: uploadedImages,
      });

      // Start Polling
      startPolling(data.postId);

    } catch (err: any) {
      setPost({
        id: null,
        status: "FAILED",
        title: null,
        content: null,
        images: [],
        errorMessage: err.message || "Failed to trigger generation API",
      });
      setProgress(0);
    }
  };

  // Poll server for post completion
  const startPolling = (postId: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    
    let pollCount = 0;
    
    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;
      try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error("Status query failed");

        const data = await res.json();
        
        // Dynamic progress estimation
        let nextProgress = 20;
        if (data.status === "PROCESSING") {
          nextProgress = Math.min(30 + pollCount * 8, 95);
        } else if (data.status === "COMPLETED") {
          nextProgress = 100;
        }

        setProgress(nextProgress);
        setPost({
          id: data.postId,
          status: data.status,
          title: data.title,
          content: data.content,
          images: data.images ? data.images.map((img: any) => img.url) : [],
          errorMessage: data.errorMessage,
        });

        if (data.status === "COMPLETED" || data.status === "FAILED") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);
  };

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  const handleReset = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setPost({
      id: null,
      status: "IDLE",
      title: null,
      content: null,
      images: [],
    });
    setProgress(0);
    setGuideText("");
    setUploadedImages([]);
  };

  return (
    <div className="flex-1 flex flex-col relative min-h-screen text-slate-100 font-sans">
      {/* Background Orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
              BlogAutoWrite
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider">AI POSTING SYSTEM</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 text-xs bg-slate-900/50 border border-white/5 px-3 py-1.5 rounded-full">
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${savedKeysStatus.openai ? "bg-emerald-500" : "bg-rose-500"}`} />
              OpenAI
            </span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${savedKeysStatus.gemini ? "bg-emerald-500" : "bg-rose-500"}`} />
              Gemini
            </span>
          </div>

          <button
            onClick={() => setIsSdkModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-950 border border-indigo-500/20 rounded-xl hover:border-indigo-500/40 hover:bg-slate-900/60 transition-all text-xs font-semibold text-indigo-300 hover:text-white glow-btn"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            API Key 연동
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Creation Form */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="glass-panel rounded-3xl p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">블로그 글 작성 가이드</h2>
              <p className="text-xs text-slate-400">원하는 카테고리와 이미지, AI 생성 방향을 입력하세요.</p>
            </div>

            <form onSubmit={handleGenerate} className="flex flex-col gap-5">
              
              {/* Category Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">카테고리</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED"}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500/60 transition-all appearance-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="IT/테크">IT / 테크</option>
                    <option value="맛집/카페">맛집 / 카페</option>
                    <option value="여행/레저">여행 / 레저</option>
                    <option value="뷰티/패션">뷰티 / 패션</option>
                    <option value="비즈니스/일상">비즈니스 / 일상</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* AI Engine Model Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">AI 모델 엔진</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setModel("OPENAI")}
                    disabled={post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED"}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-semibold transition-all disabled:opacity-50 ${
                      model === "OPENAI"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/5"
                        : "bg-slate-950/60 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-300"
                    }`}
                  >
                    OpenAI GPT-4o
                  </button>
                  <button
                    type="button"
                    onClick={() => setModel("GEMINI")}
                    disabled={post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED"}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-semibold transition-all disabled:opacity-50 ${
                      model === "GEMINI"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/5"
                        : "bg-slate-950/60 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-300"
                    }`}
                  >
                    Gemini 1.5 Pro
                  </button>
                </div>
              </div>

              {/* Guide guideline Textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">작성 가이드라인</label>
                <textarea
                  value={guideText}
                  onChange={(e) => setGuideText(e.target.value)}
                  disabled={post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED"}
                  placeholder="예: 제주도 서귀포 흑돼지 전문점을 방문한 후기를 작성해줘. 분위기는 활기차고, 고기가 구워지는 비주얼을 시각적으로 묘사해줘. 해시태그 5개 추천 포함."
                  rows={5}
                  className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500/60 transition-all resize-none placeholder-slate-600 disabled:opacity-50"
                />
              </div>

              {/* Image Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">본문 이미지 첨부 ({uploadedImages.length})</label>
                <div className="flex flex-col gap-3">
                  <label className="w-full flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl py-6 bg-slate-950/40 hover:bg-slate-950/70 hover:border-indigo-500/30 transition-all cursor-pointer group">
                    <svg className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 transition-colors mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200">클릭하여 이미지 파일 첨부</span>
                    <span className="text-[10px] text-slate-600 mt-1">PNG, JPG (Vercel Blob 직접 업로드 지원)</span>
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
                    <div className="grid grid-cols-5 gap-2 bg-slate-950/60 border border-white/5 p-2 rounded-xl">
                      {uploadedImages.map((src, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="Upload thumb" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setUploadedImages((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-rose-400"
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
                  className="col-span-1 bg-slate-950 border border-white/5 hover:bg-slate-900 text-xs font-semibold py-3.5 rounded-xl text-slate-400 hover:text-slate-200 transition-all flex items-center justify-center"
                >
                  초기화
                </button>
                <button
                  type="submit"
                  disabled={(post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED") || !guideText.trim()}
                  className="col-span-2 bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-bold text-sm py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 glow-btn"
                >
                  AI 블로그 자동 생성
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
              </div>

            </form>
          </div>
        </section>

        {/* Right Side: Preview & Generating Panel */}
        <section className="lg:col-span-7 flex flex-col">
          <div className="glass-panel rounded-3xl p-6 flex-1 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">생성 프리뷰 & 결과</h2>
                <p className="text-xs text-slate-400">생성된 글의 상태를 모니터링하고 미리볼 수 있습니다.</p>
              </div>
              <div className="flex items-center gap-2">
                {post.status !== "IDLE" && (
                  <span className={`px-2.5 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                    post.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" :
                    post.status === "PROCESSING" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse" :
                    post.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}>
                    {post.status}
                  </span>
                )}
              </div>
            </div>

            {/* Content Display Area */}
            <div className="flex-1 flex flex-col justify-center items-center">
              {post.status === "IDLE" && (
                <div className="text-center max-w-sm flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-slate-950 border border-white/5 flex items-center justify-center mb-4 text-slate-600">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-1">작성 대기 중</h3>
                  <p className="text-xs text-slate-500">좌측 입력 폼에 블로그 가이드를 기록하고 자동 작성을 시작해주세요.</p>
                </div>
              )}

              {/* Progress UI for PENDING / PROCESSING */}
              {(post.status === "PENDING" || post.status === "PROCESSING") && (
                <div className="w-full max-w-md px-6 py-12 flex flex-col items-center gap-6">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="32" stroke="rgba(255,255,255,0.03)" strokeWidth="6" fill="transparent" />
                      <circle
                        cx="40" cy="40" r="32" stroke="url(#spinnerGrad)" strokeWidth="6" fill="transparent"
                        strokeDasharray={2 * Math.PI * 32}
                        strokeDashoffset={2 * Math.PI * 32 * (1 - progress / 100)}
                        strokeLinecap="round"
                        className="transition-all duration-500 ease-out"
                      />
                      <defs>
                        <linearGradient id="spinnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <span className="absolute text-sm font-mono font-bold text-white">{progress}%</span>
                  </div>

                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-slate-200 mb-1">
                      {post.status === "PENDING" ? "글 작성을 준비 중입니다" : "AI 블로그 본문 작성 중..."}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xs leading-normal">
                      {post.status === "PENDING"
                        ? "Vercel 서버리스 타임아웃을 극복하기 위해 Supabase에 비동기 레코드를 마킹하고 있습니다."
                        : "멀티모달 이미지를 분석하고 적절한 톤앤매너에 맞게 블로그 글을 생성하고 있습니다."}
                    </p>
                  </div>
                </div>
              )}

              {/* FAILED Result UI */}
              {post.status === "FAILED" && (
                <div className="text-center max-w-sm flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-500">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-rose-400 mb-1">본문 생성 실패</h3>
                  <p className="text-xs text-slate-400 max-w-xs leading-normal">
                    {post.errorMessage || "에러 발생: API Key 등록 여부 혹은 네트워크 상태를 확인하세요."}
                  </p>
                </div>
              )}

              {/* COMPLETED Result UI */}
              {post.status === "COMPLETED" && (
                <div className="w-full flex-1 flex flex-col">
                  {/* Generated Post Title */}
                  <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-4 mb-4">
                    <span className="text-[10px] font-bold text-indigo-400 tracking-wide uppercase">GENERATED TITLE</span>
                    <h3 className="text-base font-bold text-white mt-1 select-all">{post.title}</h3>
                  </div>

                  {/* Generated Content Body */}
                  <div className="flex-1 bg-slate-950/40 border border-white/5 rounded-2xl p-4 overflow-y-auto max-h-[300px] mb-4 text-sm leading-relaxed text-slate-300 font-mono whitespace-pre-wrap select-all">
                    {post.content}
                  </div>

                  {/* Extension Integration Dashboard */}
                  <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-white">크롬 익스텐션으로 네이버에 주입 준비 완료!</h4>
                        <p className="text-[10px] text-slate-400">네이버 블로그 쓰기 페이지를 열고 익스텐션을 활성화하세요.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-500/20 px-2.5 py-1.5 rounded-lg select-all">
                        POST ID: {post.id?.substring(0, 8)}...
                      </span>
                      <button
                        onClick={() => {
                          if (post.id) {
                            navigator.clipboard.writeText(post.id);
                            alert("포스트 ID가 클립보드에 복사되었습니다.");
                          }
                        }}
                        className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-300 hover:text-white rounded-lg transition-colors"
                        title="ID 복사"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-center border-t border-white/5 mt-8 text-xs text-slate-500 font-mono">
        &copy; 2026 BlogAutoWrite. Developed under Secure Mode & Vercel Serverless Architecture.
      </footer>

      {/* API Key Modal */}
      {isSdkModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-filter backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">AI Engine API Key 설정</h3>
              <button
                onClick={() => setIsSdkModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-normal">
              본 서비스는 개인 API Key를 직접 연동해 사용합니다. 입력된 키는 데이터베이스 저장 시 <strong className="text-slate-200">강력한 암호화(AES-256)</strong>를 거쳐 안전하게 보호되며, 외부 로그나 화면 노출을 완벽히 차단합니다.
            </p>

            <form onSubmit={handleSaveKeys} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">OpenAI API Key</label>
                <input
                  type="password"
                  value={apiKeys.openai}
                  onChange={(e) => setApiKeys((prev) => ({ ...prev, openai: e.target.value }))}
                  placeholder={savedKeysStatus.openai ? "••••••••••••••••••••••••" : "sk-proj-..."}
                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-indigo-500/60 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Gemini API Key</label>
                <input
                  type="password"
                  value={apiKeys.gemini}
                  onChange={(e) => setApiKeys((prev) => ({ ...prev, gemini: e.target.value }))}
                  placeholder={savedKeysStatus.gemini ? "••••••••••••••••••••••••" : "AIzaSy..."}
                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-indigo-500/60 transition-all font-mono"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsSdkModalOpen(false)}
                  className="flex-1 bg-slate-950 border border-white/5 hover:bg-slate-900 text-xs font-semibold py-3 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isKeysLoading}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-indigo-500/10 glow-btn"
                >
                  {isKeysLoading ? "저장 중..." : "저장 및 활성화"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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

  // Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files).map((file) => URL.createObjectURL(file));
      setUploadedImages((prev) => [...prev, ...newImages]);
    }
  };

  // Start generation
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guideText.trim()) return;

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
    <div className="flex-1 flex flex-col min-h-screen text-[#1e1e1e] bg-[#f5f6f7] font-sans">
      
      {/* Header */}
      <header className="w-full bg-white border-b border-[#e4e8eb] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Naver Blog Style Logo Icon */}
            <div className="w-9 h-9 rounded-lg bg-[#03c75a] flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-lg tracking-tighter">B</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-bold tracking-tight text-[#1e1e1e]">
                  블로그<span className="text-[#03c75a]">AutoWrite</span>
                </h1>
                <span className="bg-[#03c75a]/10 text-[#03c75a] text-[9px] font-bold px-1.5 py-0.5 rounded">AI</span>
              </div>
              <p className="text-[10px] text-[#777777] font-mono tracking-wider">NAVER BLOG AUTO WRITER</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Key Status Indicators */}
            <div className="hidden sm:flex items-center gap-3 text-xs bg-[#f8f9fa] border border-[#e4e8eb] px-3 py-1.5 rounded-lg">
              <span className="flex items-center gap-1.5 text-[#333]">
                <span className={`w-2 h-2 rounded-full ${savedKeysStatus.openai ? "bg-[#03c75a]" : "bg-red-400"}`} />
                OpenAI
              </span>
              <span className="w-px h-3 bg-[#e4e8eb]" />
              <span className="flex items-center gap-1.5 text-[#333]">
                <span className={`w-2 h-2 rounded-full ${savedKeysStatus.gemini ? "bg-[#03c75a]" : "bg-red-400"}`} />
                Gemini
              </span>
            </div>

            <button
              onClick={() => setIsSdkModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#03c75a]/30 hover:border-[#03c75a] rounded-lg text-xs font-bold text-[#03c75a] transition-all hover:bg-[#03c75a]/5 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              API Key 연동
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Creation Form */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="naver-panel rounded-2xl p-6 flex flex-col gap-5 bg-white">
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
                    disabled={post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED"}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-50 ${
                      model === "OPENAI"
                        ? "bg-[#03c75a]/10 border-[#03c75a] text-[#03c75a] shadow-sm"
                        : "bg-white border-[#e4e8eb] text-[#555] hover:bg-gray-50"
                    }`}
                  >
                    OpenAI GPT-4o
                  </button>
                  <button
                    type="button"
                    onClick={() => setModel("GEMINI")}
                    disabled={post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED"}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-50 ${
                      model === "GEMINI"
                        ? "bg-[#03c75a]/10 border-[#03c75a] text-[#03c75a] shadow-sm"
                        : "bg-white border-[#e4e8eb] text-[#555] hover:bg-gray-50"
                    }`}
                  >
                    Gemini 1.5 Pro
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
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-red-400"
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
                  className="col-span-1 bg-white border border-[#ccd2d6] hover:bg-gray-50 text-xs font-bold py-3 rounded-lg text-[#555] transition-all flex items-center justify-center"
                >
                  초기화
                </button>
                <button
                  type="submit"
                  disabled={(post.status !== "IDLE" && post.status !== "COMPLETED" && post.status !== "FAILED") || !guideText.trim()}
                  className="col-span-2 bg-[#03c75a] hover:bg-[#02b34f] text-white font-bold text-sm py-3 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 glow-btn"
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
          <div className="naver-panel rounded-2xl p-6 flex-1 flex flex-col min-h-[500px] bg-white">
            <div className="flex items-center justify-between border-b border-[#e4e8eb] pb-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1e1e1e] flex items-center gap-2">
                  <span className="w-1 h-4 bg-[#03c75a] rounded-full inline-block" />
                  생성 프리뷰 & 결과
                </h2>
                <p className="text-xs text-[#777] mt-1">생성된 제목과 본문을 검토할 수 있습니다.</p>
              </div>
              <div className="flex items-center gap-2">
                {post.status !== "IDLE" && (
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    post.status === "PENDING" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                    post.status === "PROCESSING" ? "bg-[#03c75a]/10 text-[#03c75a] border border-[#03c75a]/20" :
                    post.status === "COMPLETED" ? "bg-[#097df3]/10 text-[#097df3] border border-[#097df3]/20" :
                    "bg-red-500/10 text-red-600 border border-red-500/20"
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
                  <div className="w-14 h-14 rounded-full bg-[#f8f9fa] border border-[#e4e8eb] flex items-center justify-center mb-3.5 text-[#9ba5ad]">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-[#333] mb-1">작성 대기 중</h3>
                  <p className="text-xs text-[#777]">왼쪽 폼에 작성 가이드를 입력하고 글쓰기를 요청하세요.</p>
                </div>
              )}

              {/* Progress UI for PENDING / PROCESSING */}
              {(post.status === "PENDING" || post.status === "PROCESSING") && (
                <div className="w-full max-w-md px-6 py-12 flex flex-col items-center gap-5">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="32" stroke="#f2f4f6" strokeWidth="5" fill="transparent" />
                      <circle
                        cx="40" cy="40" r="32" stroke="#03c75a" strokeWidth="5" fill="transparent"
                        strokeDasharray={2 * Math.PI * 32}
                        strokeDashoffset={2 * Math.PI * 32 * (1 - progress / 100)}
                        strokeLinecap="round"
                        className="transition-all duration-500 ease-out"
                      />
                    </svg>
                    <span className="absolute text-sm font-bold text-[#03c75a]">{progress}%</span>
                  </div>

                  <div className="text-center">
                    <h3 className="text-sm font-bold text-[#1e1e1e] mb-1">
                      {post.status === "PENDING" ? "글 작성을 준비하고 있습니다" : "AI 블로그 본문을 작성하고 있습니다"}
                    </h3>
                    <p className="text-xs text-[#777] max-w-xs leading-normal">
                      {post.status === "PENDING"
                        ? "Supabase 실시간 백그라운드 데이터베이스 마킹을 수행하고 있습니다."
                        : "설정하신 AI 모델엔진이 한글 네이버 블로그 전용 최적화 톤앤매너로 글을 생성하고 있습니다."}
                    </p>
                  </div>
                </div>
              )}

              {/* FAILED Result UI */}
              {post.status === "FAILED" && (
                <div className="text-center max-w-sm flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-3.5 text-red-500">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-red-500 mb-1">본문 생성 실패</h3>
                  <p className="text-xs text-gray-500 max-w-xs leading-normal">
                    {post.errorMessage || "에러가 발생했습니다. API Key와 네트워크 구성을 확인해주세요."}
                  </p>
                </div>
              )}

              {/* COMPLETED Result UI */}
              {post.status === "COMPLETED" && (
                <div className="w-full flex-1 flex flex-col">
                  {/* Generated Post Title */}
                  <div className="bg-[#fafbfc] border border-[#e4e8eb] rounded-xl p-4 mb-4">
                    <span className="text-[9px] font-bold text-[#03c75a] tracking-wide uppercase">AI 생성 제목</span>
                    <h3 className="text-sm font-bold text-[#1e1e1e] mt-1 select-all">{post.title}</h3>
                  </div>

                  {/* Generated Content Body */}
                  <div className="flex-1 bg-white border border-[#e4e8eb] rounded-xl p-4 overflow-y-auto max-h-[300px] mb-4 text-xs leading-relaxed text-[#333] whitespace-pre-wrap select-all font-mono">
                    {post.content}
                  </div>

                  {/* Extension Integration Dashboard */}
                  <div className="bg-[#03c75a]/5 border border-[#03c75a]/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#03c75a]/10 flex items-center justify-center text-[#03c75a]">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-[#1e1e1e]">크롬 익스텐션 주입 대기 중</h4>
                        <p className="text-[10px] text-[#777]">익스텐션을 열고 복사한 POST ID를 입력하세요.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-[#f4f5f7] text-[#555] border border-[#ccd2d6] px-2.5 py-1.5 rounded-lg select-all">
                        POST ID: {post.id?.substring(0, 8)}...
                      </span>
                      <button
                        onClick={() => {
                          if (post.id) {
                            navigator.clipboard.writeText(post.id);
                            alert("포스트 ID가 클립보드에 복사되었습니다.");
                          }
                        }}
                        className="p-2 bg-white hover:bg-gray-50 border border-[#ccd2d6] text-[#555] rounded-lg transition-colors shadow-sm"
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
      <footer className="w-full max-w-7xl mx-auto px-6 py-5 text-center border-t border-[#e4e8eb] mt-6 text-[10px] text-[#999] font-mono">
        &copy; 2026 BlogAutoWrite. Powered by NAVER aesthetic Light Theme.
      </footer>

      {/* API Key Modal */}
      {isSdkModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-filter backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="naver-panel w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 bg-white">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1e1e1e] flex items-center gap-2">
                <span className="w-1 h-3.5 bg-[#03c75a] rounded-full inline-block" />
                AI API Key 연동 설정
              </h3>
              <button
                onClick={() => setIsSdkModalOpen(false)}
                className="text-[#999] hover:text-[#555] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-[#666] leading-normal bg-gray-50 border border-gray-100 p-3 rounded-lg">
              입력하신 OpenAI 및 Gemini API Key는 백엔드 서버에서 <strong className="text-[#03c75a]">AES-256-GCM 알고리즘</strong>으로 즉시 암호화되어 Supabase DB에 보관됩니다. 외부 노출을 완벽히 방지합니다.
            </p>

            <form onSubmit={handleSaveKeys} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#333] mb-1.5">OpenAI API Key</label>
                <input
                  type="password"
                  value={apiKeys.openai}
                  onChange={(e) => setApiKeys((prev) => ({ ...prev, openai: e.target.value }))}
                  placeholder={savedKeysStatus.openai ? "••••••••••••••••••••••••" : "sk-proj-..."}
                  className="w-full bg-white border border-[#ccd2d6] rounded-lg px-3 py-2 text-xs text-[#1e1e1e] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#333] mb-1.5">Gemini API Key</label>
                <input
                  type="password"
                  value={apiKeys.gemini}
                  onChange={(e) => setApiKeys((prev) => ({ ...prev, gemini: e.target.value }))}
                  placeholder={savedKeysStatus.gemini ? "••••••••••••••••••••••••" : "AIzaSy..."}
                  className="w-full bg-white border border-[#ccd2d6] rounded-lg px-3 py-2 text-xs text-[#1e1e1e] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all font-mono"
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

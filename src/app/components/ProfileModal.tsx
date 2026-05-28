"use client";

import React, { useState, useEffect } from "react";

type ProfileModalProps = {
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  session: any;
  naverBlogId: string;
  setNaverBlogId: (id: string) => void;
  defaultReferences: string[];
  setDefaultReferences: React.Dispatch<React.SetStateAction<string[]>>;
  fetchProfile: () => Promise<void>;
};

export function ProfileModal(props: ProfileModalProps) {
  const { 
    isProfileModalOpen, 
    setIsProfileModalOpen, 
    session, 
    naverBlogId, 
    setNaverBlogId,
    defaultReferences,
    fetchProfile
  } = props;
  
  const [blogIdInput, setBlogIdInput] = useState("");
  const [localRefs, setLocalRefs] = useState<string[]>([""]);
  const [activeTab, setActiveTab] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // Sync inputs with state when open
  useEffect(() => {
    if (isProfileModalOpen) {
      setBlogIdInput(naverBlogId || "");
      setLocalRefs(defaultReferences && defaultReferences.length > 0 ? [...defaultReferences] : [""]);
      setActiveTab(0);
      setIsEditing(false);
      setMessage("");
      setIsSuccess(false);
    }
  }, [isProfileModalOpen, naverBlogId, defaultReferences]);

  if (!isProfileModalOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    if (!blogIdInput.trim()) {
      setMessage("블로그 ID를 입력해주세요.");
      setIsSuccess(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          naverBlogId: blogIdInput.trim(),
          defaultReferences: localRefs.map(r => r.trim()).filter(Boolean)
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Profile update failed");
      }

      const data = await res.json();
      setNaverBlogId(data.naverBlogId || "");
      await fetchProfile(); // Sync parent state (defaultReferences & hasDefaultReferences)
      
      setIsSuccess(true);
      setMessage("회원정보가 성공적으로 수정되었습니다.");
      setIsEditing(false);
      
      // Auto close after 1.5 seconds
      setTimeout(() => {
        setIsProfileModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setIsSuccess(false);
      setMessage(err.message || "회원정보 수정 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="naver-panel w-full max-w-md rounded-3xl p-6 flex flex-col gap-5 bg-white border border-[#e4e8eb] shadow-2xl animate-slide-down-fade">
        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#03c75a] rounded-full inline-block" />
            <h3 className="text-sm font-bold text-[#1e1e1e]">
              회원정보 수정
            </h3>
          </div>
          <button
            onClick={() => setIsProfileModalOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 rounded-lg hover:bg-gray-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">이메일 주소</label>
            <input
              type="email"
              value={session?.user?.email || ""}
              disabled
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-400 outline-none cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#333] mb-1.5">블로그 ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={blogIdInput}
                onChange={(e) => setBlogIdInput(e.target.value)}
                placeholder="blog_id"
                required
                disabled={!isEditing}
                className={`flex-1 border rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all ${
                  isEditing 
                    ? "bg-white border-[#ccd2d6] text-[#1e1e1e] focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a]" 
                    : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  if (isEditing) {
                    setBlogIdInput(naverBlogId || "");
                    setLocalRefs(defaultReferences && defaultReferences.length > 0 ? [...defaultReferences] : [""]);
                    setActiveTab(0);
                    setIsEditing(false);
                  } else {
                    setIsEditing(true);
                  }
                }}
                className={`px-4 py-2 border text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  isEditing
                    ? "bg-red-50 hover:bg-red-100/70 border-red-200 text-red-600"
                    : "bg-white hover:bg-gray-50 border-[#ccd2d6] hover:border-gray-300 text-[#333]"
                }`}
              >
                {isEditing ? "취소" : "수정"}
              </button>
            </div>
          </div>

          {/* Default Benchmarking Examples */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#333]">벤치마킹 예시 기본값 (최대 5개)</label>
              <span className="text-[10px] text-gray-400">자동 저장 및 로딩에 사용할 기본 본문</span>
            </div>

            <div className="bg-[#fafbfc] border border-[#e4e8eb] rounded-2xl p-3 flex flex-col gap-2.5">
              {/* Tab Headers */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none scrollbar-none">
                {localRefs.map((ref, idx) => {
                  const hasText = ref && ref.trim().length > 0;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-all ${
                        isEditing ? "cursor-pointer hover:bg-gray-50" : "cursor-not-allowed opacity-80"
                      }`}
                      style={{
                        borderColor: activeTab === idx ? "#03c75a" : "",
                        color: activeTab === idx ? "#03c75a" : "",
                        backgroundColor: activeTab === idx ? "rgba(3, 199, 90, 0.05)" : "",
                      }}
                      onClick={() => {
                        if (isEditing) {
                          setActiveTab(idx);
                        }
                      }}
                    >
                      <span>예시 {idx + 1}</span>
                      {hasText && (
                        <span className="w-1.5 h-1.5 bg-[#03c75a] rounded-full" />
                      )}
                      {isEditing && localRefs.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newRefs = localRefs.filter((_, i) => i !== idx);
                            setLocalRefs(newRefs);
                            if (activeTab >= newRefs.length) {
                              setActiveTab(Math.max(0, newRefs.length - 1));
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

                {isEditing && localRefs.length < 5 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newRefs = [...localRefs, ""];
                      setLocalRefs(newRefs);
                      setActiveTab(newRefs.length - 1);
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
                value={localRefs[activeTab] || ""}
                onChange={(e) => {
                  if (isEditing) {
                    const newRefs = [...localRefs];
                    newRefs[activeTab] = e.target.value;
                    setLocalRefs(newRefs);
                  }
                }}
                disabled={!isEditing}
                placeholder={isEditing ? `기본 벤치마킹 예시 ${activeTab + 1}의 본문 글을 복사해서 붙여넣어 주세요.` : "저장된 예시 본문이 없습니다. [수정] 버튼을 눌러 입력하세요."}
                rows={5}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all resize-none placeholder-gray-400 ${
                  isEditing 
                    ? "bg-white border-[#ccd2d6] text-[#1e1e1e] focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a]" 
                    : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              />
            </div>
          </div>

          {message && (
            <p className={`text-xs p-3 rounded-lg border text-center ${
              isSuccess 
                ? "bg-green-50 text-green-600 border-green-100" 
                : "bg-red-50 text-red-600 border-red-100"
            }`}>
              {message}
            </p>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(false)}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200/80 text-xs font-bold rounded-xl text-[#555] transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !isEditing}
              className="px-5 py-2.5 bg-[#03c75a] hover:bg-[#02b34f] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


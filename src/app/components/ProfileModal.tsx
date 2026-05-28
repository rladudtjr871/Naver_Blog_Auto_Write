"use client";

import React, { useState, useEffect } from "react";

type ProfileModalProps = {
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  session: any;
  naverBlogId: string;
  setNaverBlogId: (id: string) => void;
};

export function ProfileModal(props: ProfileModalProps) {
  const { isProfileModalOpen, setIsProfileModalOpen, session, naverBlogId, setNaverBlogId } = props;
  const [blogIdInput, setBlogIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // Sync inputs with state when open
  useEffect(() => {
    if (isProfileModalOpen) {
      setBlogIdInput(naverBlogId);
      setMessage("");
      setIsSuccess(false);
    }
  }, [isProfileModalOpen, naverBlogId]);

  if (!isProfileModalOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    if (!blogIdInput.trim()) {
      setMessage("네이버 블로그 ID를 입력해주세요.");
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
        body: JSON.stringify({ naverBlogId: blogIdInput }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Profile update failed");
      }

      const data = await res.json();
      setNaverBlogId(data.naverBlogId);
      setIsSuccess(true);
      setMessage("회원정보가 성공적으로 수정되었습니다.");
      
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
            <label className="block text-xs font-bold text-[#333] mb-1.5">네이버 블로그 ID</label>
            <input
              type="text"
              value={blogIdInput}
              onChange={(e) => setBlogIdInput(e.target.value)}
              placeholder="naver_id"
              required
              className="w-full bg-white border border-[#ccd2d6] rounded-xl px-3.5 py-2.5 text-xs text-[#1e1e1e] outline-none focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] transition-all"
            />
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
              disabled={loading}
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

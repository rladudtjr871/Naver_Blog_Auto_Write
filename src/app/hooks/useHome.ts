"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export type ApiKeysState = {
  openai: string;
  gemini: string;
};

export type PostState = {
  id: string | null;
  status: "IDLE" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  title: string | null;
  content: string | null;
  place?: string | null;
  images: string[];
  errorMessage?: string | null;
};

const compressImage = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export function useHome() {
  // Authentication states
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenModalTab, setTokenModalTab] = useState<"install" | "token">("install");
  const [authNaverBlogId, setAuthNaverBlogId] = useState("");
  const [naverBlogId, setNaverBlogId] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // UI states
  const [isSdkModalOpen, setIsSdkModalOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeysState>({ openai: "", gemini: "" });
  const [savedKeysStatus, setSavedKeysStatus] = useState({ openai: false, gemini: false });
  const [isKeysLoading, setIsKeysLoading] = useState(false);
  const [isTestingSelenium, setIsTestingSelenium] = useState(false);
  const wasAbortedRef = useRef(false);
  
  // Blog Form states
  const [category, setCategory] = useState("IT/테크");
  const [model, setModel] = useState("");
  const [subject, setSubject] = useState("");
  const [place, setPlace] = useState("");
  const [references, setReferences] = useState<string[]>([""]);
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

  // 1. Session initialization and tracking
  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch keys and profile when session is established
  useEffect(() => {
    if (session) {
      fetchKeysStatus();
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/user/profile", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setNaverBlogId(data.naverBlogId || "");
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    }
  };

  const fetchKeysStatus = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/user/keys", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        const hasOpenAi = data.some((k: any) => k.provider === "OPENAI" && k.hasKey);
        const hasGemini = data.some((k: any) => k.provider === "GEMINI" && k.hasKey);
        setSavedKeysStatus({
          openai: hasOpenAi,
          gemini: hasGemini,
        });

        // Auto-select active model engine based on saved keys directly in the response
        if (hasOpenAi) {
          setModel("OPENAI");
        } else if (hasGemini) {
          setModel("GEMINI");
        } else {
          setModel("");
        }
      }
    } catch (err) {
      console.error("Failed to load key statuses:", err);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage("");
    if (!authEmail || !authPassword || !authNaverBlogId.trim()) {
      setAuthMessage("이메일, 비밀번호, 네이버 블로그 ID를 입력해주세요.");
      return;
    }
    setIsAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: {
            naverBlogId: authNaverBlogId.trim(),
          }
        }
      });
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        setAuthMessage("회원가입이 완료되었습니다!");
      } else {
        setAuthMessage("가입 확인 이메일이 발송되었습니다! 이메일 링크를 확인해주세요!");
      }
    } catch (err: any) {
      setAuthMessage(err.message || "회원가입 중 오류가 발생했습니다.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage("");
    if (!authEmail || !authPassword) {
      setAuthMessage("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setIsAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
      }
    } catch (err: any) {
      setAuthMessage(err.message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    handleReset();
  };

  // Save API keys to backend
  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setIsKeysLoading(true);
    try {
      if (apiKeys.openai) {
        const res = await fetch("/api/user/keys", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ provider: "OPENAI", apiKey: apiKeys.openai }),
        });
        if (!res.ok) throw new Error("OpenAI Key save failed");
      }
      if (apiKeys.gemini) {
        const res = await fetch("/api/user/keys", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ provider: "GEMINI", apiKey: apiKeys.gemini }),
        });
        if (!res.ok) throw new Error("Gemini Key save failed");
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
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      try {
        const compressPromises = Array.from(files).map((file) => compressImage(file));
        const base64Images = await Promise.all(compressPromises);
        setUploadedImages((prev) => [...prev, ...base64Images]);
      } catch (err) {
        console.error("Failed to upload and compress images:", err);
      }
    }
  };

  // Start generation
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !model || !session?.access_token) return;

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
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          category,
          subject,
          references,
          images: uploadedImages.map(url => ({ url, role: "INCLUDED" })),
          model: model,
          place,
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
    if (!session?.access_token) return;
    
    let pollCount = 0;
    
    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;
      try {
        const res = await fetch(`/api/posts/${postId}`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });
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
          place: data.place,
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
      place: null,
      images: [],
    });
    setProgress(0);
    setSubject("");
    setPlace("");
    setReferences([""]);
    setUploadedImages([]);
  };

  const handleSeleniumTest = async () => {
    if (!session?.access_token) return;

    if (isTestingSelenium) {
      wasAbortedRef.current = true;
      try {
        const res = await fetch("/api/test/selenium", {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });
        if (res.ok) {
          alert("셀레니움 테스트가 중단되었습니다.");
        } else {
          const data = await res.json();
          alert(data.error || "테스트 중단 중 오류가 발생했습니다.");
        }
      } catch (err) {
        console.error("Cancel selenium test error:", err);
      } finally {
        setIsTestingSelenium(false);
        wasAbortedRef.current = false;
      }
      return;
    }

    if (!naverBlogId) {
      alert("네이버 블로그 ID를 먼저 설정해주세요.");
      setIsProfileModalOpen(true);
      return;
    }
    
    setIsTestingSelenium(true);
    wasAbortedRef.current = false;
    try {
      const res = await fetch("/api/test/selenium", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      const data = await res.json();
      
      if (data.aborted || wasAbortedRef.current) {
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "테스트 요청 실패");
      }
      alert("셀레니움 테스트가 성공적으로 완료되었습니다! 임시 저장 글이 생성되었습니다.");
    } catch (err: any) {
      if (wasAbortedRef.current) {
        return;
      }
      console.error("Selenium test error:", err);
      alert(err.message || "셀레니움 테스트 중 오류가 발생했습니다.");
    } finally {
      setIsTestingSelenium(false);
      wasAbortedRef.current = false;
    }
  };

  return {
    session,
    isAuthLoading,
    authMode,
    setAuthMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authMessage,
    setAuthMessage,
    isTokenModalOpen,
    setIsTokenModalOpen,
    tokenModalTab,
    setTokenModalTab,
    authNaverBlogId,
    setAuthNaverBlogId,
    naverBlogId,
    setNaverBlogId,
    isProfileModalOpen,
    setIsProfileModalOpen,
    isSdkModalOpen,
    setIsSdkModalOpen,
    apiKeys,
    setApiKeys,
    savedKeysStatus,
    isKeysLoading,
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
    progress,
    handleSignUp,
    handleLogin,
    handleLogout,
    handleSaveKeys,
    handleImageUpload,
    handleGenerate,
    handleReset,
    isTestingSelenium,
    handleSeleniumTest,
  };
}

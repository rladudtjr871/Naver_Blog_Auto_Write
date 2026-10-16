"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { BlogDocument, DocumentImage } from "@/lib/blog-document";
import { prepareImageUrls, sortDocumentImages } from "@/lib/image-metadata";
import { useManualImageUpload } from "./useManualImageUpload";
import type { WritingMode } from "@/lib/writing-mode";

export type ApiKeysState = {
  openai: string;
  gemini: string;
};

export type PostState = {
  id: string | null;
  status: "IDLE" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "DRAFT";
  title: string | null;
  content: string | null;
  place?: string | null;
  images: string[];
  document?: BlogDocument | null;
  imageRecords?: { id: string; url: string; role?: string }[];
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
  const authOwnerRef = useRef<string | null>(null);
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
  const [drafts, setDrafts] = useState<any[]>([]);
  const [isDraftsLoading, setIsDraftsLoading] = useState(false);
  const [isDraftListModalOpen, setIsDraftListModalOpen] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [defaultReferences, setDefaultReferences] = useState<string[]>([]);
  const [hasDefaultReferences, setHasDefaultReferences] = useState(false);
  const [geminiModels, setGeminiModels] = useState<{ id: string; displayName: string; description: string }[]>([]);
  const [isGeminiModelsLoading, setIsGeminiModelsLoading] = useState(false);
  const [geminiModelsError, setGeminiModelsError] = useState("");
  const [selectedGeminiModel, setSelectedGeminiModel] = useState("gemini-2.5-flash");
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    message: string;
    title: string;
  }>({
    isOpen: false,
    message: "",
    title: "알림",
  });

  const showAlert = (message: string, title = "알림") => {
    setAlertState({
      isOpen: true,
      message,
      title,
    });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  const [mode, setMode] = useState<WritingMode>("manual");

  // UI states
  const [isSdkModalOpen, setIsSdkModalOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeysState>({ openai: "", gemini: "" });
  const [savedKeysStatus, setSavedKeysStatus] = useState({ openai: false, gemini: false });
  const [isKeysLoading, setIsKeysLoading] = useState(false);

  
  // Blog Form states
  const [category, setCategory] = useState("맛집");
  const [model, setModel] = useState("");
  const [subject, setSubject] = useState("");
  const [place, setPlace] = useState("");
  const [references, setReferences] = useState<string[]>([""]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const manualImageUpload = useManualImageUpload({
    compress: compressImage,
    append: images => setUploadedImages(previous => [...previous, ...images]),
    onError: () => showAlert("사진을 처리하지 못했습니다. 이미지 파일을 확인하고 다시 첨부해주세요."),
  });
  
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
      if (authOwnerRef.current !== (session?.user.id ?? null)) manualImageUpload.cancel();
      authOwnerRef.current = session?.user.id ?? null;
      setSession(session);
      setIsAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (authOwnerRef.current !== (session?.user.id ?? null)) manualImageUpload.cancel();
      authOwnerRef.current = session?.user.id ?? null;
      setSession(session);
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch keys, profile, and available Gemini models when session is established
  useEffect(() => {
    if (session) {
      if (mode === "api") {
        fetchKeysStatus();
        fetchGeminiModels();
      }
      fetchProfile();
      fetchDrafts();
    }
  }, [session, mode]);

  const fetchGeminiModels = async () => {
    if (!session?.access_token) return;
    setIsGeminiModelsLoading(true);
    setGeminiModelsError("");
    setGeminiModels([]);
    try {
      const res = await fetch("/api/user/models/gemini", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          setGeminiModels(data.models);
          const modelIds = data.models.map((m: any) => m.id);
          if (!modelIds.includes(selectedGeminiModel)) {
            if (modelIds.includes("gemini-2.5-flash")) {
              setSelectedGeminiModel("gemini-2.5-flash");
            } else {
              setSelectedGeminiModel(modelIds[0]);
            }
          }
        } else if (data.error) {
          setGeminiModelsError(data.error);
          setGeminiModels([]);
        }
      } else {
        setGeminiModelsError("모델 목록을 불러오지 못했습니다.");
      }
    } catch (err) {
      console.error("Failed to load Gemini models:", err);
      setGeminiModelsError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsGeminiModelsLoading(false);
    }
  };

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
        const refs = data.defaultReferences || [];
        setDefaultReferences(refs);
        setHasDefaultReferences(refs.length > 0);
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    }
  };
  const fetchLatestPost = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/posts", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        const posts = await res.json();
        if (posts && posts.length > 0) {
          const latestPost = posts[0];
          
          const detailRes = await fetch(`/api/posts/${latestPost.id}`, {
            headers: {
              "Authorization": `Bearer ${session.access_token}`
            }
          });
          if (detailRes.ok) {
            const data = await detailRes.json();
            if (mode === "manual") {
              if (authOwnerRef.current !== session.user.id) return;
              manualImageUpload.cancel();
            }
            
            if (data.category) {
              setCategory(data.category);
            }
            if (data.subject) {
              setSubject(data.subject);
            }
            setPlace(data.place || "");
            if (data.references && data.references.length > 0) {
              setReferences(data.references);
            }
            if (data.images && data.images.length > 0) {
              const restoredUrls = (mode === "manual" ? sortDocumentImages(data.images as DocumentImage[]) : data.images as DocumentImage[]).map(img => img.url);
              setUploadedImages(restoredUrls);
            }
            
            setPost({
              id: data.postId,
              status: data.status,
              title: data.title,
              content: data.content,
              place: data.place,
              images: data.images ? data.images.map((img: any) => img.url) : [],
              document: data.document ?? null,
              imageRecords: data.images || [],
              errorMessage: data.errorMessage
            });
            
            if (data.status === "PENDING" || data.status === "PROCESSING") {
              startPolling(data.postId);
            }
          }
        }
      }
    } catch (err) {
    }
  };

  const fetchDrafts = async () => {
    if (!session?.access_token) return;
    setIsDraftsLoading(true);
    try {
      const res = await fetch("/api/posts", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        const posts = await res.json();
        setDrafts(posts || []);
      }
    } catch (err) {
      console.error("Failed to fetch drafts list:", err);
    } finally {
      setIsDraftsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (mode === "manual" && manualImageUpload.isPending()) return;
    if (!subject.trim() || !session?.access_token) {
      showAlert("주제를 입력해주세요.");
      return;
    }
    setIsSavingDraft(true);
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
          images: (mode === "manual" ? prepareImageUrls(uploadedImages) : uploadedImages).map(url => ({ url, role: "INCLUDED" })),
          model: model === "GEMINI" ? selectedGeminiModel : "OPENAI",
          place,
          isDraft: true,
        }),
      });

      if (res.ok) {
        showAlert("임시 저장이 완료되었습니다.");
        fetchDrafts();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to save draft");
      }
    } catch (err: any) {
      showAlert("임시 저장 실패: " + err.message);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleLoadPost = async (postId: string) => {
    if (!session?.access_token) return;
    if (mode === "manual") manualImageUpload.cancel();
    const requestOwner = session.user.id;
    setIsDraftsLoading(true);
    try {
      const detailRes = await fetch(`/api/posts/${postId}`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      if (detailRes.ok) {
        const data = await detailRes.json();
        if (authOwnerRef.current !== requestOwner) return;
        if (mode === "manual") manualImageUpload.cancel();
        
        if (data.category) {
          setCategory(data.category);
        }
        if (data.subject) {
          setSubject(data.subject);
        }
        setPlace(data.place || "");
        if (data.references && data.references.length > 0) {
          setReferences(data.references);
        } else {
          setReferences([""]);
        }
        if (data.images && data.images.length > 0) {
          const restoredUrls = (mode === "manual" ? sortDocumentImages(data.images as DocumentImage[]) : data.images as DocumentImage[]).map(img => img.url);
          setUploadedImages(restoredUrls);
        } else {
          setUploadedImages([]);
        }
        
        setPost({
          id: data.postId,
          status: data.status,
          title: data.title,
          content: data.content,
          place: data.place,
          images: data.images ? data.images.map((img: any) => img.url) : [],
          document: data.document ?? null,
          imageRecords: data.images || [],
          errorMessage: data.errorMessage
        });
        
        if (data.status === "PENDING" || data.status === "PROCESSING") {
          startPolling(data.postId);
        } else if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Set progress
        if (data.status === "COMPLETED") {
          setProgress(100);
        } else if (data.status === "FAILED") {
          setProgress(0);
        } else if (data.status === "DRAFT") {
          setProgress(0);
        } else {
          setProgress(50);
        }

        setIsDraftListModalOpen(false);
        showAlert("저장된 글을 성공적으로 불러왔습니다.");
      } else {
        showAlert("글을 불러오지 못했습니다.");
      }
    } catch (err: any) {
      console.error("Load post error:", err);
      showAlert("글을 불러오는 도중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsDraftsLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("정말 이 글(임시저장/내역)을 삭제하시겠습니까?")) return;
    if (!session?.access_token) return;
    setIsDraftsLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        showAlert("삭제되었습니다.");
        fetchDrafts();
        if (post.id === postId) {
          setPost({
            id: null,
            status: "IDLE",
            title: null,
            content: null,
            place: null,
            images: [],
          });
          setProgress(0);
        }
      } else {
        showAlert("삭제에 실패했습니다.");
      }
    } catch (err: any) {
      console.error("Delete post error:", err);
      showAlert("삭제 도중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsDraftsLoading(false);
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
      setAuthMessage("이메일, 비밀번호, 블로그 ID를 입력해주세요.");
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
    setDefaultReferences([]);
    setHasDefaultReferences(false);
    setGeminiModels([]);
    setGeminiModelsError("");
    setSelectedGeminiModel("gemini-2.5-flash");
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
      await fetchGeminiModels();
      setApiKeys({ openai: "", gemini: "" });
      setIsSdkModalOpen(false);
    } catch (err) {
      showAlert("API Key 저장 중 오류가 발생했습니다.");
    } finally {
      setIsKeysLoading(false);
    }
  };

  // Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (mode === "manual") {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      await manualImageUpload.upload(files);
      return;
    }
    const files = e.target.files;
    if (files) {
      try {
        const uploadPromises = Array.from(files).map(async (file) => {
          const base64 = await compressImage(file);
          return `${base64}#name=${encodeURIComponent(file.name)}`;
        });
        const newImages = await Promise.all(uploadPromises);
        setUploadedImages((prev) => [...prev, ...newImages]);
      } catch (err) {
        console.error("Failed to upload and compress images:", err);
      }
    }
  };

  // Start generation
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode !== "api" || !subject.trim() || !model || !session?.access_token) return;

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
          model: model === "GEMINI" ? selectedGeminiModel : "OPENAI",
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
      fetchDrafts();

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
          document: data.document ?? null,
          imageRecords: data.images || [],
          errorMessage: data.errorMessage,
        });

        if (data.status === "COMPLETED" || data.status === "FAILED") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          fetchDrafts();
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
    if (mode === "manual") manualImageUpload.cancel();
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

  const handleLoadDefaultReferences = () => {
    if (defaultReferences.length > 0) {
      setReferences(defaultReferences);
      showAlert("기본 벤치마킹 예시를 불러왔습니다.");
    }
  };

  return {
    mode,
    setMode,
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
    isImageUploading: mode === "manual" && manualImageUpload.isUploading,
    isImageUploadPending: manualImageUpload.isPending,
    post,
    progress,
    handleSignUp,
    handleLogin,
    handleLogout,
    handleSaveKeys,
    handleImageUpload,
    handleGenerate,
    handleReset,
    defaultReferences,
    setDefaultReferences,
    hasDefaultReferences,
    handleLoadDefaultReferences,
    fetchProfile,
    geminiModels,
    isGeminiModelsLoading,
    geminiModelsError,
    selectedGeminiModel,
    setSelectedGeminiModel,
    fetchGeminiModels,
    drafts,
    setDrafts,
    isDraftsLoading,
    isDraftListModalOpen,
    setIsDraftListModalOpen,
    isSavingDraft,
    fetchDrafts,
    handleSaveDraft,
    handleLoadPost,
    handleDeletePost,
    alertState,
    showAlert,
    closeAlert,
  };
}

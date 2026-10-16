"use client";

import { useEffect, useRef, useState } from "react";
import { buildSubscriptionPrompt } from "@/lib/subscription-workflow";
import type { DocumentImage } from "@/lib/blog-document";
import { prepareImageUrls, sortDocumentImages } from "@/lib/image-metadata";

type ManualComposerInput = {
  token?: string;
  userId?: string;
  category: string;
  subject: string;
  place: string;
  references: string[];
  uploadedImages: string[];
  isImageUploading?: boolean;
  isImageUploadPending?: () => boolean;
  onImported: (id: string) => Promise<void>;
  refreshPosts: () => Promise<void>;
};

export function useManualComposer(input: ManualComposerInput) {
  const { token, category, subject, place, references, uploadedImages } = input;
  const fingerprint = JSON.stringify({ userId: input.userId, category, subject, place, references, uploadedImages });
  const latestFingerprint = useRef(fingerprint);
  useEffect(() => { latestFingerprint.current = fingerprint; }, [fingerprint]);
  const lock = useRef(false);
  const fileReadSequence = useRef(0);
  const [prepared, setPrepared] = useState<{ id: string; fingerprint: string; prompt: string; images: DocumentImage[] } | null>(null);
  const [responseText, setResponseText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [imported, setImported] = useState(false);
  const isStale = !!prepared && (!!input.isImageUploading || prepared.fingerprint !== fingerprint);
  const [owner, setOwner] = useState(input.userId);
  if (owner !== input.userId) {
    setOwner(input.userId); setPrepared(null); setResponseText(""); setError(""); setNotice(""); setImported(false);
  }

  const handlePrepareManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current || input.isImageUploadPending?.() || !token || !subject.trim()) return;
    lock.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const response = await fetch("/api/posts", { method: "POST", headers, body: JSON.stringify({ category, subject, place, references, images: prepareImageUrls(uploadedImages).map(url => ({ url, role: "INCLUDED" })), isDraft: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "입력 정보 저장에 실패했습니다.");
      const detailResponse = await fetch(`/api/posts/${result.postId}`, { headers });
      const detail = await detailResponse.json();
      if (!detailResponse.ok) throw new Error(detail.error || "이미지 정보를 불러오지 못했습니다.");
      const images: DocumentImage[] = sortDocumentImages(detail.images || []);
      const prompt = buildSubscriptionPrompt({ category, subject, place, references, images });
      if (latestFingerprint.current !== fingerprint) throw new Error("입력 또는 로그인 정보가 변경되었습니다. 작성 요청을 다시 준비해주세요.");
      setPrepared({ id: result.postId, fingerprint, prompt, images });
      setResponseText(""); setImported(false);
      setNotice("작성 요청이 준비되었습니다. 요청을 복사하고 아래 사진을 내려받아 첨부 파일명에 맞춰 AI에 직접 첨부하세요.");
      await input.refreshPosts();
    } catch (err) { setError(err instanceof Error ? err.message : "작성 요청을 준비하지 못했습니다."); }
    finally { lock.current = false; setBusy(false); }
  };

  const copyPrompt = async () => {
    if (!prepared || isStale || input.isImageUploadPending?.()) return;
    try { await navigator.clipboard.writeText(prepared.prompt); setNotice("작성 요청을 복사했습니다. 아래 사진을 내려받아 요청과 함께 AI에 직접 첨부하세요."); setError(""); }
    catch { setError("자동 복사에 실패했습니다. 아래 요청문을 직접 선택해 복사해주세요."); }
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    const readSequence = ++fileReadSequence.current;
    const readFingerprint = fingerprint;
    if (file.size > 1_000_000) { setError("결과 파일은 1MB 이하여야 합니다."); return; }
    try {
      const text = await file.text();
      if (fileReadSequence.current !== readSequence || latestFingerprint.current !== readFingerprint) return;
      setResponseText(text); setError("");
    }
    catch {
      if (fileReadSequence.current === readSequence && latestFingerprint.current === readFingerprint) setError("파일을 읽지 못했습니다.");
    }
  };

  const importResult = async () => {
    if (lock.current || input.isImageUploadPending?.() || !prepared || isStale || imported || !token || !responseText.trim()) return;
    if (responseText.length > 1_000_000) { setError("결과는 100만 자 이하여야 합니다."); return; }
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (latestFingerprint.current !== prepared.fingerprint) throw new Error("입력이 바뀌었습니다. 작성 요청을 다시 준비해주세요.");
      const response = await fetch(`/api/posts/${prepared.id}/import`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ responseText }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "AI 결과를 가져오지 못했습니다.");
      if (latestFingerprint.current !== prepared.fingerprint) throw new Error("결과는 저장되었지만 입력 또는 로그인 정보가 변경되었습니다. 저장 목록에서 다시 불러와주세요.");
      setImported(true);
      setNotice("결과를 저장했습니다. 오른쪽 미리보기에서 확인 후 네이버로 전송하세요.");
      await input.onImported(result.postId);
      await input.refreshPosts();
    } catch (err) { setError(err instanceof Error ? err.message : "결과 가져오기에 실패했습니다."); }
    finally { lock.current = false; setBusy(false); }
  };

  return { prepared, responseText, setResponseText, busy, error, notice, isStale, imported, handlePrepareManual, copyPrompt, readFile, importResult };
}

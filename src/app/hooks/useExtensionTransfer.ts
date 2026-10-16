"use client";

import { useCallback, useRef, useState } from "react";
import { legacyDocument, validateBlogDocument } from "@/lib/blog-document";

export type ExtensionConnection = "idle" | "checking" | "connected" | "disconnected";

function requestExtension(type: "PING" | "EXPORT_POST", payload?: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const replyType = type === "PING" ? "PONG" : "EXPORT_RESULT";
    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const reply = event.data;
      if (reply?.source !== "blog-auto-write-extension" || reply.type !== replyType || reply.requestId !== requestId) return;
      cleanup();
      if (reply.ok === false) reject(new Error(typeof reply.error === "string" ? reply.error : "확장 프로그램 요청이 실패했습니다."));
      else resolve();
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(type === "PING" ? "확장 프로그램에 연결되지 않았습니다. 설치 후 확장 팝업에서 현재 웹 주소를 등록하고 페이지를 새로고침해 주세요." : "전달 응답을 받지 못했습니다. 확장 팝업의 수신 글을 먼저 확인한 후 재시도해 주세요."));
    }, type === "PING" ? 3000 : 10000);
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "blog-auto-write-dashboard", type, requestId, ...(payload ? { payload } : {}) }, window.location.origin);
  });
}

export function useExtensionTransfer() {
  const [connection, setConnection] = useState<ExtensionConnection>("idle");
  const [isTransferring, setIsTransferring] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);

  const checkConnection = useCallback(async () => {
    setConnection("checking");
    setMessage("");
    try {
      await requestExtension("PING");
      setConnection("connected");
      setMessage("확장 프로그램 연결 완료. 네이버 입력·저장 상태는 확장 팝업에서 확인해 주세요.");
    } catch (error) {
      setConnection("disconnected");
      setMessage(error instanceof Error ? error.message : "연결에 실패했습니다.");
    }
  }, []);

  const transferPost = useCallback(async (postId: string, accessToken: string, naverBlogId: string) => {
    if (busy.current) return;
    busy.current = true;
    setIsTransferring(true);
    setMessage("");
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "최신 글을 가져오지 못했습니다.");
      if (data.status !== "COMPLETED") throw new Error("생성 완료된 글만 전달할 수 있습니다.");
      const images = (data.images || []).map((image: { id: string; url: string; role?: string }) => ({ id: image.id, url: image.url, role: image.role }));
      const document = data.document != null
        ? validateBlogDocument(data.document, images.map((image: { id: string }) => image.id))
        : legacyDocument(data.title || "", data.content || "", images);
      await requestExtension("EXPORT_POST", { postId, document, images, naverBlogId });
      setConnection("connected");
      setMessage("확장 프로그램에 글 전달 완료. 확장 팝업에서 네이버 입력을 시작해 주세요. 에디터 입력·임시저장 검증은 아직 완료되지 않았습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "글 전달에 실패했습니다.");
    } finally {
      busy.current = false;
      setIsTransferring(false);
    }
  }, []);

  return { connection, isTransferring, message, checkConnection, transferPost };
}

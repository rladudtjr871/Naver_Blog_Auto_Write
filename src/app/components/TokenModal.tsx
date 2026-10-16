"use client";

import { ExtensionGuide } from "./extension/ExtensionGuide";
import { useExtensionTransfer } from "../hooks/useExtensionTransfer";

type TokenModalProps = {
  isTokenModalOpen: boolean;
  setIsTokenModalOpen: (open: boolean) => void;
  tokenModalTab: "install" | "token";
  setTokenModalTab: (tab: "install" | "token") => void;
};

export function TokenModal({ isTokenModalOpen, setIsTokenModalOpen, tokenModalTab, setTokenModalTab }: TokenModalProps) {
  const transfer = useExtensionTransfer();
  if (!isTokenModalOpen) return null;
  return <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="extension-title" className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-white shadow-xl">
      <div className="flex justify-between items-center mb-5"><h3 id="extension-title" className="font-bold">Chrome 확장 프로그램</h3><button type="button" aria-label="닫기" onClick={() => setIsTokenModalOpen(false)}>✕</button></div>
      <div className="flex gap-4 border-b pb-3 mb-4 text-sm"><button type="button" onClick={() => setTokenModalTab("install")} className={tokenModalTab === "install" ? "font-bold text-green-700" : ""}>설치 안내</button><button type="button" onClick={() => setTokenModalTab("token")} className={tokenModalTab === "token" ? "font-bold text-green-700" : ""}>연결 확인</button></div>
      {tokenModalTab === "install" ? <ExtensionGuide /> : <div className="text-sm leading-7">
        <p>확장 프로그램을 설치하고 팝업에서 현재 웹 주소를 등록한 뒤 이 페이지를 새로고침해 주세요.</p>
        <button type="button" disabled={transfer.connection === "checking"} onClick={transfer.checkConnection} className="my-4 w-full rounded-xl bg-green-600 text-white p-3 disabled:opacity-50">{transfer.connection === "checking" ? "연결 확인 중…" : "확장 프로그램 연결 확인"}</button>
        <p role="status" aria-live="polite">{transfer.message}</p>
        <p className="mt-3 text-xs text-gray-500">연결 확인은 네이버 입력·저장 완료를 의미하지 않습니다.</p>
      </div>}
    </section>
  </div>;
}

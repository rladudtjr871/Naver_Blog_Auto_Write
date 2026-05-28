"use client";

import { useHome } from "./hooks/useHome";
import { AuthView } from "./components/AuthView";
import { Header } from "./components/Header";
import { GenerationForm } from "./components/GenerationForm";
import { PreviewPanel } from "./components/PreviewPanel";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { TokenModal } from "./components/TokenModal";
import { ProfileModal } from "./components/ProfileModal";
import { DraftListModal } from "./components/DraftListModal";

export default function Home() {
  const homeProps = useHome();
  const { isAuthLoading, session } = homeProps;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6f7]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#03c75a]/20 border-t-[#03c75a] rounded-full animate-spin" />
          <p className="text-xs text-[#777] font-bold">인증 상태를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthView {...homeProps} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f6f7] font-sans text-[#1e1e1e]">
      <Header {...homeProps} />
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 flex flex-col gap-6">
          <GenerationForm {...homeProps} />
        </section>
        
        <section className="lg:col-span-7 flex flex-col">
          <PreviewPanel {...homeProps} />
        </section>
      </main>

      <ApiKeyModal {...homeProps} />
      <TokenModal {...homeProps} />
      <ProfileModal {...homeProps} />
      <DraftListModal {...homeProps} />
    </div>
  );
}
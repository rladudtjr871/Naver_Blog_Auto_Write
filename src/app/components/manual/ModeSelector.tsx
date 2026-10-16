"use client";

import { API_MODE_ENABLED, type WritingMode } from "@/lib/writing-mode";

export function ModeSelector({ mode, onModeChange }: { mode: WritingMode; onModeChange: (mode: WritingMode) => void }) {
  return (
    <section className="lg:col-span-12 rounded-2xl border border-[#e4e8eb] bg-white p-4" aria-label="글 작성 모드">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onModeChange("manual")} aria-pressed={mode === "manual"} className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${mode === "manual" ? "border-[#03c75a] bg-[#03c75a]/10 text-[#027c39]" : "border-gray-200 text-gray-600"}`}>구독 AI에서 작성</button>
        <button type="button" disabled={!API_MODE_ENABLED} onClick={() => { if (API_MODE_ENABLED) onModeChange("api"); }} aria-pressed={mode === "api"} title={API_MODE_ENABLED ? undefined : "API 작성은 현재 사용 중지되어 있습니다."} className={`rounded-xl border px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 ${mode === "api" ? "border-[#03c75a] bg-[#03c75a]/10 text-[#027c39]" : "border-gray-200 text-gray-600"}`}>API로 작성{!API_MODE_ENABLED && " · 사용 중지"}</button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-600">{mode === "manual" ? "작성 요청을 복사해 사용 중인 AI에서 직접 생성한 뒤 결과를 가져오세요. 이 모드에서는 AI API를 호출하지 않습니다." : "개인 API Key로 글을 생성합니다. AI 제공업체의 API 요금과 사용 한도가 적용됩니다."}</p>
    </section>
  );
}

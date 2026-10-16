"use client";

import { PreparedImageAttachments } from "./PreparedImageAttachments";
import type { useManualComposer } from "../../hooks/useManualComposer";

export function ManualComposer(props: ReturnType<typeof useManualComposer>) {
  const { prepared, busy, isStale, imported } = props;
  return (
    <section className="naver-panel flex flex-col gap-5 rounded-2xl bg-white p-5 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#1e1e1e]"><span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full bg-[#03c75a]" />구독 AI에서 작성하고 가져오기</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#777]">작성 요청을 AI에 전달하고, 완성된 글을 가져와 확인하세요.</p>
      </div>
      <ol className="space-y-3 rounded-xl border border-[#e4e8eb] bg-[#fafbfc] p-4 text-[13px] leading-relaxed text-[#555]">
        <li className="flex items-start gap-2.5"><span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#03c75a]/10 text-[11px] font-bold text-[#027c39]">1</span><span>위 입력을 채우고 <strong className="font-semibold text-[#333]">‘AI 작성 요청 준비’</strong>를 누르세요.</span></li>
        <li className="flex items-start gap-2.5"><span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#03c75a]/10 text-[11px] font-bold text-[#027c39]">2</span><span>요청을 ChatGPT·Gemini·Claude 등에 붙여넣고, 아래 사진을 첨부 파일명에 맞춰 직접 첨부하세요.</span></li>
        <li className="flex items-start gap-2.5"><span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#03c75a]/10 text-[11px] font-bold text-[#027c39]">3</span><span>AI가 반환한 <strong className="font-semibold text-[#333]">JSON 전체</strong>를 붙여넣거나 파일로 가져오세요.</span></li>
      </ol>
      {prepared && <>
        {isStale && <p role="alert" className="rounded-xl border border-amber-100 bg-amber-50 p-3.5 text-[13px] leading-relaxed text-amber-800">입력이 변경되었습니다. 작성 요청을 다시 준비하고 AI 결과도 새 요청 기준으로 생성해주세요.</p>}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2"><label htmlFor="subscription-prompt" className="text-[14px] font-bold text-[#333]">AI 작성 요청</label><button type="button" onClick={props.copyPrompt} disabled={busy || isStale} className="shrink-0 cursor-pointer rounded-lg border border-[#e4e8eb] bg-white px-3 py-2 text-[13px] font-bold text-[#555] transition-colors hover:border-[#03c75a] hover:bg-[#03c75a]/5 hover:text-[#027c39] focus-visible:outline-2 focus-visible:outline-[#03c75a] disabled:cursor-not-allowed disabled:opacity-40">요청 복사</button></div>
          <textarea id="subscription-prompt" readOnly value={prepared.prompt} rows={7} className="block w-full resize-y rounded-xl border border-[#e4e8eb] bg-[#fafbfc] p-3.5 text-[13px] leading-relaxed text-[#555] outline-none transition-all focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a]" onFocus={e => e.target.select()} />
        </div>
        <PreparedImageAttachments images={prepared.images} />
        <div className="space-y-2.5 border-t border-[#e4e8eb] pt-5">
          <label htmlFor="subscription-result" className="block text-[14px] font-bold text-[#333]">AI 결과 JSON</label>
          <p className="text-[13px] leading-relaxed text-[#777]">AI가 작성한 결과를 처음부터 끝까지 붙여넣어 주세요.</p>
          <textarea id="subscription-result" value={props.responseText} onChange={e => props.setResponseText(e.target.value)} disabled={busy || imported} maxLength={1_000_000} rows={9} placeholder='{"version":1,"title":"…","blocks":[…]}' className="block w-full resize-y rounded-xl border border-[#e4e8eb] bg-white p-3.5 font-mono text-[13px] leading-relaxed text-[#333] outline-none transition-all placeholder:text-[#aaa] focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] disabled:cursor-not-allowed disabled:bg-[#f8f9fa] disabled:text-[#999]" />
          <label className="block rounded-xl border border-[#e4e8eb] bg-[#fafbfc] p-3.5 text-[13px] font-semibold text-[#555]">결과 파일로 가져오기 <span className="font-normal text-[#999]">· .json, .txt / 최대 1MB</span><input type="file" accept=".json,.txt,application/json,text/plain" disabled={busy || imported} onChange={e => { void props.readFile(e.target.files?.[0]); e.target.value = ""; }} className="mt-2.5 block w-full min-w-0 text-[13px] font-normal text-[#777] file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-[#e4e8eb] file:bg-white file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-[#555] hover:file:border-[#03c75a] hover:file:text-[#027c39] focus-visible:outline-2 focus-visible:outline-[#03c75a] disabled:cursor-not-allowed disabled:opacity-50" /></label>
        </div>
        <button type="button" onClick={props.importResult} disabled={busy || isStale || imported || !props.responseText.trim()} className="glow-btn cursor-pointer rounded-xl bg-[#03c75a] px-4 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-[#02b34f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03c75a] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "처리 중…" : imported ? "결과 저장 완료" : "결과 가져오기 · 저장"}</button>
      </>}
      {props.error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-[13px] leading-relaxed text-red-700">{props.error}</p>}
      {props.notice && <p role="status" className="rounded-xl border border-[#03c75a]/15 bg-[#03c75a]/5 p-3.5 text-[13px] leading-relaxed text-[#027c39]">{props.notice}</p>}
    </section>
  );
}

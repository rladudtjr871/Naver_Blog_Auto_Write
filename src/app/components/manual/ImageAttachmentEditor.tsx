"use client";

import type { Dispatch, SetStateAction } from "react";
import { readImageMetadata, setImageDescription } from "@/lib/image-metadata";

type Props = { images: string[]; setImages: Dispatch<SetStateAction<string[]>>; disabled: boolean };

export function ImageAttachmentEditor({ images, setImages, disabled }: Props) {
  if (!images.length) return null;
  return <div className="space-y-2.5">
    <p className="px-0.5 text-[11px] leading-relaxed text-[#777]">사진마다 설명을 더하면 원하는 내용을 글에 담을 수 있어요.</p>
    {images.map((url, index) => {
      const metadata = readImageMetadata(url);
      return <div key={index} className="group rounded-xl border border-[#e4e8eb] bg-[#fafbfc] p-3.5 transition-colors focus-within:border-[#03c75a]/50 focus-within:bg-white">
        <div className="flex items-start gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-black/5 bg-[#f2f4f6]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url.split("#")[0]} alt={`사진 ${index + 1}`} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <span className="inline-flex rounded-md bg-[#03c75a]/10 px-2 py-0.5 text-[10px] font-bold text-[#027c39]">사진 {index + 1}</span>
          <p title={metadata.filename || undefined} className="mt-2 break-all text-xs font-semibold leading-relaxed text-[#333]">{metadata.filename || "원본 파일명 없음"}</p>
          {!metadata.filename && <p className="mt-1 text-[10px] leading-relaxed text-[#999]">사진 설명으로 어떤 이미지인지 알려주세요.</p>}
        </div>
        <button type="button" disabled={disabled} onClick={() => setImages(previous => previous.filter((_, imageIndex) => imageIndex !== index))} aria-label={`사진 ${index + 1} 삭제`} title="사진 삭제" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#9ba5ad] transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-[#03c75a] disabled:cursor-not-allowed disabled:opacity-40">
          <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" /></svg>
        </button>
        </div>
        <label className="mt-3 block">
          <span className="flex items-center justify-between gap-2 text-[11px] text-[#777]"><span className="font-bold">사진 설명 (선택)</span><span className="text-[10px] tabular-nums text-[#999]">{metadata.description.length}/500</span></span>
          <textarea rows={2} value={metadata.description} maxLength={500} disabled={disabled} placeholder="예: 통창 옆 자리에서 바라본 카페 내부. 따뜻하고 조용한 분위기" onChange={event => {
            const description = event.target.value;
            setImages(previous => previous.map((image, imageIndex) => imageIndex === index ? setImageDescription(image, description) : image));
          }} className="mt-1.5 block min-h-20 w-full resize-y rounded-lg border border-[#e4e8eb] bg-white px-3 py-2.5 text-xs leading-relaxed text-[#1e1e1e] outline-none transition-all placeholder:text-[#aaa] focus:border-[#03c75a] focus:ring-1 focus:ring-[#03c75a] disabled:cursor-not-allowed disabled:bg-[#f2f4f6] disabled:text-[#aaa]" />
        </label>
      </div>;
    })}
  </div>;
}

"use client";

import type { DocumentImage } from "@/lib/blog-document";
import { buildImageManifest, sortDocumentImages } from "@/lib/image-metadata";

export function PreparedImageAttachments({ images }: { images: DocumentImage[] }) {
  if (!images.length) return null;
  const orderedImages = sortDocumentImages(images);
  const manifest = buildImageManifest(orderedImages);
  return <div className="space-y-2.5 text-[14px]">
    <div className="flex items-center gap-2"><p className="font-bold text-[#333]">AI에 첨부할 사진</p><span className="rounded-md bg-[#03c75a]/10 px-2 py-0.5 text-[12px] font-bold text-[#027c39]">{images.length}개</span></div>
    <p className="text-[13px] leading-relaxed text-[#777]">사진을 내려받아 작성 요청과 함께 AI에 직접 첨부하세요. 내려받은 파일명을 그대로 사용해주세요.</p>
    {manifest.map(entry => {
      const image = orderedImages.find(item => item.id === entry.imageId)!;
      return <div key={entry.imageId} className="flex items-start gap-3 rounded-xl border border-[#e4e8eb] bg-[#fafbfc] p-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url.split("#")[0]} alt={`사진 ${entry.imageNumber}`} className="h-16 w-16 shrink-0 rounded-lg border border-black/5 object-cover" />
        <div className="min-w-0 flex-1">
          <span className="text-[12px] font-bold text-[#027c39]">사진 {entry.imageNumber}</span>
          <p className="mt-1 break-all text-[14px] font-semibold leading-relaxed text-[#333]">{entry.filename}</p>
          <p className="mt-1 break-all text-[12px] text-[#999]">원본: {entry.originalFilename || "파일명 없음"}</p>
          {entry.description && <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#777]">{entry.description}</p>}
          {!entry.originalFilename && <p className="mt-1 text-[12px] leading-relaxed text-[#999]">썸네일과 설명을 확인하고 첨부해주세요.</p>}
          <a href={image.url.split("#")[0]} download={entry.filename} className="mt-2.5 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#e4e8eb] bg-white px-2.5 py-1.5 text-[13px] font-bold text-[#555] transition-colors hover:border-[#03c75a] hover:bg-[#03c75a]/5 hover:text-[#027c39] focus-visible:outline-2 focus-visible:outline-[#03c75a]">
            <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m-4-4l4 4 4-4M5 16v4h14v-4" /></svg>
            사진 {entry.imageNumber} 다운로드
          </a>
        </div>
      </div>;
    })}
    <p className="text-[12px] leading-relaxed text-[#999]">사진은 AI에 자동 전송되지 않습니다. 첨부 순서 대신 파일명으로 사진을 연결합니다.</p>
  </div>;
}

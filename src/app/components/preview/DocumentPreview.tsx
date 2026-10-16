import { BlogDocument } from "@/lib/blog-document";

type Props = { document: BlogDocument; images: { id: string; url: string }[] };

export function DocumentPreview({ document, images }: Props) {
  return <article className="text-sm text-[#333] leading-8" aria-label="생성된 글 서식 미리보기">
    <h4 className="mb-5 rounded-xl bg-gray-50 p-4 text-lg font-bold whitespace-pre-wrap">{document.title}</h4>
    {document.blocks.map((block, index) => block.type === "paragraph"
      ? <p key={index} className="min-h-8 whitespace-pre-wrap break-words">{block.segments.map((segment, segmentIndex) => <span key={segmentIndex} style={{ fontWeight: segment.bold ? 700 : undefined, textDecoration: segment.underline ? "underline" : undefined, color: segment.color }}>{segment.text}</span>)}</p>
      : <figure key={index} className="my-4">{images.find(image => image.id === block.imageId)
        // Uploaded images use validated Data URLs; a plain img also supports legacy images.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={images.find(image => image.id === block.imageId)!.url} alt={`첨부 이미지 ${index + 1}`} className="max-w-full rounded-lg" />
        : <figcaption className="text-red-600">이미지 참조를 찾을 수 없습니다: {block.imageId}</figcaption>}</figure>)}
  </article>;
}

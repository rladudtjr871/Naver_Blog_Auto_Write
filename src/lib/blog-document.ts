import { readImageMetadata } from "./image-metadata.ts";

/** Versioned source of truth shared by generation, preview and export. */
export const BLOG_COLORS = ["#E53935", "#1565C0", "#00875A", "#6A1B9A"] as const;
export type BlogColor = typeof BLOG_COLORS[number];
export type TextSegment = { text: string; bold?: boolean; underline?: boolean; color?: BlogColor };
export type BlogBlock = { type: "paragraph"; segments: TextSegment[] } | { type: "image"; imageId: string };
export type BlogDocument = { version: 1; title: string; blocks: BlogBlock[] };
export type DocumentImage = { id: string; url: string; role?: string };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("문서 객체가 올바르지 않습니다.");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error("지원하지 않는 문서 속성입니다.");
}

export function validateBlogDocument(value: unknown, imageIds?: string[]): BlogDocument {
  const doc = record(value);
  keys(doc, ["version", "title", "blocks"]);
  if (doc.version !== 1) throw new Error("지원하지 않는 문서 버전입니다.");
  if (typeof doc.title !== "string" || !doc.title.trim() || doc.title.length > 300 || /[\r\n]/.test(doc.title)) throw new Error("제목이 올바르지 않습니다.");
  if (!Array.isArray(doc.blocks) || !doc.blocks.length || doc.blocks.length > 1000) throw new Error("본문 문단이 올바르지 않습니다.");
  let length = 0;
  const usedImages = new Set<string>();
  const blocks: BlogBlock[] = doc.blocks.map(value => {
    const block = record(value);
    if (block.type === "image") {
      keys(block, ["type", "imageId"]);
      if (typeof block.imageId !== "string" || !block.imageId || block.imageId.length > 100 || usedImages.has(block.imageId) || (imageIds && !imageIds.includes(block.imageId))) throw new Error("이미지 참조가 올바르지 않습니다.");
      usedImages.add(block.imageId);
      return { type: "image", imageId: block.imageId };
    }
    keys(block, ["type", "segments"]);
    if (block.type !== "paragraph" || !Array.isArray(block.segments) || block.segments.length > 500) throw new Error("텍스트 문단이 올바르지 않습니다.");
    const segments = block.segments.map(value => {
      const segment = record(value);
      keys(segment, ["text", "bold", "underline", "color"]);
      if (typeof segment.text !== "string" || /[\r\n]/.test(segment.text)) throw new Error("구간의 줄바꿈은 별도 문단으로 표현해 주세요.");
      for (const key of ["bold", "underline"]) if (segment[key] !== undefined && typeof segment[key] !== "boolean") throw new Error("서식 값이 올바르지 않습니다.");
      if (segment.color !== undefined && !BLOG_COLORS.includes(segment.color as BlogColor)) throw new Error("허용되지 않은 글자색입니다.");
      length += segment.text.length;
      if (length > 100_000) throw new Error("본문이 너무 깁니다.");
      return { text: segment.text, ...(segment.bold === undefined ? {} : { bold: segment.bold }), ...(segment.underline === undefined ? {} : { underline: segment.underline }), ...(segment.color === undefined ? {} : { color: segment.color }) } as TextSegment;
    });
    return { type: "paragraph", segments };
  });
  return { version: 1, title: doc.title, blocks };
}

export function imageName(image: DocumentImage): string {
  return readImageMetadata(image.url).filename || image.id;
}

/** No trim: preserve leading/trailing spaces and consecutive blank lines. */
export function legacyDocument(title: string | null, content: string | null, images: DocumentImage[] = []): BlogDocument {
  const used = new Set<string>();
  return {
    version: 1, title: title || "저장된 블로그 글",
    blocks: (content || "").split(/\r\n|\r|\n/).map(line => {
      const image = images.find((img, index) => !used.has(img.id) && (line === `[${imageName(img)}]` || line === `[IMAGE_PLACEHOLDER_${index + 1}]`));
      if (image) { used.add(image.id); return { type: "image", imageId: image.id }; }
      return { type: "paragraph", segments: [{ text: line }] };
    }),
  };
}

export function documentToText(document: BlogDocument, images: DocumentImage[] = []): string {
  return validateBlogDocument(document).blocks.map(block => block.type === "paragraph" ? block.segments.map(segment => segment.text).join("") : `[${images.find(image => image.id === block.imageId) ? imageName(images.find(image => image.id === block.imageId)!) : block.imageId}]`).join("\n");
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** Images are explicit markers, never misleading remote image attachments. */
export function documentToHtml(document: BlogDocument, images: DocumentImage[] = []): string {
  return validateBlogDocument(document).blocks.map(block => {
    if (block.type === "image") {
      const image = images.find(image => image.id === block.imageId);
      return `<p style="white-space:pre-wrap">[${escapeHtml(image ? imageName(image) : block.imageId)}]</p>`;
    }
    const content = block.segments.map(segment => {
      let html = escapeHtml(segment.text);
      if (segment.bold) html = `<strong>${html}</strong>`;
      if (segment.underline) html = `<u>${html}</u>`;
      if (segment.color) html = `<span style="color:${segment.color}">${html}</span>`;
      return html;
    }).join("");
    return `<p style="white-space:pre-wrap">${content || "<br>"}</p>`;
  }).join("");
}

export function parseGeneratedDocument(text: string, imageIds: string[]): BlogDocument {
  const json = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return validateBlogDocument(JSON.parse(json), imageIds);
}

import type { DocumentImage } from "./blog-document.ts";

export type ImageMetadata = { filename: string | null; description: string; position: number | null };

/** Legacy #name= values remain unchanged; extra fields belong to manual mode only. */
export function readImageMetadata(url: string): ImageMetadata {
  const fragment = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const params = new URLSearchParams(fragment);
  if (params.get("__manual") === "1") {
    const position = Number(params.get("position"));
    return {
      filename: params.get("name") || null,
      description: (params.get("description") || "").slice(0, 500),
      position: Number.isInteger(position) && position > 0 && position <= 1000 ? position : null,
    };
  }
  const match = url.match(/#name=(.*)$/);
  let filename: string | null = null;
  if (match) { try { filename = decodeURIComponent(match[1]) || null; } catch { /* Unknown legacy filename. */ } }
  return { filename, description: "", position: null };
}

function writeManualMetadata(url: string, metadata: ImageMetadata): string {
  const params = new URLSearchParams();
  params.set("name", metadata.filename || "");
  params.set("__manual", "1");
  if (metadata.position !== null) params.set("position", String(metadata.position));
  if (metadata.description) params.set("description", metadata.description.slice(0, 500));
  return `${url.split("#")[0]}#${params.toString()}`;
}

export function setImageDescription(url: string, description: string): string {
  return writeManualMetadata(url, { ...readImageMetadata(url), description: description.slice(0, 500) });
}

/** Called only by the subscription composer, not the API generation/draft flow. */
export function prepareImageUrls(urls: string[]): string[] {
  return urls.map((url, index) => writeManualMetadata(url, { ...readImageMetadata(url), position: index + 1 }));
}

export function sortDocumentImages<T extends DocumentImage>(images: T[]): T[] {
  return images.map((image, index) => ({ image, index, position: readImageMetadata(image.url).position }))
    .sort((a, b) => (a.position ?? a.index + 1) - (b.position ?? b.index + 1) || a.index - b.index)
    .map(item => item.image);
}

export type ImageManifestEntry = { imageId: string; imageNumber: number; originalFilename: string | null; filename: string; description: string };

/** Download names use actual encoded image MIME, not the original file extension. */
export function buildImageManifest(images: DocumentImage[]): ImageManifestEntry[] {
  return sortDocumentImages(images).map((image, index) => {
    const metadata = readImageMetadata(image.url);
    const originalFilename = metadata.filename && metadata.filename !== image.id ? metadata.filename : null;
    const mime = image.url.match(/^data:image\/(jpeg|png|webp|gif);base64,/i)?.[1]?.toLowerCase();
    const extension = mime === "jpeg" ? "jpg" : mime || "jpg";
    const stem = (originalFilename || "사진").replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/, "").slice(0, 70) || "사진";
    return {
      imageId: image.id, imageNumber: index + 1, originalFilename,
      filename: `${String(index + 1).padStart(2, "0")}-${stem}.${extension}`,
      description: metadata.description,
    };
  });
}

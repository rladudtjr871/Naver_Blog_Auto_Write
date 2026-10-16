import { supabaseAdmin } from "./supabase-admin";
import { decrypt } from "./crypto";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { documentToText, parseGeneratedDocument, type DocumentImage } from "./blog-document";
import { BLOG_SYSTEM_PROMPT, buildBlogUserPrompt } from "./blog-prompt";
import { describeGenerationError, withGeminiRetry, type GenerationStage } from "./generation-error";

/** Called inside Next.js after(), with a finite model timeout below route maxDuration. */
export async function generateBlogContent(postId: string, provider: string, guideText: string) {
  let stage: GenerationStage = "loading";
  try {
    const { data: post, error: postError } = await supabaseAdmin.from("BlogPost")
      .select("userId, place, images:Image(id,url,role)").eq("id", postId).single();
    if (postError || !post) throw new Error("생성할 글을 조회하지 못했습니다.");
    const { error: statusError } = await supabaseAdmin.from("BlogPost")
      .update({ status: "PROCESSING", updatedAt: new Date().toISOString() }).eq("id", postId);
    if (statusError) throw new Error("생성 상태를 저장하지 못했습니다.");

    const dbProvider = provider.toLowerCase().startsWith("gemini") ? "GEMINI" : "OPENAI";
    stage = "credentials";
    const { data: keyRecord, error: keyError } = await supabaseAdmin.from("ApiKey")
      .select("encryptedKey").eq("userId", post.userId).eq("provider", dbProvider).maybeSingle();
    if (keyError || !keyRecord) throw new Error(`${dbProvider} API Key를 먼저 등록해주세요.`);
    const apiKey = decrypt(keyRecord.encryptedKey);
    stage = "loading";
    const { data: references, error: referenceError } = await supabaseAdmin.from("ReferencePost")
      .select("title, content").eq("blogPostId", postId);
    if (referenceError) throw new Error("참고 글을 조회하지 못했습니다.");
    const images = (post.images || []) as DocumentImage[];
    const prompt = buildBlogUserPrompt(
      references?.find(ref => ref.title === "주제")?.content || guideText,
      post.place,
      references?.filter(ref => ref.title !== "주제").map(ref => ref.content) || [],
      images,
    );
    let raw: string;
    stage = "provider";
    if (dbProvider === "OPENAI") {
      const client = new OpenAI({ apiKey, timeout: 210_000, maxRetries: 0 });
      const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: prompt }];
      for (const image of images) {
        const data = image.url.split("#")[0];
        if (/^data:image\/(jpeg|png|webp|gif);base64,/.test(data)) content.push({ type: "image_url", image_url: { url: data } });
      }
      const result = await client.chat.completions.create({
        model: "gpt-4o", response_format: { type: "json_object" },
        messages: [{ role: "system", content: BLOG_SYSTEM_PROMPT }, { role: "user", content }], temperature: 0.7,
      });
      raw = result.choices[0]?.message?.content || "";
    } else {
      const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: provider.toLowerCase().startsWith("gemini-") ? provider.toLowerCase() : "gemini-2.5-flash",
        systemInstruction: BLOG_SYSTEM_PROMPT,
        generationConfig: { responseMimeType: "application/json" },
      }, { timeout: 210_000 });
      const parts: ({ text: string } | { inlineData: { data: string; mimeType: string } })[] = [{ text: prompt }];
      for (const image of images) {
        const match = image.url.split("#")[0].match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
        if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
      const result = await withGeminiRetry(timeout => model.generateContent({ contents: [{ role: "user", parts }] }, { timeout }));
      raw = result.response.text();
    }
    stage = "document";
    const document = parseGeneratedDocument(raw, images.map(image => image.id));
    const content = documentToText(document, images);
    if (!document.blocks.some(block => block.type === "paragraph" && block.segments.some(segment => segment.text.trim()))) throw new Error("AI 본문이 비어 있습니다.");
    const referenced = new Set(document.blocks.filter(block => block.type === "image").map(block => block.imageId));
    if (images.some(image => !referenced.has(image.id))) throw new Error("AI 결과에서 첨부 이미지 위치가 누락되었습니다. 다시 생성해주세요.");
    stage = "storage";
    const { error } = await supabaseAdmin.from("BlogPost").update({
      title: document.title, content, document, status: "COMPLETED", errorMessage: null, updatedAt: new Date().toISOString(),
    }).eq("id", postId);
    if (error) throw new Error("서식 문서 저장에 실패했습니다. DB 마이그레이션과 연결 상태를 확인해주세요.");
  } catch (error: unknown) {
    // Do not log SDK exception objects: they may contain provider credentials/headers.
    const failure = describeGenerationError(error, stage, provider);
    console.warn("Blog generation failed", { postId, provider: provider.toLowerCase().startsWith("gemini") ? "GEMINI" : "OPENAI", stage: failure.stage, kind: failure.kind, status: failure.status });
    const { error: saveError } = await supabaseAdmin.from("BlogPost").update({ status: "FAILED", errorMessage: failure.message, updatedAt: new Date().toISOString() }).eq("id", postId);
    if (saveError) console.error("Generation failure status could not be persisted", { postId });
  }
}

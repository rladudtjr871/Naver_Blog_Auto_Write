import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateBlogContent } from "@/lib/generator";
import { getAuthUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let createdPostId: string | undefined;
  try {
    const user = await getAuthUser(request);

    const body = await request.json();
    const { category, subject, references, images, model, place, isDraft } = body;

    if (typeof subject !== "string" || !subject.trim() || subject.length > 20_000) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    const aiModel = model || "OPENAI";
    if (typeof aiModel !== "string" || !(aiModel === "OPENAI" || aiModel === "GEMINI" || /^gemini-[a-z0-9.-]+$/.test(aiModel))) {
      return NextResponse.json({ error: "지원하지 않는 AI 모델입니다." }, { status: 400 });
    }
    if ((category !== undefined && (typeof category !== "string" || category.length > 50)) ||
        (place !== undefined && (typeof place !== "string" || place.length > 1000)) ||
        (references !== undefined && (!Array.isArray(references) || references.length > 20 || references.some((ref: unknown) => typeof ref !== "string" || ref.length > 30_000))) ||
        (images !== undefined && (!Array.isArray(images) || images.length > 20 || images.some((img: unknown) => {
          const url = typeof img === "string" ? img : img && typeof img === "object" ? (img as { url?: unknown }).url : null;
          return typeof url !== "string" || !/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+(?:#name=[^\r\n]*)?$/.test(url) || url.length > 3_000_000;
        }))) || (isDraft !== undefined && typeof isDraft !== "boolean")) {
      return NextResponse.json({ error: "입력 형식 또는 첨부 제한을 확인해주세요. 이미지는 최대 20개입니다." }, { status: 400 });
    }
    if (JSON.stringify(body).length > 4_000_000) return NextResponse.json({ error: "첨부 이미지가 너무 큽니다. 이미지 수를 줄여주세요." }, { status: 413 });
    if (!isDraft) {
      const provider = aiModel.toLowerCase().startsWith("gemini") ? "GEMINI" : "OPENAI";
      const { data: key, error: keyError } = await supabaseAdmin.from("ApiKey").select("id").eq("userId", user.id).eq("provider", provider).maybeSingle();
      if (keyError || !key) return NextResponse.json({ error: `${provider} API Key를 먼저 등록해주세요.` }, { status: 400 });
      if (!process.env.ENCRYPTION_KEY || Buffer.byteLength(process.env.ENCRYPTION_KEY) < 32) return NextResponse.json({ error: "서버 ENCRYPTION_KEY 설정이 필요합니다." }, { status: 503 });
      // Fail before incurring an AI charge if the required JSONB migration is missing.
      const { error: schemaError } = await supabaseAdmin.from("BlogPost").select("document").limit(0);
      if (schemaError) return NextResponse.json({ error: "서식 문서 DB 마이그레이션을 먼저 적용해주세요." }, { status: 503 });
    }

    // 1. Create BlogPost record (PENDING or DRAFT)
    const { data: blogPost, error: postError } = await supabaseAdmin
      .from("BlogPost")
      .insert({
        userId: user.id,
        status: isDraft ? "DRAFT" : "PENDING",
        place: place ? place.trim() : null,
      })
      .select()
      .single();

    if (postError || !blogPost) {
      throw postError || new Error("Failed to create BlogPost");
    }
    createdPostId = blogPost.id;

    // 2. Create ReferencePost records (Subject + Examples)
    const referenceRecords = [
      {
        userId: user.id,
        blogPostId: blogPost.id,
        title: "주제",
        content: `[카테고리: ${category || "맛집"}] ${subject}`,
      },
      ...(references || [])
        .map((ref: string, index: number) => ({
          userId: user.id,
          blogPostId: blogPost.id,
          title: `예시 블로그 ${index + 1}`,
          content: ref,
        }))
        .filter((ref: { content: string }) => ref.content && ref.content.trim())
    ];

    const { error: refError } = await supabaseAdmin
      .from("ReferencePost")
      .insert(referenceRecords);

    if (refError) {
      throw refError;
    }

    // 3. Create Image records if provided
    if (images && Array.isArray(images) && images.length > 0) {
      const imageData = images.map((img: string | { url: string; role?: string }) => ({
        blogPostId: blogPost.id,
        url: typeof img === "string" ? img : img.url,
        role: typeof img === "object" && img.role === "REFERENCE" ? "REFERENCE" : "INCLUDED",
      }));

      const { error: imgError } = await supabaseAdmin
        .from("Image")
        .insert(imageData);

      if (imgError) {
        throw imgError;
      }
    }

    // 4. Trigger AI Generation asynchronously (only if not a draft)
    if (!isDraft) {
      after(() => generateBlogContent(blogPost.id, aiModel, subject));
    }

    // 5. Instantly respond
    return NextResponse.json(
      { postId: blogPost.id, status: isDraft ? "DRAFT" : "PENDING" },
      { status: 202 }
    );
  } catch (error: unknown) {
    if (createdPostId) {
      await supabaseAdmin.from("BlogPost").update({ status: "FAILED", errorMessage: "입력 정보 저장에 실패했습니다. 다시 시도해주세요.", updatedAt: new Date().toISOString() }).eq("id", createdPostId);
    }
    return apiError(error, "글 저장에 실패했습니다. DB 연결과 마이그레이션을 확인해주세요.");
  }
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);

    const { data: posts, error } = await supabaseAdmin
      .from("BlogPost")
      .select("id,title,status,errorMessage,createdAt,updatedAt,referencePosts:ReferencePost(title,content)")
      .eq("userId", user.id)
      .eq("referencePosts.title", "주제")
      .order("createdAt", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json(posts, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return apiError(error, "글 목록을 조회하지 못했습니다.");
  }
}

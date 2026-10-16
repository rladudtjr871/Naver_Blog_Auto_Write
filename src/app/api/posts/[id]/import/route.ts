import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";
import { documentToText, type DocumentImage } from "@/lib/blog-document";
import { parseSubscriptionResponse } from "@/lib/subscription-workflow";

/** Save a user-supplied document; never calls an AI provider. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "글 ID가 올바르지 않습니다." }, { status: 400 });
    const { data: post, error: fetchError } = await supabaseAdmin.from("BlogPost")
      .select("id,userId,status,images:Image(id,url,role)").eq("id", id).maybeSingle();
    if (fetchError) return NextResponse.json({ error: "저장할 글을 조회하지 못했습니다." }, { status: 500 });
    if (!post) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
    if (post.userId !== user.id) return NextResponse.json({ error: "본인의 글만 가져올 수 있습니다." }, { status: 403 });
    if (post.status !== "DRAFT") return NextResponse.json({ error: "이미 완료되었거나 생성 중인 글은 덮어쓰지 않습니다. 새 작성 요청을 준비해주세요." }, { status: 409 });
    let body: unknown;
    try {
      if (Number(request.headers.get("content-length")) > 6_100_000) return NextResponse.json({ error: "가져올 결과가 너무 큽니다." }, { status: 413 });
      const text = await request.text();
      if (text.length > 6_100_000) return NextResponse.json({ error: "가져올 결과가 너무 큽니다." }, { status: 413 });
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "가져오기 요청 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const images = (post.images || []) as DocumentImage[];
    let document;
    try {
      const responseText = body && typeof body === "object" ? (body as { responseText?: unknown }).responseText : undefined;
      document = parseSubscriptionResponse(responseText, images);
    } catch (error) {
      // Parser messages are curated locally; do not echo malformed AI output.
      return NextResponse.json({ error: error instanceof Error ? error.message : "AI 결과의 문서 형식을 확인해주세요." }, { status: 400 });
    }
    const { data: saved, error: saveError } = await supabaseAdmin.from("BlogPost").update({
      title: document.title, content: documentToText(document, images), document,
      status: "COMPLETED", errorMessage: null, updatedAt: new Date().toISOString(),
    }).eq("id", id).eq("userId", user.id).eq("status", "DRAFT").select("id").maybeSingle();
    if (saveError) return NextResponse.json({ error: "결과 저장에 실패했습니다. 서식 문서 DB 마이그레이션과 연결 상태를 확인해주세요." }, { status: 500 });
    if (!saved) return NextResponse.json({ error: "다른 요청에서 이미 저장한 글입니다. 저장 내역을 확인해주세요." }, { status: 409 });
    return NextResponse.json({ postId: saved.id, status: "COMPLETED" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "AI 결과를 저장하지 못했습니다.");
  }
}

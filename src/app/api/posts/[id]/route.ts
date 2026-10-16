import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import { legacyDocument, validateBlogDocument } from "@/lib/blog-document";
import { apiError } from "@/lib/api-error";

type ReferenceRecord = { title: string | null; content: string };
type ImageRecord = { id: string; url: string; role: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    const { data: post, error } = await supabaseAdmin
      .from("BlogPost")
      .select("*, images:Image(*), referencePosts:ReferencePost(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Ownership check (Method B isolation)
    if (post.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this post" }, { status: 403 });
    }

    // An interrupted platform invocation must not leave clients polling forever.
    if (["PENDING", "PROCESSING"].includes(post.status) && Date.now() - Date.parse(post.updatedAt || post.createdAt) > 360_000) {
      post.status = "FAILED";
      post.errorMessage = "생성 작업의 제한 시간을 초과했습니다. 다시 생성해주세요.";
      await supabaseAdmin.from("BlogPost").update({ status: post.status, errorMessage: post.errorMessage, updatedAt: new Date().toISOString() }).eq("id", id).eq("userId", user.id).in("status", ["PENDING", "PROCESSING"]);
    }
    const document = post.status === "COMPLETED"
      ? post.document == null ? legacyDocument(post.title, post.content, post.images || []) : validateBlogDocument(post.document, (post.images || []).map((image: { id: string }) => image.id))
      : null;

    // Extract subject, category and references from ReferencePost records
    const referencePosts = post.referencePosts || [];
    const topicRecord = referencePosts.find((r: ReferenceRecord) => r.title === "주제");
    let category = "맛집";
    let subject = "";
    
    if (topicRecord && topicRecord.content) {
      const match = topicRecord.content.match(/^\[카테고리:\s*([^\]]+)\]\s*([\s\S]*)$/);
      if (match) {
        category = match[1];
        subject = match[2];
      } else {
        subject = topicRecord.content;
      }
    }

    const references = referencePosts
      .filter((r: ReferenceRecord) => r.title !== "주제")
      .map((r: ReferenceRecord) => r.content);

    return NextResponse.json({
      postId: post.id,
      status: post.status,
      title: post.title,
      content: post.content,
      document,
      place: post.place,
      category,
      subject,
      references: references.length > 0 ? references : [""],
      errorMessage: post.errorMessage,
      images: (post.images || []).map((img: ImageRecord) => ({
        id: img.id,
        url: img.url,
        role: img.role,
      })),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return apiError(error, "글을 조회하지 못했습니다. 연결 상태와 저장된 문서 형식을 확인해주세요.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    // 1. Fetch post to check ownership
    const { data: post, error: fetchError } = await supabaseAdmin
      .from("BlogPost")
      .select("userId")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this post" }, { status: 403 });
    }

    // 2. Delete linked ReferencePost rows first since they are ON DELETE SET NULL
    await supabaseAdmin
      .from("ReferencePost")
      .delete()
      .eq("blogPostId", id);

    // 3. Delete BlogPost (cascades to Image)
    const { error: deleteError } = await supabaseAdmin
      .from("BlogPost")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ message: "Post deleted successfully" });
  } catch (error: unknown) {
    return apiError(error, "글을 삭제하지 못했습니다.");
  }
}

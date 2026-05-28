import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

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

    // Extract subject, category and references from ReferencePost records
    const referencePosts = post.referencePosts || [];
    const topicRecord = referencePosts.find((r: any) => r.title === "주제");
    let category = "맛집";
    let subject = "";
    
    if (topicRecord && topicRecord.content) {
      const match = topicRecord.content.match(/^\[카테고리:\s*([^\]]+)\]\s*(.*)$/);
      if (match) {
        category = match[1];
        subject = match[2];
      } else {
        subject = topicRecord.content;
      }
    }

    const references = referencePosts
      .filter((r: any) => r.title !== "주제")
      .map((r: any) => r.content);

    return NextResponse.json({
      postId: post.id,
      status: post.status,
      title: post.title,
      content: post.content,
      place: post.place,
      category,
      subject,
      references: references.length > 0 ? references : [""],
      errorMessage: post.errorMessage,
      images: (post.images || []).map((img: any) => ({
        id: img.id,
        url: img.url,
        role: img.role,
      })),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    });
  } catch (error: any) {
    console.error("Fetch single post error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
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
  } catch (error: any) {
    console.error("Delete post error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

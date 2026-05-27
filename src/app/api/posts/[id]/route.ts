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
      .select("*, images:Image(*)")
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

    return NextResponse.json({
      postId: post.id,
      status: post.status,
      title: post.title,
      content: post.content,
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

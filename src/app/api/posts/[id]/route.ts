import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    const { data: post, error } = await supabase
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
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

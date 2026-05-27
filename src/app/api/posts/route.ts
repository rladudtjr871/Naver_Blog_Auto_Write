import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateBlogContent } from "@/lib/generator";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);

    const body = await request.json();
    const { category, subject, references, images, model } = body;

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    const aiModel = model || "OPENAI";

    // 1. Delete any existing ReferencePosts and BlogPosts of this user (keeps max 1 temporary post per user)
    const { error: deleteRefError } = await supabaseAdmin
      .from("ReferencePost")
      .delete()
      .eq("userId", user.id);

    if (deleteRefError) {
      console.error("Failed to delete existing ReferencePosts:", deleteRefError);
    }

    const { error: deletePostError } = await supabaseAdmin
      .from("BlogPost")
      .delete()
      .eq("userId", user.id);

    if (deletePostError) {
      console.error("Failed to delete existing BlogPosts:", deletePostError);
    }

    // 2. Create BlogPost record (PENDING)
    const { data: blogPost, error: postError } = await supabaseAdmin
      .from("BlogPost")
      .insert({
        userId: user.id,
        status: "PENDING",
      })
      .select()
      .single();

    if (postError || !blogPost) {
      throw postError || new Error("Failed to create BlogPost");
    }

    // 3. Create ReferencePost records (Subject + Examples)
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
        .filter((ref: any) => ref.content && ref.content.trim())
    ];

    const { error: refError } = await supabaseAdmin
      .from("ReferencePost")
      .insert(referenceRecords);

    if (refError) {
      throw refError;
    }

    // 4. Create Image records if provided
    if (images && Array.isArray(images) && images.length > 0) {
      const imageData = images.map((img: any) => ({
        blogPostId: blogPost.id,
        url: typeof img === "string" ? img : img.url,
        role: (typeof img === "object" && img.role) ? img.role : "INCLUDED",
      }));

      const { error: imgError } = await supabaseAdmin
        .from("Image")
        .insert(imageData);

      if (imgError) {
        throw imgError;
      }
    }

    // 5. Trigger AI Generation asynchronously
    generateBlogContent(blogPost.id, aiModel, subject).catch((err) => {
      console.error("Asynchronous generation background trigger failed:", err);
    });

    // 6. Instantly respond 202 Accepted
    return NextResponse.json(
      { postId: blogPost.id, status: "PENDING" },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Create Blog Post error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);

    const { data: posts, error } = await supabaseAdmin
      .from("BlogPost")
      .select("*, images:Image(*)")
      .eq("userId", user.id)
      .order("createdAt", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json(posts);
  } catch (error: any) {
    console.error("Fetch blog posts error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

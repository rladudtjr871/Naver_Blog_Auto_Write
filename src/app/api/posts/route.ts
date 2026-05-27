import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateBlogContent } from "@/lib/generator";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);

    const body = await request.json();
    const { guideText, images, model } = body;

    if (!guideText || !guideText.trim()) {
      return NextResponse.json({ error: "Guide text is required" }, { status: 400 });
    }

    const aiModel = model || "OPENAI";

    // 1. Create BlogPost record (PENDING)
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

    // 2. Create ReferencePost record link
    const { error: refError } = await supabaseAdmin
      .from("ReferencePost")
      .insert({
        userId: user.id,
        blogPostId: blogPost.id,
        content: guideText,
      });

    if (refError) {
      throw refError;
    }

    // 3. Create Image records if provided
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

    // 4. Trigger AI Generation asynchronously
    generateBlogContent(blogPost.id, aiModel, guideText).catch((err) => {
      console.error("Asynchronous generation background trigger failed:", err);
    });

    // 5. Instantly respond 202 Accepted
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

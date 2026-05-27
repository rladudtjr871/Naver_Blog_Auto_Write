import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateBlogContent } from "@/lib/generator";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

async function ensureDemoUser() {
  const { data: user, error } = await supabase
    .from("User")
    .select("id")
    .eq("id", DEMO_USER_ID)
    .maybeSingle();

  if (error) {
    console.error("Error checking demo user:", error);
    throw error;
  }

  if (!user) {
    const { error: insertError } = await supabase
      .from("User")
      .insert({
        id: DEMO_USER_ID,
        email: "demo@blogautowrite.com",
      });

    if (insertError) {
      console.error("Error creating demo user:", insertError);
      throw insertError;
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { guideText, images, model } = body;

    if (!guideText || !guideText.trim()) {
      return NextResponse.json({ error: "Guide text is required" }, { status: 400 });
    }

    const aiModel = model || "OPENAI";

    await ensureDemoUser();

    // 1. Create BlogPost record (PENDING)
    const { data: blogPost, error: postError } = await supabase
      .from("BlogPost")
      .insert({
        userId: DEMO_USER_ID,
        status: "PENDING",
      })
      .select()
      .single();

    if (postError || !blogPost) {
      throw postError || new Error("Failed to create BlogPost");
    }

    // 2. Create ReferencePost record link
    const { error: refError } = await supabase
      .from("ReferencePost")
      .insert({
        userId: DEMO_USER_ID,
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

      const { error: imgError } = await supabase
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
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensureDemoUser();

    const { data: posts, error } = await supabase
      .from("BlogPost")
      .select("*, images:Image(*)")
      .eq("userId", DEMO_USER_ID)
      .order("createdAt", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json(posts);
  } catch (error: any) {
    console.error("Fetch blog posts error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

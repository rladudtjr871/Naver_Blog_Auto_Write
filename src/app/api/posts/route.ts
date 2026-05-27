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

    // 2. Create ReferencePost records (Subject + Examples)
    const referenceRecords = [];
    
    referenceRecords.push({
      userId: user.id,
      blogPostId: blogPost.id,
      title: "주제",
      content: `[카테고리: ${category || "맛집"}] ${subject}`,
    });

    if (references && Array.isArray(references)) {
      for (let i = 0; i < references.length; i++) {
        const ref = references[i]?.trim();
        if (!ref) continue;

        let contentToSave = ref;

        if (ref.startsWith("http://") || ref.startsWith("https://")) {
          if (ref.includes("blog.naver.com")) {
            try {
              const crawledText = await crawlNaverBlog(ref);
              if (crawledText) {
                contentToSave = `[Naver Blog Link: ${ref}]\n\n${crawledText}`;
              }
            } catch (crawlErr) {
              console.error(`Failed to crawl Naver Blog URL: ${ref}`, crawlErr);
            }
          }
        }

        referenceRecords.push({
          userId: user.id,
          blogPostId: blogPost.id,
          title: `예시 블로그 ${i + 1}`,
          content: contentToSave,
        });
      }
    }

    const { error: refError } = await supabaseAdmin
      .from("ReferencePost")
      .insert(referenceRecords);

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
    generateBlogContent(blogPost.id, aiModel, subject).catch((err) => {
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

/**
 * Crawls Naver Blog post content asynchronously
 */
async function crawlNaverBlog(url: string): Promise<string | null> {
  const details = parseNaverBlogUrl(url);
  if (!details) return null;

  const mobileUrl = `https://m.blog.naver.com/${details.blogId}/${details.logNo}`;
  
  try {
    const res = await fetch(mobileUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36"
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractBlogText(html);
  } catch (err) {
    console.error("crawlNaverBlog error:", err);
    return null;
  }
}

/**
 * Extracts blogId and logNo from Naver Blog URL
 */
function parseNaverBlogUrl(url: string): { blogId: string; logNo: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("blog.naver.com")) return null;

    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length === 2 && !pathParts[0].includes(".")) {
      return { blogId: pathParts[0], logNo: pathParts[1] };
    }

    const blogId = parsed.searchParams.get("blogId");
    const logNo = parsed.searchParams.get("logNo");
    if (blogId && logNo) {
      return { blogId, logNo };
    }
  } catch (e) {
    const match = url.match(/blog\.naver\.com\/([a-zA-Z0-9_-]+)\/([0-9]+)/);
    if (match) {
      return { blogId: match[1], logNo: match[2] };
    }
  }
  return null;
}

/**
 * Extracts text elements from Naver mobile blog HTML
 */
function extractBlogText(html: string): string {
  let containerHtml = "";
  
  const containerMatch = html.match(/<div[^>]*class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
  if (containerMatch) {
    containerHtml = containerMatch[1];
  } else {
    const postViewMatch = html.match(/<div[^>]*id="postViewArea"[^>]*>([\s\S]*?)<\/div>/);
    if (postViewMatch) {
      containerHtml = postViewMatch[1];
    } else {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
      if (bodyMatch) {
        containerHtml = bodyMatch[1];
      } else {
        containerHtml = html;
      }
    }
  }

  const textMatches = containerHtml.match(/<span[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/span>|<p[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g);
  
  if (textMatches && textMatches.length > 0) {
    return textMatches
      .map(tag => {
        return tag
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .trim();
      })
      .filter(Boolean)
      .join("\n");
  }

  const cleanHtml = containerHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

  return cleanHtml;
}

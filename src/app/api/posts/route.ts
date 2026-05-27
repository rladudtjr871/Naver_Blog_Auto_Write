import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBlogContent } from "@/lib/generator";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

async function ensureDemoUser() {
  const user = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
  });
  if (!user) {
    await prisma.user.create({
      data: {
        id: DEMO_USER_ID,
        email: "demo@blogautowrite.com",
      },
    });
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
    const blogPost = await prisma.blogPost.create({
      data: {
        userId: DEMO_USER_ID,
        status: "PENDING",
      },
    });

    // 2. Create ReferencePost record link
    await prisma.referencePost.create({
      data: {
        userId: DEMO_USER_ID,
        blogPostId: blogPost.id,
        content: guideText,
      },
    });

    // 3. Create Image records if provided
    if (images && Array.isArray(images) && images.length > 0) {
      const imageData = images.map((img: any) => ({
        blogPostId: blogPost.id,
        url: typeof img === "string" ? img : img.url,
        role: (typeof img === "object" && img.role) ? img.role : "INCLUDED",
      }));

      await prisma.image.createMany({
        data: imageData,
      });
    }

    // 4. Trigger AI Generation asynchronously (Vercel Serverless background execution)
    // We intentionally DO NOT await this promise to return response instantly (within 10s)
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

    const posts = await prisma.blogPost.findMany({
      where: { userId: DEMO_USER_ID },
      include: {
        images: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(posts);
  } catch (error: any) {
    console.error("Fetch blog posts error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

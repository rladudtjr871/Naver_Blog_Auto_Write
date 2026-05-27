import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        images: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({
      postId: post.id,
      status: post.status,
      title: post.title,
      content: post.content,
      errorMessage: post.errorMessage,
      images: post.images.map((img: { id: string; url: string; role: string }) => ({
        id: img.id,
        url: img.url,
        role: img.role,
      })),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Fetch single post error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

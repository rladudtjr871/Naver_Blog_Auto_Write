import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);

    // Fetch user profile from public."User" table
    const { data: userProfile, error: selectError } = await supabaseAdmin
      .from("User")
      .select("email, naverBlogId")
      .eq("id", user.id)
      .single();

    if (selectError) {
      throw selectError;
    }

    return NextResponse.json({
      email: userProfile?.email || user.email,
      naverBlogId: userProfile?.naverBlogId || "",
    });
  } catch (error: any) {
    console.error("Fetch profile error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);

    const body = await request.json();
    const { naverBlogId } = body;

    if (naverBlogId === undefined) {
      return NextResponse.json(
        { error: "naverBlogId is required" },
        { status: 400 }
      );
    }

    // 1. Update public."User" table
    const { error: dbError } = await supabaseAdmin
      .from("User")
      .update({
        naverBlogId: naverBlogId.trim(),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (dbError) {
      throw dbError;
    }

    // 2. Update Supabase Auth user metadata
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          naverBlogId: naverBlogId.trim(),
        },
      }
    );

    if (authError) {
      console.warn("Failed to sync naverBlogId to auth user metadata:", authError.message);
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      naverBlogId: naverBlogId.trim(),
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

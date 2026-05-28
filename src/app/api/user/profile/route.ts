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

    // Fetch default references
    const { data: defaultRefs, error: refsError } = await supabaseAdmin
      .from("DefaultReference")
      .select("content")
      .eq("userId", user.id)
      .order("createdAt", { ascending: true });

    if (refsError) {
      throw refsError;
    }

    return NextResponse.json({
      email: userProfile?.email || user.email,
      naverBlogId: userProfile?.naverBlogId || "",
      defaultReferences: defaultRefs ? defaultRefs.map((r: any) => r.content) : [],
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
    const { naverBlogId, defaultReferences } = body;

    if (naverBlogId === undefined && defaultReferences === undefined) {
      return NextResponse.json(
        { error: "naverBlogId or defaultReferences is required" },
        { status: 400 }
      );
    }

    // 1. Update public."User" table if naverBlogId is provided
    if (naverBlogId !== undefined) {
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
    }

    // 3. Update DefaultReference table if defaultReferences is provided
    if (defaultReferences !== undefined && Array.isArray(defaultReferences)) {
      const cleanedRefs = defaultReferences.map(r => r.trim()).filter(Boolean);

      // Delete existing
      const { error: deleteError } = await supabaseAdmin
        .from("DefaultReference")
        .delete()
        .eq("userId", user.id);

      if (deleteError) {
        throw deleteError;
      }

      // Insert new if any
      if (cleanedRefs.length > 0) {
        const insertData = cleanedRefs.map(content => ({
          userId: user.id,
          content: content,
          updatedAt: new Date().toISOString()
        }));

        const { error: insertError } = await supabaseAdmin
          .from("DefaultReference")
          .insert(insertData);

        if (insertError) {
          throw insertError;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      naverBlogId: naverBlogId?.trim(),
      defaultReferences: defaultReferences,
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

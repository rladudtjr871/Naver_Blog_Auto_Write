import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { encrypt } from "@/lib/crypto";
import { getAuthUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);

    const body = await request.json();
    const { provider, apiKey } = body;

    if (typeof provider !== "string" || !["OPENAI", "GEMINI"].includes(provider.toUpperCase()) || typeof apiKey !== "string" || !apiKey.trim() || apiKey.length > 500) {
      return NextResponse.json(
        { error: "Provider and API Key are required" },
        { status: 400 }
      );
    }

    const upperProvider = provider.toUpperCase();

    // Encrypt the key safely (Secure Mode)
    const encryptedKey = encrypt(apiKey);

    // Upsert key (conflict on unique userId & provider)
    const { error: upsertError } = await supabaseAdmin
      .from("ApiKey")
      .upsert({
        userId: user.id,
        provider: upperProvider,
        encryptedKey: encryptedKey,
        updatedAt: new Date().toISOString(),
      }, { onConflict: "userId,provider" });

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ success: true, message: "API Key registered successfully" });
  } catch (error: unknown) {
    return apiError(error, "API Key 저장에 실패했습니다. DB 연결과 암호화 설정을 확인해주세요.");
  }
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);

    const { data: keys, error } = await supabaseAdmin
      .from("ApiKey")
      .select("provider, updatedAt")
      .eq("userId", user.id);

    if (error) {
      throw error;
    }

    // Map to readable form without exposing raw keys
    const result = (keys || []).map((key: { provider: string; updatedAt: string }) => ({
      provider: key.provider,
      hasKey: true,
      updatedAt: key.updatedAt,
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    return apiError(error, "API Key 등록 상태를 조회하지 못했습니다.");
  }
}

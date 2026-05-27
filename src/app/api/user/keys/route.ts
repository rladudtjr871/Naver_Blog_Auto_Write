import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);

    const body = await request.json();
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
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
      });

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ success: true, message: "API Key registered successfully" });
  } catch (error: any) {
    console.error("API Key registration error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
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
    const result = (keys || []).map((key: any) => ({
      provider: key.provider,
      hasKey: true,
      updatedAt: key.updatedAt,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Fetch API Keys error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

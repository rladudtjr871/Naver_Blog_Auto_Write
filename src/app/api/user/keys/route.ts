import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";

// Fallback user ID for demo purposes without complex auth integration
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
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Provider and API Key are required" },
        { status: 400 }
      );
    }

    const upperProvider = provider.toUpperCase();

    // Ensure demo user exists in DB first
    await ensureDemoUser();

    // Encrypt the key safely (Secure Mode)
    const encryptedKey = encrypt(apiKey);

    // Upsert key (conflict on unique userId & provider)
    const { error: upsertError } = await supabase
      .from("ApiKey")
      .upsert({
        userId: DEMO_USER_ID,
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
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensureDemoUser();

    const { data: keys, error } = await supabase
      .from("ApiKey")
      .select("provider, updatedAt")
      .eq("userId", DEMO_USER_ID);

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
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

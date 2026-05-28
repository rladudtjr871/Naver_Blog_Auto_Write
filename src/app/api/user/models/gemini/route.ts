import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);

    // Fetch the user's GEMINI API key
    const { data: apiKeyRecord, error: dbError } = await supabaseAdmin
      .from("ApiKey")
      .select("encryptedKey")
      .eq("userId", user.id)
      .eq("provider", "GEMINI")
      .single();

    if (dbError || !apiKeyRecord) {
      return NextResponse.json({ 
        models: [], 
        error: "Gemini API 키가 등록되지 않았습니다." 
      });
    }

    let decryptedKey;
    try {
      decryptedKey = decrypt(apiKeyRecord.encryptedKey);
    } catch (decryptErr) {
      return NextResponse.json({ 
        models: [], 
        error: "API 키 복호화에 실패했습니다." 
      });
    }

    // Call Google API to get models list
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${decryptedKey}`);
    
    if (!response.ok) {
      return NextResponse.json({ 
        models: [], 
        error: "API 키가 올바르지 않거나 호출 권한이 없습니다. 키를 확인해 주세요." 
      });
    }

    const data = await response.json();
    const modelsList: any[] = [];

    if (data.models && Array.isArray(data.models)) {
      data.models.forEach((model: any) => {
        const modelId = model.name.replace("models/", "");
        // Filter: only models that support content generation and are branded 'gemini'
        if (
          model.supportedGenerationMethods?.includes("generateContent") &&
          modelId.toLowerCase().includes("gemini")
        ) {
          modelsList.push({
            id: modelId,
            displayName: model.displayName || modelId,
            description: model.description || ""
          });
        }
      });
    }

    return NextResponse.json({ success: true, models: modelsList });
  } catch (error: any) {
    console.error("Fetch Gemini models error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

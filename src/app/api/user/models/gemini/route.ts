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

    const ALLOWED_GEMINI_MODELS = [
      "gemini-3.5-flash",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-pro-latest",
      "gemini-flash-latest"
    ];

    const data = await response.json();
    const modelsList: any[] = [];

    if (data.models && Array.isArray(data.models)) {
      data.models.forEach((model: any) => {
        const modelId = model.name.replace("models/", "");
        // Filter: only models that support content generation and are on the allowed list
        if (
          model.supportedGenerationMethods?.includes("generateContent") &&
          ALLOWED_GEMINI_MODELS.includes(modelId)
        ) {
          modelsList.push({
            id: modelId,
            displayName: model.displayName || modelId,
            description: model.description || ""
          });
        }
      });

      // Sort models according to the ALLOWED_GEMINI_MODELS order
      modelsList.sort((a, b) => {
        return ALLOWED_GEMINI_MODELS.indexOf(a.id) - ALLOWED_GEMINI_MODELS.indexOf(b.id);
      });
    }

    return NextResponse.json({ success: true, models: modelsList });
  } catch (error: any) {
    console.error("Fetch Gemini models error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

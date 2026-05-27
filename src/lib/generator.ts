import { supabaseAdmin } from "./supabase";
import { decrypt } from "./crypto";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Background worker to generate blog content using AI APIs and Supabase Admin SDK
 */
export async function generateBlogContent(postId: string, provider: string, guideText: string) {
  try {
    // 1. Fetch user ID associated with this post using supabaseAdmin
    const { data: post, error: postErr } = await supabaseAdmin
      .from("BlogPost")
      .select("userId")
      .eq("id", postId)
      .single();

    if (postErr || !post) {
      throw postErr || new Error("BlogPost not found");
    }
    const userId = post.userId;

    // 2. Update status to PROCESSING
    const { error: statusErr } = await supabaseAdmin
      .from("BlogPost")
      .update({ status: "PROCESSING", updatedAt: new Date().toISOString() })
      .eq("id", postId);

    if (statusErr) throw statusErr;

    // 3. Fetch user API key for target provider
    const { data: apiKeyRecord, error: keyErr } = await supabaseAdmin
      .from("ApiKey")
      .select("encryptedKey")
      .eq("userId", userId)
      .eq("provider", provider.toUpperCase())
      .maybeSingle();

    if (keyErr) throw keyErr;

    if (!apiKeyRecord) {
      throw new Error(`API Key for ${provider} has not been registered.`);
    }

    // 4. Decrypt the key safely
    const apiKey = decrypt(apiKeyRecord.encryptedKey);

    let generatedTitle = "";
    let generatedContent = "";

    const systemPrompt = `당신은 네이버 블로그 전문 마케터이자 전문 작가입니다. 
가이드라인과 이미지를 참고하여 고품질의 블로그 포스팅 글을 작성해야 합니다.
블로그 글은 다음 규격을 엄격히 지켜야 합니다:
1. 반드시 제목(Title)과 본문(Body)을 분리하여 작성할 것.
2. 결과물 포맷은 최상단에 [TITLE] 태그로 제목을 한 줄 작성하고, 그 다음 라인부터 [BODY] 태그를 붙인 뒤 본문 마크다운 내용을 채울 것.
   예:
   [TITLE] 제주도 인생 흑돼지 맛집 탐방기
   [BODY] ## 서론... \n\n 맛집을 다녀왔습니다...
3. 친근하고 유익한 구어체 한글(~합니다, ~했답니다, ~요 등)을 사용할 것.
4. 네이버 스마트에디터 ONE에 직접 타이핑될 예정이므로 가독성을 위해 단락을 자주 나누고, 소제목(##, ###)과 적절한 이모지를 적극적으로 활용하여 예쁘게 작성할 것.`;

    const userPrompt = `블로그 작성 가이드라인:
"${guideText}"`;

    if (provider.toUpperCase() === "OPENAI") {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      });

      const rawResult = response.choices[0]?.message?.content || "";
      const parsed = parseAiResponse(rawResult);
      generatedTitle = parsed.title;
      generatedContent = parsed.content;
    } else if (provider.toUpperCase() === "GEMINI") {
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
      const response = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
        ]
      });

      const rawResult = response.response.text();
      const parsed = parseAiResponse(rawResult);
      generatedTitle = parsed.title;
      generatedContent = parsed.content;
    } else {
      throw new Error(`Unsupported AI Provider: ${provider}`);
    }

    if (!generatedTitle || !generatedContent) {
      throw new Error("AI generated empty content. Parse failed.");
    }

    // 5. Save generated content back to Supabase
    const { error: saveErr } = await supabaseAdmin
      .from("BlogPost")
      .update({
        title: generatedTitle,
        content: generatedContent,
        status: "COMPLETED",
        updatedAt: new Date().toISOString(),
      })
      .eq("id", postId);

    if (saveErr) throw saveErr;

  } catch (error: any) {
    console.error(`AI Generation failure for post ${postId}:`, error);
    await supabaseAdmin
      .from("BlogPost")
      .update({
        status: "FAILED",
        errorMessage: error.message || "Unknown AI generation error",
        updatedAt: new Date().toISOString(),
      })
      .eq("id", postId);
  }
}

/**
 * Parse AI response expecting [TITLE] and [BODY] tags
 */
function parseAiResponse(rawText: string): { title: string; content: string } {
  let title = "AI가 작성한 블로그 글";
  let content = rawText;

  const titleMatch = rawText.match(/\[TITLE\]\s*(.*)/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }

  const bodyIndex = rawText.indexOf("[BODY]");
  if (bodyIndex !== -1) {
    content = rawText.substring(bodyIndex + 6).trim();
  } else {
    content = rawText.replace(/\[TITLE\]\s*(.*)/i, "").trim();
  }

  return { title, content };
}

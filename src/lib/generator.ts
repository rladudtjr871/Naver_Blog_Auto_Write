import { supabaseAdmin } from "./supabase";
import { decrypt } from "./crypto";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Background worker to generate blog content using AI APIs and Supabase Admin SDK
 */
export async function generateBlogContent(postId: string, provider: string, guideText: string) {
  try {
    // 1. Fetch user ID, place and associated images using supabaseAdmin
    const { data: post, error: postErr } = await supabaseAdmin
      .from("BlogPost")
      .select("userId, place, images:Image(*)")
      .eq("id", postId)
      .single();

    if (postErr || !post) {
      throw postErr || new Error("BlogPost not found");
    }
    const userId = post.userId;
    const place = post.place;

    // 2. Update status to PROCESSING
    const { error: statusErr } = await supabaseAdmin
      .from("BlogPost")
      .update({ status: "PROCESSING", updatedAt: new Date().toISOString() })
      .eq("id", postId);

    if (statusErr) throw statusErr;

    // 3. Fetch user API key for target provider
    const dbProvider = provider.toLowerCase().startsWith("gemini") ? "GEMINI" : provider.toUpperCase();
    const { data: apiKeyRecord, error: keyErr } = await supabaseAdmin
      .from("ApiKey")
      .select("encryptedKey")
      .eq("userId", userId)
      .eq("provider", dbProvider)
      .maybeSingle();

    if (keyErr) throw keyErr;

    if (!apiKeyRecord) {
      throw new Error(`API Key for ${provider} has not been registered.`);
    }

    // 4. Decrypt the key safely
    const apiKey = decrypt(apiKeyRecord.encryptedKey);

    let generatedTitle = "";
    let generatedContent = "";

    // 5. Fetch reference posts (topic and example blogs) from database
    const { data: refPosts, error: refError } = await supabaseAdmin
      .from("ReferencePost")
      .select("title, content")
      .eq("blogPostId", postId);

    if (refError) throw refError;

    const topicRecord = refPosts?.find(r => r.title === "주제");
    const blogTopic = topicRecord?.content || guideText;

    const exampleRecords = refPosts?.filter(r => r.title !== "주제") || [];
    const exampleBlogs = exampleRecords.map(r => r.content);

    const imageNames: string[] = [];
    if (post && post.images && Array.isArray(post.images)) {
      post.images.forEach((img, idx) => {
        let name = `IMAGE_PLACEHOLDER_${idx + 1}`;
        if (img.url) {
          const hashIndex = img.url.indexOf("#name=");
          if (hashIndex !== -1) {
            name = decodeURIComponent(img.url.substring(hashIndex + 6));
          }
        }
        imageNames.push(name);
      });
    }

    const systemPrompt = `당신은 대한민국에서 가장 트렌디한 파워블로거이자 친근한 동네 가이드입니다.
제시된 주제와 이미지를 참고하고, 예시 블로그들의 스타일을 벤치마킹하여 고품질의 블로그 포스팅 글을 작성해야 합니다.

블로그 글은 다음 규격과 규칙을 엄격히 지켜야 합니다:
1. 반드시 제목(Title)과 본문(Body)을 분리하여 작성할 것.
2. 결과물 포맷은 최상단에 [TITLE] 태그로 제목을 한 줄 작성하고, 그 다음 라인부터 [BODY] 태그를 붙인 뒤 본문 내용을 채울 것.
   예:
   [TITLE] [카테고리] 제주도 인생 흑돼지 맛집 탐방기
   [BODY] [ 1. 서론 ]\n\n맛집을 다녀왔습니다...
   
[반드시 지켜야 할 가독성 및 스타일 규칙]
0. 타이틀(제목)에는 [카테고리]가 반드시 포함되게 하라. (예: [TITLE] [맛집] 제주도 흑돼지 맛집 탐방기)
1. 문장은 절대로 길어지면 안 된다. 한 문장은 최대 1~2줄 이내로 짧고 리드미컬하게 끊어서 작성하라.
2. 가독성을 위해 1문장마다 '줄바꿈(Enter)'을 적극적으로 활용하라. 빽빽한 줄글은 절대 금지한다.
3. 말투는 백과사전 같은 딱딱한 어조(~다, ~입니다)를 금지하고, 인스타그램이나 블로그에서 자주 쓰는 친근한 SNS 구어체(~요!, ~ㅋㅋㅋ, ~강추!)를 적극 사용하라.
4. 블로그 에디터에 직접 복사/붙여넣기될 예정이므로 가독성을 위해 단락을 자주 나누고, 마크다운 기호(##, **, *, _, \` 등)를 절대로 사용하지 마십시오.
5. 함께 제공되는 이미지가 있다면 이미지 속 시각적 정보(분위기, 상품 상태, 색상, 장소 등)를 매우 세부적으로 관찰하여 본문 내용에 자연스럽게 묘사해 줄 것.
6. 글의 구조를 잡기 위해 소제목(예: ■ 내부 분위기, ■ 메뉴 후기)을 활용하고, 문단 사이에 구분선(---)을 적절히 배치하라.
7. 포스팅 중간중간 흐름에 맞춰 사진이 들어가야 할 위치를 정확히 계산하여, 반드시 '[이미지 파일명]' 또는 '[IMAGE_PLACEHOLDER_번호]' 형태로 태그를 독립된 빈 라인 사이에 단독 줄로 삽입하라. (최대 업로드된 이미지 개수만큼 배치)
8. '맛집', '카페', '여행'인 경우 장소 정보를 추가해야 한다.
9. 본문 맨 마지막 줄에는 해당 포스팅과 어울리는 해시태그를 반드시 생성하여 추가하라. (예: #맛집 #제주도맛집 #흑돼지)
10. 해시태그는 반드시 '#' 기호로 시작하는 단어여야 하며, 각 해시태그는 띄어쓰기로 구분해 한 줄로 모아서 작성해야 한다. '#' 기호 바로 뒤에 공백을 두지 마라(예: '# 맛집' 금지, '#맛집' 필수).`;

    let userPrompt = `작성할 블로그 주제:
"${blogTopic}"

아래 제공되는 예시 블로그들의 작성 스타일, 말투, 단락 구성, 이모지 활용법 및 핵심 표현 등을 철저하게 분석하고 벤치마킹하여 동일한 느낌의 고품질 블로그 글을 새로 작성해 주세요.

작성 시 참고할 예시 블로그 목록:
`;

    if (exampleBlogs.length > 0) {
      exampleBlogs.forEach((example, i) => {
        userPrompt += `\n--- [예시 블로그 ${i + 1}] ---\n${example}\n`;
      });
    } else {
      userPrompt += `\n(제공된 예시 블로그가 없습니다. 주제에 맞춰 자유롭게 작성하세요.)\n`;
    }

    if (imageNames.length > 0) {
      userPrompt += `\n\n첨부된 이미지 목록 (글의 맥락 흐름에 맞춰 사진이 들어갈 위치에 [파일명] 또는 [IMAGE_PLACEHOLDER_번호] 형태의 태그를 반드시 빈 라인 사이에 단독 줄로 삽입해 주세요):\n`;
      imageNames.forEach((name) => {
        userPrompt += `- [${name}]\n`;
      });
    }

    if (place) {
      userPrompt += `\n\n지정된 장소 정보 (해당 장소를 방문한 경험, 음식 맛, 서비스, 분위기 또는 방문 목적을 글에 자연스럽고 상세히 묘사해 주세요): "${place}"\n`;
    }

    if (provider.toUpperCase() === "OPENAI") {
      const openai = new OpenAI({ apiKey });
      
      const userContent: any[] = [
        { type: "text", text: userPrompt }
      ];

      // Add base64 images if available
      if (post && post.images && Array.isArray(post.images)) {
        for (const img of post.images) {
          if (img.url && img.url.startsWith("data:image/")) {
            userContent.push({
              type: "image_url",
              image_url: {
                url: img.url
              }
            });
          }
        }
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
      });

      const rawResult = response.choices[0]?.message?.content || "";
      const parsed = parseAiResponse(rawResult);
      generatedTitle = parsed.title;
      generatedContent = parsed.content;
    } else if (provider.toUpperCase() === "GEMINI" || provider.toLowerCase().startsWith("gemini-")) {
      const geminiModelName = provider.toLowerCase().startsWith("gemini-") 
        ? provider.toLowerCase() 
        : "gemini-2.5-flash";
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: geminiModelName });
      
      const parts: any[] = [
        { text: `${systemPrompt}\n\n${userPrompt}` }
      ];

      // Add base64 images if available
      if (post && post.images && Array.isArray(post.images)) {
        for (const img of post.images) {
          if (img.url && img.url.startsWith("data:image/")) {
            const parsed = parseBase64DataUrl(img.url);
            if (parsed) {
              parts.push({
                inlineData: {
                  data: parsed.data,
                  mimeType: parsed.mimeType
                }
              });
            }
          }
        }
      }

      const response = await model.generateContent({
        contents: [
          { role: "user", parts }
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

  // Strip any accidental markdown formatting characters to clean up for Naver Blog Editor
  title = cleanMarkdown(title);
  content = cleanMarkdown(content);

  return { title, content };
}

/**
 * Strips markdown symbols to make text clean for Naver Blog Editor
 */
function cleanMarkdown(text: string): string {
  return text
    // 1. Remove heading marks like #, ##, ### at the start of lines
    .replace(/^(#+)\s+/gm, "")
    // 2. Remove bold/italic markers like **, *, __, _
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // 3. Remove inline code backticks
    .replace(/`([^`]+)`/g, "$1")
    // 4. Remove markdown links [Text](URL) -> Text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    // 5. Remove horizontal rule lines like --- or ===
    .replace(/^[=\-*]{3,}$/gm, "");
}

/**
 * Helper to extract mimeType and base64 data from a data URL
 */
function parseBase64DataUrl(dataUrl: string) {
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
  if (!matches) return null;
  return {
    mimeType: matches[1],
    data: matches[2]
  };
}

import { NextResponse } from "next/server";

/** Never return raw database/SDK errors (which can echo rows or credentials). */
export function apiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (/Unauthorized|Missing or invalid Authorization|Empty access token/.test(message)) {
    return NextResponse.json({ error: "로그인이 만료되었습니다. 다시 로그인해주세요." }, { status: 401 });
  }
  if (message.startsWith("Supabase 환경") || message.startsWith("ENCRYPTION_KEY")) {
    return NextResponse.json({ error: message }, { status: 503 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

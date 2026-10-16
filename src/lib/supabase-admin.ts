import { createClient } from "@supabase/supabase-js";

/** Only imported by server modules. Never fall back to the public anon key. */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "missing-service-role-key",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export function assertSupabaseConfiguration() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase 환경 변수 설정이 필요합니다. .env.example을 확인해주세요.");
  }
}

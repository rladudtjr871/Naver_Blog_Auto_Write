-- 기존 프로젝트의 Supabase SQL Editor에서 실행. 기존 글은 수정하지 않습니다.
BEGIN;

ALTER TABLE public."BlogPost" ADD COLUMN IF NOT EXISTS document JSONB;

CREATE TABLE IF NOT EXISTS public."DefaultReference" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public."DefaultReference" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own DefaultReferences" ON public."DefaultReference";
CREATE POLICY "Users can manage their own DefaultReferences"
    ON public."DefaultReference" FOR ALL TO authenticated
    USING (auth.uid() = "userId") WITH CHECK (auth.uid() = "userId");
GRANT SELECT, INSERT, UPDATE, DELETE ON public."DefaultReference" TO authenticated;
GRANT ALL ON public."DefaultReference" TO service_role;

-- 암호화한 키도 브라우저에 반환하지 않습니다. 서버 service_role로만 관리합니다.
ALTER TABLE public."ApiKey" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own API keys" ON public."ApiKey";
REVOKE ALL ON public."ApiKey" FROM anon, authenticated;
GRANT ALL ON public."ApiKey" TO service_role;

COMMIT;

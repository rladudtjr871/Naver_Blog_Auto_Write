-- Supabase SQL Editor용 테이블 생성 DDL 스크립트
-- 복사하여 Supabase SQL Editor에 붙여넣고 Run을 눌러 실행하세요.

-- 1. User 테이블 생성
CREATE TABLE IF NOT EXISTS "User" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    "naverBlogId" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ApiKey 테이블 생성
CREATE TABLE IF NOT EXISTS "ApiKey" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE("userId", provider)
);

-- 3. BlogPost 테이블 생성
CREATE TABLE IF NOT EXISTS "BlogPost" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT,
    document JSONB,
    place TEXT,
    status TEXT DEFAULT 'PENDING' NOT NULL, -- PENDING, PROCESSING, COMPLETED, FAILED
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ReferencePost 테이블 생성
CREATE TABLE IF NOT EXISTS "ReferencePost" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "blogPostId" UUID REFERENCES "BlogPost"(id) ON DELETE SET NULL,
    title TEXT,
    content TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Image 테이블 생성
CREATE TABLE IF NOT EXISTS "Image" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "blogPostId" UUID NOT NULL REFERENCES "BlogPost"(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    role TEXT NOT NULL, -- "REFERENCE" or "INCLUDED"
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. 사용자 기본 참고 글
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

-- =========================================================================
-- Supabase Row Level Security (RLS) 설정
-- =========================================================================
-- 기본적으로 RLS를 활성화하면 외부 Anon Key를 통한 무단 접근이 모두 차단됩니다.
-- 개발 환경(데모용) 또는 프로덕션(인증 연동용) 목적에 맞게 아래 스크립트 중 하나를 선택해 실행하세요.

/*
-----------------------------------------------------------------------------
방법 A: 개발/데모 모드 및 서버사이드 API 통제 전용 (현재 프로젝트 기본 세팅)
-----------------------------------------------------------------------------
설명: Supabase Auth 로그인을 연동하지 않고, 고정된 데모 사용자 ID나 
Next.js 서버 측 API 라우트를 통해서만 DB를 조회할 때 사용하는 정책입니다.
Anon Key로 들어오는 전체 CRUD 요청을 테스트 목적으로 전체 허용합니다.
*/

-- 1. RLS 활성화
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlogPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferencePost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Image" ENABLE ROW LEVEL SECURITY;

-- 2. User 테이블: 로그인한 회원 본인의 프로필 정보만 CRUD 가능
CREATE POLICY "Users can manage their own profile" ON "User"
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3. ApiKey는 인증·소유권을 확인하는 서버 API에서만 접근합니다.
DROP POLICY IF EXISTS "Users can manage their own API keys" ON public."ApiKey";
REVOKE ALL ON public."ApiKey" FROM anon, authenticated;
GRANT ALL ON public."ApiKey" TO service_role;

-- 4. BlogPost 테이블: 본인이 생성한 블로그 포스팅만 CRUD 가능
CREATE POLICY "Users can manage their own BlogPosts" ON "BlogPost"
    FOR ALL USING (auth.uid() = "userId") WITH CHECK (auth.uid() = "userId");

-- 5. ReferencePost 테이블: 본인의 참조 대상 정보만 CRUD 가능
CREATE POLICY "Users can manage their own ReferencePosts" ON "ReferencePost"
    FOR ALL USING (auth.uid() = "userId") WITH CHECK (auth.uid() = "userId");

-- 6. Image 테이블: 본인의 BlogPost 하위에 바인딩된 이미지에 한해서만 CRUD 가능
CREATE POLICY "Users can manage images in their own BlogPosts" ON "Image"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM "BlogPost"
            WHERE "BlogPost".id = "Image"."blogPostId"
            AND "BlogPost"."userId" = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "BlogPost"
            WHERE "BlogPost".id = "Image"."blogPostId"
            AND "BlogPost"."userId" = auth.uid()
        )
    );



/*
-----------------------------------------------------------------------------
방법 B: Supabase Auth 로그인 연동 시 (보안 강화 프로덕션 권장 모델)
-----------------------------------------------------------------------------
설명: 회원가입/로그인을 통해 생성된 사용자의 JWT(액세스 토큰) 기반으로 
정확히 본인이 소유한(userId가 일치하는) 데이터만 CRUD할 수 있게 통제합니다.
(※ 방법 A의 정책이 적용되어 있다면 기존 정책을 DROP 한 후 실행해야 합니다.)

-- 1. RLS 활성화
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlogPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferencePost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Image" ENABLE ROW LEVEL SECURITY;

-- 2. User 테이블: 본인 프로필만 조회/수정 가능
CREATE POLICY "Users can manage their own profile" ON "User"
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3. ApiKey 테이블: 본인의 API 키만 제어 가능 (보안 핵심)
CREATE POLICY "Users can manage their own API keys" ON "ApiKey"
    FOR ALL USING (auth.uid() = "userId") WITH CHECK (auth.uid() = "userId");

-- 4. BlogPost 테이블: 본인의 글만 제어 가능
CREATE POLICY "Users can manage their own BlogPosts" ON "BlogPost"
    FOR ALL USING (auth.uid() = "userId") WITH CHECK (auth.uid() = "userId");

-- 5. ReferencePost 테이블: 본인의 참조 대상 글만 제어 가능
CREATE POLICY "Users can manage their own ReferencePosts" ON "ReferencePost"
    FOR ALL USING (auth.uid() = "userId") WITH CHECK (auth.uid() = "userId");

-- 6. Image 테이블: 본인의 BlogPost에 속해 있는 이미지만 제어 가능
CREATE POLICY "Users can manage images in their own BlogPosts" ON "Image"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM "BlogPost"
            WHERE "BlogPost".id = "Image"."blogPostId"
            AND "BlogPost"."userId" = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "BlogPost"
            WHERE "BlogPost".id = "Image"."blogPostId"
            AND "BlogPost"."userId" = auth.uid()
        )
    );
*/


-- =========================================================================
-- [추가] Supabase Auth 회원가입 시 public."User" 테이블 자동 연동 트리거 DDL
-- =========================================================================

-- 1. 트리거 함수 정의
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public."User" (id, email, "naverBlogId", "createdAt", "updatedAt")
    VALUES (
        new.id, 
        new.email, 
        (new.raw_user_meta_data->>'naverBlogId'), 
        COALESCE(new.created_at, now()), 
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET "naverBlogId" = EXCLUDED."naverBlogId", "updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 트리거 설정
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- [스키마 업데이트] 기존 BlogPost 테이블에 place 컬럼 추가 DDL
-- =========================================================================
-- ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "place" TEXT;

-- Supabase SQL Editor용 테이블 생성 DDL 스크립트
-- 복사하여 Supabase SQL Editor에 붙여넣고 Run을 눌러 실행하세요.

-- 1. User 테이블 생성
CREATE TABLE IF NOT EXISTS "User" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
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

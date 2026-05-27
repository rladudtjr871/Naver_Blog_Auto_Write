---
description: Vercel & Serverless Architecture Specification
---

# Infrastructure: Vercel & Serverless Architecture Specification

이 문서는 비용 최적화(무료 티어 활용) 및 빠른 배포를 위해 Vercel 기반의 서버리스 아키텍처 구성을 정의합니다. 개발 및 배포 에이전트는 서버리스 환경의 제약 조건을 고려하여 코드를 작성해야 합니다.

---

## ☁️ 1. 클라우드 서비스 구성 (Serverless Stack)

### 🖥️ Web & API: Vercel (Hobby Plan)
* **역할:** Next.js 프론트엔드 호스팅 및 Serverless Functions를 이용한 백엔드 API 구동
* **주의사항 (중요):** Vercel 무료 티어의 API 요청 최대 실행 시간(Timeout)은 **10초**이다. AI가 블로그 글을 생성하는 데 10초 이상 걸릴 수 있으므로, API 호출 시 대기하지 않고 대시보드에서 상태를 폴링(Polling)하거나 웹소켓/서버 센트 이벤트(SSE) 방식을 고려하거나, Next.js의 `Route Handlers`에서 스트리밍 방식을 활용한다.

### 🗄️ Database: Supabase (Free Tier)
* **역할:** 유저 정보, 암호화된 AI API Key, 임시저장 글 데이터 관리 (PostgreSQL)
* **연동:** Vercel Integration을 통해 환경 변수를 자동으로 동기화한다.

### 📁 Storage: Vercel Blob (또는 Cloudinary Free)
* **역할:** 유저가 업로드한 블로그 본문용 이미지 파일 저장
* **업로드 방식:** 서버를 거치지 않고 브라우저에서 스토리지로 바로 업로드하는 'Client-side Upload' 방식을 채택하여 Vercel API 부하를 줄인다.

---

## 🔑 2. 필수 환경 변수 (Environment Variables)

배포 에이전트는 Vercel Dashboard의 Environment Variables에 아래 변수들이 올바르게 등록되었는지 확인한다.
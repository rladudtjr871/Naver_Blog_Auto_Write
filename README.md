# AI 기반 네이버 블로그 자동 작성 서비스 (BlogAutoWrite)

본 프로젝트는 AI를 통해 블로그 포스팅 본문을 자동 생성하는 **Next.js 웹 대시보드**와, 생성된 결과물(제목, 본문, 이미지)을 네이버 스마트에디터 ONE에 한 번에 입력해 주는 **크롬 익스텐션 매크로 주입기**로 구성된 풀스택 서비스입니다.

---

## ✨ 핵심 기능

1. **AI 기반 블로그 포스팅 생성:** OpenAI GPT-4o 및 Gemini 1.5 Pro 모델을 모두 지원하며, 카테고리 및 참고 이미지와 사용자 가이드라인에 최적화된 블로그 글을 작성합니다.
2. **Vercel Serverless 타임아웃 극복:** 10초 제한의 서버리스 환경을 대응하기 위해 **비동기 상태 백그라운드 생성 & 클라이언트 폴링(Polling)** 아키텍처를 도입했습니다.
3. **Secure Mode 개인 API Key 관리:** 사용자 개인 API Key를 `crypto` 모듈의 `AES-256-GCM` 대칭 키 방식으로 암호화하여 DB에 안전하게 보관하며 외부로 절대 노출하지 않습니다.
4. **크롬 익스텐션 원클릭 매크로 주입:** 네이버 블로그 글쓰기 페이지 내에 타이핑 방식(`insertText`)의 매크로를 사용하여 React/Vue 상태 상태와 완벽히 동기화된 안전한 자동 입력을 지원합니다.
5. **이미지 드래그 앤 드롭 오버레이:** 보안 샌드박스로 막혀 있는 원격 이미지 주입을 해결하기 위해 화면 우하단에 플로팅 이미지 오버레이 조작 패널을 활성화하여 마우스 드래그 앤 드롭으로 본문 원하는 위치에 이미지를 삽입할 수 있도록 돕습니다.

---

## 🛠️ 개발 스택 및 아키텍처

- **Web Frontend / Backend API:** Next.js 16 (App Router, Tailwind CSS, TypeScript)
- **Database ORM:** Prisma v6
- **Database DB:** Supabase PostgreSQL
- **Storage:** Vercel Blob Storage
- **Chrome Extension:** Manifest V3 Standard HTML5/JavaScript

---

## 🚀 로컬 개발 및 실행 방법

### 1. 사전 요구사항
- Node.js 18 이상 설치
- Supabase PostgreSQL 데이터베이스 인스턴스 생성

### 2. 패키지 설치
프로젝트 루트 폴더에서 아래 명령을 실행합니다.
```bash
npm install
```

### 3. 환경 변수 설정
프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 아래 형식을 채워 넣습니다:
```env
# Supabase 연결 설정 (Prisma v6)
DATABASE_URL="postgresql://postgres.[your-project-id]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[your-project-id]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"

# API Key 암호화용 32자 임의 시크릿 키
ENCRYPTION_KEY="your-32-character-secret-key-goes-here"
```

### 4. 데이터베이스 테이블 생성 (Supabase SQL Editor)
1. 프로젝트 루트에 있는 [supabase_schema.sql](file:///c:/Users/yskim/Documents/blogAutoWrite/supabase_schema.sql) 파일의 내용을 전체 복사합니다.
2. [Supabase Dashboard](https://supabase.com/dashboard) ➔ 프로젝트 선택 ➔ 좌측 메뉴의 **SQL Editor**로 이동합니다.
3. **'New query'**를 눌러 새 쿼리창을 연 후, 복사한 내용을 붙여넣고 **'Run'** 버튼을 클릭하여 실행하면 테이블이 생성됩니다.

### 5. 웹 서비스 개발 서버 시작
```bash
npm run dev
```
개발 서버가 켜지면 브라우저에서 [http://localhost:3000](http://localhost:3000)으로 대시보드 웹 서비스에 접속하실 수 있습니다.

---

## 🔌 크롬 익스텐션 설치 및 연동 방법

### 1. 확장 프로그램 브라우저 등록
1. 프로젝트 루트 디렉토리에 빌드되어 있는 `extension.zip` 파일의 압축을 풉니다.
2. 구글 크롬 브라우저를 열고 주소창에 `chrome://extensions/`를 입력하여 페이지로 이동합니다.
3. 우측 상단의 **'개발자 모드'** 토글을 켭니다.
4. 좌측 상단의 **'압축해제된 확장 프로그램을 로드합니다'** 버튼을 클릭합니다.
5. 압축을 해제한 `extension` 폴더를 통째로 지정하여 추가합니다.

### 2. 서비스 연동 및 글 작성 플로우
1. 대시보드 웹 서비스([http://localhost:3000](http://localhost:3000))에 접속합니다.
2. 우측 상단 **'API Key 연동'** 버튼을 눌러 본인의 OpenAI 또는 Gemini API Key를 등록합니다.
3. 좌측 작성 폼에서 카테고리와 가이드를 입력한 뒤 **'AI 블로그 자동 생성'**을 요청합니다.
4. 생성이 완료(`COMPLETED`)되면 화면 하단에 발급된 **POST ID (UUID)** 복사 버튼을 누릅니다.
5. [네이버 블로그 글쓰기 페이지](https://blog.naver.com/)에 진입하여 새 글 작성(스마트에디터 ONE) 모드를 활성화합니다.
6. 크롬 툴바에서 **BlogAutoWrite Helper** 익스텐션 아이콘을 클릭합니다.
7. 복사해 온 **POST ID**를 붙여넣고 **'데이터 불러오기'**를 클릭합니다.
8. 데이터 요약 정보 확인 후 **'네이버 블로그 주입하기'**를 클릭하면 글쓰기 창에 타이핑 매크로가 실행됩니다.
9. 화면 우하단에 나타난 플로팅 이미지 오버레이의 이미지들을 에디터 본문 본인이 원하는 위치로 **드래그 앤 드롭**하여 포스팅 작성을 완성합니다!

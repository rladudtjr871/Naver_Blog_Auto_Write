# Antigravity Agent Swarm Orchestration Specification

본 문서는 'AI 기반 네이버 블로그 자동 작성 웹 서비스 및 크롬 익스텐션' 프로젝트를 수행하는 Antigravity 에이전트 팀의 역할 정의, 책임 범위, 컨텍스트 참조 가이드 및 협업 핸드오프(Handoff) 프로토콜을 정의합니다.

---

## 👥 1. 에이전트 팀 구성 및 참조 컨텍스트 (Team Profile)

Antigravity 매니저 에이전트는 프로젝트 실행 시 아래 정의에 따라 서브 에이전트들을 인스턴스화하고 해당하는 컨텍스트 파일을 주입해야 합니다.

| 에이전트 ID | 에이전트 이름 (Role) | 전담 컨텍스트 파일 (Context) | 핵심 역량 및 책임 범위 |
| :--- | :--- | :--- | :--- |
| **PMA** | PM / 기획 에이전트 | `01_pm_agent.md` | 요구사항 분석, RDB 스키마 설계, REST API 스펙 정의 및 백로그 관리 |
| **UXD** | UI/UX 디자인 에이전트 | `02_design_agent.md` | 웹 대시보드 및 익스텐션 팝업 UI 레이아웃 기획, Tailwind CSS 컴포넌트 마크업 생성 |
| **FSD** | 풀스택 개발 에이전트 | `03_developer_agent.md`<br>`07_prompt_generator_agent.md` | Next.js API, Supabase DB 연동, AI 프롬프트 엔지니어링 구현 및 Manifest V3 크롬 익스텐션 매크로 빌드 |
| **QAT** | QA / 테스터 에이전트 | `04_tester_agent.md` | `/browser` 도구를 활용한 네이버 스마트에디터 ONE DOM 주입 매크로 시뮬레이션 및 예외 처리 검증 |
| **DVO** | 배포 / DevOps 에이전트 | `05_devops_agent.md`<br>`06_vercel_architecture.md` | Vercel 환경 변수 검증, 서버리스 타임아웃 예방 인프라 체크 및 최종 익스텐션 패킹 |

---

## 🔄 2. 단계별 에이전트 협업 및 트리거 가이드 (Pipeline Lifecycle)

모든 에이전트는 `stack.md`의 규칙을 상시 준수하며, `00_global_rules.md` 순서에 따라 아래 트리거 조건이 충족될 때 자율적으로 다음 에이전트를 호출(Handoff)합니다.

### 📍 Phase 1: 요구사항 정의 및 설계 (Trigger: Project Start)
* **주동자:** `PMA`
* **액션:** 기획 요구사항 및 Vercel 서버리스 스펙(`06_vercel_architecture.md`)을 기반으로 `User`, `ReferencePost`, `BlogPost`, `Image` 테이블 스키마와 백엔드 API 엔드포인트를 설계합니다.
* **핸드오프:** 설계 문서 완수 후, `UXD`와 `FSD`를 동시에 깨워 다음 단계를 트리거합니다.

### 📍 Phase 2: UI/UX 컴포넌트 빌드 (Trigger: Phase 1 Completion)
* **주동자:** `UXD`
* **액션:** 대시보드(카테고리, 장소, 가이드 입력 영역) 및 익스텐션 팝업창 UI를 설계하고 Tailwind CSS 코드를 추출합니다.
* **핸드오프:** 완성된 UI 컴포넌트 소스코드를 `FSD`에게 인계합니다.

### 📍 Phase 3: 백엔드 API & 익스텐션 매크로 구현 (Trigger: Phase 2 Completion)
* **주동자:** `FSD`
* **액션:** 
  1. `03_developer_agent.md` 아키텍처 규칙(Hooks/Utils 분리, 구조별 컴포넌트 폴더링)에 맞추어 Next.js 애플리케이션을 빌드합니다.
  2. `07_prompt_generator_agent.md` 가이드에 따라 유저 데이터(카테고리, 맛집/카페/여행 장소 정보, 해시태그 등)를 가공해 네이버 블로그에 최적화된 MZ 스타일의 프롬프트를 조립하고 AI API를 호출합니다.
  3. `/browser` 툴로 네이버 글쓰기 창 구조를 따내어 `config.json` 기반의 자동 주입 매크로 스크립트를 빌드합니다.
* **핸드오프:** 기능 구현 완료 후 코드 리뷰 및 가상 환경 테스트를 위해 `QAT`를 호출합니다.

### 📍 Phase 4: 크롬 가상 환경 시뮬레이션 및 품질 검증 (Trigger: Phase 3 Completion)
* **주동자:** `QAT`
* **액션:** 가상 브라우저 환경에서 실제 네이버 블로그 글쓰기 창에 진입한 후, `FSD`가 작성한 스크립트를 로드해 제목([카테고리] 포함), 가독성이 보장된 줄바꿈 본문, 이미지 파일명 태그가 완벽하게 인젝션되는지 검증합니다.
* **피드백 루프:** 매크로 도중 스크립트 에러나 네이버 차단 요소 감지 시 로그를 취합하여 `FSD`에게 재수정을 요청합니다. 통과 시 `DVO`에게 이관합니다.

### 📍 Phase 5: 인프라 검증 및 최종 패킹 (Trigger: Phase 4 Sign-off)
* **주동자:** `DVO`
* **액션:** `.env` 내의 Supabase 및 Vercel 환경 변수를 검증하고, 검증이 끝난 크롬 익스텐션 소스코드를 `.zip` 파일로 빌드 패킹한 뒤 최종 Walkthrough 문서를 작성합니다.

---

## 🔒 3. 에이전트 간 인터페이스 규칙 (Communication Rules)

1. 모든 에이전트는 타 에이전트에게 업무를 위임하거나 협업을 요청할 때, 작업 결과물이 저장된 파일 경로와 변경 사항 리포트를 함께 전달해야 한다.
2. 개발 에이전트(`FSD`)가 프론트엔드 및 백엔드 로직을 작성할 때는 `03_developer_agent.md`에 명시된 컴포넌트 분리 원칙(5, 6, 7, 8, 9번 규칙)을 엄격히 준수하고 있는지 매 단계 검증 문구를 공유해야 한다.
3. AI Api key를 이용한 프롬프트 작성 시 `07_prompt_generator_agent.md`에 명시된 내용을 준수하여 작성하도록 한다.
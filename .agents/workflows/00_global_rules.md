---
description: Global Rules & Architecture Overview
---

# Global Rules & Architecture Overview

## 📋 공통 준수 사항
* **보안 최우선:** 유저의 네이버 세션 정보 및 AI API Key는 상시 `Secure Mode`로 관리하며, 외부 로그 출력을 금지한다.
* **모듈화 개발:** 웹 프론트엔드, 백엔드, 크롬 익스텐션은 서로 독립된 컴포넌트로 분리하여 빌드한다.
* **유지보수성:** 네이버 블로그 스마트에디터ONE의 DOM 셀렉터는 `config.json`으로 격리하여 관리한다.

## 🔄 전체 협업 프로세스
1. PM Agent 디자인/개발 스펙 정의 -> 2. Design Agent UI 컴포넌트 생성 -> 3. Developer Agent 기능 구현 -> 4. Tester Agent 매크로 시뮬레이션 검증 -> 5. DevOps Agent 패킹 및 완료 보고
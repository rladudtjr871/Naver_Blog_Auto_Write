---
description: 풀스택 개발 에이전트
---

# Role: 풀스택 개발 에이전트

## 🎯 미션
백엔드 API 인프라 구축, 생성형 AI API 연동, 그리고 네이버 블로그에 글을 주입하는 크롬 익스텐션 매크로를 구현한다.

## 🏃‍♂️ 작업 워크플로우 (Phase 3)
1. **웹 API 개발:** 유저의 AI API Key를 암호화 저장하고, 멀티모달 API를 호출하여 이미지 분석 및 본문을 생성·임시 저장하는 백엔드를 구현한다.
2. **익스텐션 개발:** 크롬 익스텐션 Manifest V3 규격을 사용하여 백엔드로부터 데이터를 받아오는 `popup.js`를 작성한다.
3. `/browser` 도구를 켜서 네이버 블로그 글쓰기 창의 DOM 구조를 분석하고, 데이터를 안전하게 주입(Injection)하는 content script를 완성한다.
4. 작성이 완료되면 코드 검수를 위해 `04_tester_agent.md`를 호출한다.
5. page.tsx 각 페이지마다 hooks, utils를 가진다.
6. page.tsx 안에 각 UI 영역 별로 component를 나눈다.
7. components 폴더에는 유사한 영역별로 분류된 component 폴더가 있으며 그 하위로 component 파일을 만든다.
8. 비즈니스 로직은 hooks 폴더 하위에 use{페이지명}.ts로 분리한다.
9. 공통 기능이 발생하는 경우 utils 폴더에 정의한다. 예를 들면 날짜 유틸인 경우 dateUtils.ts
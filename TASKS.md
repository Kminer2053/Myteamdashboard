# 작업 할당 및 체크리스트

## 코더1 (Sonnet 4.5) - 백엔드 작업

### 첫 번째 과업: 기존 코드 확인 및 검토
- [x] `server.js`의 `/lunch/*` 라우트 코드 확인
  - [x] `callAppsScript` 헬퍼 함수 검토
  - [x] 각 엔드포인트 구현 상태 확인
  - [x] 에러 핸들링 및 로깅 확인
- [x] `kakao-bot.js`의 점심 추천 명령어 처리 코드 확인
  - [x] `/점심`, `/추천` 명령어 처리 로직 검토
  - [x] 메시지 포맷팅 로직 확인
  - [x] 웹페이지 링크 포함 로직 확인
- [x] `env.example` 환경변수 설정 확인
- [x] 코드 품질 검토 및 개선사항 파악

### 레포지토리 1: server.js 백엔드 라우트 추가/개선
- [x] `server.js`에 `/lunch/*` 라우트 추가 또는 개선
  - [x] `GET /lunch/places`: Apps Script로 places 조회 요청
  - [x] `POST /lunch/places`: Apps Script로 새 장소 등록 요청
  - [x] `POST /lunch/reviews`: Apps Script로 리뷰 등록 요청
  - [x] `POST /lunch/recommend`: Apps Script로 추천 요청
- [x] Apps Script 호출 헬퍼 함수 구현 (x-api-key 인증 포함)
- [x] 에러 핸들링 및 로깅 구현
- [x] CORS 설정 업데이트 (신규 프론트엔드 도메인 허용)

### 레포지토리 1: 카카오톡봇 연동 개선
- [x] `kakao-bot.js`의 `/점심`, `/추천` 명령어 처리 코드 검토 및 개선
- [x] `POST /lunch/recommend` 호출하여 추천 결과 받기
- [x] 추천 결과를 카톡 메시지로 포맷팅
- [x] 웹페이지 링크 포함 (환경변수 `LUNCH_WEB_URL` 사용)
- [x] 도움말에 점심 추천 명령어 추가

### 환경변수 설정
- [x] `env.example`에 다음 추가:
  - `GOOGLE_APPS_SCRIPT_URL`
  - `LUNCH_API_KEY`
  - `LUNCH_WEB_URL`

### Apps Script 템플릿 검토 및 개선
- [x] `docs/lunch-service/apps-script-template.js` 코드 확인
  - [x] GET /places 구현
  - [x] POST /places 구현
  - [x] POST /reviews 구현
  - [x] POST /recommend 구현 (규칙 기반 + LLM 호출)
  - [x] x-api-key 검증 미들웨어
  - [x] Google Sheets 읽기/쓰기 함수
- [x] `docs/lunch-service/setup-guide.md` 작성

---

## 코더2 (Gemini 3.0 Pro) - 프론트엔드 작업

### 첫 번째 과업: 기존 코드 확인 및 검토
- [x] `lunch-service/index.html` 코드 확인
  - [x] HTML 구조 검토
  - [x] 모바일 최적화 설정 확인
  - [x] 탭 구조 확인
- [x] `lunch-service/lunch.css` 코드 확인
  - [x] 스타일 구조 검토
  - [x] 모바일 반응형 확인
  - [x] 탭바 고정 스타일 확인
- [x] `lunch-service/lunch.js` 존재 여부 확인
- [x] 코드 품질 검토 및 개선사항 파악

### 레포지토리 2: 프론트엔드 파일 생성/개선
- [x] `index.html` 작성 또는 개선 (모바일 최적화)
  - [x] 메타 viewport 설정
  - [x] 추천/목록/등록 탭 구조
  - [x] 하단 고정 탭바
- [x] `lunch.js` 작성 또는 완성 (비즈니스 로직)
  - [x] API 호출 함수 (`API_BASE_URL` 환경변수 사용)
  - [x] 추천 탭 로직 (자연어 입력, 프리셋 선택, 결과 표시)
  - [x] 목록 탭 로직 (검색/필터, 카드 리스트)
  - [x] 등록 탭 로직 (폼 제출, 유효성 검사)
  - [x] 탭 전환 로직
  - [x] 로딩 상태 관리
  - [x] 에러 처리 및 토스트 메시지
- [x] `lunch.css` 작성 또는 개선 (스타일)
  - [x] 모바일 최적화 (max-width: 420px, 중앙 정렬)
  - [x] body 배경 회색 (#f5f5f5)
  - [x] 컨테이너 스타일
  - [x] 하단 탭바 고정 (position: fixed)
  - [x] 카드 스타일
  - [x] 반응형 디자인

### 문서 작성
- [x] `README.md` 작성
  - [x] 프로젝트 설명
  - [x] 설치 및 배포 가이드
  - [x] API 엔드포인트 설정 방법
- [x] `STATUS.md` 작성 (개발 상태 추적) - WORKLOG.md로 대체

---

## 오케스트레이터 (Opus 4.5) - 관리 작업

- [x] 초기 계획 수립
- [x] API_SPEC.md 작성
- [x] TASKS.md 작성
- [x] WORKLOG.md 초기화
- [x] 각 코더 작업 진행 상황 모니터링
- [x] 코드 리뷰 및 품질 검증
- [x] 통합 테스트
  - [x] lunch-service/vercel.json 생성
  - [x] 프론트엔드 Vercel 배포 완료 (https://lunch-service.vercel.app)
  - [x] CORS 설정 확인 완료
- [x] 배포 관리
  - [x] 프론트엔드: Vercel (https://lunch-service.vercel.app)
  - [대기] 백엔드: Render 환경변수 설정 필요 (LUNCH_WEB_URL)

---

## 공유 문서

- [x] `API_SPEC.md`: API 인터페이스 정의
- [x] `TASKS.md`: 작업 할당 및 체크리스트
- [x] `WORKLOG.md`: 작업 진행 상황 로그

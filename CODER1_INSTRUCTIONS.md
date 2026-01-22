# 코더1 (Sonnet 4.5) 작업 지시서

## 역할
백엔드 일체 코딩 담당

## 첫 번째 과업: 기존 코드 확인 및 검토

다음 파일들을 확인하고 검토하세요:

1. **server.js** (레포지토리 1)
   - `/lunch/*` 라우트가 이미 추가되어 있는지 확인
   - `callAppsScript` 헬퍼 함수 구현 상태 확인
   - 각 엔드포인트 (GET /lunch/places, POST /lunch/places, POST /lunch/reviews, POST /lunch/recommend) 구현 상태 확인
   - 에러 핸들링 및 로깅이 적절한지 확인
   - CORS 설정이 신규 프론트엔드 도메인을 허용하는지 확인

2. **kakao-bot.js** (레포지토리 1)
   - `/점심`, `/추천` 명령어 처리 로직이 추가되어 있는지 확인
   - `POST /lunch/recommend` 호출 로직 확인
   - 추천 결과를 카톡 메시지로 포맷팅하는 로직 확인
   - 웹페이지 링크 포함 로직 확인 (환경변수 `LUNCH_WEB_URL` 사용)
   - 도움말에 점심 추천 명령어가 추가되었는지 확인

3. **env.example** (레포지토리 1)
   - `GOOGLE_APPS_SCRIPT_URL` 추가 여부 확인
   - `LUNCH_API_KEY` 추가 여부 확인
   - `LUNCH_WEB_URL` 추가 여부 확인

4. **docs/lunch-service/apps-script-template.js**
   - Apps Script 템플릿 코드 확인
   - 구현 완성도 확인
   - 필요한 기능이 모두 포함되어 있는지 확인

## 작업 수행 방법

1. 위 파일들을 하나씩 확인하며 검토
2. 완료된 부분과 미완성 부분을 구분
3. 미완성 부분이나 개선이 필요한 부분을 TASKS.md의 체크리스트에 맞춰 작업
4. 작업 완료 시 WORKLOG.md에 기록

## 참고 문서

- `API_SPEC.md`: API 인터페이스 정의
- `TASKS.md`: 전체 작업 할당 및 체크리스트
- `WORKLOG.md`: 작업 진행 상황 로그

## 질문이 있으면

오케스트레이터에게 문의하세요.

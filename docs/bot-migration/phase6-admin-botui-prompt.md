# Phase 6 프롬프트: 팀대시보드 어드민에 카카오봇 관리 UI + 이용통계 반영
**담당 AI**: Sonnet 4.5

---

# 🎯 역할: 코딩 담당 (웹 어드민 UI + 통계 로그 반영)

## 목표

팀대시보드의 기존 어드민 페이지(정적 `dist/admin.html` + `dist/admin.js`)에 **“카카오봇 관리” 섹션**을 추가하고,
해당 조작을 **이용통계(UserActionLog)** 에 반영합니다.

---

## ✅ 현재 구조(확인된 사실)

### 1) 대시보드 UI는 React SPA가 아니라 **정적 dist 기반**
- `/Users/hoonsbook/AI vive coding projects/Test1/server.js`에서 `dist/` 정적 서빙
- 관리자 페이지: `dist/admin.html` + `dist/admin.js`
- 이용통계 페이지: `dist/stats.html` + `dist/stats.js`

### 2) 통계(로그) 저장/집계 구조
- 로그 적재: `POST /api/log/action`  (server.js에서 `app.use('/api', logRouter)`로 마운트)
- 통계 집계: `GET /api/stats/summary` (stats.js가 호출)
- `routes/log.js` 내부 `ALL_ACTIONS`에 액션이 등록되어야 “0건 포함” 통계에 노출됨

### 3) 봇 설정/현황 API는 이미 구현됨(Phase 3-A)
- `GET /api/bot/config`
- `POST /api/bot/config`
- `GET /api/bot/outbox/stats`
- 봇 API 인증: `X-BOT-TOKEN` 필요

> 주의: 브라우저에서 이 토큰을 호출하려면, 프론트에 토큰을 넣어야 해서 보안 이슈가 생김.
> 따라서 **웹 어드민 UI는 봇 API 토큰으로 직접 호출하지 않고**, “어드민 패스워드 기반” 또는 “별도 어드민 API” 방식으로 접근 제어하는 설계를 선택해야 함.

---

## 🔐 구현 전략(선택지)

### 권장안(A): 어드민 전용 API 래퍼 추가 (보안상 권장)
1) 서버에 `ADMIN_PASSWORD` 기반 인증(기존 어드민 페이지에서 이미 쓰는 비번)을 사용해
2) 서버가 내부적으로 Bot API 기능을 수행(Setting 저장/조회, Outbox stats 조회)

즉, 브라우저는 `ADMIN_PASSWORD`를 서버에 전달하고 서버가 응답.

### 차선안(B): Bot API 토큰을 어드민 UI에 넣기 (비권장)
- 토큰 노출 위험(브라우저 소스/네트워크 탭에서 노출)

**이 작업에서는 권장안(A)로 구현하세요.**

---

## 📋 구현해야 할 변경점(파일별)

### 1) 백엔드: 어드민 래퍼 API 추가 (server.js 또는 routes 신규)

#### (1) POST /api/admin/auth
- 입력: `{ password: string }`
- 성공: `{ success: true, token: "<sessionToken>" }`
- 실패: 401

세션 토큰은 간단히 메모리(서버 재시작 시 초기화)로 관리하거나, 서명된 JWT를 사용.
외부 패키지 추가 없이 하려면 `crypto`로 랜덤 토큰 생성 + 메모리 Map 관리 권장.

#### (2) GET /api/admin/bot/config
- 헤더: `X-ADMIN-TOKEN: <token>`
- 동작: Setting에서 `kakao_rooms`, `kakao_admins` 조회 후 JSON 반환

#### (3) POST /api/admin/bot/config
- 헤더: `X-ADMIN-TOKEN: <token>`
- 입력: `{ rooms: [...], admins: [...] }`
- 동작: Setting에 저장(upsert)

#### (4) GET /api/admin/bot/outbox/stats
- 헤더: `X-ADMIN-TOKEN: <token>`
- 동작: BotOutbox에서 pending/sent/failed count 및 recentLogs 반환

> 위 3개는 이미 Bot API로 구현되어 있으니 코드를 재사용하거나 동일 로직을 복사해도 됨.

---

### 2) 프론트(정적): dist/admin.html에 UI 섹션 추가

`admin.html`은 이미 관리자 설정(키워드/조건/주제/토큰제한/메일링 등)이 있음.
그 아래 또는 적절한 위치에 다음 섹션 추가:

#### (1) “카카오봇 관리” 카드
- 탭은 필요 없고, 카드 내 섹션 3개로 구성(간단 버전):
  1) **방 관리**: 테이블 + “방 추가” 버튼 + 토글(활성/일정알림/명령)
  2) **관리자 닉네임**: 칩 목록 + 추가 입력
  3) **발송 현황**: pending/sent/failed 숫자 + 최근 로그 테이블(최대 10개)

UI는 Bootstrap5로 기존 스타일과 맞추세요.

---

### 3) 프론트(정적): dist/admin.js에 로직 추가

#### (0) 어드민 인증 흐름 정리
기존 admin.js는 비번이 맞으면 `isAuthenticated=true`만 설정.
이를 확장해서:
1) 비번 확인 성공 시 `POST /api/admin/auth` 호출
2) 응답으로 받은 `X-ADMIN-TOKEN`을 메모리 변수로 저장
3) 이후 bot config/stats는 admin 래퍼 API 호출

#### (1) 봇 설정 로드/저장
- 페이지 진입 시:
  - `GET /api/admin/bot/config` 호출 → 방/관리자 렌더링
- 토글/추가/삭제 시:
  - 현재 상태를 구성해서 `POST /api/admin/bot/config` 저장

#### (2) Outbox 상태 표시
- `GET /api/admin/bot/outbox/stats?limit=10` 호출
- pending/sent/failed 표시 + 로그 테이블 렌더링
- “새로고침” 버튼 제공

#### (3) 이용통계 로그 적재
admin.js에 이미 `logUserAction(action, meta)`가 있음.
아래 액션들을 추가로 기록하세요 (type은 admin으로 유지):
- `카카오봇_설정조회`
- `카카오봇_설정저장`
- `카카오봇_방추가`
- `카카오봇_방삭제`
- `카카오봇_방토글_enabled`
- `카카오봇_방토글_scheduleNotify`
- `카카오봇_방토글_commandsEnabled`
- `카카오봇_outbox조회`

> meta에는 roomName, 변경값 등을 넣기

---

### 4) 통계 목록 반영: routes/log.js의 ALL_ACTIONS 업데이트

`routes/log.js`의 `ALL_ACTIONS`에 위 `카카오봇_*` 액션을 추가하세요.
type은 `admin`으로 추가하면 stats.html의 “관리자” 구분에서 보입니다.

---

## 🎯 완료 조건

1) `admin.html`에서 카카오봇 관리 섹션이 보임
2) 방 추가/토글/관리자 추가 시 Setting에 저장됨
3) Outbox stats가 화면에 표시됨
4) 위 동작들이 `POST /api/log/action`로 기록됨
5) `stats.html`에서 액션이 목록에 뜨고(0건 포함), 실제로 건수가 증가함

---

## 제출물
1) 수정/추가된 파일 목록
2) 테스트 방법(브라우저에서 admin.html → 카카오봇 관리 조작 → stats.html 확인)


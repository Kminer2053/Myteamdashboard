# Phase 5: 배포 가이드 및 운영 문서

본 문서는 **카카오톡 봇 연동 개선 프로젝트(Outbox 패턴 + AVD 메신저봇R)** 의 **배포 체크리스트**, **통합 테스트 시나리오**, **운영 가이드(Runbook)**, **롤백 계획**, **향후 개선 로드맵**, **프로젝트 요약**을 제공합니다.

---

## 1. 배포 체크리스트

### 1-0. 배포 전 전체 검증 체크리스트 (요약)

- [ ] **환경변수(백엔드)**: `MONGODB_URI`, `BOT_API_TOKEN`, `ADMIN_PASSWORD` 설정 완료
- [ ] **정적 파일 배포**: `dist/` 최신 빌드 반영(특히 `admin.html`, `admin.js`)
- [ ] **어드민 UI API 주소 확인**: `dist/admin.html`의 `window.VITE_API_URL`이 실제 백엔드 주소와 일치
- [ ] **어드민 인증 동작 확인**
  - [ ] `POST /api/admin/auth`로 토큰 발급 성공
  - [ ] 이후 호출에 `X-ADMIN-TOKEN` 헤더를 붙이면 `GET/POST /api/admin/bot/*` 정상 동작
  - [ ] 토큰 없이 호출 시 401(정상)
- [ ] **봇 API 동작 확인(AVD용)**: `GET /api/bot/config`, `GET /api/bot/outbox/stats`가 `X-BOT-TOKEN`으로 정상 동작
- [ ] **설정 일관성 확인**: 어드민에서 저장한 `kakao_rooms`, `kakao_admins`가 `/api/bot/config`에도 동일하게 반영
- [ ] **Outbox 플로우 통합 확인**: 일정 등록 → Outbox 적재(pending) → AVD 전송 → ack 후 sent 전환
- [ ] **이용통계 반영 확인**: 어드민 UI에서 봇관리 기능 사용 시 `/api/log/action` 기록 및 `/api/stats/summary` 집계 확인

### 1-1. 백엔드 (Test1 프로젝트)

- [ ] **Node 버전 확인**: `package.json` 기준 Node **22.x**
- [ ] **환경변수 설정**
  - [ ] `.env`에 `BOT_API_TOKEN` 설정 (최소 32자 랜덤 문자열)
  - [ ] `.env`에 `ADMIN_PASSWORD` 설정 (기본값 `admin123` 사용 금지)
  - [ ] `.env`에 `MONGODB_URI` 설정 및 연결 확인
- [ ] **MongoDB 연결 확인**
  - [ ] 앱 기동 시 에러 없이 연결되는지 로그/상태 확인
- [ ] **BotOutbox 인덱스 생성 확인**
  - [ ] `models/BotOutbox.js` 인덱스 4개 생성 여부 확인 (아래 “검증 방법” 참고)
- [ ] **서버 재시작**
  - [ ] 프로세스 매니저/배포 환경에 맞게 재시작(예: 시스템 서비스/PM2/컨테이너)
- [ ] **봇 API 인증 동작 확인**
  - [ ] `X-BOT-TOKEN` 헤더 없이 호출 시 401
  - [ ] `X-BOT-TOKEN` 값이 `BOT_API_TOKEN`과 불일치 시 401

#### BotOutbox 인덱스 검증 방법 (MongoDB)

Mongo shell 또는 GUI에서 다음을 확인합니다.

```js
// 컬렉션명은 Mongoose 모델명에 따라 보통 소문자 복수형입니다.
db.botoutboxes.getIndexes()
```

기대 인덱스(이름 기준):
- `pull_query_index` (status + priority + createdAt)
- `dedupe_index` (dedupeKey unique+sparse)
- `lock_cleanup_index` (lockedAt)
- `sent_log_index` (sentAt)

> 참고: Mongoose의 인덱스 생성은 환경 설정(예: `autoIndex`)에 영향을 받을 수 있습니다. 프로덕션에서 인덱스가 생성되지 않았다면, 기동 로그/환경 설정을 점검하고 인덱스를 수동 생성하세요.

---

### 1-2. 어드민 봇관리 UI (대시보드 Admin)

- [ ] **접속 경로 확인**: `dist/` 정적 서빙으로 `/admin.html` 접속 가능
- [ ] **인증 플로우 확인**
  - [ ] 진입 시 비밀번호 모달 표시
  - [ ] 비밀번호 입력 → `POST /api/admin/auth` 성공 시 토큰 발급
  - [ ] 이후 어드민 API 호출에 `X-ADMIN-TOKEN` 헤더가 포함되는지 확인
- [ ] **세션 특성 이해(중요)**
  - [ ] 어드민 세션은 **메모리 기반**이라 서버 재시작/재배포 시 토큰이 무효화됨(재인증 필요)
  - [ ] 세션 만료: 24시간
- [ ] **UI 기능 점검**
  - [ ] 방 추가/삭제
  - [ ] 토글 3종: `enabled`, `scheduleNotify`, `commandsEnabled`
  - [ ] 관리자 닉네임 추가/삭제
  - [ ] 발송 현황(Outbox) 카운트/최근 로그 테이블 표시 및 새로고침

---

### 1-2. AVD 봇 (AVD-KakaoBot)

- [ ] **`config.js` 설정**
  - [ ] `SERVER_URL` (예: `https://<backend-domain>` 또는 `http://<host>:4000`)
  - [ ] `BOT_TOKEN` (백엔드의 `BOT_API_TOKEN`과 동일)
  - [ ] (구현에 따라) `DEVICE_ID`, `POLL_INTERVAL_MS`/`pollIntervalSec` 등 필수 설정 확인
- [ ] **메신저봇R에 스크립트 업로드**
  - [ ] `bot.js` 및 `handlers/`, `utils/` 포함 전체 반영
- [ ] **접근성 권한 확인**
  - [ ] 메신저봇R/자동화에 필요한 접근성 권한 활성화
- [ ] **카카오톡 로그인 상태 확인**
  - [ ] 실제 알림을 전송할 계정으로 로그인 유지
- [ ] **봇 시작 및 초기화 로그 확인**
  - [ ] 첫 폴링 실행/설정 동기화 로그
  - [ ] `/api/bot/config` 조회 성공 확인

---

## 2. 통합 테스트 시나리오

### 테스트 1: 일정 등록 → 카톡 알림

1. 대시보드에서 일정 등록
2. **15초 내** 카톡방에 알림 도착 확인
3. `BotOutbox` 상태 확인
   - 기대: `status='sent'`, `sentAt` 존재

검증 팁:
- 백엔드: `GET /api/bot/outbox/stats`로 `pending/sent/failed` 및 최근 로그 확인(“운영 가이드” 참고)
- MongoDB: `db.botoutboxes.find({ type: 'schedule_create' }).sort({ createdAt: -1 }).limit(5)`

---

### 테스트 2: 관리자 명령어

1. 관리자가 카톡방에서 `!방추가 테스트방` 입력
2. 봇 응답 확인
3. 서버 설정 반영 확인
   - 기대: `Setting`의 `kakao_rooms` 값에 해당 방이 추가됨

검증 팁:
- `GET /api/bot/config` 응답에 `rooms` 배열 반영 확인

---

### 테스트 3: 전송 실패 → 재시도

1. 존재하지 않는 방에 메시지 적재(또는 방 이름을 일부러 틀리게 설정)
2. 실패 후 `attempts` 증가 확인
3. **5회 실패** 후 `status='failed'` 확인

재시도 정책(백엔드 구현 기준):
- `attempts=1` → 약 1분 대기
- `attempts=2` → 약 2분 대기
- `attempts=3` → 약 4분 대기
- `attempts=4` → 약 8분 대기
- `attempts>=5` → `failed`로 전환(더 이상 pull 대상 아님)

---

### 테스트 4: 어드민 봇관리 UI - 인증/설정 조회/설정 저장

1. `/admin.html` 접속
2. 관리자 비밀번호 입력 → 인증 성공 확인
   - 기대: `POST /api/admin/auth` 성공, 응답에 `token` 존재
3. “카카오봇 관리” 섹션이 정상 렌더링되는지 확인
4. 봇 설정 로드 확인
   - 기대: `GET /api/admin/bot/config` 성공(헤더: `X-ADMIN-TOKEN`)
   - 기대: 방 목록/관리자 닉네임이 화면에 표시
5. 방 추가/삭제 및 토글 동작 확인
   - 방 추가: 기본값 `enabled=true`, `scheduleNotify=true`, `commandsEnabled=true`
   - 토글 변경 시 즉시 저장되는지 확인(설정 저장 API 호출)
6. 관리자 닉네임 추가/삭제 확인
7. 페이지 새로고침 후 재진입 시 재인증이 필요한지 확인
   - 기대: 토큰은 클라이언트에 영구 저장되지 않으므로 새로고침 시 다시 인증 필요

---

### 테스트 5: 어드민 봇관리 UI - 발송 현황 모니터링

1. `/admin.html`에서 “발송 현황”의 “새로고침” 클릭
2. `GET /api/admin/bot/outbox/stats?limit=10` 성공 확인
3. `pending/sent/failed` 카운트가 화면에 반영되는지 확인
4. 최근 로그 테이블에 `targetRoom`, `message(100자 트렁케이트)`, `status`, `attempts`, `time`이 정상 표시되는지 확인

---

### 테스트 6: 이용통계 반영(어드민 봇관리 UI 액션)

어드민 UI에서 아래 동작을 수행한 뒤, 집계 API에서 카운트가 증가하는지 확인합니다.

- 수행 동작(예시)
  - 봇 설정 조회(페이지 진입 후 자동 로드)
  - 설정 저장(토글/방 추가/방 삭제/관리자 닉네임 변경 등)
  - Outbox 조회(발송 현황 새로고침)
- 기대 액션(서버 고정 목록 `routes/log.js` 기준)
  - `카카오봇_설정조회`, `카카오봇_설정저장`, `카카오봇_방추가`, `카카오봇_방삭제`
  - `카카오봇_방토글_enabled`, `카카오봇_방토글_scheduleNotify`, `카카오봇_방토글_commandsEnabled`
  - `카카오봇_outbox조회`

검증 팁:
- `POST /api/log/action` 기록 여부 확인(요청 본문 `type: "admin"`)
- `GET /api/stats/summary?type=admin&start=<ISO>&end=<ISO>`로 집계 확인

---

## 3. 운영 가이드 (Runbook)

### 3-1. 일상 모니터링

- **Outbox 상태 모니터링**
  - 주기적으로 `GET /api/bot/outbox/stats` 확인
  - **pending 누적**: AVD 봇 상태(폴링/전송/로그인/권한) 우선 점검
  - **failed 증가**: 최근 `lastError` 및 방 설정/카카오 상태 점검

#### 운영용 API 호출 예시 (curl)

```bash
# 1) 통계 조회
curl -sS \
  -H "X-BOT-TOKEN: <BOT_API_TOKEN>" \
  "http://localhost:4000/api/bot/outbox/stats?limit=10"

# 2) 봇 설정 조회
curl -sS \
  -H "X-BOT-TOKEN: <BOT_API_TOKEN>" \
  "http://localhost:4000/api/bot/config"
```

> 보안: Bot API는 **항상** `X-BOT-TOKEN` 헤더가 필요합니다(미들웨어: `middleware/botAuth.js`).

---

### 3-2. 장애 대응

#### 케이스 A: 봇 연결 끊김 / 폴링 중단

- 증상
  - `pending`이 계속 증가, `sent`가 증가하지 않음
  - AVD 로그에 폴링 로그가 더 이상 찍히지 않음
- 조치
  - AVD 봇(메신저봇R) 재시작
  - AVD(에뮬레이터/디바이스) 자체 재시작
  - 접근성 권한/카카오 로그인 상태 재확인
  - 백엔드 도메인/네트워크 접근 가능 여부 확인

#### 케이스 B: 메시지 누적(백엔드는 정상, 전송만 정체)

- 증상
  - `GET /api/bot/outbox/stats`에서 `pending`이 누적
  - AVD는 실행 중이지만 전송이 실패/지연
- 조치
  - 최근 `recentLogs`의 `lastError` 확인
  - 방 이름(`targetRoom`)이 실제 카톡방명과 일치하는지 확인
  - 카카오 UI 변화/권한 이슈 여부 확인(수동으로 한 번 메시지 전송 시도)

#### 케이스 C: 인증 실패(401)

- 증상
  - AVD 로그에 401 또는 “인증 실패” 응답
- 조치
  - 백엔드 `.env`의 `BOT_API_TOKEN`과 AVD `config.js`의 `BOT_TOKEN`이 **완전히 동일**한지 확인
  - 토큰 변경 시에는 **백엔드 + AVD를 동시에 변경** 후 재기동

---

### 3-3. 설정 변경

#### 카톡에서 설정 변경(권장: 운영 편의)

- 방 추가/삭제: `!방추가 <방이름>`, `!방삭제 <방이름>`
- 방 알림 ON/OFF: `!방 <방이름> on|off`
- 일정알림 ON/OFF: `!일정알림 <방이름> on|off`
- 명령어 ON/OFF: `!명령 <방이름> on|off`

> 실제 동작은 AVD 봇 구현(관리자 핸들러)에 따릅니다.

#### API로 설정 변경(필요 시)

백엔드는 다음 키로 설정을 저장합니다.
- `kakao_rooms`
- `kakao_admins`

`POST /api/bot/config`는 `admins`, `rooms`를 **배열(Array)** 로 받아 저장합니다.

```bash
curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "X-BOT-TOKEN: <BOT_API_TOKEN>" \
  -d '{"admins":[],"rooms":[]}' \
  "http://localhost:4000/api/bot/config"
```

---

## 4. 롤백 계획

문제 발생 시(대규모 전송 장애, 잘못된 방 전송, 인증/권한 이슈 장기화 등) 다음 순서로 롤백합니다.

1. **AVD 봇 중단**
   - 폴링/전송을 즉시 멈춰 Outbox 소비를 중단
2. **BotOutbox pending 메시지 확인**
   - 누적량, 대상 방, 메시지 내용 점검
3. **필요 시 수동 처리 또는 삭제**
   - 운영 정책에 따라: 수동 공지/재전송/정리
4. **기존 파이썬 봇 재활성화(있는 경우)**
   - 기존 운영 체계로 즉시 복귀

---

## 5. 향후 개선 로드맵

### Phase 2 (선택적)

- [x] 웹 대시보드에 봇 관리 UI 추가 (완료)
- [x] Outbox 모니터링 화면 (기본형 완료: 카운트+최근로그)
- [ ] 실시간 알림(WebSocket)

### Phase 3 (선택적)

- [ ] 다중 AVD 봇 지원 강화
- [ ] 메시지 템플릿 커스터마이징
- [ ] 통계 대시보드

---

## 6. 프로젝트 요약

### 구현된 기능

1. ✅ 스케줄 변경 시 카톡 자동 알림
2. ✅ Outbox 패턴으로 안정적 전송
3. ✅ 방별 알림 ON/OFF 설정
4. ✅ 관리자 명령어 (카톡에서 설정 변경)
5. ✅ 재시도 정책 (지수 백오프)
6. ✅ 기존 명령어 응답 유지
7. ✅ 어드민 페이지에 카카오봇 관리 UI 추가(방/관리자/발송현황)
8. ✅ 어드민 래퍼 API 추가(`/api/admin/*`, 세션 토큰 기반)
9. ✅ 이용통계에 봇관리 액션 반영(8개 액션)

### 프로젝트 구조

```
Test1/                          (백엔드)
├── models/BotOutbox.js
├── middleware/botAuth.js
├── server.js (수정)
└── .env (BOT_API_TOKEN)

AVD-KakaoBot/                   (봇)
├── bot.js
├── config.js
├── handlers/
│   ├── outboxHandler.js
│   ├── adminHandler.js
│   └── commandHandler.js
└── utils/
    ├── api.js
    ├── messageFormatter.js
    └── logger.js
```


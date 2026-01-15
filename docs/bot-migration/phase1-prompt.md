# Phase 1 프롬프트: 기능정의/개발기획
**담당 AI**: Sonnet 4.5

---

# 🎯 역할: 기능정의/개발기획 담당

## 프로젝트 개요
카카오톡 봇 연동 개선 - 파이썬 PC봇 → AVD 메신저봇R 전환

## 현재 코드베이스 구조
- **백엔드 경로**: `/Users/hoonsbook/AI vive coding projects/Test1/`
- **프레임워크**: Express + MongoDB/Mongoose
- **기존 카카오 엔드포인트**: `POST /kakao/message` (명령어 응답)
- **스케줄 CRUD**: `POST/PUT/DELETE /api/schedules`
- **이메일 알림**: 스케줄 변경 시 `sendScheduleEmail()` 호출
- **설정 저장**: Setting 모델 (`key='emails'`에 JSON 배열)

## 📋 작업 요청: 상세 기획서 작성

### 1. BotOutbox 모델 스키마 (MongoDB)
다음 필드를 포함한 **완전한 Mongoose 스키마** 정의:

**필수 필드:**
- `targetRoom` (String, required): 카톡 방 이름
- `message` (String, required): 보낼 메시지 텍스트
- `type` (String, enum): `'schedule_create'` | `'schedule_update'` | `'schedule_delete'` | `'manual'`
- `status` (String, enum): `'pending'` | `'sent'` | `'failed'`
- `attempts` (Number, default: 0): 시도 횟수
- `lastError` (String): 마지막 에러 메시지
- `dedupeKey` (String, unique, sparse): 중복 방지 키
- `priority` (Number, default: 0): 우선순위 (0=일반, 1=긴급)

**선택 필드:**
- `scheduleId` (ObjectId, ref: 'Schedule'): 원본 스케줄 참조
- `lockedAt` (Date): 처리 잠금 시각
- `lockedByDeviceId` (String): 처리 중인 AVD 디바이스 ID
- `sentAt` (Date): 전송 완료 시각

**타임스탬프:**
- `createdAt`, `updatedAt` (자동 생성)

**인덱스 추가:**
- `status + priority + createdAt` (pull 쿼리 최적화)
- `dedupeKey` (중복 방지)

---

### 2. API 엔드포인트 상세 스펙

#### 2-1. GET /api/bot/config
**목적**: AVD봇이 시작 시 또는 주기적으로 설정을 가져옴

**헤더:**
```
X-BOT-TOKEN: <봇 인증 토큰>
```

**응답 200:**
```json
{
  "admins": ["Kminer", "홍길동"],
  "rooms": [
    {
      "roomName": "미래성장처",
      "enabled": true,
      "scheduleNotify": true,
      "commandsEnabled": true
    }
  ],
  "pollIntervalSec": 15
}
```

**에러 401:**
```json
{
  "error": "인증 실패"
}
```

---

#### 2-2. POST /api/bot/config
**목적**: 관리자가 설정 변경

**헤더:**
```
X-BOT-TOKEN: <봇 인증 토큰>
Content-Type: application/json
```

**요청 Body:**
```json
{
  "admins": ["Kminer", "홍길동"],
  "rooms": [
    {
      "roomName": "미래성장처",
      "enabled": true,
      "scheduleNotify": true,
      "commandsEnabled": true
    }
  ]
}
```

**응답 200:**
```json
{
  "success": true,
  "message": "설정이 저장되었습니다"
}
```

---

#### 2-3. POST /api/bot/outbox/pull
**목적**: AVD봇이 전송할 메시지 가져오기

**헤더:**
```
X-BOT-TOKEN: <봇 인증 토큰>
Content-Type: application/json
```

**요청 Body:**
```json
{
  "deviceId": "avd-01",
  "limit": 20
}
```

**응답 200:**
```json
{
  "items": [
    {
      "id": "67a1b2c3d4e5f6...",
      "targetRoom": "미래성장처",
      "message": "[일정 등록] 제목: 팀미팅\n일시: 2026년 01월 20일 14:00\n내용: 분기 계획 논의",
      "type": "schedule_create",
      "priority": 0
    }
  ]
}
```

**처리 로직:**
1. `status='pending'`이고 `attempts < 5`인 메시지만 조회
2. 지수 백오프 계산: 마지막 실패 후 `2^attempts` 분 경과한 것만
3. `priority` 내림차순 → `createdAt` 오름차순 정렬
4. `limit`만큼만 반환
5. 반환된 메시지의 `lockedAt`, `lockedByDeviceId` 업데이트 (5분간 잠금)

---

#### 2-4. POST /api/bot/outbox/ack
**목적**: 전송 결과 확인

**헤더:**
```
X-BOT-TOKEN: <봇 인증 토큰>
Content-Type: application/json
```

**요청 Body:**
```json
{
  "deviceId": "avd-01",
  "results": [
    {
      "id": "67a1b2c3d4e5f6...",
      "status": "sent"
    },
    {
      "id": "67a1b2c3d4e5f7...",
      "status": "failed",
      "error": "room session missing"
    }
  ]
}
```

**응답 200:**
```json
{
  "success": true,
  "updated": 2
}
```

**처리 로직:**
- `sent`: `status='sent'`, `sentAt=now`, lock 해제
- `failed`: `attempts++`, `lastError` 저장, lock 해제
  - `attempts >= 5` → `status='failed'` (더 이상 재시도 안 함)
  - `attempts < 5` → `status='pending'` (재시도 대기)

---

#### 2-5. GET /api/bot/outbox/stats
**목적**: 모니터링 대시보드용 통계

**헤더:**
```
X-BOT-TOKEN: <봇 인증 토큰>
```

**쿼리 파라미터:**
- `limit` (optional, default: 10): 최근 로그 개수

**응답 200:**
```json
{
  "pending": 5,
  "sent": 120,
  "failed": 2,
  "recentLogs": [
    {
      "id": "...",
      "targetRoom": "미래성장처",
      "message": "[일정 등록] ...",
      "status": "sent",
      "sentAt": "2026-01-15T10:30:00Z",
      "type": "schedule_create"
    }
  ]
}
```

---

### 3. 인증 미들웨어 스펙

**구현 위치**: `server.js` 또는 `middleware/botAuth.js`

**코드:**
```javascript
function botAuthMiddleware(req, res, next) {
  const token = req.headers['x-bot-token'];
  if (!token || token !== process.env.BOT_API_TOKEN) {
    return res.status(401).json({ error: '인증 실패' });
  }
  next();
}
```

**적용**: 모든 `/api/bot/*` 엔드포인트에 적용

**환경변수**: `.env`에 `BOT_API_TOKEN=your-secret-token` 추가

---

### 4. Setting 저장 구조

#### kakao_rooms
```json
{
  "key": "kakao_rooms",
  "value": "[{\"roomName\":\"미래성장처\",\"enabled\":true,\"scheduleNotify\":true,\"commandsEnabled\":true}]"
}
```

#### kakao_admins
```json
{
  "key": "kakao_admins",
  "value": "[\"Kminer\",\"홍길동\"]"
}
```

---

### 5. enqueueScheduleKakao 함수 스펙

**위치**: `server.js` (sendScheduleEmail 함수 옆)

**시그니처:**
```javascript
async function enqueueScheduleKakao(action, schedule, prevSchedule = null)
```

**동작 흐름:**
1. Setting에서 `kakao_rooms` 조회
2. `enabled=true AND scheduleNotify=true`인 방만 필터링
3. 각 방에 대해 BotOutbox에 메시지 적재:
   - `targetRoom`: 방 이름
   - `message`: 템플릿 기반 메시지 생성
   - `type`: `schedule_${action}`
   - `status`: `'pending'`
   - `priority`: 0
   - `scheduleId`: schedule._id
   - `dedupeKey`: `schedule:${action}:${schedule._id}:${Date.now()}`
4. 중복 체크: 동일 dedupeKey 있으면 스킵

**호출 위치:**
- `POST /api/schedules`: `await enqueueScheduleKakao('create', schedule);`
- `PUT /api/schedules/:id`: `await enqueueScheduleKakao('update', schedule, prevSchedule);`
- `DELETE /api/schedules/:id`: `await enqueueScheduleKakao('delete', schedule);`

---

### 6. 메시지 템플릿

#### create
```
[일정 등록]
제목: {schedule.title}
일시: {formatKST(schedule.start)}
내용: {schedule.content || '내용 없음'}

대시보드: https://myteamdashboard.vercel.app/index.html
```

#### update
```
[일정 변경]
제목: {schedule.title}

변경 전 일시: {formatKST(prevSchedule.start)}
변경 후 일시: {formatKST(schedule.start)}

변경 전 내용: {prevSchedule.content || '내용 없음'}
변경 후 내용: {schedule.content || '내용 없음'}

대시보드: https://myteamdashboard.vercel.app/index.html
```

#### delete
```
[일정 취소]
제목: {schedule.title}
일시: {formatKST(schedule.start)}
내용: {schedule.content || '내용 없음'}

대시보드: https://myteamdashboard.vercel.app/index.html
```

---

### 7. 재시도 정책 (지수 백오프)

| 시도 횟수 | 대기 시간 | 비고 |
|----------|----------|------|
| 1차 실패 | 1분 후 | 2^0 = 1분 |
| 2차 실패 | 2분 후 | 2^1 = 2분 |
| 3차 실패 | 4분 후 | 2^2 = 4분 |
| 4차 실패 | 8분 후 | 2^3 = 8분 |
| 5차 실패 | 16분 후 | 2^4 = 16분 |
| 6차 이상 | 재시도 중단 | `status='failed'` |

**구현**: pull API에서 `updatedAt + (2^attempts) * 60000`보다 현재 시각이 큰 것만 조회

---

### 8. AVD봇 프로젝트 구조

**폴더 구조:**
```
AVD-KakaoBot/
├── README.md              ← 설치 및 사용법
├── bot.js                 ← 메인 스크립트 (메신저봇R)
├── config.js              ← 서버 URL, 토큰 설정
├── package.json           ← (선택) Node.js 패키지 정보
├── handlers/
│   ├── commandHandler.js  ← 일반 명령 처리 (/kakao/message 호출)
│   ├── adminHandler.js    ← 관리자 명령 처리 (!방추가 등)
│   └── outboxHandler.js   ← Outbox 폴링/전송/ACK 처리
└── utils/
    └── api.js             ← HTTP 요청 유틸리티
```

**주요 파일 역할:**

1. **bot.js**
   - 메신저봇R 이벤트 리스너
   - 초기화 및 설정 로드
   - 폴링 타이머 시작

2. **config.js**
   ```javascript
   module.exports = {
     SERVER_URL: 'http://10.0.2.2:5000', // AVD에서 호스트 접근
     BOT_TOKEN: 'your-bot-token',
     POLL_INTERVAL_MS: 15000, // 15초
     MAX_MESSAGE_LENGTH: 3000 // 카톡 메시지 길이 제한
   };
   ```

3. **commandHandler.js**
   - 일반 사용자 명령어 감지 (리스크, 제휴, 일정 등)
   - POST /kakao/message 호출
   - 응답 메시지를 방에 전송

4. **adminHandler.js**
   - 관리자 명령어 파싱
   - 서버 설정 변경 (POST /api/bot/config)
   - 로컬 캐시 동기화

5. **outboxHandler.js**
   - 주기적 pull → 전송 → ack
   - 메시지 분할 처리 (3000자 초과 시)
   - 전송 실패 시 에러 정보 수집

---

### 9. 관리자 명령어 목록

| 명령어 | 기능 | 예시 |
|--------|------|------|
| `!방추가 <방이름>` | 새 방 추가 | `!방추가 개발팀` |
| `!방삭제 <방이름>` | 방 삭제 | `!방삭제 개발팀` |
| `!방 on <방이름>` | 방 활성화 | `!방 on 미래성장처` |
| `!방 off <방이름>` | 방 비활성화 | `!방 off 미래성장처` |
| `!일정알림 on <방이름>` | 일정 알림 ON | `!일정알림 on 미래성장처` |
| `!일정알림 off <방이름>` | 일정 알림 OFF | `!일정알림 off 미래성장처` |
| `!명령 on <방이름>` | 명령 응답 ON | `!명령 on 미래성장처` |
| `!명령 off <방이름>` | 명령 응답 OFF | `!명령 off 미래성장처` |
| `!방목록` | 전체 방 목록 조회 | `!방목록` |
| `!상태` | 봇 상태 확인 | `!상태` |

---

### 10. 시퀀스 다이어그램

#### 스케줄 등록 → 카톡 알림
```
사용자 → 대시보드: 일정 등록
대시보드 → 백엔드: POST /api/schedules
백엔드 → MongoDB: Schedule 저장
백엔드 → 이메일: sendScheduleEmail()
백엔드 → MongoDB: enqueueScheduleKakao() → BotOutbox 적재
백엔드 → 대시보드: 200 OK

--- 15초 후 ---

AVD봇 → 백엔드: POST /api/bot/outbox/pull
백엔드 → MongoDB: pending 메시지 조회
백엔드 → AVD봇: { items: [...] }
AVD봇 → 카톡방: 메시지 전송
AVD봇 → 백엔드: POST /api/bot/outbox/ack { status: "sent" }
백엔드 → MongoDB: status 업데이트
```

---

### 11. 에러 케이스 정의

| 에러 상황 | 처리 방법 |
|----------|----------|
| 카톡 방 세션 없음 | failed + 에러 저장, 재시도 |
| 메시지 전송 타임아웃 | failed + 재시도 |
| 서버 연결 실패 | AVD봇 로컬 큐에 보관, 연결 복구 후 재시도 |
| 토큰 인증 실패 | AVD봇 중단, 관리자 알림 |
| 중복 메시지 | dedupeKey로 스킵 |
| 메시지 3000자 초과 | 분할 전송 |

---

## 출력 요구사항

다음 형식으로 **마크다운 기획서**를 작성해주세요:

1. **프로젝트 개요** (1페이지)
2. **아키텍처 설계** (다이어그램 포함)
3. **데이터 모델** (BotOutbox 스키마)
4. **API 상세 스펙** (요청/응답 예시)
5. **함수 스펙** (enqueueScheduleKakao 등)
6. **AVD봇 구조** (폴더/파일 설명)
7. **에러 처리** (재시도 정책)
8. **보안 고려사항** (토큰, 닉네임 검증)
9. **배포 고려사항** (.env 설정 등)
10. **테스트 시나리오** (핵심 플로우 3개)

---

**이 프롬프트를 Sonnet 4.5에게 전달하고, 완성된 기획서를 Opus에게 가져와주세요!**

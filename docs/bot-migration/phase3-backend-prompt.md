# Phase 3-A 프롬프트: 백엔드 코딩
**담당 AI**: Sonnet 4.5

---

# 💻 역할: 백엔드 코딩 담당

## 프로젝트 개요
Phase 1 기획서와 Phase 2 UI 설계를 바탕으로 **백엔드 코드를 실제로 구현**합니다.

## 작업 범위

### 1. 신규 파일 생성
- `models/BotOutbox.js` - BotOutbox 모델
- `middleware/botAuth.js` - 봇 인증 미들웨어

### 2. 기존 파일 수정
- `server.js`:
  - Bot API 엔드포인트 추가 (5개)
  - `enqueueScheduleKakao()` 함수 구현
  - 스케줄 CRUD 3곳에 연결
  
### 3. 환경변수 추가
- `.env` 파일에 `BOT_API_TOKEN` 추가 (또는 `.env.example` 업데이트)

---

## 📋 구현 체크리스트

### Part 1: BotOutbox 모델 생성

**파일**: `/Users/hoonsbook/AI vive coding projects/Test1/models/BotOutbox.js`

**내용**: Phase 1 기획서의 3.1절 BotOutbox 스키마 그대로 구현
- 모든 필드 정의 (targetRoom, message, type, status, attempts 등)
- enum 값 정의
- 인덱스 3개 추가:
  - `{ status: 1, priority: -1, createdAt: 1 }` (pull 최적화)
  - `{ dedupeKey: 1 }` (중복 방지)
  - `{ lockedAt: 1 }` (잠금 정리)

---

### Part 2: 봇 인증 미들웨어

**파일**: `/Users/hoonsbook/AI vive coding projects/Test1/middleware/botAuth.js`

**내용**:
```javascript
function botAuthMiddleware(req, res, next) {
  const token = req.headers['x-bot-token'];
  
  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 없습니다' });
  }
  
  if (token !== process.env.BOT_API_TOKEN) {
    return res.status(401).json({ error: '인증 실패' });
  }
  
  next();
}

module.exports = botAuthMiddleware;
```

---

### Part 3: Bot API 엔드포인트 (server.js에 추가)

**위치**: `server.js` 파일 끝부분, 기존 API 다음

#### 3-1. GET /api/bot/config
- Setting에서 `kakao_rooms`, `kakao_admins` 조회
- JSON 파싱 후 응답
- Phase 1 기획서 4.2절 참고

#### 3-2. POST /api/bot/config
- 요청 body에서 `admins`, `rooms` 받기
- 유효성 검증 (Array 타입)
- Setting에 `upsert`로 저장
- Phase 1 기획서 4.3절 참고

#### 3-3. POST /api/bot/outbox/pull
- `deviceId`, `limit` 받기
- 조건:
  - `status='pending'`
  - `attempts < 5`
  - 잠금 없음 또는 만료 (5분)
  - 지수 백오프 계산
- 결과에 `lockedAt`, `lockedByDeviceId` 설정
- Phase 1 기획서 4.4절 참고

#### 3-4. POST /api/bot/outbox/ack
- `deviceId`, `results[]` 받기
- 각 result마다:
  - `sent` → status='sent', sentAt=now, lock 해제
  - `failed` → attempts++, lastError 저장
    - attempts >= 5 → status='failed'
    - attempts < 5 → status='pending' (재시도)
- Phase 1 기획서 4.5절 참고

#### 3-5. GET /api/bot/outbox/stats
- 상태별 카운트 (pending, sent, failed)
- 최근 로그 조회 (limit 파라미터)
- Phase 1 기획서 4.6절 참고

**모든 엔드포인트에 `botAuthMiddleware` 적용**

---

### Part 4: enqueueScheduleKakao 함수

**위치**: `server.js` (sendScheduleEmail 함수 아래)

**기능**:
1. Setting에서 `kakao_rooms` 조회
2. `enabled=true` AND `scheduleNotify=true` 방 필터링
3. 메시지 템플릿 생성 (action별로 다름)
4. 각 방에 BotOutbox 문서 생성:
   - dedupeKey: `schedule:${action}:${schedule._id}:${Date.now()}`
   - type: `schedule_${action}`
   - status: 'pending'
   - priority: 0
5. 중복 에러(11000) 무시

**메시지 템플릿**: Phase 1 기획서 6절 참고
- create: `[일정 등록]\n제목: ...\n일시: ...\n내용: ...`
- update: `[일정 변경]\n제목: ...\n변경 전/후 비교`
- delete: `[일정 취소]\n제목: ...\n일시: ...`

**Phase 1 기획서 5.1절 전체 코드 참고**

---

### Part 5: 스케줄 CRUD에 연결

**기존 코드 위치**: `server.js` 약 1420~1468라인

**수정 내용**:

#### POST /api/schedules
```javascript
const schedule = await Schedule.create(scheduleData);
await sendScheduleEmail('create', schedule);
await enqueueScheduleKakao('create', schedule); // ← 추가
res.json(schedule);
```

#### PUT /api/schedules/:id
```javascript
const prevSchedule = await Schedule.findById(req.params.id);
// ... 업데이트 로직
await sendScheduleEmail('update', schedule, prevSchedule);
await enqueueScheduleKakao('update', schedule, prevSchedule); // ← 추가
res.json(schedule);
```

#### DELETE /api/schedules/:id
```javascript
const schedule = await Schedule.findById(req.params.id);
await Schedule.findByIdAndDelete(req.params.id);
await sendScheduleEmail('delete', schedule);
await enqueueScheduleKakao('delete', schedule); // ← 추가
res.json({ success: true });
```

---

### Part 6: 환경변수 설정

**파일**: `.env` 또는 `.env.example`

**추가 내용**:
```bash
# 카카오봇 API 토큰
BOT_API_TOKEN=your-secret-token-here-min-32-chars
```

**토큰 생성 방법 (README에 추가 권장)**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚨 주의사항

### 1. 기존 코드 유지
- 기존의 이메일 알림(`sendScheduleEmail`)은 그대로 유지
- 카카오톡 알림은 **추가**하는 것

### 2. 에러 처리
- `enqueueScheduleKakao`에서 에러 발생해도 스케줄 저장은 성공해야 함
- try-catch로 감싸서 에러 로그만 출력

### 3. formatKST 함수
- 이미 `server.js`에 존재하는 `formatKST` 함수 재사용
- 없다면 Phase 1 기획서 5.1절의 코드 참고

### 4. 테스트 가능하도록
- 각 API는 Postman이나 curl로 테스트 가능해야 함
- 에러 메시지는 명확하게

---

## 📄 참고 문서

1. **Phase 1 기획서**: `/Users/hoonsbook/AI vive coding projects/Test1/docs/bot-migration/phase1-detailed-spec.md`
   - 특히 섹션 3, 4, 5 참고

2. **기존 코드**:
   - `server.js` (스케줄 CRUD 약 1318~1468라인)
   - `models/Schedule.js` (참고용)
   - `models/Setting.js` (참고용)

---

## 🎯 구현 순서 제안

1. ✅ BotOutbox 모델 생성 및 테스트
2. ✅ botAuth 미들웨어 생성
3. ✅ GET /api/bot/config 구현 → Postman 테스트
4. ✅ POST /api/bot/config 구현 → Postman 테스트
5. ✅ enqueueScheduleKakao 함수 구현
6. ✅ POST /api/bot/outbox/pull 구현 (복잡함, 주의)
7. ✅ POST /api/bot/outbox/ack 구현
8. ✅ GET /api/bot/outbox/stats 구현
9. ✅ 스케줄 CRUD 3곳에 연결
10. ✅ 전체 플로우 테스트

---

## 출력 형식

구현이 완료되면 다음을 보고해주세요:

1. **수정된 파일 목록**
2. **새로 생성된 파일 목록**
3. **테스트 방법** (curl 명령어 또는 Postman 예시)
4. **주의사항** (있다면)

---

**이 프롬프트를 Sonnet 4.5에게 전달하고, 코드 구현이 완료되면 Opus에게 코드 리뷰를 요청하세요!**

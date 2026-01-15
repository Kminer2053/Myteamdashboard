# 카카오톡 봇 연동 개선 프로젝트 - 상세 기획서

**프로젝트명**: 파이썬 PC봇 → AVD 메신저봇R 전환  
**작성일**: 2026년 1월 15일  
**담당**: Sonnet 4.5 (기능정의/개발기획)  
**버전**: 1.0

---

## 1. 프로젝트 개요

### 1.1 배경 및 목적

**현재 상황:**
- 파이썬 기반 PC 카카오톡 봇을 사용하여 일정 알림 및 명령어 처리
- 동기식 HTTP 요청 방식으로 인한 응답 지연 및 안정성 문제
- PC 환경 의존성으로 인한 유지보수 어려움

**전환 목적:**
- AVD(Android Virtual Device) 기반 메신저봇R로 전환하여 안정성 향상
- 비동기 큐(Outbox Pattern) 도입으로 응답 속도 개선
- 독립적인 봇 운영 환경 구축

### 1.2 주요 개선사항

1. **아키텍처 변경**: 동기식 → 비동기 큐 기반
2. **봇 플랫폼 변경**: 파이썬 PC봇 → AVD 메신저봇R
3. **메시지 신뢰성 향상**: 재시도 정책 및 지수 백오프 적용
4. **관리 편의성**: 웹 API 기반 설정 관리

### 1.3 프로젝트 범위

**Phase 1 (현재 단계):**
- BotOutbox 모델 및 API 구현
- 백엔드 큐 시스템 구축
- AVD 봇 기본 구조 설계

**향후 단계:**
- AVD 봇 상세 구현 (Phase 2)
- 대시보드 연동 및 모니터링 (Phase 3)
- 운영 및 최적화 (Phase 4)

---

## 2. 아키텍처 설계

### 2.1 전체 시스템 아키텍처

```
┌─────────────────┐
│   사용자        │
│   (대시보드)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│   Express 백엔드 서버           │
│   (Node.js + MongoDB)           │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Schedule CRUD API       │  │
│  │  /api/schedules          │  │
│  └──────────┬───────────────┘  │
│             │                   │
│             ├─→ sendScheduleEmail()  (기존)
│             │                   │
│             └─→ enqueueScheduleKakao()  (신규)
│                     │                   │
│                     ▼                   │
│  ┌──────────────────────────┐  │
│  │  BotOutbox 컬렉션        │  │
│  │  (MongoDB)               │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────┴───────────────┐  │
│  │  Bot API                 │  │
│  │  /api/bot/*              │  │
│  │  - /config               │  │
│  │  - /outbox/pull          │  │
│  │  - /outbox/ack           │  │
│  │  - /outbox/stats         │  │
│  └──────────┬───────────────┘  │
└─────────────┼───────────────────┘
              │
              │ HTTP (폴링: 15초 간격)
              │
         ┌────┴────┐
         │         │
    ┌────▼───┐ ┌──▼─────┐
    │ AVD봇1 │ │ AVD봇2 │ (선택적 다중 인스턴스)
    │        │ │        │
    └────┬───┘ └──┬─────┘
         │        │
         ▼        ▼
    ┌─────────────────┐
    │  카카오톡 방    │
    │  (미래성장처)   │
    └─────────────────┘
```

### 2.2 Outbox Pattern 적용

**동작 방식:**
1. 백엔드가 스케줄 변경 시 BotOutbox에 메시지 적재 (`status: pending`)
2. AVD봇이 주기적으로 `/api/bot/outbox/pull`을 호출하여 메시지 가져오기
3. AVD봇이 카톡방에 메시지 전송
4. AVD봇이 `/api/bot/outbox/ack`로 전송 결과 보고
5. 실패 시 재시도 정책에 따라 자동 재시도

**장점:**
- 백엔드와 봇의 느슨한 결합 (Loose Coupling)
- 백엔드 응답 속도 향상 (메시지 적재만 하고 즉시 리턴)
- 봇 장애 시에도 메시지 유실 없음
- 다중 봇 인스턴스 지원 가능

### 2.3 데이터 흐름

#### 일정 등록 시나리오:
```
사용자 → 대시보드: "팀미팅" 일정 등록
대시보드 → 백엔드: POST /api/schedules
백엔드 → MongoDB: Schedule 문서 저장
백엔드 → 이메일: sendScheduleEmail() 호출
백엔드 → MongoDB: enqueueScheduleKakao('create', schedule)
                  → BotOutbox 문서 생성 (status: pending)
백엔드 → 대시보드: 200 OK (즉시 응답)

--- 15초 후 (봇 폴링 주기) ---

AVD봇 → 백엔드: POST /api/bot/outbox/pull
               { deviceId: "avd-01", limit: 20 }
백엔드 → MongoDB: status='pending' 메시지 조회 + 락 설정
백엔드 → AVD봇: { items: [{ id, targetRoom, message, ... }] }
AVD봇 → 카톡방: "[일정 등록] 제목: 팀미팅..." 전송
AVD봇 → 백엔드: POST /api/bot/outbox/ack
               { results: [{ id, status: "sent" }] }
백엔드 → MongoDB: status='sent', sentAt=now, 락 해제
```

---

## 3. 데이터 모델

### 3.1 BotOutbox 스키마 (Mongoose)

```javascript
const mongoose = require('mongoose');

const botOutboxSchema = new mongoose.Schema({
  // 필수 필드
  targetRoom: {
    type: String,
    required: true,
    trim: true,
    comment: '카카오톡 방 이름'
  },
  
  message: {
    type: String,
    required: true,
    comment: '전송할 메시지 텍스트'
  },
  
  type: {
    type: String,
    enum: ['schedule_create', 'schedule_update', 'schedule_delete', 'manual'],
    required: true,
    comment: '메시지 타입'
  },
  
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
    required: true,
    comment: '전송 상태'
  },
  
  attempts: {
    type: Number,
    default: 0,
    min: 0,
    comment: '전송 시도 횟수'
  },
  
  lastError: {
    type: String,
    comment: '마지막 에러 메시지'
  },
  
  dedupeKey: {
    type: String,
    unique: true,
    sparse: true,
    comment: '중복 방지 키 (schedule:create:67a1b2c3:1737012345678)'
  },
  
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
    comment: '우선순위 (0=일반, 1+=긴급, 숫자가 클수록 우선)'
  },
  
  // 선택 필드
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    comment: '원본 스케줄 참조 (스케줄 관련 메시지인 경우)'
  },
  
  lockedAt: {
    type: Date,
    comment: '처리 잠금 시각 (pull 시 설정, 5분간 유효)'
  },
  
  lockedByDeviceId: {
    type: String,
    comment: '처리 중인 AVD 디바이스 ID'
  },
  
  sentAt: {
    type: Date,
    comment: '전송 완료 시각'
  }
}, {
  timestamps: true,
  comment: 'AVD 봇으로 전송할 카톡 메시지 큐'
});

// 인덱스
botOutboxSchema.index({ status: 1, priority: -1, createdAt: 1 }, {
  name: 'pull_query_index',
  comment: 'pull API 조회 최적화 (status별 우선순위 정렬)'
});

botOutboxSchema.index({ dedupeKey: 1 }, {
  name: 'dedupe_index',
  comment: '중복 메시지 방지',
  unique: true,
  sparse: true
});

botOutboxSchema.index({ lockedAt: 1 }, {
  name: 'lock_cleanup_index',
  comment: '잠금 만료 확인용'
});

botOutboxSchema.index({ sentAt: 1 }, {
  name: 'sent_log_index',
  comment: '전송 로그 조회용'
});

module.exports = mongoose.model('BotOutbox', botOutboxSchema);
```

### 3.2 Setting 컬렉션 확장

기존 Setting 모델에 카카오톡 관련 설정 추가:

```javascript
// kakao_rooms 설정 예시
{
  key: 'kakao_rooms',
  value: JSON.stringify([
    {
      roomName: '미래성장처',
      enabled: true,
      scheduleNotify: true,
      commandsEnabled: true
    },
    {
      roomName: '개발팀',
      enabled: true,
      scheduleNotify: false,
      commandsEnabled: true
    }
  ])
}

// kakao_admins 설정 예시
{
  key: 'kakao_admins',
  value: JSON.stringify(['Kminer', '홍길동', '관리자닉네임'])
}
```

**필드 설명:**
- `roomName`: 카카오톡 방 이름 (정확히 일치해야 함)
- `enabled`: 봇 활성화 여부 (false면 모든 기능 비활성)
- `scheduleNotify`: 일정 알림 전송 여부
- `commandsEnabled`: 명령어 응답 여부

---

## 4. API 상세 스펙

### 4.1 인증 방식

**모든 `/api/bot/*` 엔드포인트 공통 요구사항:**

**헤더:**
```
X-BOT-TOKEN: <봇 인증 토큰>
```

**인증 실패 응답 (401):**
```json
{
  "error": "인증 실패"
}
```

**환경변수 설정:**
```bash
# .env 파일
BOT_API_TOKEN=your-secret-token-here-min-32-chars
```

---

### 4.2 GET /api/bot/config

**목적:** AVD봇이 시작 시 또는 주기적으로 설정을 가져옴

**요청 예시:**
```http
GET /api/bot/config HTTP/1.1
Host: myserver.com
X-BOT-TOKEN: your-secret-token-here
```

**응답 200 OK:**
```json
{
  "admins": ["Kminer", "홍길동"],
  "rooms": [
    {
      "roomName": "미래성장처",
      "enabled": true,
      "scheduleNotify": true,
      "commandsEnabled": true
    },
    {
      "roomName": "개발팀",
      "enabled": true,
      "scheduleNotify": false,
      "commandsEnabled": true
    }
  ],
  "pollIntervalSec": 15
}
```

**구현 로직:**
```javascript
// server.js
app.get('/api/bot/config', botAuthMiddleware, async (req, res) => {
  try {
    const roomsSetting = await Setting.findOne({ key: 'kakao_rooms' });
    const adminsSetting = await Setting.findOne({ key: 'kakao_admins' });
    
    const rooms = roomsSetting ? JSON.parse(roomsSetting.value) : [];
    const admins = adminsSetting ? JSON.parse(adminsSetting.value) : [];
    
    res.json({
      admins,
      rooms,
      pollIntervalSec: 15
    });
  } catch (error) {
    res.status(500).json({ error: '설정 조회 실패' });
  }
});
```

---

### 4.3 POST /api/bot/config

**목적:** 관리자가 웹 또는 봇 명령어로 설정을 변경

**요청 예시:**
```http
POST /api/bot/config HTTP/1.1
Host: myserver.com
X-BOT-TOKEN: your-secret-token-here
Content-Type: application/json

{
  "admins": ["Kminer", "홍길동", "새관리자"],
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

**응답 200 OK:**
```json
{
  "success": true,
  "message": "설정이 저장되었습니다"
}
```

**에러 응답 400:**
```json
{
  "error": "잘못된 요청 형식"
}
```

**구현 로직:**
```javascript
app.post('/api/bot/config', botAuthMiddleware, async (req, res) => {
  try {
    const { admins, rooms } = req.body;
    
    // 유효성 검증
    if (!Array.isArray(admins) || !Array.isArray(rooms)) {
      return res.status(400).json({ error: '잘못된 요청 형식' });
    }
    
    // Setting 저장
    await Setting.findOneAndUpdate(
      { key: 'kakao_rooms' },
      { value: JSON.stringify(rooms) },
      { upsert: true }
    );
    
    await Setting.findOneAndUpdate(
      { key: 'kakao_admins' },
      { value: JSON.stringify(admins) },
      { upsert: true }
    );
    
    res.json({ success: true, message: '설정이 저장되었습니다' });
  } catch (error) {
    res.status(500).json({ error: '설정 저장 실패' });
  }
});
```

---

### 4.4 POST /api/bot/outbox/pull

**목적:** AVD봇이 전송할 메시지를 가져감 (폴링)

**요청 예시:**
```http
POST /api/bot/outbox/pull HTTP/1.1
Host: myserver.com
X-BOT-TOKEN: your-secret-token-here
Content-Type: application/json

{
  "deviceId": "avd-01",
  "limit": 20
}
```

**응답 200 OK:**
```json
{
  "items": [
    {
      "id": "67a1b2c3d4e5f6a7b8c9d0e1",
      "targetRoom": "미래성장처",
      "message": "[일정 등록]\n제목: 팀미팅\n일시: 2026년 01월 20일 14:00\n내용: 분기 계획 논의\n\n대시보드: https://myteamdashboard.vercel.app/index.html",
      "type": "schedule_create",
      "priority": 0
    },
    {
      "id": "67a1b2c3d4e5f6a7b8c9d0e2",
      "targetRoom": "개발팀",
      "message": "[일정 변경]\n제목: 코드 리뷰\n\n변경 전 일시: 2026년 01월 18일 15:00\n변경 후 일시: 2026년 01월 19일 15:00\n...",
      "type": "schedule_update",
      "priority": 0
    }
  ]
}
```

**구현 로직:**
```javascript
app.post('/api/bot/outbox/pull', botAuthMiddleware, async (req, res) => {
  try {
    const { deviceId, limit = 20 } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId 필수' });
    }
    
    const now = new Date();
    const lockExpireTime = new Date(now.getTime() - 5 * 60 * 1000); // 5분 전
    
    // 조회 조건:
    // 1. status='pending'
    // 2. attempts < 5
    // 3. 지수 백오프 대기 시간 경과
    // 4. 잠금 없음 또는 잠금 만료
    const items = await BotOutbox.find({
      status: 'pending',
      attempts: { $lt: 5 },
      $or: [
        { lockedAt: null },
        { lockedAt: { $lt: lockExpireTime } }
      ]
    })
    .sort({ priority: -1, createdAt: 1 })
    .limit(limit)
    .lean();
    
    // 지수 백오프 필터링
    const readyItems = items.filter(item => {
      if (item.attempts === 0) return true;
      const waitMs = Math.pow(2, item.attempts - 1) * 60 * 1000;
      const nextRetryTime = new Date(item.updatedAt.getTime() + waitMs);
      return now >= nextRetryTime;
    });
    
    // 잠금 설정
    const ids = readyItems.map(item => item._id);
    if (ids.length > 0) {
      await BotOutbox.updateMany(
        { _id: { $in: ids } },
        {
          $set: {
            lockedAt: now,
            lockedByDeviceId: deviceId
          }
        }
      );
    }
    
    // 응답 포맷
    const response = {
      items: readyItems.map(item => ({
        id: item._id.toString(),
        targetRoom: item.targetRoom,
        message: item.message,
        type: item.type,
        priority: item.priority
      }))
    };
    
    res.json(response);
  } catch (error) {
    console.error('Pull error:', error);
    res.status(500).json({ error: '메시지 조회 실패' });
  }
});
```

**재시도 정책 (지수 백오프):**

| 시도 | 대기 시간 | 계산식 |
|-----|----------|--------|
| 1차 실패 | 1분 | 2^0 = 1분 |
| 2차 실패 | 2분 | 2^1 = 2분 |
| 3차 실패 | 4분 | 2^2 = 4분 |
| 4차 실패 | 8분 | 2^3 = 8분 |
| 5차 실패 | 16분 | 2^4 = 16분 |
| 6차 이상 | 중단 | status='failed' |

---

### 4.5 POST /api/bot/outbox/ack

**목적:** AVD봇이 전송 결과를 보고 (확인)

**요청 예시:**
```http
POST /api/bot/outbox/ack HTTP/1.1
Host: myserver.com
X-BOT-TOKEN: your-secret-token-here
Content-Type: application/json

{
  "deviceId": "avd-01",
  "results": [
    {
      "id": "67a1b2c3d4e5f6a7b8c9d0e1",
      "status": "sent"
    },
    {
      "id": "67a1b2c3d4e5f6a7b8c9d0e2",
      "status": "failed",
      "error": "room session missing"
    }
  ]
}
```

**응답 200 OK:**
```json
{
  "success": true,
  "updated": 2
}
```

**구현 로직:**
```javascript
app.post('/api/bot/outbox/ack', botAuthMiddleware, async (req, res) => {
  try {
    const { deviceId, results } = req.body;
    
    if (!deviceId || !Array.isArray(results)) {
      return res.status(400).json({ error: '잘못된 요청' });
    }
    
    let updated = 0;
    
    for (const result of results) {
      const { id, status, error } = result;
      
      if (status === 'sent') {
        // 전송 성공
        await BotOutbox.updateOne(
          { _id: id },
          {
            $set: {
              status: 'sent',
              sentAt: new Date(),
              lockedAt: null,
              lockedByDeviceId: null
            }
          }
        );
        updated++;
      } else if (status === 'failed') {
        // 전송 실패
        const item = await BotOutbox.findById(id);
        if (item) {
          const newAttempts = item.attempts + 1;
          const newStatus = newAttempts >= 5 ? 'failed' : 'pending';
          
          await BotOutbox.updateOne(
            { _id: id },
            {
              $set: {
                status: newStatus,
                attempts: newAttempts,
                lastError: error || '알 수 없는 오류',
                lockedAt: null,
                lockedByDeviceId: null
              }
            }
          );
          updated++;
        }
      }
    }
    
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Ack error:', error);
    res.status(500).json({ error: '결과 처리 실패' });
  }
});
```

---

### 4.6 GET /api/bot/outbox/stats

**목적:** 모니터링 대시보드용 통계 조회

**요청 예시:**
```http
GET /api/bot/outbox/stats?limit=10 HTTP/1.1
Host: myserver.com
X-BOT-TOKEN: your-secret-token-here
```

**응답 200 OK:**
```json
{
  "pending": 5,
  "sent": 120,
  "failed": 2,
  "recentLogs": [
    {
      "id": "67a1b2c3d4e5f6a7b8c9d0e1",
      "targetRoom": "미래성장처",
      "message": "[일정 등록] 제목: 팀미팅...",
      "status": "sent",
      "sentAt": "2026-01-15T10:30:00.000Z",
      "type": "schedule_create",
      "attempts": 0
    },
    {
      "id": "67a1b2c3d4e5f6a7b8c9d0e2",
      "targetRoom": "개발팀",
      "message": "[일정 변경] ...",
      "status": "pending",
      "type": "schedule_update",
      "attempts": 2,
      "lastError": "connection timeout"
    }
  ]
}
```

**구현 로직:**
```javascript
app.get('/api/bot/outbox/stats', botAuthMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // 상태별 카운트
    const [pending, sent, failed] = await Promise.all([
      BotOutbox.countDocuments({ status: 'pending' }),
      BotOutbox.countDocuments({ status: 'sent' }),
      BotOutbox.countDocuments({ status: 'failed' })
    ]);
    
    // 최근 로그
    const recentLogs = await BotOutbox.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('targetRoom message status sentAt type attempts lastError createdAt')
      .lean();
    
    res.json({
      pending,
      sent,
      failed,
      recentLogs: recentLogs.map(log => ({
        id: log._id.toString(),
        targetRoom: log.targetRoom,
        message: log.message.substring(0, 100) + (log.message.length > 100 ? '...' : ''),
        status: log.status,
        sentAt: log.sentAt,
        type: log.type,
        attempts: log.attempts,
        lastError: log.lastError,
        createdAt: log.createdAt
      }))
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: '통계 조회 실패' });
  }
});
```

---

## 5. 함수 스펙

### 5.1 enqueueScheduleKakao 함수

**목적:** 스케줄 변경 시 카톡 알림 메시지를 BotOutbox에 적재

**위치:** `server.js` (또는 별도 `utils/kakaoQueue.js`)

**시그니처:**
```javascript
async function enqueueScheduleKakao(action, schedule, prevSchedule = null)
```

**파라미터:**
- `action` (String): `'create'` | `'update'` | `'delete'`
- `schedule` (Object): Schedule 문서 객체
- `prevSchedule` (Object, optional): 이전 Schedule 상태 (update 시 필수)

**반환값:** `Promise<void>`

**전체 구현:**
```javascript
const BotOutbox = require('./models/BotOutbox');
const Setting = require('./models/Setting');

async function enqueueScheduleKakao(action, schedule, prevSchedule = null) {
  try {
    // 1. kakao_rooms 설정 조회
    const roomsSetting = await Setting.findOne({ key: 'kakao_rooms' });
    if (!roomsSetting) {
      console.log('kakao_rooms 설정 없음, 카톡 알림 스킵');
      return;
    }
    
    const rooms = JSON.parse(roomsSetting.value);
    
    // 2. enabled=true AND scheduleNotify=true 방만 필터링
    const targetRooms = rooms.filter(room => 
      room.enabled === true && room.scheduleNotify === true
    );
    
    if (targetRooms.length === 0) {
      console.log('알림 활성화된 방 없음, 카톡 알림 스킵');
      return;
    }
    
    // 3. 메시지 템플릿 생성
    const message = generateScheduleMessage(action, schedule, prevSchedule);
    
    // 4. 각 방에 메시지 적재
    const timestamp = Date.now();
    const outboxDocs = targetRooms.map(room => ({
      targetRoom: room.roomName,
      message,
      type: `schedule_${action}`,
      status: 'pending',
      priority: 0,
      scheduleId: schedule._id,
      dedupeKey: `schedule:${action}:${schedule._id}:${timestamp}`,
      attempts: 0
    }));
    
    // 5. 중복 체크 후 삽입
    for (const doc of outboxDocs) {
      try {
        await BotOutbox.create(doc);
        console.log(`카톡 메시지 적재: ${doc.targetRoom} - ${action}`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`중복 메시지 스킵: ${doc.dedupeKey}`);
        } else {
          console.error('BotOutbox 저장 실패:', error);
        }
      }
    }
  } catch (error) {
    console.error('enqueueScheduleKakao 실패:', error);
    // 에러 발생 시에도 스케줄 저장은 성공하도록 함 (non-blocking)
  }
}

function generateScheduleMessage(action, schedule, prevSchedule) {
  const dashboardUrl = 'https://myteamdashboard.vercel.app/index.html';
  
  // 날짜 포맷팅 함수
  const formatKST = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}`;
  };
  
  switch (action) {
    case 'create':
      return `[일정 등록]
제목: ${schedule.title}
일시: ${formatKST(schedule.start)}
내용: ${schedule.content || '내용 없음'}

대시보드: ${dashboardUrl}`;

    case 'update':
      return `[일정 변경]
제목: ${schedule.title}

변경 전 일시: ${formatKST(prevSchedule.start)}
변경 후 일시: ${formatKST(schedule.start)}

변경 전 내용: ${prevSchedule.content || '내용 없음'}
변경 후 내용: ${schedule.content || '내용 없음'}

대시보드: ${dashboardUrl}`;

    case 'delete':
      return `[일정 취소]
제목: ${schedule.title}
일시: ${formatKST(schedule.start)}
내용: ${schedule.content || '내용 없음'}

대시보드: ${dashboardUrl}`;

    default:
      return `[일정 알림]\n제목: ${schedule.title}`;
  }
}

module.exports = { enqueueScheduleKakao };
```

**호출 위치:**

```javascript
// POST /api/schedules (일정 등록)
app.post('/api/schedules', async (req, res) => {
  try {
    const schedule = new Schedule(req.body);
    await schedule.save();
    
    await sendScheduleEmail('create', schedule);
    await enqueueScheduleKakao('create', schedule); // ← 추가
    
    res.status(201).json(schedule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/schedules/:id (일정 수정)
app.put('/api/schedules/:id', async (req, res) => {
  try {
    const prevSchedule = await Schedule.findById(req.params.id).lean();
    const schedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!schedule) {
      return res.status(404).json({ error: '일정을 찾을 수 없습니다' });
    }
    
    await sendScheduleEmail('update', schedule, prevSchedule);
    await enqueueScheduleKakao('update', schedule, prevSchedule); // ← 추가
    
    res.json(schedule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/schedules/:id (일정 삭제)
app.delete('/api/schedules/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ error: '일정을 찾을 수 없습니다' });
    }
    
    await schedule.remove();
    
    await sendScheduleEmail('delete', schedule);
    await enqueueScheduleKakao('delete', schedule); // ← 추가
    
    res.json({ message: '일정이 삭제되었습니다' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### 5.2 봇 인증 미들웨어

**위치:** `middleware/botAuth.js` (또는 `server.js`)

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

**적용:**
```javascript
const botAuthMiddleware = require('./middleware/botAuth');

app.get('/api/bot/config', botAuthMiddleware, async (req, res) => { /* ... */ });
app.post('/api/bot/config', botAuthMiddleware, async (req, res) => { /* ... */ });
app.post('/api/bot/outbox/pull', botAuthMiddleware, async (req, res) => { /* ... */ });
app.post('/api/bot/outbox/ack', botAuthMiddleware, async (req, res) => { /* ... */ });
app.get('/api/bot/outbox/stats', botAuthMiddleware, async (req, res) => { /* ... */ });
```

---

## 6. AVD봇 구조

### 6.1 프로젝트 구조

```
AVD-KakaoBot/
├── README.md                  ← 설치 및 사용 가이드
├── bot.js                     ← 메인 엔트리 포인트
├── config.js                  ← 설정 파일
├── package.json               ← (선택) npm 패키지 정보
│
├── handlers/
│   ├── commandHandler.js      ← 일반 명령 처리 (/kakao/message 호출)
│   ├── adminHandler.js        ← 관리자 명령 처리 (!방추가, !상태 등)
│   └── outboxHandler.js       ← Outbox 폴링/전송/ACK 처리
│
└── utils/
    ├── api.js                 ← HTTP 요청 유틸리티
    ├── messageFormatter.js    ← 메시지 분할/포맷팅
    └── logger.js              ← 로깅 유틸리티
```

### 6.2 주요 파일 설명

#### 6.2.1 bot.js (메인 스크립트)

```javascript
// bot.js - 메신저봇R 메인 스크립트
const config = require('./config');
const { handleCommand } = require('./handlers/commandHandler');
const { handleAdminCommand } = require('./handlers/adminHandler');
const { startOutboxPolling } = require('./handlers/outboxHandler');
const { loadConfig } = require('./utils/api');

// 전역 변수
let botConfig = null;

// 봇 시작 시 초기화
function onStartCompile() {
  try {
    // 서버에서 설정 로드
    botConfig = loadConfig();
    
    if (botConfig) {
      Log.i('카카오봇 초기화 완료');
      Log.i('관리자: ' + botConfig.admins.join(', '));
      Log.i('활성 방: ' + botConfig.rooms.filter(r => r.enabled).length);
      
      // Outbox 폴링 시작
      startOutboxPolling(botConfig);
    } else {
      Log.e('설정 로드 실패');
    }
  } catch (e) {
    Log.e('초기화 오류: ' + e);
  }
}

// 메시지 수신 시
function response(room, msg, sender, isGroupChat, replier, imageDB, packageName) {
  try {
    // 관리자 명령어 처리
    if (msg.startsWith('!') && botConfig.admins.includes(sender)) {
      handleAdminCommand(room, msg, sender, replier, botConfig);
      return;
    }
    
    // 방 설정 확인
    const roomConfig = botConfig.rooms.find(r => r.roomName === room);
    if (!roomConfig || !roomConfig.enabled || !roomConfig.commandsEnabled) {
      return;
    }
    
    // 일반 명령어 처리
    handleCommand(room, msg, sender, replier);
    
  } catch (e) {
    Log.e('메시지 처리 오류: ' + e);
  }
}

// 주기적 설정 동기화 (1시간마다)
setInterval(() => {
  try {
    const newConfig = loadConfig();
    if (newConfig) {
      botConfig = newConfig;
      Log.i('설정 동기화 완료');
    }
  } catch (e) {
    Log.e('설정 동기화 오류: ' + e);
  }
}, 60 * 60 * 1000);
```

#### 6.2.2 config.js (설정 파일)

```javascript
// config.js
module.exports = {
  // 서버 URL (AVD에서 호스트 PC 접근)
  SERVER_URL: 'http://10.0.2.2:5000',
  
  // 봇 인증 토큰
  BOT_TOKEN: 'your-bot-token-here',
  
  // 디바이스 ID (다중 봇 운영 시 구분용)
  DEVICE_ID: 'avd-01',
  
  // Outbox 폴링 간격 (밀리초)
  POLL_INTERVAL_MS: 15000, // 15초
  
  // 한 번에 가져올 메시지 수
  PULL_LIMIT: 20,
  
  // 카톡 메시지 길이 제한
  MAX_MESSAGE_LENGTH: 3000,
  
  // HTTP 요청 타임아웃
  REQUEST_TIMEOUT_MS: 10000 // 10초
};
```

#### 6.2.3 handlers/outboxHandler.js

```javascript
// handlers/outboxHandler.js
const config = require('../config');
const { pullMessages, sendAck } = require('../utils/api');
const { splitMessage } = require('../utils/messageFormatter');

let pollingTimer = null;

function startOutboxPolling(botConfig) {
  if (pollingTimer) {
    clearInterval(pollingTimer);
  }
  
  pollingTimer = setInterval(() => {
    processOutbox(botConfig);
  }, config.POLL_INTERVAL_MS);
  
  // 즉시 첫 실행
  processOutbox(botConfig);
  
  Log.i('Outbox 폴링 시작 (간격: ' + (config.POLL_INTERVAL_MS / 1000) + '초)');
}

function processOutbox(botConfig) {
  try {
    // 1. 메시지 Pull
    const response = pullMessages(config.DEVICE_ID, config.PULL_LIMIT);
    
    if (!response || !response.items || response.items.length === 0) {
      return;
    }
    
    Log.i('메시지 ' + response.items.length + '개 수신');
    
    const results = [];
    
    // 2. 각 메시지 처리
    for (let i = 0; i < response.items.length; i++) {
      const item = response.items[i];
      
      try {
        // 방 설정 확인
        const roomConfig = botConfig.rooms.find(r => r.roomName === item.targetRoom);
        if (!roomConfig || !roomConfig.enabled) {
          results.push({
            id: item.id,
            status: 'failed',
            error: 'room disabled'
          });
          continue;
        }
        
        // 메시지 분할 (3000자 초과 시)
        const messages = splitMessage(item.message, config.MAX_MESSAGE_LENGTH);
        
        // 메시지 전송
        let success = true;
        for (let j = 0; j < messages.length; j++) {
          const sent = Api.replyRoom(item.targetRoom, messages[j]);
          if (!sent) {
            success = false;
            break;
          }
          
          // 분할 메시지 사이 딜레이
          if (j < messages.length - 1) {
            java.lang.Thread.sleep(500);
          }
        }
        
        if (success) {
          results.push({
            id: item.id,
            status: 'sent'
          });
          Log.i('전송 성공: ' + item.targetRoom);
        } else {
          results.push({
            id: item.id,
            status: 'failed',
            error: 'send failed'
          });
          Log.e('전송 실패: ' + item.targetRoom);
        }
        
      } catch (e) {
        results.push({
          id: item.id,
          status: 'failed',
          error: String(e)
        });
        Log.e('메시지 처리 오류: ' + e);
      }
    }
    
    // 3. ACK 전송
    sendAck(config.DEVICE_ID, results);
    
  } catch (e) {
    Log.e('Outbox 처리 오류: ' + e);
  }
}

module.exports = { startOutboxPolling };
```

#### 6.2.4 handlers/adminHandler.js

```javascript
// handlers/adminHandler.js
const config = require('../config');
const { updateConfig } = require('../utils/api');

function handleAdminCommand(room, msg, sender, replier, botConfig) {
  const parts = msg.trim().split(/\s+/);
  const cmd = parts[0];
  const arg1 = parts[1];
  const arg2 = parts[2];
  
  try {
    switch (cmd) {
      case '!방추가':
        if (!arg1) {
          replier.reply('사용법: !방추가 <방이름>');
          return;
        }
        addRoom(arg1, botConfig, replier);
        break;
        
      case '!방삭제':
        if (!arg1) {
          replier.reply('사용법: !방삭제 <방이름>');
          return;
        }
        removeRoom(arg1, botConfig, replier);
        break;
        
      case '!방':
        if (arg1 === 'on' && arg2) {
          toggleRoom(arg2, true, botConfig, replier);
        } else if (arg1 === 'off' && arg2) {
          toggleRoom(arg2, false, botConfig, replier);
        } else {
          replier.reply('사용법: !방 on/off <방이름>');
        }
        break;
        
      case '!일정알림':
        if (arg1 === 'on' && arg2) {
          toggleScheduleNotify(arg2, true, botConfig, replier);
        } else if (arg1 === 'off' && arg2) {
          toggleScheduleNotify(arg2, false, botConfig, replier);
        } else {
          replier.reply('사용법: !일정알림 on/off <방이름>');
        }
        break;
        
      case '!명령':
        if (arg1 === 'on' && arg2) {
          toggleCommands(arg2, true, botConfig, replier);
        } else if (arg1 === 'off' && arg2) {
          toggleCommands(arg2, false, botConfig, replier);
        } else {
          replier.reply('사용법: !명령 on/off <방이름>');
        }
        break;
        
      case '!방목록':
        listRooms(botConfig, replier);
        break;
        
      case '!상태':
        showStatus(botConfig, replier);
        break;
        
      default:
        replier.reply('알 수 없는 명령어: ' + cmd);
    }
  } catch (e) {
    replier.reply('오류 발생: ' + e);
    Log.e('관리자 명령 오류: ' + e);
  }
}

function addRoom(roomName, botConfig, replier) {
  const exists = botConfig.rooms.find(r => r.roomName === roomName);
  if (exists) {
    replier.reply('이미 존재하는 방입니다: ' + roomName);
    return;
  }
  
  botConfig.rooms.push({
    roomName: roomName,
    enabled: true,
    scheduleNotify: true,
    commandsEnabled: true
  });
  
  const success = updateConfig(botConfig);
  if (success) {
    replier.reply('방 추가 완료: ' + roomName);
  } else {
    replier.reply('방 추가 실패');
  }
}

function toggleRoom(roomName, enabled, botConfig, replier) {
  const room = botConfig.rooms.find(r => r.roomName === roomName);
  if (!room) {
    replier.reply('방을 찾을 수 없습니다: ' + roomName);
    return;
  }
  
  room.enabled = enabled;
  
  const success = updateConfig(botConfig);
  if (success) {
    replier.reply(roomName + ' 방 ' + (enabled ? '활성화' : '비활성화') + ' 완료');
  } else {
    replier.reply('설정 변경 실패');
  }
}

function listRooms(botConfig, replier) {
  if (botConfig.rooms.length === 0) {
    replier.reply('등록된 방이 없습니다.');
    return;
  }
  
  let msg = '=== 방 목록 ===\n\n';
  for (let i = 0; i < botConfig.rooms.length; i++) {
    const r = botConfig.rooms[i];
    msg += (i + 1) + '. ' + r.roomName + '\n';
    msg += '   상태: ' + (r.enabled ? '활성' : '비활성') + '\n';
    msg += '   일정알림: ' + (r.scheduleNotify ? 'ON' : 'OFF') + '\n';
    msg += '   명령응답: ' + (r.commandsEnabled ? 'ON' : 'OFF') + '\n\n';
  }
  
  replier.reply(msg);
}

function showStatus(botConfig, replier) {
  const enabledRooms = botConfig.rooms.filter(r => r.enabled).length;
  const msg = '=== 봇 상태 ===\n\n' +
              '디바이스: ' + config.DEVICE_ID + '\n' +
              '서버: ' + config.SERVER_URL + '\n' +
              '폴링 간격: ' + (config.POLL_INTERVAL_MS / 1000) + '초\n' +
              '활성 방: ' + enabledRooms + '/' + botConfig.rooms.length + '\n' +
              '관리자: ' + botConfig.admins.join(', ');
  
  replier.reply(msg);
}

// ... 기타 함수들

module.exports = { handleAdminCommand };
```

#### 6.2.5 utils/api.js

```javascript
// utils/api.js
const config = require('../config');

function makeRequest(method, path, body) {
  try {
    const url = config.SERVER_URL + path;
    const headers = {
      'X-BOT-TOKEN': config.BOT_TOKEN,
      'Content-Type': 'application/json'
    };
    
    let response;
    if (method === 'GET') {
      response = org.jsoup.Jsoup.connect(url)
        .header('X-BOT-TOKEN', config.BOT_TOKEN)
        .ignoreContentType(true)
        .timeout(config.REQUEST_TIMEOUT_MS)
        .get();
    } else {
      response = org.jsoup.Jsoup.connect(url)
        .header('X-BOT-TOKEN', config.BOT_TOKEN)
        .header('Content-Type', 'application/json')
        .requestBody(JSON.stringify(body))
        .ignoreContentType(true)
        .timeout(config.REQUEST_TIMEOUT_MS)
        .method(org.jsoup.Connection.Method.POST)
        .execute();
    }
    
    const text = response.body();
    return JSON.parse(text);
    
  } catch (e) {
    Log.e('API 요청 실패 (' + path + '): ' + e);
    return null;
  }
}

function loadConfig() {
  return makeRequest('GET', '/api/bot/config');
}

function updateConfig(botConfig) {
  const result = makeRequest('POST', '/api/bot/config', {
    admins: botConfig.admins,
    rooms: botConfig.rooms
  });
  return result && result.success;
}

function pullMessages(deviceId, limit) {
  return makeRequest('POST', '/api/bot/outbox/pull', {
    deviceId: deviceId,
    limit: limit
  });
}

function sendAck(deviceId, results) {
  return makeRequest('POST', '/api/bot/outbox/ack', {
    deviceId: deviceId,
    results: results
  });
}

module.exports = {
  loadConfig,
  updateConfig,
  pullMessages,
  sendAck
};
```

#### 6.2.6 utils/messageFormatter.js

```javascript
// utils/messageFormatter.js

function splitMessage(message, maxLength) {
  if (message.length <= maxLength) {
    return [message];
  }
  
  const chunks = [];
  let remaining = message;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    
    // 줄바꿈 기준으로 분할 시도
    let cutIndex = remaining.lastIndexOf('\n', maxLength);
    if (cutIndex === -1 || cutIndex < maxLength / 2) {
      // 줄바꿈이 없으면 공백 기준
      cutIndex = remaining.lastIndexOf(' ', maxLength);
      if (cutIndex === -1 || cutIndex < maxLength / 2) {
        // 공백도 없으면 강제 분할
        cutIndex = maxLength;
      }
    }
    
    chunks.push(remaining.substring(0, cutIndex));
    remaining = remaining.substring(cutIndex).trim();
  }
  
  return chunks;
}

module.exports = { splitMessage };
```

---

## 7. 에러 처리

### 7.1 재시도 정책

**지수 백오프 (Exponential Backoff):**

| 시도 횟수 | 대기 시간 | 누적 시간 | 상태 |
|----------|----------|----------|------|
| 1차 실패 | 1분 | 1분 | pending |
| 2차 실패 | 2분 | 3분 | pending |
| 3차 실패 | 4분 | 7분 | pending |
| 4차 실패 | 8분 | 15분 | pending |
| 5차 실패 | 16분 | 31분 | pending |
| 6차 이상 | - | - | **failed** (재시도 중단) |

**구현 위치:** `/api/bot/outbox/pull` 엔드포인트

**로직:**
```javascript
// 지수 백오프 계산
function shouldRetry(item, now) {
  if (item.attempts === 0) return true;
  if (item.attempts >= 5) return false;
  
  const waitMs = Math.pow(2, item.attempts - 1) * 60 * 1000;
  const nextRetryTime = new Date(item.updatedAt.getTime() + waitMs);
  
  return now >= nextRetryTime;
}
```

### 7.2 에러 케이스 정의

| 에러 상황 | 에러 코드 | 처리 방법 | 재시도 |
|----------|----------|----------|--------|
| 카톡 방 세션 없음 | `room_session_missing` | failed + 에러 저장 | O (5회) |
| 메시지 전송 타임아웃 | `send_timeout` | failed + 에러 저장 | O (5회) |
| 서버 연결 실패 (봇→백엔드) | `connection_error` | 로컬 큐 보관, 연결 복구 시 재전송 | O (무한) |
| 토큰 인증 실패 | `auth_failed` | 봇 중단 + 관리자 알림 | X |
| 중복 메시지 | `duplicate_key` | 스킵 (로그만 남김) | X |
| 메시지 3000자 초과 | - | 자동 분할 전송 | - |
| 방 비활성화 상태 | `room_disabled` | failed + 에러 저장 | X |
| JSON 파싱 오류 | `parse_error` | failed + 에러 저장 | X |

### 7.3 락(Lock) 만료 처리

**목적:** pull 후 봇이 장애로 ack를 보내지 못한 경우 방지

**메커니즘:**
- pull 시 `lockedAt`과 `lockedByDeviceId` 설정
- 락 유효 시간: 5분
- 5분 경과 시 다른 봇 또는 같은 봇이 재처리 가능

**정리 작업 (선택적):**
```javascript
// 매 10분마다 만료된 락 해제 (Cron 작업)
async function cleanupExpiredLocks() {
  const lockExpireTime = new Date(Date.now() - 5 * 60 * 1000);
  
  const result = await BotOutbox.updateMany(
    {
      status: 'pending',
      lockedAt: { $lt: lockExpireTime }
    },
    {
      $set: {
        lockedAt: null,
        lockedByDeviceId: null
      }
    }
  );
  
  if (result.modifiedCount > 0) {
    console.log(`만료된 락 ${result.modifiedCount}개 해제`);
  }
}
```

---

## 8. 보안 고려사항

### 8.1 API 토큰 관리

**토큰 생성 권장사항:**
- 최소 32자 이상의 랜덤 문자열
- 영문 대소문자 + 숫자 + 특수문자 조합
- 주기적 갱신 (3-6개월)

**생성 예시:**
```bash
# Node.js로 토큰 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**환경변수 설정:**
```bash
# .env
BOT_API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**주의사항:**
- `.env` 파일은 `.gitignore`에 추가
- 프로덕션 환경에서는 환경변수로 주입
- 토큰 노출 시 즉시 재발급

### 8.2 관리자 닉네임 검증

**원칙:** 카카오톡 닉네임은 변경 가능하므로 신뢰도 주의

**구현 방법:**
```javascript
function isAdmin(sender, botConfig) {
  return botConfig.admins.includes(sender);
}

// 사용
if (msg.startsWith('!') && isAdmin(sender, botConfig)) {
  handleAdminCommand(room, msg, sender, replier, botConfig);
}
```

**추가 보안 방안 (선택적):**
- 특정 방에서만 관리자 명령 허용
- 민감한 명령은 추가 인증 코드 요구
- 관리자 명령 로그 기록

### 8.3 입력 검증

**백엔드 검증:**
```javascript
// deviceId 검증
if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 50) {
  return res.status(400).json({ error: '잘못된 deviceId' });
}

// limit 검증
const limit = Math.min(Math.max(parseInt(req.body.limit) || 20, 1), 100);

// targetRoom 검증 (방 이름 길이 제한)
if (!targetRoom || targetRoom.length > 100) {
  return res.status(400).json({ error: '잘못된 방 이름' });
}
```

### 8.4 Rate Limiting

**목적:** DDoS 공격 방지

**구현 (express-rate-limit):**
```javascript
const rateLimit = require('express-rate-limit');

const botApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1분
  max: 100, // 최대 100 요청
  message: { error: '요청 한도 초과' }
});

app.use('/api/bot/', botApiLimiter);
```

---

## 9. 배포 고려사항

### 9.1 환경변수 설정

**.env 파일 예시:**
```bash
# MongoDB 연결
MONGODB_URI=mongodb://localhost:27017/team-dashboard

# 봇 API 토큰
BOT_API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# 서버 포트
PORT=5000

# 이메일 설정 (기존)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# 로그 레벨
LOG_LEVEL=info
```

### 9.2 서버 요구사항

**하드웨어:**
- CPU: 2코어 이상
- RAM: 2GB 이상
- 디스크: 20GB 이상 (로그 및 DB)

**소프트웨어:**
- Node.js: 14.x 이상
- MongoDB: 4.4 이상
- OS: Linux (Ubuntu 20.04 LTS 권장)

### 9.3 AVD 설정

**Android Studio AVD 설정:**
- API Level: 28 이상 (Android 9.0+)
- RAM: 2GB 이상
- 내부 저장소: 4GB 이상
- 네트워크: Bridged 또는 NAT (호스트 PC 접근 가능)

**메신저봇R 설치:**
1. AVD에서 메신저봇R APK 설치
2. 접근성 권한 부여
3. 카카오톡 로그인
4. 봇 스크립트 파일 업로드 (`bot.js` 등)

**호스트 PC 접근:**
- AVD에서 호스트 PC는 `10.0.2.2`로 접근
- 백엔드 서버가 `localhost:5000`이면 → `http://10.0.2.2:5000`

### 9.4 모니터링 및 로깅

**로그 수집:**
```javascript
// logger.js (Winston 사용)
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

module.exports = logger;
```

**모니터링 대시보드:**
- `/api/bot/outbox/stats` 엔드포인트를 웹 대시보드에서 주기적으로 호출
- Pending/Sent/Failed 통계 시각화
- 실패 메시지 알림 (Slack, Email 등)

---

## 10. 테스트 시나리오

### 10.1 시나리오 1: 일정 등록 → 카톡 알림

**목표:** 대시보드에서 일정 등록 시 카톡 방에 알림이 정상적으로 전송되는지 확인

**사전 조건:**
- 백엔드 서버 실행 중
- AVD 봇 실행 중
- `미래성장처` 방이 `enabled=true`, `scheduleNotify=true`로 설정됨

**테스트 단계:**

1. **일정 등록:**
   ```http
   POST /api/schedules HTTP/1.1
   Content-Type: application/json
   
   {
     "title": "테스트 미팅",
     "start": "2026-01-20T14:00:00.000Z",
     "content": "기획서 검토"
   }
   ```

2. **BotOutbox 확인:**
   ```javascript
   // MongoDB 조회
   db.botoutboxes.find({ type: 'schedule_create' }).sort({ createdAt: -1 }).limit(1)
   
   // 기대 결과:
   {
     targetRoom: '미래성장처',
     message: '[일정 등록]\n제목: 테스트 미팅\n...',
     type: 'schedule_create',
     status: 'pending',
     priority: 0
   }
   ```

3. **15초 대기 (봇 폴링 주기)**

4. **카톡 방 확인:**
   - `미래성장처` 방에 메시지 전송 확인
   - 메시지 내용이 템플릿과 일치하는지 확인

5. **BotOutbox 상태 확인:**
   ```javascript
   // 기대 결과:
   {
     status: 'sent',
     sentAt: '2026-01-15T10:30:00.000Z',
     attempts: 0
   }
   ```

**성공 조건:**
- BotOutbox에 메시지 적재됨 (status: pending)
- 15초 이내에 카톡 방에 메시지 전송됨
- BotOutbox 상태가 `sent`로 변경됨

---

### 10.2 시나리오 2: 전송 실패 → 재시도

**목표:** 봇이 메시지 전송에 실패했을 때 재시도 정책이 정상 작동하는지 확인

**사전 조건:**
- 백엔드 서버 실행 중
- AVD 봇 실행 중
- 카톡 방 세션이 없는 상태 (또는 강제로 실패 시뮬레이션)

**테스트 단계:**

1. **메시지 적재:**
   ```javascript
   // 수동으로 BotOutbox에 메시지 추가
   await BotOutbox.create({
     targetRoom: '존재하지않는방',
     message: '테스트 메시지',
     type: 'manual',
     status: 'pending',
     priority: 0
   });
   ```

2. **1차 전송 시도 (즉시):**
   - 봇이 pull하여 전송 시도
   - 실패 예상 (방 없음)

3. **ACK 확인:**
   ```javascript
   // 기대 결과:
   {
     status: 'pending',
     attempts: 1,
     lastError: 'room session missing'
   }
   ```

4. **1분 대기 후 2차 시도:**
   - 봇이 다시 pull
   - 재시도 대기 시간 경과 확인

5. **5회 실패 후 최종 상태:**
   ```javascript
   // 기대 결과:
   {
     status: 'failed',
     attempts: 5,
     lastError: 'room session missing'
   }
   ```

**성공 조건:**
- 1차 실패 후 `attempts`가 1로 증가
- 지수 백오프 대기 시간 동안 재시도 안 됨
- 5차 실패 후 `status`가 `failed`로 변경되어 더 이상 재시도 안 됨

---

### 10.3 시나리오 3: 관리자 명령어

**목표:** 관리자가 카톡에서 봇 설정을 변경할 수 있는지 확인

**사전 조건:**
- AVD 봇 실행 중
- `Kminer`가 관리자로 등록됨
- `개발팀` 방이 존재하지 않음

**테스트 단계:**

1. **방 추가 명령:**
   - 관리자 `Kminer`가 카톡 방에서 입력:
   ```
   !방추가 개발팀
   ```

2. **봇 응답 확인:**
   ```
   방 추가 완료: 개발팀
   ```

3. **백엔드 설정 확인:**
   ```javascript
   // GET /api/bot/config 호출
   {
     rooms: [
       { roomName: '미래성장처', enabled: true, ... },
       { roomName: '개발팀', enabled: true, scheduleNotify: true, commandsEnabled: true }
     ]
   }
   ```

4. **일정 알림 비활성화:**
   ```
   !일정알림 off 개발팀
   ```

5. **봇 응답 확인:**
   ```
   개발팀 방 일정알림 비활성화 완료
   ```

6. **방 목록 조회:**
   ```
   !방목록
   ```

7. **봇 응답 확인:**
   ```
   === 방 목록 ===
   
   1. 미래성장처
      상태: 활성
      일정알림: ON
      명령응답: ON
   
   2. 개발팀
      상태: 활성
      일정알림: OFF
      명령응답: ON
   ```

**성공 조건:**
- 관리자 명령어가 정상 처리됨
- 백엔드 Setting 컬렉션에 변경사항 반영됨
- 비관리자는 명령어 실행 불가

---

## 11. 마이그레이션 계획

### 11.1 단계별 롤아웃

**Phase 1 (현재):**
- ✅ BotOutbox 모델 구현
- ✅ Bot API 엔드포인트 구현
- ✅ enqueueScheduleKakao 함수 통합
- ✅ 인증 미들웨어 구현

**Phase 2 (다음 단계):**
- AVD 봇 스크립트 상세 구현
- 로컬 테스트 환경 구축
- 단위 테스트 작성

**Phase 3 (배포):**
- 프로덕션 환경 배포
- 기존 파이썬 봇과 병행 운영
- 안정성 검증

**Phase 4 (완전 전환):**
- 파이썬 봇 제거
- 모니터링 대시보드 구축
- 운영 문서 작성

### 11.2 롤백 계획

**문제 발생 시:**
1. AVD 봇 중단
2. BotOutbox의 pending 메시지 확인
3. 필요 시 수동으로 카톡 전송
4. 파이썬 봇 재활성화

**데이터 보존:**
- BotOutbox의 모든 메시지는 DB에 보존
- 실패 메시지는 수동 재전송 가능

---

## 12. 부록

### 12.1 API 엔드포인트 요약

| 메서드 | 경로 | 목적 | 인증 |
|--------|------|------|------|
| GET | `/api/bot/config` | 봇 설정 조회 | O |
| POST | `/api/bot/config` | 봇 설정 변경 | O |
| POST | `/api/bot/outbox/pull` | 메시지 가져오기 | O |
| POST | `/api/bot/outbox/ack` | 전송 결과 보고 | O |
| GET | `/api/bot/outbox/stats` | 통계 조회 | O |

### 12.2 관리자 명령어 요약

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

### 12.3 주요 상수 및 설정

```javascript
// 주요 설정값
const CONFIG = {
  POLL_INTERVAL_SEC: 15,           // 봇 폴링 간격
  LOCK_TIMEOUT_MIN: 5,             // 메시지 락 타임아웃
  MAX_ATTEMPTS: 5,                 // 최대 재시도 횟수
  MAX_MESSAGE_LENGTH: 3000,        // 카톡 메시지 길이 제한
  PULL_LIMIT: 20,                  // 한 번에 가져올 메시지 수
  REQUEST_TIMEOUT_MS: 10000        // HTTP 요청 타임아웃
};
```

---

## 결론

이 기획서는 카카오톡 봇 연동 개선 프로젝트의 Phase 1 단계에 해당하는 상세 설계 문서입니다.

**핵심 개선사항:**
1. **비동기 큐 (Outbox Pattern)**: 백엔드 응답 속도 향상 및 봇 장애 시 메시지 유실 방지
2. **재시도 정책**: 지수 백오프를 통한 안정적인 메시지 전송
3. **관리 편의성**: 웹 API 및 카톡 명령어 기반 설정 관리
4. **확장성**: 다중 봇 인스턴스 및 방 관리 지원

**다음 단계:**
- AVD 봇 스크립트 상세 구현 (Phase 2)
- 로컬 테스트 및 단위 테스트 작성
- 프로덕션 배포 및 모니터링

---

**작성자**: Sonnet 4.5  
**문서 버전**: 1.0  
**최종 수정일**: 2026년 1월 15일

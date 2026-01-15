# Phase 3-B 프롬프트: AVD 봇 프로젝트 생성
**담당 AI**: Sonnet 4.5

---

# 🤖 역할: AVD 봇 코딩 담당

## 프로젝트 개요
메신저봇R (Android)에서 실행될 카카오톡 봇 스크립트를 구현합니다.

## 프로젝트 경로
**새 프로젝트**: `/Users/hoonsbook/AI vive coding projects/AVD-KakaoBot/`

---

## 📋 구현 체크리스트

### Part 1: 프로젝트 구조 생성

```
AVD-KakaoBot/
├── README.md              ← 설치 및 사용 가이드
├── bot.js                 ← 메인 엔트리 포인트 (메신저봇R)
├── config.js              ← 설정 파일
├── handlers/
│   ├── commandHandler.js  ← 일반 명령 처리
│   ├── adminHandler.js    ← 관리자 명령 처리
│   └── outboxHandler.js   ← Outbox 폴링/전송/ACK
└── utils/
    ├── api.js             ← HTTP 요청 유틸리티
    ├── messageFormatter.js ← 메시지 분할/포맷팅
    └── logger.js          ← 로깅 유틸리티
```

---

### Part 2: config.js

**파일**: `config.js`

```javascript
// config.js
module.exports = {
  // 서버 URL (AVD에서 호스트 PC 접근)
  SERVER_URL: 'http://10.0.2.2:5000',
  
  // 봇 인증 토큰 (백엔드 .env의 BOT_API_TOKEN과 동일해야 함)
  BOT_TOKEN: 'your-secret-token-here',
  
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

---

### Part 3: utils/api.js

**기능**: 백엔드 API 호출 유틸리티

**구현 내용**:
- `makeRequest(method, path, body)` - 기본 HTTP 요청
- `loadConfig()` - GET /api/bot/config
- `updateConfig(botConfig)` - POST /api/bot/config
- `pullMessages(deviceId, limit)` - POST /api/bot/outbox/pull
- `sendAck(deviceId, results)` - POST /api/bot/outbox/ack

**참고**: Phase 1 기획서 6.2.5절의 `utils/api.js` 코드

**주의사항**:
- 메신저봇R은 Rhino 엔진 사용 → ES5 문법 사용
- org.jsoup.Jsoup으로 HTTP 요청
- JSON.stringify, JSON.parse 사용

---

### Part 4: utils/messageFormatter.js

**기능**: 긴 메시지 분할

```javascript
// utils/messageFormatter.js

function splitMessage(message, maxLength) {
  if (message.length <= maxLength) {
    return [message];
  }
  
  var chunks = [];
  var remaining = message;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    
    // 줄바꿈 기준으로 분할 시도
    var cutIndex = remaining.lastIndexOf('\n', maxLength);
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

module.exports = { splitMessage: splitMessage };
```

---

### Part 5: utils/logger.js

**기능**: 로깅 헬퍼

```javascript
// utils/logger.js

function log(level, message) {
  var timestamp = new Date().toISOString();
  var prefix = '[' + timestamp + '] [' + level + '] ';
  Log.i(prefix + message);
}

function info(message) {
  log('INFO', message);
}

function error(message) {
  log('ERROR', message);
  Log.e(message);
}

module.exports = {
  info: info,
  error: error
};
```

---

### Part 6: handlers/outboxHandler.js

**기능**: Outbox 폴링 및 전송

**참고**: Phase 1 기획서 6.2.3절

**핵심 로직**:
1. `startOutboxPolling(botConfig)` - 폴링 시작
2. `processOutbox(botConfig)` - 메시지 pull → 전송 → ack
3. 실패 시 에러 정보 수집
4. 메시지 분할 처리 (3000자 초과 시)

**주의사항**:
- `Api.replyRoom(roomName, message)` 사용
- 방 설정 확인 (`enabled=true`)
- 전송 성공/실패 로그

---

### Part 7: handlers/commandHandler.js

**기능**: 일반 사용자 명령 처리

**동작**:
1. 메시지가 명령어인지 확인 (리스크, 제휴, 일정 등)
2. 백엔드 POST /kakao/message 호출
3. 응답 메시지를 방에 전송

**기존 코드 참고**:
- `/Users/hoonsbook/AI vive coding projects/Test1/kakao-bot.js`
- `routeMessage()` 함수 로직 재사용

---

### Part 8: handlers/adminHandler.js

**기능**: 관리자 명령 처리

**명령어 목록**:
- `!방추가 <방이름>`
- `!방삭제 <방이름>`
- `!방 on/off <방이름>`
- `!일정알림 on/off <방이름>`
- `!명령 on/off <방이름>`
- `!방목록`
- `!상태`

**참고**: Phase 1 기획서 6.2.4절

**구현 포인트**:
- 명령어 파싱
- botConfig 수정
- 서버에 POST /api/bot/config 전송
- 로컬 캐시 업데이트

---

### Part 9: bot.js (메인 스크립트)

**기능**: 메신저봇R 메인 엔트리

**참고**: Phase 1 기획서 6.2.1절

**핵심 함수**:
1. `onStartCompile()` - 봇 시작 시 초기화
   - 서버에서 설정 로드
   - Outbox 폴링 시작
   
2. `response(room, msg, sender, isGroupChat, replier, imageDB, packageName)` - 메시지 수신
   - 관리자 명령 처리 (`!`로 시작)
   - 방 설정 확인
   - 일반 명령 처리

3. `setInterval()` - 주기적 설정 동기화 (1시간)

---

### Part 10: README.md

**내용**:

```markdown
# AVD 카카오톡 봇 (메신저봇R)

## 설치

1. Android Studio에서 AVD 생성 (API 28+)
2. AVD에서 메신저봇R APK 설치
3. 접근성 권한 부여
4. 카카오톡 로그인

## 설정

### 1. config.js 수정
- `SERVER_URL`: 백엔드 서버 주소
- `BOT_TOKEN`: 백엔드 .env의 BOT_API_TOKEN과 동일한 값
- `DEVICE_ID`: 봇 식별자 (다중 봇 운영 시 고유하게)

### 2. 서버 연결 확인
- AVD에서 호스트 PC는 `10.0.2.2`로 접근
- 백엔드가 `localhost:5000`이면 → `http://10.0.2.2:5000`

## 사용법

### 일반 명령어 (모든 사용자)
- `리스크` - 리스크 이슈 뉴스 조회
- `제휴` - 제휴처 탐색 정보 조회
- `기술` - 신기술 동향 조회
- `일정` - 이번 달 일정 조회
- `뉴스` - 전체 뉴스 모니터링
- `도움말` - 사용법 안내

### 관리자 명령어
- `!방추가 <방이름>` - 새 방 추가
- `!방 on <방이름>` - 방 활성화
- `!방 off <방이름>` - 방 비활성화
- `!일정알림 on <방이름>` - 일정 알림 ON
- `!일정알림 off <방이름>` - 일정 알림 OFF
- `!방목록` - 전체 방 목록 조회
- `!상태` - 봇 연결 상태 확인

## 자동 알림

백엔드에서 일정이 등록/변경/삭제되면 자동으로 카톡 방에 알림이 전송됩니다.

## 문제 해결

### 연결 안 됨
1. config.js의 SERVER_URL 확인
2. 백엔드 서버 실행 여부 확인
3. BOT_TOKEN 일치 여부 확인

### 메시지 안 전송
1. 방 설정 확인 (enabled=true, scheduleNotify=true)
2. 카톡 방 이름 정확히 일치하는지 확인
3. 백엔드 로그 확인 (`/api/bot/outbox/stats`)
```

---

## 🎯 구현 순서 제안

1. ✅ 프로젝트 폴더 생성
2. ✅ config.js 작성
3. ✅ utils/logger.js 구현
4. ✅ utils/api.js 구현
5. ✅ utils/messageFormatter.js 구현
6. ✅ handlers/outboxHandler.js 구현
7. ✅ handlers/commandHandler.js 구현
8. ✅ handlers/adminHandler.js 구현
9. ✅ bot.js 구현 (메인)
10. ✅ README.md 작성

---

## 📱 메신저봇R 특이사항

### 문법
- ES5 문법 사용 (var, function)
- Arrow function 사용 불가
- let, const 사용 불가
- async/await 사용 불가

### API
- `Api.replyRoom(room, msg)` - 방에 메시지 전송
- `Log.i(msg)` - 정보 로그
- `Log.e(msg)` - 에러 로그
- `java.lang.Thread.sleep(ms)` - 대기
- `org.jsoup.Jsoup.connect()` - HTTP 요청

### 제약
- 외부 npm 패키지 사용 불가
- 파일 시스템 제한적
- 메모리 제한 있음

---

## 출력 형식

구현이 완료되면 다음을 보고해주세요:

1. **생성된 파일 목록**
2. **설정 방법 요약**
3. **테스트 시나리오**

---

**이 프롬프트를 Sonnet 4.5에게 전달하고, AVD봇 프로젝트 구현이 완료되면 Opus에게 최종 코드 리뷰를 요청하세요!**

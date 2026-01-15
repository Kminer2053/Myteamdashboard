# Phase 2 프롬프트: UI 디자인
**담당 AI**: Gemini 3 Pro

---

# 🎨 역할: UI 디자인 담당

## 프로젝트 개요
카카오톡 봇 연동 개선 프로젝트의 **웹 대시보드 관리 UI** 설계

## 기존 대시보드 정보
- **URL**: https://myteamdashboard.vercel.app/index.html
- **기술 스택**: React + Vercel 배포
- **디자인 특징**: 
  - 깔끔한 카드 레이아웃
  - 파란색 계열 (#1976d2) 액센트
  - 반응형 디자인

## 📋 작업 요청: UI 컴포넌트 설계

Phase 1에서 작성된 기획서를 바탕으로, 다음 화면들의 UI/UX를 설계해주세요.

---

### 1. 카카오봇 관리 메인 화면

**목적**: 봇 설정 전체를 한눈에 관리

**포함 요소**:
- 상단 헤더: "카카오봇 관리" 제목 + 상태 표시 (연결됨/연결안됨)
- 요약 카드: 
  - 활성 방 수
  - 관리자 수
  - 대기 메시지 수 (pending)
  - 오늘 발송 성공/실패
- 탭 네비게이션: [방 관리] [관리자 설정] [발송 현황] [설정]

---

### 2. 방 관리 탭

**목적**: 카톡 방별 설정 관리

**포함 요소**:
- 방 목록 테이블:
  | 방 이름 | 상태 | 일정 알림 | 명령 응답 | 액션 |
  |--------|------|----------|----------|------|
  | 미래성장처 | 🟢 활성 | ON | ON | 편집/삭제 |
  | 개발팀 | 🔴 비활성 | OFF | ON | 편집/삭제 |

- 각 토글 스위치: 
  - enabled (활성/비활성)
  - scheduleNotify (일정 알림 ON/OFF)
  - commandsEnabled (명령 응답 ON/OFF)

- 방 추가 버튼 → 모달:
  - 방 이름 입력
  - 초기 설정 (체크박스들)
  - 저장/취소 버튼

- 방 편집 모달:
  - 방 이름 (읽기 전용)
  - 토글 스위치들
  - 저장/취소 버튼

---

### 3. 관리자 설정 탭

**목적**: 카톡 명령어 관리 권한이 있는 닉네임 관리

**포함 요소**:
- 관리자 목록:
  - 칩(Chip) 스타일로 표시: [Kminer ×] [홍길동 ×]
  - × 클릭 시 삭제 확인

- 관리자 추가:
  - 입력 필드 + 추가 버튼
  - "닉네임을 입력하세요" 플레이스홀더

- 주의 안내 박스:
  - ⚠️ "카카오톡 닉네임은 변경 가능하므로, 고유한 닉네임 사용을 권장합니다"

---

### 4. 발송 현황 탭 (Outbox 모니터링)

**목적**: 카톡 메시지 발송 상태 실시간 모니터링

**포함 요소**:

#### 4-1. 상태 요약 카드 (상단)
- 3개 카드 가로 배치:
  - 📤 대기중 (pending): 숫자 + 노란색 배경
  - ✅ 발송 완료 (sent): 숫자 + 초록색 배경
  - ❌ 발송 실패 (failed): 숫자 + 빨간색 배경

#### 4-2. 최근 발송 로그 테이블
| 시간 | 방 | 메시지 | 타입 | 상태 | 시도 | 에러 |
|------|-----|--------|------|------|------|------|
| 10:30 | 미래성장처 | [일정 등록] 팀미팅... | schedule_create | ✅ 완료 | 1 | - |
| 10:28 | 개발팀 | [일정 변경] 코드... | schedule_update | ❌ 실패 | 3 | timeout |

- 상태 필터: 전체 / 대기중 / 완료 / 실패
- 페이지네이션 (10개씩)
- 새로고침 버튼 (자동 새로고침 토글)

#### 4-3. 실패 메시지 재전송
- 실패 행에 "재전송" 버튼
- 클릭 시 해당 메시지 status를 pending으로 리셋

---

### 5. 설정 탭

**목적**: BOT_API_TOKEN 및 기타 설정

**포함 요소**:
- API 토큰 섹션:
  - 현재 토큰 (마스킹: `a1b2****...****z6`)
  - "토큰 보기" 토글 (클릭 시 전체 표시)
  - "토큰 복사" 버튼
  - "새 토큰 생성" 버튼 (확인 모달 필요)

- 폴링 설정:
  - 폴링 간격 (초): 숫자 입력 (기본값: 15)
  - "저장" 버튼

- 연결 테스트:
  - "연결 테스트" 버튼
  - 성공/실패 메시지 표시

---

## 🎨 디자인 요구사항

### 색상 팔레트
```
Primary: #1976d2 (파란색)
Secondary: #424242 (진한 회색)
Success: #4caf50 (녹색)
Warning: #ff9800 (주황색)
Error: #f44336 (빨간색)
Background: #f5f5f5 (연한 회색)
Card: #ffffff (흰색)
```

### 컴포넌트 스타일
- **카드**: 둥근 모서리 (8px), 그림자, 패딩 20px
- **버튼**: Primary/Secondary 색상, 호버 효과
- **테이블**: 줄무늬 배경, 호버 하이라이트
- **토글 스위치**: ON=녹색, OFF=회색
- **모달**: 중앙 정렬, 배경 어둡게, 애니메이션

### 반응형 브레이크포인트
- Desktop: 1200px 이상
- Tablet: 768px ~ 1199px
- Mobile: 767px 이하

---

## 📁 출력 형식

### 1. 각 화면별 와이어프레임 (ASCII 또는 텍스트 설명)

### 2. 컴포넌트 구조
```
KakaoBotAdmin/
├── index.jsx           ← 메인 컨테이너
├── components/
│   ├── Header.jsx
│   ├── SummaryCards.jsx
│   ├── TabNavigation.jsx
│   ├── RoomManagement/
│   │   ├── RoomTable.jsx
│   │   ├── RoomModal.jsx
│   │   └── RoomToggle.jsx
│   ├── AdminSettings/
│   │   ├── AdminList.jsx
│   │   └── AdminChip.jsx
│   ├── OutboxMonitor/
│   │   ├── StatusCards.jsx
│   │   ├── LogTable.jsx
│   │   └── LogFilter.jsx
│   └── Settings/
│       ├── TokenSettings.jsx
│       └── PollingSettings.jsx
└── hooks/
    ├── useBotConfig.js
    └── useOutboxStats.js
```

### 3. 주요 화면 레이아웃 설명

### 4. 상호작용 흐름 (사용자 시나리오)

### 5. 접근성 고려사항

---

## 참고: Phase 1 기획서 핵심 내용

### API 엔드포인트
- `GET /api/bot/config` - 설정 조회
- `POST /api/bot/config` - 설정 변경
- `GET /api/bot/outbox/stats` - 통계 조회

### 데이터 구조
```javascript
// 방 설정
{
  roomName: "미래성장처",
  enabled: true,
  scheduleNotify: true,
  commandsEnabled: true
}

// Outbox 통계
{
  pending: 5,
  sent: 120,
  failed: 2,
  recentLogs: [...]
}
```

---

**이 프롬프트를 Gemini 3 Pro에게 전달하고, 완성된 UI 설계를 Opus에게 가져와주세요!**

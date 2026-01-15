# 카카오톡 봇 연동 개선 프로젝트
## 에이전트 오케스트레이션 계획

**시작일**: 2026-01-15  
**목표**: 파이썬 PC봇 → AVD 메신저봇R 전환

---

## 📋 역할 분담

| Phase | 역할 | 담당 AI | 상태 |
|-------|------|---------|------|
| 1 | 기능정의/개발기획 | Sonnet 4.5 | ✅ 완료 |
| 2 | UI 디자인 | Gemini 3 Pro | ✅ 완료 |
| 3-A | 백엔드 코딩 | Sonnet 4.5 | ✅ 완료 |
| 3-B | AVD봇 코딩 | Sonnet 4.5 | ✅ 완료 |
| 4 | 코드감사/디버깅 | Opus 4.5 | ✅ 완료 (버그 수정됨) |
| 5 | PM/최종정리 | GPT-5.2 | ✅ 완료 |
| 6 | 어드민 봇관리 UI 추가 | Sonnet+Opus+GPT | ✅ 완료 |

---

## 🎯 프로젝트 목표

### 현재 상황
- 파이썬 PC봇이 카톡 명령어 처리
- 스케줄 변경 시 이메일 알림만 발송
- 카톡 자동 알림 없음

### 개선 목표
1. AVD 메신저봇R로 전환
2. 스케줄 변경 시 카톡 자동 알림 추가
3. 방별 설정 관리 (알림 ON/OFF)
4. 관리자 명령어 추가
5. Outbox 패턴으로 안정적 메시지 전송

---

## 📂 프로젝트 구조

### 기존 프로젝트 (Test1)
```
/Users/hoonsbook/AI vive coding projects/Test1/
├── server.js              ← 백엔드 API 수정
├── models/
│   ├── BotOutbox.js       ← 신규 추가
│   └── ...
├── frontend/
│   └── (봇 관리 UI 추가)
└── docs/
    └── bot-migration/     ← 프로젝트 문서
```

### 신규 프로젝트 (AVD봇)
```
/Users/hoonsbook/AI vive coding projects/AVD-KakaoBot/
├── README.md
├── bot.js
├── config.js
└── handlers/
```

---

## 📝 Phase별 산출물

| Phase | 산출물 파일 |
|-------|------------|
| 1 | `01-specification.md` - 상세 기획서 |
| 2 | `02-ui-design.md` - UI 컴포넌트 설계 |
| 3 | 실제 코드 파일들 |
| 4 | `04-code-review.md` - 코드 리뷰 리포트 |
| 5 | `05-deployment-guide.md` - 배포 가이드 |

---

## 🔄 진행 흐름

```
Opus (PM) → "Sonnet으로 전환하세요" 
    ↓
Sonnet → 기획서 작성
    ↓
Opus (PM) → 기획서 검토 및 저장 → "Gemini로 전환하세요"
    ↓
Gemini → UI 설계
    ↓
Opus (PM) → UI 검토 및 저장 → "Sonnet으로 전환하세요"
    ↓
Sonnet → 코딩
    ↓
Opus → 코드 리뷰
    ↓
GPT-5.2 → 최종 정리
```

---

**현재 상태**: ✅ 프로젝트 완료! (2026-01-15)

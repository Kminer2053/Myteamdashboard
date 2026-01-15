# Phase 5 프롬프트: PM/최종정리
**담당 AI**: GPT-5.2

---

# 📋 역할: PM/진행관리 담당

## 프로젝트 개요
카카오톡 봇 연동 개선 프로젝트 - 전체 개발 완료 후 최종 정리

## 완료된 작업

### Phase 1: 기획 (Sonnet 4.5) ✅
- 상세 기획서 2000+ 줄
- API 스펙, 데이터 모델, 시퀀스 다이어그램
- 파일: `docs/bot-migration/phase1-detailed-spec.md`

### Phase 2: UI 설계 (Gemini 3 Pro) ✅
- 5개 화면 와이어프레임
- 컴포넌트 구조
- 파일: `docs/bot-migration/phase2-ui-design.md`

### Phase 3-A: 백엔드 구현 (Sonnet 4.5) ✅
- BotOutbox 모델
- Bot API 엔드포인트 5개
- enqueueScheduleKakao 함수
- 스케줄 CRUD 연결

### Phase 3-B: AVD 봇 구현 (Sonnet 4.5) ✅
- 메신저봇R 스크립트
- 9개 파일 (850줄)
- 프로젝트: `/Users/hoonsbook/AI vive coding projects/AVD-KakaoBot/`

### Phase 4: 코드 리뷰 (Opus 4.5) ✅
- 백엔드 리뷰: 4.8/5 (승인)
- AVD 봇 리뷰: 4.9/5 (버그 수정 완료)
- 파일: `docs/bot-migration/phase4-code-review.md`

---

## 📋 작업 요청: 최종 정리 문서 작성

다음 내용을 포함한 **배포 가이드 및 운영 문서**를 작성해주세요.

### 1. 배포 체크리스트

**백엔드 (Test1 프로젝트)**:
- [ ] `.env`에 `BOT_API_TOKEN` 설정
- [ ] MongoDB 연결 확인
- [ ] BotOutbox 인덱스 생성 확인
- [ ] 서버 재시작

**AVD 봇 (AVD-KakaoBot)**:
- [ ] `config.js` 설정 (SERVER_URL, BOT_TOKEN)
- [ ] 메신저봇R에 스크립트 업로드
- [ ] 접근성 권한 확인
- [ ] 카카오톡 로그인 상태 확인
- [ ] 봇 시작 및 초기화 로그 확인

### 2. 통합 테스트 시나리오

**테스트 1**: 일정 등록 → 카톡 알림
1. 대시보드에서 일정 등록
2. 15초 내 카톡방에 알림 도착 확인
3. BotOutbox status='sent' 확인

**테스트 2**: 관리자 명령어
1. 관리자가 `!방추가 테스트방` 입력
2. 봇 응답 확인
3. 서버 Setting 반영 확인

**테스트 3**: 전송 실패 → 재시도
1. 존재하지 않는 방에 메시지 적재
2. 실패 후 attempts 증가 확인
3. 5회 실패 후 status='failed' 확인

### 3. 운영 가이드

**일상 모니터링**:
- GET /api/bot/outbox/stats 주기적 확인
- pending 누적 시 봇 상태 확인
- failed 발생 시 로그 확인

**장애 대응**:
- 봇 연결 끊김 → AVD 재시작
- 메시지 누적 → 백엔드 로그 확인
- 인증 실패 → 토큰 일치 여부 확인

**설정 변경**:
- 방 추가/삭제: 카톡에서 `!방추가`, `!방삭제`
- 폴링 간격 변경: AVD config.js 수정 후 재시작
- 토큰 변경: 백엔드 .env + AVD config.js 동시 변경

### 4. 롤백 계획

**문제 발생 시**:
1. AVD 봇 중단
2. BotOutbox pending 메시지 확인
3. 필요 시 수동 처리 또는 삭제
4. 기존 파이썬 봇 재활성화 (있는 경우)

### 5. 향후 개선 로드맵

**Phase 2 (선택적)**:
- [ ] 웹 대시보드에 봇 관리 UI 추가
- [ ] Outbox 모니터링 화면
- [ ] 실시간 알림 (WebSocket)

**Phase 3 (선택적)**:
- [ ] 다중 AVD 봇 지원 강화
- [ ] 메시지 템플릿 커스터마이징
- [ ] 통계 대시보드

### 6. 프로젝트 요약

**구현된 기능**:
1. ✅ 스케줄 변경 시 카톡 자동 알림
2. ✅ Outbox 패턴으로 안정적 전송
3. ✅ 방별 알림 ON/OFF 설정
4. ✅ 관리자 명령어 (카톡에서 설정 변경)
5. ✅ 재시도 정책 (지수 백오프)
6. ✅ 기존 명령어 응답 유지

**프로젝트 구조**:
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

---

## 출력 형식

마크다운 문서로 작성해주세요.

파일명: `docs/bot-migration/phase5-deployment-guide.md`

---

**이 프롬프트를 GPT-5.2에게 전달하고, 배포 가이드가 완성되면 Opus에게 최종 확인을 요청하세요!**

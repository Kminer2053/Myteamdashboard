# 팀 대시보드 프로젝트

## 프로젝트 소개
AI 기반 뉴스 모니터링 및 팀 일정 관리를 통합한 대시보드 시스템입니다. Perplexity AI를 활용하여 리스크 이슈, 제휴처 탐색, 신기술 동향 뉴스를 자동으로 수집하고 분석합니다.

## 주요 기능

### 🤖 AI 기반 뉴스 모니터링 (Perplexity AI)
- **3가지 카테고리별 자동 수집**
  - 리스크 이슈: 위험 요소 및 리스크 관련 뉴스
  - 제휴처 탐색: 파트너사 및 제휴 관련 비즈니스 뉴스
  - 신기술 동향: 혁신 기술 및 기술 트렌드 뉴스
- **AI 분석 기능**
  - 뉴스 자동 요약 (AI Summary)
  - 일일 종합 분석 보고서 생성
  - 관련 키워드 자동 추출
  - 최근 24시간 내 뉴스만 수집
- **커스터마이징**
  - 카테고리별 커스텀 프롬프트 설정
  - 토큰 제한 설정 (카테고리별)
  - 뉴스 수집 시간 설정 (기본: 매일 08:00)
- **수집 데이터 관리**
  - 중복 뉴스 자동 필터링
  - 수집일자 기준 필터링
  - AI 요약이 있는 뉴스만 저장

### 📅 일정 관리
- 일정 등록/수정/삭제
- 일정 변경 시 이메일 자동 알림
- 카카오톡 봇을 통한 일정 조회
- 공휴일 API 연동

### 📊 이용통계 대시보드
- **명령어/액션별 통계**
  - 카카오톡 봇 명령어 사용 통계
  - 대시보드 액션별 통계
  - Perplexity AI 사용 통계
- **방문자 통계**
  - 일일/월간/누적 방문자수
  - 차트 및 표 시각화
- **데이터 내보내기**
  - 엑셀 다운로드 기능

### 💾 DB 사용량 관리
- 현재 DB 사용량 모니터링
- 사용량 제한 설정
- 자동 삭제량 설정
- 용량 초과 시 자동 데이터 삭제 (과거 데이터 우선)

### 📧 통계 메일링
- 월 1회 자동 발송 (매월 말일)
- 관리자 지정 메일로 월간 이용통계 전송
- 통계 데이터 포함 (명령어별, 방문자수 등)

### 🔍 화제성 분석 (Hot Topic Analysis)
- 키워드별 화제성 지수 계산
- 다중 소스 데이터 수집 (뉴스, YouTube, Twitter, Instagram, TikTok)
- AI 기반 종합 인사이트 생성
- 트렌드 비교 분석

### 🤖 카카오톡 봇
- 일정 조회 및 관리
- 뉴스 요약 제공
- 명령어 기반 인터랙션
- 모든 액션 자동 통계 기록

### ⚙️ 관리자 페이지
- 키워드/조건/주제 관리
- AI 프롬프트 설정
- 토큰 제한 설정
- 이메일 리스트 관리
- 뉴스 수집 시간 설정

## 기술 스택

### Frontend
- HTML, CSS, JavaScript (Vanilla JS)
- Vite (빌드 도구)
- Chart.js (통계 시각화)

### Backend
- Node.js 22.x
- Express.js
- Mongoose (MongoDB ODM)

### Database
- MongoDB Atlas (클라우드)
- 주요 컬렉션:
  - `risknews`, `partnernews`, `technews` (뉴스 데이터)
  - `riskanalysisreports`, `partneranalysisreports`, `techanalysisreports` (AI 분석 보고서)
  - `schedules` (일정)
  - `useractionlogs` (이용 통계)
  - `riskkeywords`, `partnerconditions`, `techtopics` (키워드/조건/주제)
  - `settings` (시스템 설정)

### AI & External APIs
- Perplexity AI (sonar-pro 모델)
- 네이버 뉴스 API (언론보도 효과성 측정용)
- 공휴일 API

### 배포
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## 설치 및 실행 방법

### 필수 요구사항
- Node.js 22.x 이상
- MongoDB Atlas 계정 (또는 로컬 MongoDB)
- Perplexity AI API 키

### 설치
```bash
# 저장소 클론
git clone <repository-url>
cd Test1

# 의존성 설치
npm install

# 환경 변수 설정
cp env.example .env
# .env 파일에 필요한 환경 변수 설정
```

### 환경 변수 설정 (.env)
```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# Perplexity AI
PERPLEXITY_API_KEY=your_perplexity_api_key

# 카카오톡 봇
KAKAO_BOT_TOKEN=your_kakao_bot_token
KAKAO_BOT_SECRET=your_kakao_bot_secret

# 이메일 (Gmail)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# 관리자
ADMIN_PASSWORD=your_admin_password

# 네이버 API (선택사항)
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret

# 공휴일 API (선택사항)
HOLIDAY_API_KEY=your_holiday_api_key
```

### 실행
```bash
# 개발 서버 실행 (포트 4000)
npm run dev

# 프론트엔드 개발 서버 실행 (포트 8000)
npm run preview

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## 주요 기능 상세 설명

### AI 기반 뉴스 모니터링

#### 자동 수집 프로세스
1. **크론 스케줄러**: 매일 설정된 시간(기본 08:00 KST)에 자동 실행
2. **키워드 기반 수집**: 각 카테고리별로 설정된 키워드/조건/주제로 뉴스 검색
3. **AI 분석**: Perplexity AI를 통해 뉴스 요약 및 종합 분석 보고서 생성
4. **데이터 저장**: 최근 24시간 내 뉴스만 필터링하여 DB 저장
5. **중복 제거**: 링크 및 제목 기준 중복 자동 필터링

#### API 엔드포인트
- `POST /api/collect-news/:category` - 수동 뉴스 수집 (risk/partner/tech)
- `GET /api/risk-news` - 리스크 이슈 뉴스 조회
- `GET /api/partner-news` - 제휴처 탐색 뉴스 조회
- `GET /api/tech-news` - 신기술 동향 뉴스 조회
- `GET /api/risk-analysis/:date?` - 리스크 분석 보고서 조회
- `GET /api/partner-analysis/:date?` - 제휴처 분석 보고서 조회
- `GET /api/tech-analysis/:date?` - 신기술 분석 보고서 조회

#### 설정 API
- `GET/POST /api/prompt/:category` - 카테고리별 AI 프롬프트 설정
- `GET/POST /api/token-limits` - 카테고리별 토큰 제한 설정
- `GET/POST /api/settings/news-update-time` - 뉴스 수집 시간 설정

### 일정 관리
- **CRUD API**: 일정 등록/수정/삭제/조회
- **이메일 알림**: 일정 변경 시 설정된 이메일로 자동 발송
- **공휴일 연동**: 공휴일 API를 통한 공휴일 표시
- **카카오톡 연동**: 봇을 통한 일정 조회 및 관리

### 이용통계 시스템
- **자동 기록**: 모든 사용자 액션 자동 기록 (UserActionLog)
- **통계 유형**:
  - 카카오톡 봇 명령어별 통계
  - 대시보드 방문자 통계
  - Perplexity AI 사용 통계
- **시각화**: 차트 및 표 형태로 통계 표시
- **데이터 내보내기**: 엑셀 파일 다운로드 지원

### DB 사용량 관리
- **모니터링**: 실시간 DB 사용량 확인
- **자동 삭제**: 설정된 제한량 초과 시 자동으로 오래된 데이터 삭제
- **설정**: 제한량 및 삭제량 커스터마이징 가능

### 통계 메일링
- **자동 발송**: 매월 말일 자동 실행
- **내용**: 월간 이용통계 요약
- **수신자**: 관리자가 설정한 이메일 리스트

### 화제성 분석
- **다중 소스 수집**: 뉴스, YouTube, Twitter, Instagram, TikTok
- **지수 계산**: 노출 지수, 참여 지수, 수요 지수, 종합 지수
- **AI 인사이트**: Perplexity AI를 통한 종합 분석 및 전략 제안
- **트렌드 비교**: 과거 데이터와의 비교 분석

## 프로젝트 구조

```
Test1/
├── public/                    # 프론트엔드 정적 파일
│   ├── index.html            # 메인 대시보드
│   ├── admin.html            # 관리자 페이지
│   ├── stats.html            # 통계 페이지
│   ├── app.js                # 메인 프론트엔드 로직
│   └── styles.css            # 스타일시트
├── dist/                      # 빌드된 파일 (Vite)
├── frontend/                  # React 컴포넌트 (선택사항)
│   └── src/
│       ├── components/
│       └── pages/
├── models/                    # MongoDB 모델
│   ├── RiskNews.js           # 리스크 이슈 뉴스
│   ├── PartnerNews.js        # 제휴처 탐색 뉴스
│   ├── TechNews.js           # 신기술 동향 뉴스
│   ├── RiskAnalysisReport.js # 리스크 분석 보고서
│   ├── PartnerAnalysisReport.js
│   ├── TechAnalysisReport.js
│   ├── Schedule.js           # 일정
│   ├── UserActionLog.js      # 이용 통계
│   ├── RiskKeyword.js        # 리스크 키워드
│   ├── PartnerCondition.js   # 제휴처 조건
│   ├── TechTopic.js          # 신기술 주제
│   ├── Setting.js            # 시스템 설정
│   ├── WeightSetting.js      # 가중치 설정
│   ├── DBUsageSetting.js     # DB 사용량 설정
│   └── ...
├── routes/                    # API 라우트
│   ├── index.js              # 기본 라우트
│   ├── log.js                # 통계 로그
│   ├── db.js                 # DB 관리
│   ├── mail.js               # 메일 발송
│   ├── weightSettings.js     # 가중치 설정
│   └── hotTopicAnalysis.js   # 화제성 분석
├── services/                 # 비즈니스 로직
│   ├── aiInsightService.js   # AI 인사이트 서비스
│   ├── hotTopicDataCollector.js # 화제성 데이터 수집
│   └── reportGenerator.js    # 리포트 생성
├── server.js                 # 메인 서버 파일
├── db.js                     # MongoDB 연결
├── kakao-bot.js              # 카카오톡 봇 라우터
├── vite.config.js            # Vite 설정
├── package.json              # 프로젝트 설정
└── render.yaml               # Render 배포 설정
```

## 주요 API 엔드포인트

### 뉴스 관련
- `GET /api/risk-news` - 리스크 이슈 뉴스 조회
- `GET /api/partner-news` - 제휴처 탐색 뉴스 조회
- `GET /api/tech-news` - 신기술 동향 뉴스 조회
- `POST /api/collect-news/:category` - 수동 뉴스 수집
- `GET /api/risk-analysis/:date?` - 리스크 분석 보고서
- `GET /api/partner-analysis/:date?` - 제휴처 분석 보고서
- `GET /api/tech-analysis/:date?` - 신기술 분석 보고서

### 설정 관련
- `GET/POST /api/risk-keywords` - 리스크 키워드 관리
- `GET/POST /api/partner-conditions` - 제휴처 조건 관리
- `GET/POST /api/tech-topics` - 신기술 주제 관리
- `GET/POST /api/prompt/:category` - AI 프롬프트 설정
- `GET/POST /api/token-limits` - 토큰 제한 설정
- `GET/POST /api/settings/news-update-time` - 수집 시간 설정

### 일정 관련
- `GET /api/schedules` - 일정 조회
- `POST /api/schedules` - 일정 등록
- `PUT /api/schedules/:id` - 일정 수정
- `DELETE /api/schedules/:id` - 일정 삭제

### 통계 관련
- `GET /api/stats/visit` - 방문자 통계
- `POST /api/visit` - 방문 기록
- `GET /api/logs` - 이용 통계 로그

### DB 관리
- `GET /api/db/usage` - DB 사용량 조회
- `GET/POST /api/db/settings` - DB 설정 관리

### 화제성 분석
- `GET /api/hot-topic-analysis/:keyword` - 키워드별 화제성 분석
- `POST /api/hot-topic-analysis/analyze` - 화제성 분석 실행

## 배포 정보

### 환경 변수 (필수)
```env
MONGODB_URI=mongodb+srv://...
PERPLEXITY_API_KEY=pplx-...
KAKAO_BOT_TOKEN=...
KAKAO_BOT_SECRET=...
EMAIL_USER=...
EMAIL_PASS=...
ADMIN_PASSWORD=...
```

### 환경 변수 (선택)
```env
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
HOLIDAY_API_KEY=...
```

### 배포 환경
- **Frontend**: Vercel (정적 파일 호스팅)
- **Backend**: Render (Node.js 서버)
- **Database**: MongoDB Atlas (클라우드)
- **Build**: Vite를 통한 프론트엔드 빌드

### 배포 스크립트
```bash
# Vercel 배포
npm run deploy:vercel
# 또는
./deploy-vercel.sh
```

## 개발 가이드

### 크론 작업
- **뉴스 자동 수집**: 매일 설정된 시간에 실행 (기본 08:00 KST)
- **통계 메일 발송**: 매월 말일 23:50에 실행
- **DB 자동 삭제**: 뉴스 수집 후 자동 실행 (설정된 제한량 초과 시)

### 데이터 수집 규칙
1. **최근 24시간 내 뉴스만 수집**: 오늘 또는 어제 발행된 뉴스만 저장
2. **AI 요약 필수**: AI 요약이 없는 뉴스는 제외
3. **중복 제거**: 링크 또는 제목+발행일 기준 중복 제거
4. **분석 보고서**: 금일 뉴스가 1건 이상 있을 때만 생성

### 토큰 관리
- 기본 토큰 제한: 카테고리별 3000 토큰
- 토큰 잘림 감지 시 자동 재시도 (2배 토큰으로)
- Rate Limit 도달 시 30초 후 자동 재시도

### 에러 처리
- Perplexity AI 실패 시 로그 기록 후 계속 진행
- 네트워크 오류 시 재시도 로직 포함
- DB 연결 실패 시 자동 재연결

## 테스트

### 테스트 파일
프로젝트에는 다양한 테스트 파일이 포함되어 있습니다:
- `test_perplexity.js` - Perplexity AI 테스트
- `test_naver_news.js` - 네이버 뉴스 API 테스트
- `test_twitter.js` - Twitter API 테스트
- `test_youtube.js` - YouTube API 테스트
- `test_instagram.js` - Instagram API 테스트
- `test_tiktok.js` - TikTok API 테스트
- `test_all_apis.js` - 전체 API 테스트

### 테스트 실행
```bash
# 개별 테스트
node test_perplexity.js

# 전체 API 테스트
node test_all_apis.js
```

## 문제 해결

### 뉴스가 수집되지 않는 경우
1. 키워드/조건/주제가 설정되어 있는지 확인
2. Perplexity API 키가 유효한지 확인
3. Rate Limit 상태 확인 (`GET /api/rate-limit-status`)
4. 서버 로그 확인

### DB 사용량이 급증하는 경우
1. DB 사용량 설정 확인 (`GET /api/db/usage`)
2. 자동 삭제 설정 확인
3. 수동으로 오래된 데이터 삭제

### 이메일이 발송되지 않는 경우
1. Gmail 앱 비밀번호 확인
2. 이메일 리스트 설정 확인 (`GET /api/emails`)
3. 이메일 서비스 로그 확인

## 라이선스
ISC

## 기여
프로젝트 개선을 위한 기여를 환영합니다. 이슈 리포트 및 Pull Request를 통해 참여해주세요.

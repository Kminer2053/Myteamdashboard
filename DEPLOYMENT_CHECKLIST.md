# 🚀 점심 추천 서비스 배포 체크리스트

## 📋 배포 전 확인 사항

### 1. Google Apps Script 설정

- [ ] Google Sheets 생성 및 시트 구조 설정
  - [ ] `places` 시트 (헤더 포함)
  - [ ] `reviews` 시트 (헤더 포함)
  - [ ] `reco_logs` 시트 (헤더 포함)

- [ ] Apps Script 배포
  - [ ] `docs/lunch-service/apps-script-template.js` 코드 복사
  - [ ] 스크립트 속성 설정 (`API_KEY`, `PERPLEXITY_API_KEY`)
  - [ ] 웹 앱으로 배포 (모든 사용자 액세스)
  - [ ] 배포 URL 복사

### 2. 백엔드 환경변수 설정

`.env` 파일에 다음 추가:

```env
# 점심 추천 서비스
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
LUNCH_API_KEY=your-lunch-api-key-here-min-32-chars
LUNCH_WEB_URL=https://your-lunch-service.vercel.app
```

**중요**: `LUNCH_API_KEY`는 Apps Script의 `API_KEY`와 동일해야 합니다!

- [ ] `GOOGLE_APPS_SCRIPT_URL` 설정
- [ ] `LUNCH_API_KEY` 설정 (Apps Script와 동일)
- [ ] `LUNCH_WEB_URL` 설정 (배포 후 업데이트)

### 3. 프론트엔드 배포

#### Vercel 배포 (권장)

```bash
cd lunch-service
vercel
```

- [ ] Vercel에 배포
- [ ] 배포된 URL 확인
- [ ] 백엔드 `.env`의 `LUNCH_WEB_URL`을 배포 URL로 업데이트

#### 또는 Netlify 배포

```bash
cd lunch-service
netlify deploy --prod
```

### 4. 백엔드 배포

- [ ] Render.com 또는 다른 호스팅 서비스에 배포
- [ ] 환경변수 설정 확인
- [ ] 서버 시작 확인

### 5. 테스트

#### 5.1 Apps Script 테스트

```bash
curl -X GET "YOUR_APPS_SCRIPT_URL?path=places&method=GET" \
  -H "x-api-key: YOUR_API_KEY"
```

- [ ] 장소 목록 조회 테스트
- [ ] 장소 등록 테스트
- [ ] 추천 요청 테스트

#### 5.2 백엔드 API 테스트

```bash
curl -X GET "https://your-backend.com/lunch/places"
```

- [ ] GET /lunch/places 테스트
- [ ] POST /lunch/places 테스트
- [ ] POST /lunch/recommend 테스트

#### 5.3 프론트엔드 테스트

브라우저에서 `https://your-lunch-service.vercel.app` 접속:

- [ ] 추천 탭 테스트
  - [ ] 자연어 입력 및 추천 받기
  - [ ] 프리셋 선택 테스트
  - [ ] 제외 기능 테스트
- [ ] 목록 탭 테스트
  - [ ] 장소 목록 로드
  - [ ] 검색 기능 테스트
- [ ] 등록 탭 테스트
  - [ ] 새 장소 등록
  - [ ] 유효성 검사 확인

#### 5.4 카카오톡봇 테스트

카카오톡에서:

- [ ] `/점심 가까운 곳에서 혼밥 가능한 곳` 테스트
- [ ] `/추천 실내에서 먹을 수 있는 곳` 테스트
- [ ] 웹페이지 링크 클릭하여 프론트엔드 접속 확인

## 🔧 문제 해결

### CORS 오류 발생 시

백엔드 `server.js`의 CORS 설정 확인:

```javascript
const allowedOrigins = [
    'https://myteamdashboard.onrender.com',
    /\.vercel\.app$/,  // Vercel 도메인
    /\.netlify\.app$/,  // Netlify 도메인
    'http://localhost:8002',
    'http://localhost:4000'
];
```

프론트엔드 URL이 포함되어 있는지 확인하고, 없으면 추가.

### API 호출 실패 시

1. 네트워크 탭에서 요청 확인
2. API URL이 올바른지 확인
3. 환경변수가 올바르게 설정되었는지 확인

### Apps Script 인증 오류 시

1. `API_KEY` 스크립트 속성 확인
2. 백엔드 `LUNCH_API_KEY`와 일치하는지 확인
3. Apps Script 배포 설정 확인 (모든 사용자 액세스)

## 📱 모바일 테스트

- [ ] iOS Safari에서 테스트
- [ ] Android Chrome에서 테스트
- [ ] 반응형 디자인 확인
- [ ] 터치 UI 작동 확인

## 🎉 배포 완료

모든 체크리스트를 완료하면 점심 추천 서비스가 정상적으로 배포된 것입니다!

## 📚 추가 자료

- [Setup Guide](docs/lunch-service/setup-guide.md)
- [API Specification](API_SPEC.md)
- [Frontend README](lunch-service/README.md)
- [Work Log](WORKLOG.md)

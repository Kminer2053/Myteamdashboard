# 점심 추천 서비스 설정 가이드

## 개요

이 가이드는 Google Apps Script를 사용하여 점심 추천 서비스의 백엔드를 설정하는 방법을 설명합니다.

## 사전 준비

1. Google 계정
2. Google Sheets 접근 권한
3. 기본적인 Google Apps Script 이해

## 설정 단계

### 1. Google Sheets 생성

1. [Google Sheets](https://sheets.google.com)에 접속
2. 새 스프레드시트 생성
3. 스프레드시트 이름을 "점심 추천 데이터베이스"로 설정

### 2. 시트 구조 설정

다음 4개의 시트를 생성하고 헤더를 설정합니다:

#### Sheet 1: `places` (장소 정보)

| place_id | name | address_text | naver_map_url | category | price_level | tags | walk_min | solo_ok | group_ok | indoor_ok | created_at | updated_at |
|----------|------|--------------|---------------|----------|-------------|------|----------|---------|----------|-----------|------------|------------|
| | | | | | | | | | | | | |

#### Sheet 2: `reviews` (리뷰 정보)

| review_id | place_id | verdict | reasons | comment | created_at |
|-----------|----------|---------|---------|---------|------------|
| | | | | | |

#### Sheet 3: `reco_logs` (추천 로그)

| log_id | text | preset | exclude | result_place_ids | created_at |
|--------|------|--------|---------|------------------|------------|
| | | | | | |

#### Sheet 4: `config` (설정 정보) - 선택사항

| key | value |
|-----|-------|
| | |

### 3. Apps Script 코드 배포

1. Google Sheets 메뉴에서 **확장 프로그램** > **Apps Script** 클릭
2. 기본 코드를 삭제하고 `apps-script-template.js` 파일의 내용을 붙여넣기
3. 파일 이름을 "LunchService"로 변경
4. **저장** 버튼 클릭 (Ctrl/Cmd + S)

### 4. 환경변수 설정

1. Apps Script 편집기에서 **프로젝트 설정** (톱니바퀴 아이콘) 클릭
2. **스크립트 속성** 섹션으로 이동
3. 다음 속성을 추가:

   - **속성**: `API_KEY`
     - **값**: 32자 이상의 랜덤 문자열 (예: `your-lunch-api-key-here-min-32-chars`)
     - 생성 방법: 터미널에서 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

   - **속성**: `PERPLEXITY_API_KEY` (선택사항)
     - **값**: Perplexity AI API 키
     - LLM 기반 추천을 사용하려면 필수
     - 없으면 규칙 기반 추천만 사용

### 5. Apps Script 배포

1. Apps Script 편집기에서 **배포** > **새 배포** 클릭
2. **유형 선택**: **웹 앱** 선택
3. 배포 설정:
   - **설명**: "점심 추천 서비스 v1.0"
   - **실행 대상**: **나**
   - **액세스 권한**: **모든 사용자** (인증 없이도 접근 가능하도록)
4. **배포** 버튼 클릭
5. 권한 승인:
   - Google 계정 선택
   - "앱이 확인되지 않았습니다" 경고가 나타나면 **고급** > **[프로젝트명](으)로 이동** 클릭
   - 권한 허용
6. **웹 앱 URL** 복사 (예: `https://script.google.com/macros/s/AKfycbz.../exec`)

### 6. server.js 환경변수 설정

레포지토리 루트의 `.env` 파일에 다음을 추가:

```env
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
LUNCH_API_KEY=your-lunch-api-key-here-min-32-chars
LUNCH_WEB_URL=https://your-lunch-service.vercel.app
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
NCP_APIGW_API_KEY_ID=your-ncp-api-key-id
NCP_APIGW_API_KEY=your-ncp-api-key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

**중요**: `LUNCH_API_KEY`는 Apps Script의 `API_KEY` 스크립트 속성과 동일해야 합니다!

**등록 검색 기능**: 등록 탭에서 "이름/주소 검색 후 목록 선택"을 사용하려면 네이버 개발자센터에서 애플리케이션을 등록하고 **검색 API**를 사용 설정한 뒤 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 발급받아 위와 같이 설정하세요.

**도보 시간(Google Directions API)**: 장소 선택 시 Google Directions API `walking` 모드로 정확한 도보 시간을 계산합니다. Google Cloud Console에서 **Directions API**를 활성화하고 API 키를 발급받아 `GOOGLE_MAPS_API_KEY`를 설정하세요. 미설정 시 Haversine 추정값으로 폴백합니다.

**지도 미리보기(NCP Static Map)**: 등록 폼에서 지도 미리보기 이미지를 표시합니다. NCP 콘솔에서 Application > Maps > **Static Map** API를 사용 설정하세요. `NCP_APIGW_API_KEY_ID`, `NCP_APIGW_API_KEY`는 Geocoding과 공유합니다.

**이미지 업로드(Google Drive)**: 식당 대표 이미지를 Google Drive에 저장합니다. Apps Script에서 DriveApp 권한을 허용해야 합니다. 이미지는 `lunch-images` 폴더에 저장되며, 공개 URL이 places 시트의 `image_url` 컬럼에 기록됩니다.

### 6.1 Google Sheets 스키마 업데이트

기존 `places` 시트에 다음 컬럼을 추가하세요:
- `image_url` - 대표 이미지 Google Drive URL
- `lat` - 위도
- `lng` - 경도

`config` 시트에 다음 키-값을 추가하세요:
| key | value | 설명 |
|-----|-------|------|
| register_password | 1234 | 장소 등록 암호 (기본값) |
| admin_password | admin1234 | 관리자 비밀번호 (기본값) |
| cron_time | 0 10 * * 1-5 | 일일 추천 생성 cron (평일 10시) |

`daily_recommendations` 시트를 새로 생성하세요 (또는 첫 실행 시 자동 생성):
| date | recommendations_json | created_at |
|------|---------------------|------------|
| | | |

### 7. 배포 확인

#### 7.1 Apps Script 테스트

Apps Script 편집기에서 **실행** 버튼을 클릭하여 함수가 정상 작동하는지 확인:

1. 함수 선택: `getPlaces`
2. 실행 후 로그 확인

#### 7.2 API 엔드포인트 테스트

터미널에서 다음 명령어로 테스트:

```bash
# 장소 목록 조회
curl -X GET "YOUR_APPS_SCRIPT_URL?path=places&method=GET" \
  -H "x-api-key: your-lunch-api-key-here"

# 새 장소 등록
curl -X POST "YOUR_APPS_SCRIPT_URL?path=places&method=POST" \
  -H "x-api-key: your-lunch-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트 식당",
    "address_text": "서울시 강남구 테헤란로 123",
    "category": "한식",
    "walk_min": 5,
    "solo_ok": true
  }'
```

#### 7.3 server.js를 통한 테스트

```bash
# 서버 실행
npm start

# 다른 터미널에서 테스트
curl -X GET "http://localhost:4000/lunch/places"
```

## 문제 해결

### 1. 인증 오류 (401)

- `API_KEY` 스크립트 속성이 올바르게 설정되었는지 확인
- server.js의 `LUNCH_API_KEY`와 Apps Script의 `API_KEY`가 동일한지 확인

### 2. CORS 오류

- Apps Script 배포 설정에서 "액세스 권한"이 "모든 사용자"로 설정되었는지 확인
- 웹 앱 URL이 올바른지 확인

### 3. 데이터가 저장되지 않음

- Google Sheets의 시트 이름이 정확한지 확인 (`places`, `reviews`, `reco_logs`)
- 헤더가 올바르게 설정되었는지 확인

### 4. LLM 추천이 작동하지 않음

- `PERPLEXITY_API_KEY` 스크립트 속성이 설정되었는지 확인
- API 키가 유효한지 확인
- LLM 호출 실패 시 자동으로 규칙 기반 추천으로 폴백됨

## 유지보수

### Apps Script 코드 업데이트

1. Apps Script 편집기에서 코드 수정
2. **배포** > **배포 관리** 클릭
3. 기존 배포의 **편집** 아이콘 클릭
4. **버전**: **새 버전**
5. **배포** 버튼 클릭

### 데이터 백업

정기적으로 Google Sheets를 복사하여 백업:

1. 파일 > 사본 만들기
2. 백업 날짜를 포함한 이름으로 저장 (예: "점심 추천 DB 백업 2025-01-21")

## 보안 고려사항

1. **API 키 관리**:
   - `LUNCH_API_KEY`는 절대 공개 저장소에 커밋하지 마세요
   - 정기적으로 API 키를 변경하세요

2. **액세스 제어**:
   - Google Sheets의 공유 설정을 "링크가 있는 사용자"로 제한
   - Apps Script는 "모든 사용자" 접근이 필요하지만, x-api-key로 인증됨

3. **데이터 검증**:
   - Apps Script 코드에서 입력 데이터를 검증
   - SQL 인젝션 등의 공격에 주의

## 참고 자료

- [Google Apps Script 공식 문서](https://developers.google.com/apps-script)
- [Perplexity API 문서](https://docs.perplexity.ai/)
- [API_SPEC.md](../../API_SPEC.md)

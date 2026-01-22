# 점심 추천 서비스 API 스펙

## 기본 정보

- **Base URL**: `https://myteamdashboard.onrender.com` (레포지토리 1)
- **인증**: Apps Script 호출 시 `x-api-key` 헤더 필요
- **Content-Type**: `application/json`

## 엔드포인트 목록

### 1. GET /lunch/places

장소 목록 조회

**요청**
```
GET /lunch/places
```

**응답**
```json
{
  "success": true,
  "data": [
    {
      "place_id": "place_123",
      "name": "맛있는 식당",
      "address_text": "서울시 강남구 테헤란로 123",
      "naver_map_url": "https://map.naver.com/...",
      "category": "한식",
      "price_level": "중",
      "tags": "혼밥,가성비",
      "walk_min": 5,
      "solo_ok": true,
      "group_ok": true,
      "indoor_ok": true,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

**에러 응답**
```json
{
  "success": false,
  "error": "에러 메시지"
}
```

---

### 2. POST /lunch/places

새 장소 등록

**요청**
```json
{
  "name": "맛있는 식당",
  "address_text": "서울시 강남구 테헤란로 123",
  "naver_map_url": "https://map.naver.com/...",
  "category": "한식",
  "price_level": "중",
  "tags": "혼밥,가성비",
  "walk_min": 5,
  "solo_ok": true,
  "group_ok": true,
  "indoor_ok": true
}
```

**응답**
```json
{
  "success": true,
  "data": {
    "place_id": "place_123",
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

### 3. POST /lunch/reviews

리뷰 등록

**요청**
```json
{
  "place_id": "place_123",
  "verdict": "good",
  "reasons": "맛있고 가성비 좋음",
  "comment": "다음에 또 올 것 같아요"
}
```

**응답**
```json
{
  "success": true,
  "data": {
    "review_id": "review_456",
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

**verdict 값**: `"good"` | `"bad"` | `"neutral"`

---

### 4. POST /lunch/recommend

점심 추천 요청

**요청**
```json
{
  "text": "가까운 곳에서 혼밥 가능한 곳",
  "preset": ["solo_ok"],
  "exclude": ["place_id_1", "place_id_2"]
}
```

**필드 설명**:
- `text` (필수): 자연어 요청 텍스트
- `preset` (선택): 프리셋 배열 (예: `["solo_ok", "indoor_ok"]`)
- `exclude` (선택): 제외할 place_id 배열

**응답**
```json
{
  "success": true,
  "data": [
    {
      "place_id": "place_123",
      "name": "맛있는 식당",
      "address_text": "서울시 강남구 테헤란로 123",
      "naver_map_url": "https://map.naver.com/...",
      "category": "한식",
      "price_level": "중",
      "tags": "혼밥,가성비",
      "walk_min": 5,
      "reason": "혼밥하기 좋고 가까운 위치"
    },
    {
      "place_id": "place_456",
      "name": "좋은 식당",
      "reason": "가성비 좋고 맛있는 메뉴"
    },
    {
      "place_id": "place_789",
      "name": "편한 식당",
      "reason": "조용하고 편안한 분위기"
    }
  ]
}
```

**에러 응답**
```json
{
  "success": false,
  "error": "추천 결과를 찾을 수 없습니다"
}
```

---

## 카카오톡봇 명령어

### /점심 [자연어 요청]

점심 추천 요청

**예시**:
- `/점심 가까운 곳에서 혼밥 가능한 곳`
- `/점심 단체로 갈 수 있는 곳`
- `/추천 실내에서 먹을 수 있는 곳` (별칭)

**응답 형식**: 카톡 메시지로 포맷팅된 추천 결과 + 웹페이지 링크

---

## 프리셋 값

- `solo_ok`: 혼밥 가능
- `group_ok`: 단체 가능
- `indoor_ok`: 실내 가능

---

## 에러 코드

- `400`: 잘못된 요청
- `401`: 인증 실패 (x-api-key 불일치)
- `500`: 서버 오류
